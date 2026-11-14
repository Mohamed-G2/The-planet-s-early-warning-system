import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Compass,
  Crop,
  Calendar,
  Palette,
  RotateCcw,
  Check,
  FileText,
  ShieldAlert,
  Download,
  Upload,
} from 'lucide-react';
import {
  REGION_METADATA,
  CUSTOM_DATASET_KEY,
  getRegionMeta,
  COLORBLIND_PALETTES,
  getPaletteGradientCSS,
} from '../services/telemetryService';
import { SegmentedControl, InfoTip, SPRING } from './ui/primitives';

const MONTH_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
];

const PALETTE_OPTIONS = Object.keys(COLORBLIND_PALETTES).map((p) => ({
  id: p,
  label: p,
}));

export default function ControlBar({
  selectedCountry = 'USA',
  countryTelemetry,
  hasCustomDataset = false,
  onSelectCountry,
  aoiBbox,
  onApplyAOI,
  onResetAOI,
  isDrawingAOI,
  onToggleDrawAOI,
  yearFrom,
  yearTo,
  selectedMonth = 'ALL',
  onChangeYearRange,
  onChangeMonth,
  selectedPalette = 'Ember',
  onSelectPalette,
  onOpenDrawer,
  onOpenIngest,
  aoiLoading = false,
}) {
  const activeMeta = getRegionMeta(selectedCountry, countryTelemetry);
  const benchmarkYears = activeMeta.benchmarkYears || [2023, 2024, 2025];
  const basinKeys = hasCustomDataset
    ? [...Object.keys(REGION_METADATA), CUSTOM_DATASET_KEY]
    : Object.keys(REGION_METADATA);

  const [draftBbox, setDraftBbox] = useState({
    lat_min: Number(aoiBbox?.lat_min ?? activeMeta.bbox.lat_min).toFixed(1),
    lat_max: Number(aoiBbox?.lat_max ?? activeMeta.bbox.lat_max).toFixed(1),
    lon_min: Number(aoiBbox?.lon_min ?? activeMeta.bbox.lon_min).toFixed(1),
    lon_max: Number(aoiBbox?.lon_max ?? activeMeta.bbox.lon_max).toFixed(1),
  });

  useEffect(() => {
    if (aoiBbox) {
      setDraftBbox({
        lat_min: Number(aoiBbox.lat_min).toFixed(1),
        lat_max: Number(aoiBbox.lat_max).toFixed(1),
        lon_min: Number(aoiBbox.lon_min).toFixed(1),
        lon_max: Number(aoiBbox.lon_max).toFixed(1),
      });
    }
  }, [aoiBbox]);

  const handleBboxSubmit = (e) => {
    e.preventDefault();
    const minLat = Math.max(-90, Math.min(90, parseFloat(draftBbox.lat_min) || activeMeta.bbox.lat_min));
    const maxLat = Math.max(-90, Math.min(90, parseFloat(draftBbox.lat_max) || activeMeta.bbox.lat_max));
    const minLon = Math.max(-180, Math.min(180, parseFloat(draftBbox.lon_min) || activeMeta.bbox.lon_min));
    const maxLon = Math.max(-180, Math.min(180, parseFloat(draftBbox.lon_max) || activeMeta.bbox.lon_max));

    if (onApplyAOI) {
      onApplyAOI({
        lat_min: Math.min(minLat, maxLat),
        lat_max: Math.max(minLat, maxLat),
        lon_min: Math.min(minLon, maxLon),
        lon_max: Math.max(minLon, maxLon),
      });
    }
  };

  return (
    <div className="divide-y divide-white/[0.06]">
      {/* Row 1: Clean 5 Region Tabs (no year badges) + Drawer Actions */}
      <div className="px-5 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 shrink-0 lg:w-[142px]">
            <Compass className="w-4 h-4 text-sky-300" strokeWidth={1.75} />
            <span className="eyebrow !text-slate-300">Target Basin</span>
          </div>

          <div
            role="tablist"
            aria-label="Target Basin"
            className="inline-flex flex-wrap items-center gap-0.5 rounded-full p-1 bg-white/[0.03] border border-white/[0.07]"
          >
            {basinKeys.map((cKey) => {
              const meta = getRegionMeta(cKey, cKey === CUSTOM_DATASET_KEY ? countryTelemetry : null);
              const isSelected = selectedCountry === cKey;
              return (
                <button
                  key={cKey}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => onSelectCountry && onSelectCountry(cKey)}
                  className={`relative px-3.5 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                    isSelected ? 'text-white' : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {isSelected && (
                    <motion.span
                      layoutId="dock-region"
                      transition={SPRING}
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `${meta.accent}24`,
                        boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.14), 0 0 0 1px ${meta.accent}55`,
                      }}
                    />
                  )}
                  <span
                    className="relative w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: meta.accent }}
                  />
                  <span className="relative">{cKey}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Drawer & Ingestion Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onOpenIngest && onOpenIngest()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap text-cyan-200 bg-cyan-500/12 hover:bg-cyan-500/22 border border-cyan-400/30 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-300" />
            <span>Ingest Data</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenDrawer && onOpenDrawer('sitrep')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/25 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-amber-300" />
            <span>SitRep</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenDrawer && onOpenDrawer('watchdog')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-400/25 transition-colors"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-300" />
            <span>Watchdog</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenDrawer && onOpenDrawer('export')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap text-sky-200 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/25 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-sky-300" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Row 2: AOI Bounds (5) | Date Range (4) | Color Palette (3) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-white/[0.06]">
        {/* AOI Bounds */}
        <form onSubmit={handleBboxSubmit} className="xl:col-span-5 p-5 sm:p-6 flex flex-col justify-between gap-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Crop className="w-3.5 h-3.5 text-sky-300" strokeWidth={1.75} />
              <span className="eyebrow !text-slate-300">AOI Bounds</span>
              <InfoTip text="Set geographic bounding coordinates or drag a rectangle directly on the Tactical Map to query DuckDB spatial aggregations." />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleDrawAOI}
                className={`px-2.5 py-1 rounded-full text-[11px] font-mono whitespace-nowrap transition-all border ${
                  isDrawingAOI
                    ? 'bg-sky-400/20 text-sky-100 border-sky-400/60 shadow-[0_0_18px_-4px_rgba(56,189,248,0.6)]'
                    : 'bg-white/[0.03] text-slate-300 hover:text-white border-white/[0.08]'
                }`}
              >
                {isDrawingAOI ? 'Drag on Map…' : 'Draw AOI'}
              </button>

              <button
                type="button"
                onClick={onResetAOI}
                title="Reset bounds"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono whitespace-nowrap text-slate-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
            {[
              { key: 'lat_min', label: 'Min Lat' },
              { key: 'lat_max', label: 'Max Lat' },
              { key: 'lon_min', label: 'Min Lon' },
              { key: 'lon_max', label: 'Max Lon' },
            ].map((f) => (
              <div key={f.key}>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-1 whitespace-nowrap">
                  {f.label}
                </label>
                <input
                  lang="en"
                  dir="ltr"
                  type="text"
                  inputMode="decimal"
                  value={draftBbox[f.key]}
                  onChange={(e) => setDraftBbox((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="glass-input"
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={aoiLoading}
              className="col-span-2 sm:col-span-1 h-[34px] px-3 rounded-[10px] bg-sky-400/15 hover:bg-sky-400/25 border border-sky-400/35 font-mono text-[11.5px] font-semibold text-sky-200 whitespace-nowrap flex items-center justify-center gap-1 transition-colors"
            >
              <Check className="w-3.5 h-3.5 text-sky-300" />
              <span>{aoiLoading ? '…' : 'Apply'}</span>
            </button>
          </div>
        </form>

        {/* Date Range */}
        <div className="xl:col-span-4 p-5 sm:p-6 flex flex-col justify-between gap-3.5">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-amber-300" strokeWidth={1.75} />
            <span className="eyebrow !text-slate-300">Date Range</span>
            <InfoTip text="Constrained to each basin's harmonized benchmark years. Pre-VIIRS records (2005, 2010, 2012) are reconstructed to 375m VIIRS scale." />
          </div>

          <div className="grid grid-cols-3 gap-2.5 items-end">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-1 whitespace-nowrap">
                From
              </label>
              <select
                value={yearFrom}
                onChange={(e) => {
                  const newFrom = Number(e.target.value);
                  const safeTo = Math.max(newFrom, Number(yearTo));
                  if (onChangeYearRange) onChangeYearRange(newFrom, safeTo);
                }}
                className="glass-input"
              >
                {benchmarkYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-1 whitespace-nowrap">
                To
              </label>
              <select
                value={yearTo}
                onChange={(e) => {
                  const newTo = Number(e.target.value);
                  const safeFrom = Math.min(Number(yearFrom), newTo);
                  if (onChangeYearRange) onChangeYearRange(safeFrom, newTo);
                }}
                className="glass-input"
              >
                {benchmarkYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-1 whitespace-nowrap">
                Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                  if (onChangeMonth) onChangeMonth(val);
                }}
                className="glass-input"
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Color Palette */}
        <div className="xl:col-span-3 p-5 sm:p-6 flex flex-col justify-between gap-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-emerald-300" strokeWidth={1.75} />
              <span className="eyebrow !text-slate-300">Palette</span>
              <InfoTip text="Perceptually uniform, colorblind-safe scientific colormaps shared across both Tactical Map and Burning Calendar." />
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Color Palette"
            className="w-full grid grid-cols-5 items-center p-1 rounded-full bg-white/[0.03] border border-white/[0.07]"
          >
            {PALETTE_OPTIONS.map((opt) => {
              const active = selectedPalette === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onSelectPalette && onSelectPalette(opt.id)}
                  className={`relative px-2 py-1.5 rounded-full text-[11px] font-medium text-center truncate transition-colors ${
                    active ? 'text-white' : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="palette-pill"
                      transition={SPRING}
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: 'rgba(52, 211, 153, 0.16)',
                        boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.14), 0 0 0 1px rgba(52, 211, 153, 0.35)',
                      }}
                    />
                  )}
                  <span className="relative z-10">{opt.label}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-1">
            <div
              className="w-full h-2 rounded-full overflow-hidden border-0 transition-all duration-300"
              style={{
                backgroundImage: getPaletteGradientCSS(selectedPalette),
                backgroundSize: '100% 100%',
              }}
            />
            <div className="flex justify-between font-mono text-[9.5px] tabular-nums text-slate-500">
              <span>Low</span>
              <span>Q50</span>
              <span>P90+</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
