import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Sparkles, Flame } from 'lucide-react';
import {
  getRegionMeta,
  getPaletteColor,
} from '../services/telemetryService';
import {
  SpotlightCard,
  CardHeader,
  SegmentedControl,
  Reveal,
  SPRING,
} from './ui/primitives';

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const SENSOR_MODES = [
  { id: 'harmonized', label: 'AI Harmonized' },
  { id: 'raw_modis', label: 'Raw MODIS' },
  { id: 'raw_viirs', label: 'Raw VIIRS' },
];

export default function BurningCalendar({
  selectedCountry = 'USA',
  countryTelemetry,
  selectedPalette = 'Ember',
  onSelectYearMonth,
}) {
  const [sensorMode, setSensorMode] = useState('harmonized');
  const [activeCell, setActiveCell] = useState(null);

  const activeMeta = getRegionMeta(selectedCountry, countryTelemetry);
  const benchmarkYears = countryTelemetry?.benchmark_years || activeMeta.benchmarkYears;
  const monthlySeries = countryTelemetry?.monthly || [];

  const { matrixByYear, monthBaselines, maxValue } = useMemo(() => {
    const byYear = {};
    const monthTotals = {};
    const monthCounts = {};

    for (const yr of benchmarkYears) {
      byYear[yr] = {};
    }

    let maxVal = 1;

    for (const rec of monthlySeries) {
      const yr = Number(rec.year);
      const mo = Number(rec.month);
      if (!byYear[yr]) byYear[yr] = {};
      byYear[yr][mo] = rec;

      const val = Number(rec[sensorMode] || 0);
      if (val > maxVal) maxVal = val;

      monthTotals[mo] = (monthTotals[mo] || 0) + val;
      monthCounts[mo] = (monthCounts[mo] || 0) + 1;
    }

    const baselines = {};
    for (let m = 1; m <= 12; m++) {
      baselines[m] = monthCounts[m] ? monthTotals[m] / monthCounts[m] : 1;
    }

    return {
      matrixByYear: byYear,
      monthBaselines: baselines,
      maxValue: maxVal,
    };
  }, [benchmarkYears, monthlySeries, sensorMode]);

  const inspected = useMemo(() => {
    if (activeCell && matrixByYear[activeCell.year]?.[activeCell.month]) {
      return matrixByYear[activeCell.year][activeCell.month];
    }
    if (!monthlySeries.length) return null;
    return [...monthlySeries].sort((a, b) => Number(b.harmonized || 0) - Number(a.harmonized || 0))[0];
  }, [activeCell, matrixByYear, monthlySeries]);

  const inspectedBaseline = inspected ? monthBaselines[inspected.month] || 1 : 1;
  const inspectedVal = inspected ? Number(inspected[sensorMode] || 0) : 0;
  const inspectedPctDev =
    inspectedBaseline > 0 ? ((inspectedVal - inspectedBaseline) / inspectedBaseline) * 100 : 0;

  return (
    <Reveal as="section" id="burning-calendar" aria-label="Burning Calendar" y={28}>
      <SpotlightCard glow="#FBBF24" className="overflow-hidden divide-y divide-white/[0.06]">
        {/* Crisp Single-Line Header */}
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <CardHeader
            icon={Calendar}
            iconColor="text-amber-300"
            title="Burning Calendar"
            info="Seasonal fire activity matrix across benchmark years. Pre-VIIRS years (2005, 2010, 2012) are AI reconstructed to 375m VIIRS scale via LightGBM Quantile Regression."
          />

          <SegmentedControl
            options={SENSOR_MODES}
            value={sensorMode}
            onChange={setSensorMode}
            layoutId="calendar-sensor"
            size="sm"
            accent="rgba(251, 191, 36, 0.16)"
            accentBorder="rgba(251, 191, 36, 0.4)"
          />
        </div>

        {/* Heatmap Matrix */}
        <div className="p-6 overflow-x-auto">
          <div className="min-w-[820px] space-y-2">
            <div className="grid grid-cols-[152px_repeat(12,minmax(50px,1fr))_88px] gap-1.5 items-center font-mono text-[10.5px] uppercase tracking-widest text-slate-500 pb-1">
              <div className="pl-2">Year</div>
              {MONTH_LABELS.map((mLabel) => (
                <div key={mLabel} className="text-center">
                  {mLabel}
                </div>
              ))}
              <div className="text-right pr-2">Total</div>
            </div>

            {benchmarkYears.map((yr) => {
              const isReconstructed = yr === 2005 || yr === 2010 || yr === 2012;
              const rowRecords = matrixByYear[yr] || {};
              const rowTotal = Object.values(rowRecords).reduce(
                (s, r) => s + Number(r?.[sensorMode] || 0),
                0
              );

              return (
                <div
                  key={yr}
                  className="grid grid-cols-[152px_repeat(12,minmax(50px,1fr))_88px] gap-1.5 items-center py-0.5"
                >
                  <div className="pl-2 flex items-center gap-2 whitespace-nowrap">
                    <span className="font-mono text-[13.5px] font-semibold text-white tabular-nums">
                      {yr}
                    </span>
                    {isReconstructed && (
                      <span
                        title="Pre-VIIRS era reconstructed to 375m VIIRS scale"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-sky-400/10 text-sky-300 border border-sky-400/30"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        AI Recon
                      </span>
                    )}
                  </div>

                  {MONTH_LABELS.map((_, idx) => {
                    const mo = idx + 1;
                    const cell = rowRecords[mo];
                    const val = Number(cell?.[sensorMode] || 0);
                    const norm = maxValue > 0 ? Math.min(1, Math.pow(val / maxValue, 0.58)) : 0;
                    const bgColor =
                      val > 0
                        ? getPaletteColor(selectedPalette, norm, 0.9)
                        : 'rgba(255, 255, 255, 0.025)';
                    const textColor = norm > 0.62 ? '#020408' : '#F8FAFC';

                    const baseline = monthBaselines[mo] || 1;
                    const pctDev = baseline > 0 ? ((val - baseline) / baseline) * 100 : 0;

                    const isInspected =
                      inspected && Number(inspected.year) === yr && Number(inspected.month) === mo;

                    return (
                      <motion.button
                        key={`${yr}-${mo}`}
                        type="button"
                        whileHover={{ scale: 1.07, zIndex: 20 }}
                        whileTap={{ scale: 0.96 }}
                        transition={SPRING}
                        onMouseEnter={() => setActiveCell({ year: yr, month: mo })}
                        onClick={() => {
                          setActiveCell({ year: yr, month: mo });
                          if (onSelectYearMonth) onSelectYearMonth(yr, mo);
                        }}
                        style={{
                          backgroundColor: bgColor,
                          color: textColor,
                        }}
                        className={`h-11 rounded-xl font-mono text-[11px] font-semibold flex flex-col items-center justify-center relative tabular-nums ${
                          isInspected
                            ? 'ring-2 ring-white/90 shadow-[0_0_20px_rgba(255,255,255,0.28)] z-10'
                            : 'border border-white/[0.06]'
                        }`}
                      >
                        <span>
                          {val >= 1000
                            ? `${(val / 1000).toFixed(val >= 10000 ? 0 : 1)}k`
                            : Math.round(val)}
                        </span>
                        <span
                          className="text-[8.5px] opacity-80 font-normal"
                          style={{ color: norm > 0.62 ? '#0F172A' : '#CBD5E1' }}
                        >
                          {pctDev >= 0 ? `+${Math.round(pctDev)}%` : `${Math.round(pctDev)}%`}
                        </span>

                        {cell?.is_anomaly && (
                          <span
                            className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-500 ring-1 ring-white/90"
                            title="Anomaly Surge Month"
                          />
                        )}
                      </motion.button>
                    );
                  })}

                  <div className="text-right pr-2 font-mono text-xs font-semibold text-amber-200 tabular-nums whitespace-nowrap">
                    {rowTotal >= 1000000
                      ? `${(rowTotal / 1000000).toFixed(2)}M`
                      : rowTotal >= 1000
                      ? `${(rowTotal / 1000).toFixed(0)}k`
                      : Math.round(rowTotal)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating Glass Cell Telemetry Bar */}
        <AnimatePresence mode="wait">
          {inspected && (
            <motion.div
              key={`${selectedCountry}-${inspected.period}-${sensorMode}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="px-6 py-3.5 bg-white/[0.02] flex flex-wrap items-center justify-between gap-4 font-mono text-xs tabular-nums"
            >
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-white font-semibold flex items-center gap-2 whitespace-nowrap">
                  <Flame className="w-3.5 h-3.5 text-amber-300" />
                  {selectedCountry} · {inspected.period}
                </span>
                <span className="text-slate-400 whitespace-nowrap">
                  Q50 <strong className="text-amber-200">{Number(inspected.harmonized).toLocaleString('en-US')}</strong>{' '}
                  <span className="text-slate-500">
                    [{Number(inspected.harmonized_low).toLocaleString('en-US')}–{Number(inspected.harmonized_high).toLocaleString('en-US')}]
                  </span>
                </span>
                <span className="text-slate-400 whitespace-nowrap">
                  Baseline{' '}
                  <strong className={inspectedPctDev >= 25 ? 'text-rose-400' : 'text-sky-300'}>
                    {inspectedPctDev >= 0 ? `+${inspectedPctDev.toFixed(1)}%` : `${inspectedPctDev.toFixed(1)}%`}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-4 text-[11px] text-slate-400 whitespace-nowrap">
                <span>
                  MODIS / VIIRS{' '}
                  <strong className="text-sky-300">
                    {Number(inspected.raw_modis).toLocaleString('en-US')} / {Number(inspected.raw_viirs).toLocaleString('en-US')}
                  </strong>
                </span>
                <span>
                  FRP <strong className="text-orange-300">{Number(inspected.frp_mw).toLocaleString('en-US')} MW</strong>
                </span>
                <span>
                  Night <strong className="text-violet-300">{(Number(inspected.night_fire_ratio) * 100).toFixed(1)}%</strong>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SpotlightCard>
    </Reveal>
  );
}
