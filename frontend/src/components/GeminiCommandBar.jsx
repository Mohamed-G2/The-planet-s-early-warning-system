import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  ArrowUp,
  X,
  FileSpreadsheet,
  Sparkles,
  Radio,
  Loader2,
  MapPin,
  AlertTriangle,
} from 'lucide-react';
import { REGION_METADATA } from '../services/telemetryService';
import { SPRING } from './ui/primitives';

const BASIN_KEYS = Object.keys(REGION_METADATA);
const OWNER_OPTIONS = ['Auto-Detect', ...BASIN_KEYS];

export default function GeminiCommandBar({
  selectedCountry = 'USA',
  onSelectCountry,
  attachedFile = null,
  onAttachFile,
  onStageSample,
  onStageLiveFirms,
  ownerCountry = 'Auto-Detect',
  onChangeOwnerCountry,
  onSubmit,
  submitting = false,
  compact = false,
  errorMsg = null,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const menuWrapperRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handleOutside = (e) => {
      if (menuWrapperRef.current && !menuWrapperRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const lineCount = Math.max(0, text.trim().split(/\r?\n/).length - 1);
    onAttachFile &&
      onAttachFile({
        filename: file.name,
        csvText: text,
        rowsCount: lineCount,
        isLiveFeed: false,
      });
    setMenuOpen(false);
  };

  return (
    <div className="w-full max-w-3xl mx-auto relative">
      {/* Subtle Ambient Gemini/Apple Border Halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-[1px] rounded-[28px] opacity-60 blur-sm"
        style={{
          background:
            'linear-gradient(90deg, rgba(56,189,248,0.28), rgba(245,158,11,0.22), rgba(244,63,94,0.25))',
        }}
      />

      <div
        className={`relative rounded-[28px] bg-[#070B14]/90 backdrop-blur-2xl border border-white/[0.11] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_20px_60px_-15px_rgba(0,0,0,0.85)] ${
          compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
        } flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5`}
      >
        <input
          ref={fileInputRef}
          lang="en"
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Left: + Attach CSV Popover Trigger */}
        <div ref={menuWrapperRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Attach CSV or Live Feed"
            aria-expanded={menuOpen}
            className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
              menuOpen
                ? 'bg-sky-400/20 border-sky-400/50 text-white rotate-45'
                : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/[0.1] text-slate-200'
            }`}
          >
            <Plus className="w-4 h-4" strokeWidth={2.1} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: compact ? -6 : 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: compact ? -4 : 4, scale: 0.97 }}
                transition={{ duration: 0.16 }}
                className={`absolute left-0 ${
                  compact ? 'top-full mt-2.5' : 'bottom-full mb-2.5'
                } z-50 w-64 rounded-2xl bg-[#090F1C]/95 backdrop-blur-2xl border border-white/[0.12] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.9)] p-1.5 space-y-1`}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-3 py-2.5 rounded-xl hover:bg-white/[0.06] text-left flex items-center gap-2.5 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-cyan-300 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium text-white">Upload FIRMS CSV</div>
                    <div className="text-[10.5px] font-mono text-slate-400 truncate">
                      Raw MODIS / VIIRS or 0.5° grid
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onStageSample && onStageSample();
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl hover:bg-white/[0.06] text-left flex items-center gap-2.5 transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium text-white">Sample Raw FIRMS Batch</div>
                    <div className="text-[10.5px] font-mono text-slate-400 truncate">
                      34 MODIS + VIIRS detections
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onStageLiveFirms && onStageLiveFirms();
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl hover:bg-white/[0.06] text-left flex items-center gap-2.5 transition-colors"
                >
                  <Radio className="w-4 h-4 text-emerald-300 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium text-white">Live 24h FIRMS</div>
                    <div className="text-[10.5px] font-mono text-slate-400 truncate">
                      Active basin satellite feed
                    </div>
                  </div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Center: Attached CSV Chip + Basin Owner OR Quick Country Pills */}
        <div className="flex-1 min-w-0 flex flex-wrap items-center justify-center sm:justify-start gap-2">
          {attachedFile ? (
            <div className="w-full flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/12 border border-cyan-400/35 text-[12px] font-mono text-cyan-100 max-w-[260px]">
                <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                <span className="truncate">{attachedFile.filename}</span>
                <button
                  type="button"
                  onClick={() => onAttachFile && onAttachFile(null)}
                  aria-label="Remove attached CSV"
                  className="p-0.5 rounded-full hover:bg-white/15 text-cyan-200 hover:text-white transition-colors shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-white/[0.04] border border-white/[0.09]">
                <MapPin className="w-3 h-3 text-amber-300 shrink-0" />
                <select
                  lang="en"
                  aria-label="Basin Owner"
                  value={ownerCountry}
                  onChange={(e) => onChangeOwnerCountry && onChangeOwnerCountry(e.target.value)}
                  className="bg-transparent text-[12px] font-medium text-slate-200 focus:outline-none cursor-pointer pr-1"
                >
                  {OWNER_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} className="bg-[#080C16] text-slate-100">
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div
              role="tablist"
              aria-label="Quick Basin Selector"
              className="w-full flex flex-wrap items-center justify-center sm:justify-start gap-1"
            >
              {BASIN_KEYS.map((cKey) => {
                const meta = REGION_METADATA[cKey];
                const active = selectedCountry === cKey;
                return (
                  <button
                    key={cKey}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onSelectCountry && onSelectCountry(cKey)}
                    className={`relative px-3.5 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                      active ? 'text-white' : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="gemini-country-pill"
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
          )}
        </div>

        {/* Right: Upward Send Arrow (↑) */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.94 }}
          disabled={submitting}
          onClick={() => onSubmit && onSubmit()}
          aria-label="Run Harmonization Analysis"
          className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center bg-gradient-to-b from-white to-slate-200 hover:from-sky-100 hover:to-sky-300 disabled:opacity-50 text-[#020408] shadow-[0_0_24px_-4px_rgba(255,255,255,0.45)] transition-all"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.3} />
          ) : (
            <ArrowUp className="w-4 h-4" strokeWidth={2.4} />
          )}
        </motion.button>
      </div>

      {errorMsg && (
        <div className="mt-2 px-4 py-2 rounded-full bg-rose-500/12 border border-rose-400/30 flex items-center justify-center gap-2 text-[11.5px] text-rose-200">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-300 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}

