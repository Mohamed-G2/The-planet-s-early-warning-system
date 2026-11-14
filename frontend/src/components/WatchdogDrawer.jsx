import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileText,
  ShieldAlert,
  Download,
  Check,
  Printer,
  Flame,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  getRegionMeta,
  AUDIENCE_BRIEFINGS,
  computeBiomassAndCO2,
  subscribeWatchdog,
  exportTelemetryCSV,
  MEGAFIRE_PRESETS,
} from '../services/telemetryService';
import {
  CardHeader,
  SegmentedControl,
  SPRING,
} from './ui/primitives';

const DRAWER_TABS = [
  { id: 'sitrep', label: 'Mission SitRep' },
  { id: 'watchdog', label: '24/7 Watchdog' },
  { id: 'export', label: 'Export CSV' },
];

export default function WatchdogDrawer({
  isOpen = false,
  activeTab = 'sitrep',
  onChangeTab,
  onClose,
  selectedCountry = 'USA',
  countryTelemetry,
  aoiResult,
  aoiBbox,
  selectedAudience = 'Scientists',
  yearFrom,
  yearTo,
  selectedMonth = 'ALL',
  onTriggerPreset,
  onOpenIngest,
}) {
  const [email, setEmail] = useState('ops-dispatch@nasa-firms-harm.org');
  const [frpThreshold, setFrpThreshold] = useState(500);
  const [sevThreshold, setSevThreshold] = useState(0.65);
  const [subscribing, setSubscribing] = useState(false);
  const [watchdogResponse, setWatchdogResponse] = useState(null);

  const [anomaliesOnly, setAnomaliesOnly] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);

  const activeMeta = getRegionMeta(selectedCountry, countryTelemetry);
  const audienceBrief =
    AUDIENCE_BRIEFINGS[selectedAudience] || AUDIENCE_BRIEFINGS.Scientists;

  const totals = aoiResult?.summary || countryTelemetry?.totals || {};
  const harmonized = Number(totals.harmonized || 0);
  const harmonizedLow = Number(totals.harmonized_low || 0);
  const harmonizedHigh = Number(totals.harmonized_high || 0);
  const rawModis = Number(totals.raw_modis || 0);
  const rawViirs = Number(totals.raw_viirs || 0);
  const frpMw = Number(totals.frp_mw || 0);
  const maxFrpP90 = Number(
    totals.max_frp_p90 ||
      countryTelemetry?.top_active_hotspots?.[0]?.frp_p90 ||
      59.66
  );
  const nightRatio = Number(
    totals.night_fire_ratio ||
      countryTelemetry?.top_active_hotspots?.[0]?.night_fire_ratio ||
      0.28
  );
  const anomalyCells = Number(
    totals.anomaly_cells ?? totals.total_grid_anomaly_cells ?? 0
  );
  const isAnomaly = anomalyCells > 0 || Boolean(totals.is_anomaly);

  const biomassStats = computeBiomassAndCO2(frpMw);
  const bbox = aoiBbox || activeMeta.bbox;

  const handleWatchdogSubmit = async (e) => {
    e.preventDefault();
    setSubscribing(true);
    try {
      const res = await subscribeWatchdog({
        country: selectedCountry,
        email,
        lat_min: bbox.lat_min,
        lat_max: bbox.lat_max,
        lon_min: bbox.lon_min,
        lon_max: bbox.lon_max,
        frp_threshold_mw: Number(frpThreshold),
        anomaly_severity_threshold: Number(sevThreshold),
        notify_on_anomaly: true,
      });
      setWatchdogResponse(res);
    } finally {
      setSubscribing(false);
    }
  };

  const handleSimulateAlexandroupolis = async () => {
    const greecePreset = MEGAFIRE_PRESETS[0];
    if (onTriggerPreset && greecePreset) {
      onTriggerPreset(greecePreset);
    }
    setSubscribing(true);
    try {
      const res = await subscribeWatchdog({
        country: 'Greece',
        email: email || 'hellas-civil-protection@nasa-firms.org',
        lat_min: 40.0,
        lat_max: 41.8,
        lon_min: 25.0,
        lon_max: 27.0,
        frp_threshold_mw: 500,
        anomaly_severity_threshold: 0.65,
        notify_on_anomaly: true,
      });
      setWatchdogResponse({
        ...res,
        simulatedEvent: 'Aug 2023 Alexandroupolis Megafire (41.0°N, 26.0°E · 43,268.54 MW FRP)',
      });
    } finally {
      setSubscribing(false);
    }
  };

  const handleCSVExport = async () => {
    setExportStatus('exporting');
    const res = await exportTelemetryCSV({
      country: selectedCountry,
      min_lat: bbox.lat_min,
      max_lat: bbox.lat_max,
      min_lon: bbox.lon_min,
      max_lon: bbox.lon_max,
      year_start: yearFrom,
      year_end: yearTo,
      month: selectedMonth,
      anomalies_only: anomaliesOnly,
    });
    setExportStatus(res?.filename || 'exported');
    setTimeout(() => setExportStatus(null), 3500);
  };

  const handleDownloadSitRepFile = () => {
    const sitrepText = [
      '========================================================================',
      'EAGLES OF HORUS · NASA FIRMS TACTICAL SITUATION REPORT (SITREP)',
      '========================================================================',
      `Generated UTC     : ${new Date().toISOString()}`,
      `Target Basin      : ${selectedCountry}`,
      `AOI Bounding Box  : [${Number(bbox.lat_min).toFixed(2)}°N, ${Number(bbox.lon_min).toFixed(2)}°E] to [${Number(bbox.lat_max).toFixed(2)}°N, ${Number(bbox.lon_max).toFixed(2)}°E]`,
      `Temporal Window   : ${yearFrom || activeMeta.benchmarkYears[0]} – ${yearTo || activeMeta.benchmarkYears[activeMeta.benchmarkYears.length - 1]} (Month: ${selectedMonth})`,
      `Target Role       : ${selectedAudience}`,
      '------------------------------------------------------------------------',
      '1. CROSS-SENSOR QUANTILE HARMONIZATION TELEMETRY',
      `   - AI Harmonized Detections (Q50) : ${Math.round(harmonized).toLocaleString('en-US')}`,
      `   - 80% Confidence Interval        : [${Math.round(harmonizedLow).toLocaleString('en-US')} – ${Math.round(harmonizedHigh).toLocaleString('en-US')}]`,
      `   - Cleaned MODIS (1km Terra/Aqua) : ${rawModis.toLocaleString('en-US')}`,
      `   - Cleaned VIIRS (375m S-NPP/N20) : ${rawViirs.toLocaleString('en-US')}`,
      '------------------------------------------------------------------------',
      '2. RADIATIVE INTENSITY, NOCTURNAL RETENTION & ANOMALY',
      `   - Anomaly Status                 : ${isAnomaly ? 'ACTIVE SURGE DETECTED' : 'NOMINAL'}`,
      `   - Flagged 0.5° Anomaly Cells     : ${anomalyCells.toLocaleString('en-US')}`,
      `   - Cumulative Radiative Power     : ${frpMw.toLocaleString('en-US')} MW`,
      `   - 90th Percentile Intensity P90  : ${maxFrpP90.toFixed(2)} MW`,
      `   - Nocturnal Fire Ratio (N)       : ${(nightRatio * 100).toFixed(1)}%`,
      '------------------------------------------------------------------------',
      '3. WOOSTER BIOMASS COMBUSTION & CO2 EQUIVALENT IMPACT',
      `   - Fire Radiative Energy (FRE)    : ${biomassStats.radiativeEnergyTJ.toFixed(2)} TJ`,
      `   - Est. Dry Biomass Combusted     : ${Math.round(biomassStats.biomassMetricTons).toLocaleString('en-US')} Metric Tons`,
      `   - Est. CO2 Equivalent Emissions  : ${Math.round(biomassStats.co2MetricTons).toLocaleString('en-US')} Metric Tons CO2e`,
      '------------------------------------------------------------------------',
      `4. TACTICAL RECOMMENDATION FOR ${selectedAudience.toUpperCase()}`,
      `   - Focus Metric : ${audienceBrief.focusMetric}`,
      `   - Action Plan  : ${audienceBrief.actionProtocol}`,
      '========================================================================',
    ].join('\n');

    const blob = new Blob([sitrepText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EaglesOfHorus_SitRep_${selectedCountry}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Frosted Slide-Over Drawer */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[9990] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={onClose}
              className="fixed inset-0 z-[9990] bg-black/75 backdrop-blur-md"
            />

            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={SPRING}
              className="fixed inset-y-0 right-0 z-[9999] w-full max-w-xl h-full bg-[#060912]/95 backdrop-blur-2xl border-l border-white/[0.09] shadow-[0_0_90px_rgba(0,0,0,0.9)] flex flex-col justify-between overflow-y-auto"
            >
              <div>
                <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between sticky top-0 bg-[#060912]/90 backdrop-blur-2xl z-20">
                  <div className="flex items-center gap-2.5 whitespace-nowrap">
                    <span className="font-sans text-base font-semibold tracking-tight text-white">
                      {selectedCountry}
                    </span>
                    <span className="text-white/20">·</span>
                    <span className="font-mono text-xs text-sky-300">{selectedAudience}</span>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close drawer"
                    className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-6 py-3.5 border-b border-white/[0.07]">
                  <SegmentedControl
                    options={DRAWER_TABS}
                    value={activeTab}
                    onChange={(tabId) => onChangeTab && onChangeTab(tabId, true)}
                    layoutId="drawer-tab"
                    size="sm"
                    accent="rgba(56, 189, 248, 0.16)"
                    accentBorder="rgba(56, 189, 248, 0.38)"
                    className="w-full justify-between"
                  />
                </div>

                {/* TAB 1: Mission SitRep */}
                {activeTab === 'sitrep' && (
                  <div className="p-6 space-y-5">
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.07] space-y-4 font-mono text-xs tabular-nums">
                      <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
                        <span className="eyebrow !text-amber-200">Executive SitRep</span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] border ${
                            isAnomaly
                              ? 'bg-rose-500/15 text-rose-300 border-rose-400/35'
                              : 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35'
                          }`}
                        >
                          {isAnomaly ? 'ANOMALY SURGE' : 'NOMINAL'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5 text-[11px]">
                        <div>
                          <span className="text-slate-500 block">Basin</span>
                          <strong className="text-white">{selectedCountry}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">AOI Bounds</span>
                          <strong className="text-sky-300">
                            [{Number(bbox.lat_min).toFixed(1)}°, {Number(bbox.lon_min).toFixed(1)}°] → [
                            {Number(bbox.lat_max).toFixed(1)}°, {Number(bbox.lon_max).toFixed(1)}°]
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Harmonized Q50</span>
                          <strong className="text-emerald-300">
                            {Math.round(harmonized).toLocaleString('en-US')}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">FRP P90</span>
                          <strong className="text-amber-200">{maxFrpP90.toFixed(1)} MW</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Biomass Burned</span>
                          <strong className="text-orange-300">
                            {Math.round(biomassStats.biomassMetricTons).toLocaleString('en-US')} t
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">CO₂ Emissions</span>
                          <strong className="text-rose-300">
                            {Math.round(biomassStats.co2MetricTons).toLocaleString('en-US')} t
                          </strong>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-white/[0.07] font-sans text-xs text-slate-300 leading-relaxed">
                        {audienceBrief.actionProtocol}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleDownloadSitRepFile}
                        className="flex-1 py-2.5 px-4 rounded-full bg-gradient-to-b from-amber-200 to-amber-400 font-sans text-xs font-semibold text-[#1a0f02] whitespace-nowrap flex items-center justify-center gap-2 shadow-[0_0_24px_-6px_rgba(251,191,36,0.65)] transition-transform active:scale-[0.98]"
                      >
                        <Download className="w-3.5 h-3.5" strokeWidth={2.2} />
                        <span>Download SitRep</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="py-2.5 px-4 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] font-sans text-xs font-medium text-slate-200 whitespace-nowrap flex items-center justify-center gap-2 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5 text-sky-300" />
                        <span>Print</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 2: 24/7 Watchdog */}
                {activeTab === 'watchdog' && (
                  <div className="p-6 space-y-5">
                    <div className="p-4 rounded-2xl bg-rose-500/[0.07] border border-rose-400/25 space-y-3">
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className="font-semibold text-rose-200 flex items-center gap-2">
                          <Flame className="w-4 h-4 text-rose-400" />
                          Alexandroupolis Test Alert
                        </span>
                        <span className="text-amber-200 tabular-nums">41.0°N, 26.0°E</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleSimulateAlexandroupolis}
                        disabled={subscribing}
                        className="w-full py-2.5 px-4 rounded-full bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 font-mono text-xs font-semibold text-rose-100 whitespace-nowrap flex items-center justify-center gap-2 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>{subscribing ? 'Simulating…' : 'Trigger Aug 2023 Alert'}</span>
                      </button>
                    </div>

                    <form onSubmit={handleWatchdogSubmit} className="space-y-4 font-mono text-xs">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">
                          Dispatch Endpoint
                        </label>
                        <input lang="en"
                          type="text"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="glass-input"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">
                            FRP Threshold (MW)
                          </label>
                          <input
                            lang="en"
                            dir="ltr"
                            type="text"
                            inputMode="decimal"
                            value={frpThreshold}
                            onChange={(e) => setFrpThreshold(e.target.value)}
                            className="glass-input"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">
                            Severity (0–1)
                          </label>
                          <input
                            lang="en"
                            dir="ltr"
                            type="text"
                            inputMode="decimal"
                            value={sevThreshold}
                            onChange={(e) => setSevThreshold(e.target.value)}
                            className="glass-input"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={subscribing}
                        className="w-full py-2.5 px-4 rounded-full bg-sky-400/18 hover:bg-sky-400/28 border border-sky-400/40 font-sans text-xs font-semibold text-sky-100 whitespace-nowrap transition-colors"
                      >
                        {subscribing ? 'Registering…' : `Subscribe AOI (${selectedCountry})`}
                      </button>
                    </form>

                    {watchdogResponse && (
                      <div className="p-4 rounded-2xl bg-emerald-500/[0.06] border border-emerald-400/25 space-y-2.5 font-mono text-xs tabular-nums">
                        <div className="flex items-center justify-between text-emerald-300 font-semibold">
                          <span>ID: {watchdogResponse.subscription?.subscription_id}</span>
                          <span>
                            {watchdogResponse.subscription?.initial_evaluation?.alert_triggered
                              ? 'ALERT TRIGGERED'
                              : 'ACTIVE'}
                          </span>
                        </div>

                        <div className="space-y-1 text-[11px] text-slate-300">
                          {(
                            watchdogResponse.subscription?.initial_evaluation
                              ?.matching_anomalies_preview || []
                          ).map((m, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between py-1.5 border-b border-white/[0.06] last:border-b-0"
                            >
                              <span>
                                {m.country} [{Number(m.lat_bin).toFixed(1)}°, {Number(m.lon_bin).toFixed(1)}°]
                              </span>
                              <span className="text-amber-200">
                                {Number(m.frp_mw).toLocaleString('en-US')} MW
                              </span>
                              <span className="text-rose-400">
                                Sev {Number(m.anomaly_severity).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: Export CSV */}
                {activeTab === 'export' && (
                  <div className="p-6 space-y-5 font-mono text-xs">
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.07] space-y-3 tabular-nums">
                      <div className="eyebrow !text-sky-300">13-Column Telemetry CSV</div>

                      <div className="space-y-1.5 text-[11px] text-slate-300">
                        <div>
                          Basin: <strong className="text-white">{selectedCountry}</strong>
                        </div>
                        <div>
                          AOI Bounds:{' '}
                          <strong className="text-sky-300">
                            [{Number(bbox.lat_min).toFixed(1)}°, {Number(bbox.lon_min).toFixed(1)}°] → [
                            {Number(bbox.lat_max).toFixed(1)}°, {Number(bbox.lon_max).toFixed(1)}°]
                          </strong>
                        </div>
                      </div>

                      <label className="pt-2 flex items-center gap-2.5 cursor-pointer text-slate-200 font-sans text-xs">
                        <input lang="en"
                          type="checkbox"
                          checked={anomaliesOnly}
                          onChange={(e) => setAnomaliesOnly(e.target.checked)}
                          className="accent-sky-400 rounded"
                        />
                        <span>Anomalies Only</span>
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={handleCSVExport}
                      className="w-full py-3 px-4 rounded-full bg-gradient-to-b from-sky-200 to-sky-400 font-sans text-xs font-semibold text-[#020408] whitespace-nowrap flex items-center justify-center gap-2 shadow-[0_0_24px_-6px_rgba(56,189,248,0.65)] transition-transform active:scale-[0.98]"
                    >
                      {exportStatus && exportStatus !== 'exporting' ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Downloaded {exportStatus}</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" strokeWidth={2.2} />
                          <span>
                            {exportStatus === 'exporting'
                              ? 'Exporting…'
                              : `Download ${selectedCountry} CSV`}
                          </span>
                        </>
                      )}
                    </button>

                    {onOpenIngest && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose && onClose();
                          onOpenIngest();
                        }}
                        className="w-full py-2.5 px-4 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/30 font-sans text-xs font-medium text-cyan-200 whitespace-nowrap flex items-center justify-center gap-2 transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5 text-cyan-300" />
                        <span>Ingest Data</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-white/[0.07] text-[10.5px] font-mono text-slate-500 flex items-center justify-between">
                <span>Eagles of Horus</span>
                <span>OOF R² 0.8833</span>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}
