import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  motion,
  AnimatePresence,
  useInView,
  useMotionValue,
  useSpring,
} from 'framer-motion';
import { Info } from 'lucide-react';

export const SPRING = { type: 'spring', stiffness: 420, damping: 36, mass: 0.7 };
export const EASE_OUT = [0.22, 1, 0.36, 1];

/* ------------------------------------------------------------------ */
/* SpotlightCard — Linear/Raycast-style cursor-tracked glow            */
/* ------------------------------------------------------------------ */
function hexToRgbTriplet(hex = '#7DD3FC') {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

export function SpotlightCard({
  as: Tag = 'div',
  className = '',
  glow = '#7DD3FC',
  children,
  style,
  ...rest
}) {
  const ref = useRef(null);

  const handleMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  }, []);

  return (
    <Tag
      ref={ref}
      onMouseMove={handleMove}
      className={`spotlight-card glass-card rounded-3xl ${className}`}
      style={{ '--spot-rgb': hexToRgbTriplet(glow), ...style }}
      {...rest}
    >
      <span aria-hidden className="spotlight-glow" />
      <span aria-hidden className="spotlight-border" />
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* AnimatedNumber — spring counter that animates on view & change      */
/* ------------------------------------------------------------------ */
const defaultFormat = (v) => Math.round(v).toLocaleString('en-US');

export function AnimatedNumber({ value = 0, format = defaultFormat, className = '' }) {
  const ref = useRef(null);
  const formatRef = useRef(format);
  formatRef.current = format;

  const inView = useInView(ref, { once: true, margin: '-40px' });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 60, damping: 18, mass: 0.9 });

  useEffect(() => {
    if (inView) motionValue.set(Number(value) || 0);
  }, [inView, value, motionValue]);

  useEffect(
    () =>
      spring.on('change', (v) => {
        if (ref.current) ref.current.textContent = formatRef.current(v);
      }),
    [spring]
  );

  // Re-apply latest formatting on every render (e.g. unit change) without React owning the text node
  useLayoutEffect(() => {
    if (ref.current) ref.current.textContent = formatRef.current(spring.get());
  });

  return <span ref={ref} className={`tabular-nums ${className}`} />;
}

/* ------------------------------------------------------------------ */
/* InfoTip — tiny ⓘ with portal-rendered glass tooltip                 */
/* ------------------------------------------------------------------ */
export function InfoTip({ text, className = '', size = 13 }) {
  const iconRef = useRef(null);
  const [pos, setPos] = useState(null);

  const show = () => {
    const r = iconRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 280;
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, r.left + r.width / 2 - width / 2));
    const placeBelow = r.top < 140;
    setPos({ left, top: placeBelow ? r.bottom + 10 : r.top - 10, placeBelow, width });
  };

  return (
    <>
      <span
        ref={iconRef}
        onMouseEnter={show}
        onMouseLeave={() => setPos(null)}
        onFocus={show}
        onBlur={() => setPos(null)}
        tabIndex={0}
        aria-label={text}
        className={`inline-flex items-center text-slate-500 hover:text-slate-200 focus:text-slate-200 outline-none cursor-help transition-colors ${className}`}
      >
        <Info style={{ width: size, height: size }} />
      </span>
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {pos && (
              <div
                key="tip"
                className="fixed z-[200] pointer-events-none"
                style={{
                  left: pos.left,
                  top: pos.top,
                  width: pos.width,
                  transform: pos.placeBelow ? 'none' : 'translateY(-100%)',
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: pos.placeBelow ? -4 : 4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: pos.placeBelow ? -4 : 4, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: EASE_OUT }}
                  className="glass-pill rounded-xl px-3.5 py-2.5 text-[11.5px] leading-relaxed text-slate-200"
                >
                  {text}
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* SegmentedControl — shared-element sliding pill (layoutId)           */
/* ------------------------------------------------------------------ */
export function SegmentedControl({
  options,
  value,
  onChange,
  layoutId,
  size = 'md',
  accent = 'rgba(255,255,255,0.1)',
  accentBorder = 'rgba(255,255,255,0.14)',
  className = '',
  renderOption,
}) {
  const pad = size === 'sm' ? 'px-3 py-1 text-[11.5px]' : 'px-3.5 py-1.5 text-[12.5px]';
  return (
    <div
      role="tablist"
      className={`relative inline-flex items-center gap-0.5 rounded-full p-1 bg-white/[0.03] border border-white/[0.07] ${className}`}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange && onChange(opt.id)}
            className={`relative ${pad} rounded-full font-medium whitespace-nowrap transition-colors duration-200 ${
              active ? 'text-white' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={SPRING}
                className="absolute inset-0 rounded-full"
                style={{
                  background: opt.accent || accent,
                  boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.12), 0 0 0 1px ${opt.accentBorder || accentBorder}`,
                }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {renderOption ? renderOption(opt, active) : opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reveal — scroll-triggered entrance                                  */
/* ------------------------------------------------------------------ */
export function Reveal({ children, delay = 0, y = 28, className = '', as = 'div', ...rest }) {
  const MotionTag = motion[as] || motion.div;
  return (
    <MotionTag
      initial={{ opacity: 0, y, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.8, delay, ease: EASE_OUT }}
      className={className}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}

/* ------------------------------------------------------------------ */
/* CardHeader — 1–3 word title + optional ⓘ + right slot               */
/* ------------------------------------------------------------------ */
export function CardHeader({ icon: Icon, iconColor = 'text-slate-400', title, info, right, className = '' }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} strokeWidth={1.75} />}
        <h3 className="card-title">{title}</h3>
        {info && <InfoTip text={info} />}
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Number formatting helpers                                           */
/* ------------------------------------------------------------------ */
export const fmtCompact = (v, digits = 1) => {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(digits)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(digits === 1 ? 2 : digits)}M`;
  if (abs >= 1e4) return `${(n / 1e3).toFixed(digits)}k`;
  return Math.round(n).toLocaleString('en-US');
};

export const fmtInt = (v) => Math.round(Number(v) || 0).toLocaleString('en-US');
