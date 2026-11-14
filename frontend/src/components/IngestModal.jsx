import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Upload,
  Sparkles,
  Radio,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import {
  SAMPLE_RAW_FIRMS_CSV,
  ingestAndHarmonizeCSV,
  fetchLiveFirms24h,
} from '../services/telemetryService';
import { InfoTip, SPRING, fmtCompact, fmtInt } from './ui/primitives';

export default function IngestModal({
  isOpen = false,
  onClose,
  selectedCountry = 'USA',
  aoiBbox = null,
  onIngestComplete,
}) {
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const runPipeline = async (taskFn, actionTag) => {
    setProcessing(true);
    setActiveAction(actionTag);
    setErrorMsg(null);
    try {
      const res = await taskFn();
      setLastResult(res);
      if (onIngestComplete) {
        onIngestComplete(res);
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to parse and harmonize CSV dataset.');
    } finally {
      setProcessing(false);
      setActiveAction(null);
    }
  };

  const handleFileObject = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text')) {
      setErrorMsg('Please select a valid `.csv` satellite telemetry file.');
      return;
    }
    const text = await file.text();
    await runPipeline(
      () =>
        ingestAndHarmonizeCSV(text, {
          filename: file.name,
          countryHint: selectedCountry,
        }),
      'csv'
    );
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      await handleFileObject(file);
    }
  };

  const handleLoadSample = () => {
    runPipeline(
      () =>
        ingestAndHarmonizeCSV(SAMPLE_RAW_FIRMS_CSV, {
          filename: 'sample_raw_firms_modis_viirs.csv',
          countryHint: selectedCountry,
        }),
      'sample'
    );
  };

  const handleLiveFirms = () => {
    runPipeline(() => fetchLiveFirms24h(selectedCountry, aoiBbox), 'live');
  };

  const meta = lastResult?.meta;
  const totals = lastResult?.country_telemetry?.totals;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={SPRING}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-3xl bg-[#070B14]/95 border border-white/[0.1] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_32px_90px_-16px_rgba(0,0,0,0.9)] overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center">
                  <Upload className="w-3.5 h-3.5 text-cyan-300" strokeWidth={1.9} />
                </div>
                <span className="text-[15px] font-semibold tracking-[-0.015em] text-white">
                  Ingest Data
                </span>
                <InfoTip text="Upload raw NASA FIRMS CSV detections (latitude, longitude, acq_date, frp, daynight, confidence, satellite/instrument) or pre-binned 0.5° grid CSVs. Quality gates drop MODIS confidence < 30 and VIIRS low confidence, then bin to 0.5° × 0.5° and run LightGBM Q10/Q50/Q90 & IsolationForest." />
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="p-2 rounded-full bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Drag & Drop Dropzone */}
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => !processing && fileInputRef.current?.click()}
                className={`relative rounded-2xl border border-dashed p-7 text-center cursor-pointer transition-all ${
                  dragging
                    ? 'border-cyan-400 bg-cyan-500/[0.08] shadow-[0_0_30px_-8px_rgba(34,211,238,0.45)]'
                    : 'border-white/[0.14] hover:border-cyan-400/50 bg-white/[0.02] hover:bg-white/[0.035]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileObject(file);
                    e.target.value = '';
                  }}
                />

                <div className="mx-auto w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3">
                  {processing ? (
                    <Loader2 className="w-5 h-5 text-cyan-300 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-5 h-5 text-cyan-300" strokeWidth={1.7} />
                  )}
                </div>

                <div className="text-[13.5px] font-medium text-white">
                  {processing ? 'Running LightGBM Quantile Pipeline...' : 'Drop .csv here or browse'}
                </div>
                <div className="mt-1.5 text-[11px] font-mono text-slate-400">
                  NASA FIRMS Raw (latitude, longitude, acq_date, frp, daynight) · 0.5° Binning
                </div>
              </div>

              {/* Quick Trigger Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={processing}
                  onClick={handleLoadSample}
                  className="px-4 py-3 rounded-2xl bg-cyan-500/12 hover:bg-cyan-500/20 disabled:opacity-50 border border-cyan-400/30 text-left transition-all flex items-center gap-3"
                >
                  <Sparkles className="w-4 h-4 text-cyan-300 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold text-white truncate">
                      {activeAction === 'sample' ? 'Harmonizing...' : 'Load Sample Raw FIRMS Batch'}
                    </div>
                    <div className="text-[10.5px] font-mono text-cyan-200/75 truncate">
                      34 MODIS+VIIRS Detections
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={processing}
                  onClick={handleLiveFirms}
                  className="px-4 py-3 rounded-2xl bg-emerald-500/12 hover:bg-emerald-500/20 disabled:opacity-50 border border-emerald-400/30 text-left transition-all flex items-center gap-3"
                >
                  <Radio className="w-4 h-4 text-emerald-300 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold text-white truncate">
                      {activeAction === 'live' ? 'Fetching 24h Feed...' : 'Live 24h FIRMS'}
                    </div>
                    <div className="text-[10.5px] font-mono text-emerald-200/75 truncate">
                      Active Basin · {selectedCountry}
                    </div>
                  </div>
                </button>
              </div>

              {/* Error Banner */}
              {errorMsg && (
                <div className="px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-400/30 flex items-center gap-2.5 text-[12px] text-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Harmonization Output Summary */}
              {lastResult && meta && totals && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-white/[0.03] border border-cyan-400/25 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-[12.5px] font-semibold text-white truncate">
                        {meta.filename}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.12em] bg-cyan-500/15 text-cyan-200 border border-cyan-400/30 shrink-0">
                      {lastResult.feed_status === 'live_nasa_firms'
                        ? 'Live FIRMS'
                        : meta.fallback_used
                          ? '24h Snapshot'
                          : 'Harmonized'}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div className="rounded-xl bg-[#04070E] border border-white/[0.06] px-2.5 py-2">
                      <div className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-slate-500">
                        Retained
                      </div>
                      <div className="text-[14px] font-mono font-semibold text-white tabular-nums mt-0.5">
                        {fmtInt(meta.rows_retained)}/{fmtInt(meta.rows_raw)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#04070E] border border-white/[0.06] px-2.5 py-2">
                      <div className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-slate-500">
                        0.5° Cells
                      </div>
                      <div className="text-[14px] font-mono font-semibold text-cyan-300 tabular-nums mt-0.5">
                        {fmtInt(meta.grid_cells_binned)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#04070E] border border-white/[0.06] px-2.5 py-2">
                      <div className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-slate-500">
                        Harmonized
                      </div>
                      <div className="text-[14px] font-mono font-semibold text-amber-300 tabular-nums mt-0.5">
                        {fmtCompact(totals.harmonized)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#04070E] border border-white/[0.06] px-2.5 py-2">
                      <div className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-slate-500">
                        Anomalies
                      </div>
                      <div className="text-[14px] font-mono font-semibold text-rose-300 tabular-nums mt-0.5">
                        {fmtInt(totals.total_grid_anomaly_cells)}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-2.5 rounded-xl bg-white text-slate-950 font-semibold text-[12.5px] hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>Explore Custom Ingested Dataset</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
}

