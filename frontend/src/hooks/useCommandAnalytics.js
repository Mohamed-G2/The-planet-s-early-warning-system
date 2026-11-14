import { useMemo } from 'react';
import { computeBiomassAndCO2 } from '../services/telemetryService';

export const FEATURE_META = {
  raw_modis: { label: 'MODIS Count', color: '#38BDF8' },
  modis_night_fire_ratio: { label: 'Night Fire Ratio', color: '#A78BFA' },
  modis_frp_sum: { label: 'Total FRP', color: '#FB923C' },
  lat_bin: { label: 'Latitude', color: '#34D399' },
  modis_frp_p90: { label: 'FRP P90', color: '#FBBF24' },
  lon_bin: { label: 'Longitude', color: '#60A5FA' },
  sin_month: { label: 'Season Phase', color: '#F472B6' },
  modis_brightness_mean: { label: 'Brightness (K)', color: '#E879F9' },
  cos_month: { label: 'Season Amplitude', color: '#94A3B8' },
};

/**
 * Shared analytics derivations for the Command Deck
 * (KPIs, Nocturnal Risk, Wooster Carbon Impact, anomaly z-scores, TreeSHAP ranking).
 */
export function useCommandAnalytics({ countryTelemetry, aoiResult, selectedHotspot }) {
  const monthlySeries = useMemo(() => {
    if (aoiResult?.monthly_series?.length > 0) return aoiResult.monthly_series;
    return countryTelemetry?.monthly || [];
  }, [aoiResult, countryTelemetry]);

  const kpiStats = useMemo(() => {
    if (aoiResult?.summary) {
      const s = aoiResult.summary;
      return {
        rawModis: Number(s.raw_modis || 0),
        rawViirs: Number(s.raw_viirs || 0),
        harmonizedLow: Number(s.harmonized_low || 0),
        harmonized: Number(s.harmonized || 0),
        harmonizedHigh: Number(s.harmonized_high || 0),
        frpMw: Number(s.frp_mw || 0),
        maxFrpP90: Number(s.max_frp_p90 || 0),
        nightFireRatio: Number(s.night_fire_ratio || 0),
        anomalyMonths: monthlySeries.filter((m) => m.is_anomaly).length,
        anomalyCells: Number(s.anomaly_cells || 0),
      };
    }

    const t = countryTelemetry?.totals || {};
    const avgNight =
      monthlySeries.length > 0
        ? monthlySeries.reduce((acc, m) => acc + Number(m.night_fire_ratio || 0), 0) / monthlySeries.length
        : 0.25;
    const peakP90 =
      monthlySeries.length > 0 ? Math.max(...monthlySeries.map((m) => Number(m.frp_p90 || 0))) : 50;

    return {
      rawModis: Number(t.raw_modis || 0),
      rawViirs: Number(t.raw_viirs || 0),
      harmonizedLow: Number(t.harmonized_low || 0),
      harmonized: Number(t.harmonized || 0),
      harmonizedHigh: Number(t.harmonized_high || 0),
      frpMw: Number(t.frp_mw || 0),
      maxFrpP90: peakP90,
      nightFireRatio: avgNight,
      anomalyMonths: Number(t.total_anomaly_months || 0),
      anomalyCells: Number(t.total_grid_anomaly_cells || 0),
    };
  }, [aoiResult, countryTelemetry, monthlySeries]);

  const nocturnal = useMemo(() => {
    const activeNightRatio = selectedHotspot
      ? Number(selectedHotspot.night_fire_ratio || 0)
      : kpiStats.nightFireRatio;

    const allCountryMonths = countryTelemetry?.monthly || [];
    const baselineNightRatio =
      allCountryMonths.length > 0
        ? allCountryMonths.reduce((s, m) => s + Number(m.night_fire_ratio || 0), 0) / allCountryMonths.length
        : 0.22;

    const nightRatioAnom = activeNightRatio - baselineNightRatio;
    const level =
      activeNightRatio >= 0.32 || nightRatioAnom >= 0.08
        ? 'critical'
        : activeNightRatio >= 0.22 || nightRatioAnom >= 0.03
        ? 'elevated'
        : 'nominal';
    const shapNightPct = Number(countryTelemetry?.shap_drivers?.modis_night_fire_ratio || 8.5);

    return {
      activeNightRatio,
      baselineNightRatio,
      nightRatioAnom,
      level,
      isRedAlert: level === 'critical',
      shapNightPct,
    };
  }, [selectedHotspot, kpiStats, countryTelemetry]);

  const biomass = useMemo(() => computeBiomassAndCO2(kpiStats.frpMw), [kpiStats.frpMw]);

  const anomalySeries = useMemo(() => {
    const allMonths = countryTelemetry?.monthly || [];
    const byCalMonth = {};
    for (let m = 1; m <= 12; m++) byCalMonth[m] = [];
    for (const rec of allMonths) {
      const m = Number(rec.month);
      if (byCalMonth[m]) byCalMonth[m].push(Number(rec.harmonized || 0));
    }

    const statsByMonth = {};
    for (let m = 1; m <= 12; m++) {
      const arr = byCalMonth[m];
      const mean = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 1;
      const variance =
        arr.length > 1
          ? arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length
          : Math.pow(mean * 0.35, 2);
      statsByMonth[m] = { mean, std: Math.max(Math.sqrt(variance), 1) };
    }

    return monthlySeries.map((rec) => {
      const m = Number(rec.month);
      const val = Number(rec.harmonized || 0);
      const { mean, std } = statsByMonth[m] || { mean: 1, std: 1 };
      return {
        ...rec,
        period: rec.period || `${rec.year}-${String(rec.month).padStart(2, '0')}`,
        pctDeviation: Number((mean > 0 ? ((val - mean) / mean) * 100 : 0).toFixed(1)),
        harmonized_z: Number(((val - mean) / std).toFixed(2)),
      };
    });
  }, [monthlySeries, countryTelemetry]);

  const shapRanked = useMemo(() => {
    const rawMap = aoiResult?.shap_drivers || countryTelemetry?.shap_drivers || {};
    return Object.entries(rawMap)
      .map(([feature, pct]) => ({
        feature,
        label: FEATURE_META[feature]?.label || feature,
        color: FEATURE_META[feature]?.color || '#38BDF8',
        attribution_pct: Number(pct || 0),
      }))
      .sort((a, b) => b.attribution_pct - a.attribution_pct);
  }, [aoiResult, countryTelemetry]);

  return { monthlySeries, kpiStats, nocturnal, biomass, anomalySeries, shapRanked };
}

