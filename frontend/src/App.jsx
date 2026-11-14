import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Navbar from './components/Navbar';
import OrbitalHero3D from './components/OrbitalHero3D';
import MegafirePresets from './components/MegafirePresets';
import ControlBar from './components/ControlBar';
import TacticalMap2D from './components/TacticalMap2D';
import BurningCalendar from './components/BurningCalendar';
import AnalyticsSuite from './components/AnalyticsSuite';
import WatchdogDrawer from './components/WatchdogDrawer';
import IngestModal from './components/IngestModal';
import { SpotlightCard, Reveal } from './components/ui/primitives';
import {
  getInitialTelemetry,
  fetchTelemetrySummary,
  checkBackendHealth,
  analyzeAOI,
  REGION_METADATA,
  CUSTOM_DATASET_KEY,
  getRegionMeta,
} from './services/telemetryService';

export default function App() {
  const [activeTab, setActiveTab] = useState('globe');
  const [telemetry, setTelemetry] = useState(() => getInitialTelemetry());
  const [selectedCountry, setSelectedCountry] = useState('USA');
  const [selectedAudience, setSelectedAudience] = useState('Scientists');
  const [selectedPalette, setSelectedPalette] = useState('Ember');
  const [backendStatus, setBackendStatus] = useState({ online: false, status: 'checking' });

  const [aoiBbox, setAoiBbox] = useState(() => ({ ...REGION_METADATA.USA.bbox }));
  const [yearFrom, setYearFrom] = useState(2005);
  const [yearTo, setYearTo] = useState(2025);
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [isDrawingAOI, setIsDrawingAOI] = useState(false);

  const [aoiResult, setAoiResult] = useState(null);
  const [aoiLoading, setAoiLoading] = useState(false);
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [activePresetId, setActivePresetId] = useState(null);
  const [mapViewTarget, setMapViewTarget] = useState(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('sitrep');
  const [ingestModalOpen, setIngestModalOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    checkBackendHealth().then((health) => {
      if (mounted) setBackendStatus(health);
    });
    fetchTelemetrySummary().then((data) => {
      if (mounted && data && data.countries) {
        setTelemetry(data);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const runAOIQuery = useCallback(
    async ({ country, bbox, fromYr, toYr, month, countryDataOverride = null }) => {
      const cObj = countryDataOverride || telemetry?.countries?.[country];
      const meta = getRegionMeta(country, cObj);
      const benchYears = meta.benchmarkYears || [2023, 2024, 2025];
      const filteredYears = benchYears.filter((y) => y >= fromYr && y <= toYr);
      const monthsList = month === 'ALL' ? null : [Number(month)];

      setAoiLoading(true);
      try {
        const res = await analyzeAOI({
          country,
          min_lat: bbox.lat_min,
          max_lat: bbox.lat_max,
          min_lon: bbox.lon_min,
          max_lon: bbox.lon_max,
          years: filteredYears.length ? filteredYears : benchYears,
          months: monthsList,
          top_k_hotspots: country === CUSTOM_DATASET_KEY ? 40 : 15,
        });
        setAoiResult(res);
      } finally {
        setAoiLoading(false);
      }
    },
    [telemetry]
  );

  const handleSelectCountry = useCallback(
    (newCountry) => {
      const cObj = telemetry?.countries?.[newCountry];
      const meta = getRegionMeta(newCountry, cObj);
      const yrs = meta.benchmarkYears;
      const newBbox = { ...meta.bbox };
      const minYr = yrs[0];
      const maxYr = yrs[yrs.length - 1];

      setSelectedCountry(newCountry);
      setActivePresetId(null);
      setAoiBbox(newBbox);
      setYearFrom(minYr);
      setYearTo(maxYr);
      setSelectedMonth('ALL');
      setSelectedHotspot(null);
      setMapViewTarget({ center: meta.mapCenter, zoom: meta.mapZoom });

      runAOIQuery({
        country: newCountry,
        bbox: newBbox,
        fromYr: minYr,
        toYr: maxYr,
        month: 'ALL',
        countryDataOverride: cObj,
      });
    },
    [runAOIQuery, telemetry]
  );

  const handleIngestComplete = useCallback(
    (res) => {
      const customTelemetry = res?.country_telemetry;
      if (!customTelemetry) return;

      setTelemetry((prev) => ({
        ...(prev || {}),
        countries: {
          ...(prev?.countries || {}),
          [CUSTOM_DATASET_KEY]: customTelemetry,
        },
      }));

      const meta = getRegionMeta(CUSTOM_DATASET_KEY, customTelemetry);
      const yrs = meta.benchmarkYears;
      const newBbox = { ...meta.bbox };
      const minYr = yrs[0];
      const maxYr = yrs[yrs.length - 1];

      setSelectedCountry(CUSTOM_DATASET_KEY);
      setActivePresetId(null);
      setAoiBbox(newBbox);
      setYearFrom(minYr);
      setYearTo(maxYr);
      setSelectedMonth('ALL');
      setSelectedHotspot(null);
      setMapViewTarget({ center: meta.mapCenter, zoom: meta.mapZoom });

      runAOIQuery({
        country: CUSTOM_DATASET_KEY,
        bbox: newBbox,
        fromYr: minYr,
        toYr: maxYr,
        month: 'ALL',
        countryDataOverride: customTelemetry,
      });
    },
    [runAOIQuery]
  );

  const handleSelectPreset = useCallback(
    (preset) => {
      if (!preset) return;
      setActivePresetId(preset.id);
      setSelectedCountry(preset.country);
      setAoiBbox({ ...preset.bbox });
      setYearFrom(preset.yearFrom);
      setYearTo(preset.yearTo);
      setSelectedMonth(preset.month || 'ALL');
      setSelectedHotspot(preset.targetCell || null);
      setMapViewTarget({ center: preset.mapCenter, zoom: preset.mapZoom });

      runAOIQuery({
        country: preset.country,
        bbox: preset.bbox,
        fromYr: preset.yearFrom,
        toYr: preset.yearTo,
        month: preset.month || 'ALL',
      });
    },
    [runAOIQuery]
  );

  const handleClearPreset = useCallback(() => {
    handleSelectCountry(selectedCountry);
  }, [handleSelectCountry, selectedCountry]);

  const handleApplyAOI = useCallback(
    (newBbox) => {
      setAoiBbox(newBbox);
      setActivePresetId(null);
      const centerLat = (Number(newBbox.lat_min) + Number(newBbox.lat_max)) / 2;
      const centerLon = (Number(newBbox.lon_min) + Number(newBbox.lon_max)) / 2;
      setMapViewTarget({ center: [centerLat, centerLon], zoom: 5 });

      runAOIQuery({
        country: selectedCountry,
        bbox: newBbox,
        fromYr: yearFrom,
        toYr: yearTo,
        month: selectedMonth,
      });
    },
    [selectedCountry, yearFrom, yearTo, selectedMonth, runAOIQuery]
  );

  const handleResetAOI = useCallback(() => {
    const cObj = telemetry?.countries?.[selectedCountry];
    const meta = getRegionMeta(selectedCountry, cObj);
    const yrs = meta.benchmarkYears;
    const fullBbox = { ...meta.bbox };
    setAoiBbox(fullBbox);
    setYearFrom(yrs[0]);
    setYearTo(yrs[yrs.length - 1]);
    setSelectedMonth('ALL');
    setActivePresetId(null);
    setSelectedHotspot(null);
    setMapViewTarget({ center: meta.mapCenter, zoom: meta.mapZoom });

    runAOIQuery({
      country: selectedCountry,
      bbox: fullBbox,
      fromYr: yrs[0],
      toYr: yrs[yrs.length - 1],
      month: 'ALL',
      countryDataOverride: cObj,
    });
  }, [selectedCountry, runAOIQuery, telemetry]);

  const handleChangeYearRange = useCallback(
    (newFrom, newTo) => {
      setYearFrom(newFrom);
      setYearTo(newTo);
      runAOIQuery({
        country: selectedCountry,
        bbox: aoiBbox,
        fromYr: newFrom,
        toYr: newTo,
        month: selectedMonth,
      });
    },
    [selectedCountry, aoiBbox, selectedMonth, runAOIQuery]
  );

  const handleChangeMonth = useCallback(
    (newMonth) => {
      setSelectedMonth(newMonth);
      runAOIQuery({
        country: selectedCountry,
        bbox: aoiBbox,
        fromYr: yearFrom,
        toYr: yearTo,
        month: newMonth,
      });
    },
    [selectedCountry, aoiBbox, yearFrom, yearTo, runAOIQuery]
  );

  const handleSelectYearMonthFromCalendar = useCallback(
    (yr, mo) => {
      setYearFrom(yr);
      setYearTo(yr);
      setSelectedMonth(mo);
      runAOIQuery({
        country: selectedCountry,
        bbox: aoiBbox,
        fromYr: yr,
        toYr: yr,
        month: mo,
      });
    },
    [selectedCountry, aoiBbox, runAOIQuery]
  );

  const handleOpenDrawer = useCallback((tab = 'sitrep', open = true) => {
    setDrawerTab(tab);
    setDrawerOpen(open);
  }, []);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const TAB_ORDER = [
    { id: 'globe', label: 'Globe' },
    { id: 'map', label: 'Tactical Map' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'telemetry', label: 'Telemetry' },
  ];
  const currentTabIdx = TAB_ORDER.findIndex((t) => t.id === activeTab);
  const prevTab = currentTabIdx > 0 ? TAB_ORDER[currentTabIdx - 1] : null;
  const nextTab = currentTabIdx >= 0 && currentTabIdx < TAB_ORDER.length - 1 ? TAB_ORDER[currentTabIdx + 1] : null;

  const activeCountryData =
    telemetry?.countries?.[selectedCountry] || telemetry?.countries?.USA || {};
  const hasCustomDataset = Boolean(telemetry?.countries?.[CUSTOM_DATASET_KEY]);
  const regionAccent = getRegionMeta(selectedCountry, activeCountryData).accent || '#38BDF8';

  return (
    <div className="min-h-screen overflow-x-hidden max-w-full bg-[#020408] text-slate-100 font-sans relative selection:bg-sky-500/30 selection:text-sky-100">
      {/* Subtle film grain & ambient deep-space blooms */}
      <div aria-hidden className="noise-overlay" />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse 60% 45% at 20% 55%, rgba(56,189,248,0.06) 0%, transparent 65%), radial-gradient(ellipse 50% 40% at 85% 75%, rgba(245,158,11,0.05) 0%, transparent 65%)',
        }}
      />

      <Navbar
        activeTab={activeTab}
        onSelectTab={handleTabChange}
        onOpenDrawer={(tab) => handleOpenDrawer(tab, true)}
      />

      {activeTab === 'globe' ? (
        <OrbitalHero3D
          telemetry={telemetry}
          selectedCountry={selectedCountry}
          onSelectCountry={handleSelectCountry}
          selectedAudience={selectedAudience}
          onExploreCommandDeck={() => handleTabChange('map')}
        />
      ) : (
        <main
          id="command-deck"
          className="relative z-20 max-w-7xl mx-auto pt-28 sm:pt-24 pb-16 px-4 sm:px-8 space-y-6 sm:space-y-8"
        >
          {/* Minimal Executive Command Header */}
          <Reveal y={18} className="flex flex-wrap items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-3.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: regionAccent,
                  boxShadow: `0 0 18px ${regionAccent}`,
                }}
              />
              <h2 className="font-sans text-2xl sm:text-3xl font-bold tracking-[-0.035em] text-white whitespace-nowrap">
                {selectedCountry}
              </h2>
              <span className="h-4 w-px bg-white/[0.12]" />
              <span className="eyebrow !text-sky-300">Command Deck</span>
            </div>

            <div className="glass-pill rounded-2xl sm:rounded-full px-3 sm:px-4 py-1.5 flex flex-wrap items-center gap-2 sm:gap-3 font-mono text-[10.5px] sm:text-[11px] tabular-nums text-slate-400 max-w-full">
              <span className="flex items-center gap-1.5 text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {backendStatus.online ? 'DuckDB Live' : 'Embedded Telemetry'}
              </span>
              <span className="text-white/15">·</span>
              <span>
                AOI{' '}
                <strong className="text-slate-200">
                  [{Number(aoiBbox.lat_min).toFixed(1)}°, {Number(aoiBbox.lon_min).toFixed(1)}°] → [
                  {Number(aoiBbox.lat_max).toFixed(1)}°, {Number(aoiBbox.lon_max).toFixed(1)}°]
                </strong>
              </span>
            </div>
          </Reveal>

          {/* Unified Control Dock: Time-Machine Presets + Region / AOI / Date / Palette */}
          <Reveal y={22}>
            <SpotlightCard glow={regionAccent} className="overflow-hidden divide-y divide-white/[0.06]">
              <MegafirePresets
                activePresetId={activePresetId}
                onSelectPreset={handleSelectPreset}
                onClearPreset={handleClearPreset}
              />
              <ControlBar
                selectedCountry={selectedCountry}
                countryTelemetry={activeCountryData}
                hasCustomDataset={hasCustomDataset}
                onSelectCountry={handleSelectCountry}
                aoiBbox={aoiBbox}
                onApplyAOI={handleApplyAOI}
                onResetAOI={handleResetAOI}
                isDrawingAOI={isDrawingAOI}
                onToggleDrawAOI={() => setIsDrawingAOI((prev) => !prev)}
                yearFrom={yearFrom}
                yearTo={yearTo}
                selectedMonth={selectedMonth}
                onChangeYearRange={handleChangeYearRange}
                onChangeMonth={handleChangeMonth}
                selectedPalette={selectedPalette}
                onSelectPalette={setSelectedPalette}
                onOpenDrawer={(tab) => handleOpenDrawer(tab, true)}
                onOpenIngest={() => setIngestModalOpen(true)}
                aoiLoading={aoiLoading}
              />
            </SpotlightCard>
          </Reveal>

          {/* Dedicated Active Tab Workspace */}
          {activeTab === 'map' && (
            <TacticalMap2D
              selectedCountry={selectedCountry}
              countryTelemetry={activeCountryData}
              aoiResult={aoiResult}
              aoiBbox={aoiBbox}
              onApplyAOI={handleApplyAOI}
              isDrawingAOI={isDrawingAOI}
              onToggleDrawAOI={setIsDrawingAOI}
              selectedPalette={selectedPalette}
              mapViewTarget={mapViewTarget}
              selectedHotspot={selectedHotspot}
              onSelectHotspot={setSelectedHotspot}
            />
          )}

          {activeTab === 'calendar' && (
            <BurningCalendar
              selectedCountry={selectedCountry}
              countryTelemetry={activeCountryData}
              selectedPalette={selectedPalette}
              onSelectYearMonth={handleSelectYearMonthFromCalendar}
            />
          )}

          {activeTab === 'telemetry' && (
            <AnalyticsSuite
              selectedCountry={selectedCountry}
              countryTelemetry={activeCountryData}
              aoiResult={aoiResult}
              selectedAudience={selectedAudience}
              onSelectAudience={setSelectedAudience}
              selectedHotspot={selectedHotspot}
            />
          )}

          {/* Sleek Bottom Section Switcher */}
          <div className="pt-4 flex items-center justify-between gap-4 border-t border-white/[0.06]">
            {prevTab ? (
              <button
                type="button"
                onClick={() => handleTabChange(prevTab.id)}
                className="glass-pill rounded-full px-4 py-2.5 flex items-center gap-2 text-xs font-mono text-slate-300 hover:text-white hover:border-white/20 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-sky-300" />
                <span>Previous: {prevTab.label}</span>
              </button>
            ) : (
              <div />
            )}

            {nextTab ? (
              <button
                type="button"
                onClick={() => handleTabChange(nextTab.id)}
                className="glass-pill rounded-full px-4 py-2.5 flex items-center gap-2 text-xs font-mono text-slate-200 hover:text-white hover:border-sky-400/40 transition-colors"
              >
                <span>Next: {nextTab.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-sky-300" />
              </button>
            ) : (
              <div />
            )}
          </div>
        </main>
      )}

      {/* Slide-Over Drawer & Ingest Modal (available from any tab) */}
      <WatchdogDrawer
        isOpen={drawerOpen}
        activeTab={drawerTab}
        onChangeTab={handleOpenDrawer}
        onClose={() => setDrawerOpen(false)}
        selectedCountry={selectedCountry}
        countryTelemetry={activeCountryData}
        aoiResult={aoiResult}
        aoiBbox={aoiBbox}
        selectedAudience={selectedAudience}
        yearFrom={yearFrom}
        yearTo={yearTo}
        selectedMonth={selectedMonth}
        onTriggerPreset={handleSelectPreset}
        onOpenIngest={() => setIngestModalOpen(true)}
      />

      <IngestModal
        isOpen={ingestModalOpen}
        onClose={() => setIngestModalOpen(false)}
        selectedCountry={selectedCountry === CUSTOM_DATASET_KEY ? 'USA' : selectedCountry}
        aoiBbox={aoiBbox}
        onIngestComplete={handleIngestComplete}
      />
    </div>
  );
}
