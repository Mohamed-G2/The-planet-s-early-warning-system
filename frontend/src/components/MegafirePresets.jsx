import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, RotateCcw } from 'lucide-react';
import { MEGAFIRE_PRESETS } from '../services/telemetryService';
import { InfoTip, SPRING } from './ui/primitives';

const CHIP_LABELS = {
  'greece-alexandroupolis-2023': { title: 'Greece Aug 2023', metric: '43.3k MW' },
  'canada-boreal-2023': { title: 'Canada 2023', metric: 'Surge' },
  'brazil-amazon-2024': { title: 'Brazil 2024', metric: 'Amazon' },
  'usa-california-reconstruction': { title: 'USA 2005 → 2025', metric: 'AI' },
};

export default function MegafirePresets({ activePresetId, onSelectPreset, onClearPreset }) {
  const activePreset = MEGAFIRE_PRESETS.find((p) => p.id === activePresetId) || null;

  return (
    <div className="px-5 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-4">
      <div className="flex items-center gap-2 shrink-0 lg:w-[150px]">
        <History className="w-4 h-4 text-amber-300" strokeWidth={1.75} />
        <span className="eyebrow !text-slate-300">Time Machine</span>
        <InfoTip
          text={
            activePreset
              ? `${activePreset.title} — ${activePreset.summary}`
              : 'One-click historical megafire case studies: flies the map, sets AOI and period, and loads anomaly & SHAP telemetry.'
          }
        />
      </div>

      <div className="flex-1 flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 -mx-1 px-1">
        {MEGAFIRE_PRESETS.map((preset, i) => {
          const isActive = activePresetId === preset.id;
          const chip = CHIP_LABELS[preset.id] || { title: preset.shortTitle, metric: '' };
          return (
            <motion.button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset && onSelectPreset(preset)}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.5 }}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              title={preset.title}
              className={`relative shrink-0 inline-flex items-center gap-2.5 pl-3 pr-3.5 py-2 rounded-2xl text-[12.5px] font-medium whitespace-nowrap border transition-colors ${
                isActive
                  ? 'text-white border-transparent'
                  : 'text-slate-300 hover:text-white border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="preset-active"
                  transition={SPRING}
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background: `linear-gradient(180deg, ${preset.accent}2e, ${preset.accent}12)`,
                    boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.14), 0 0 0 1px ${preset.accent}66, 0 10px 30px -12px ${preset.accent}`,
                  }}
                />
              )}
              <span className="relative flex h-2 w-2">
                {isActive && (
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70"
                    style={{ background: preset.accent }}
                  />
                )}
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: preset.accent }} />
              </span>
              <span className="relative">{chip.title}</span>
              {chip.metric && (
                <span className="relative font-mono text-[10.5px] tabular-nums text-slate-400">· {chip.metric}</span>
              )}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {activePreset && (
          <motion.button
            type="button"
            onClick={onClearPreset}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="shrink-0 self-start lg:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] whitespace-nowrap"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
