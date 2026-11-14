import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileDown } from 'lucide-react';
import { SPRING, EASE_OUT } from './ui/primitives';

const NAV_ITEMS = [
  { id: 'orbital-globe', label: 'Globe' },
  { id: 'tactical-map', label: 'Tactical Map' },
  { id: 'burning-calendar', label: 'Calendar' },
  { id: 'telemetry', label: 'Telemetry' },
];

export const ROLE_SHORT = {
  'Emergency Responders': 'Emergency',
  Firefighters: 'Firefighters',
  Scientists: 'Scientists',
  'Land Managers': 'Land',
};

function HorusInsignia() {
  return (
    <span className="relative flex items-center justify-center w-7 h-7">
      <span className="absolute inset-0 rounded-full bg-amber-400/20 blur-md" />
      <svg viewBox="0 0 32 32" className="relative w-7 h-7" fill="none">
        <defs>
          <linearGradient id="horus-g" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="55%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="14.5" stroke="url(#horus-g)" strokeOpacity="0.55" strokeWidth="1" />
        <path
          d="M5 15.5c3.6-3.9 7.4-5.6 11-5.6s7.4 1.7 11 5.6c-3.6 3.6-7.4 5.2-11 5.2s-7.4-1.6-11-5.2Z"
          stroke="url(#horus-g)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="15.4" r="3" fill="url(#horus-g)" />
        <path d="M13.5 20.5 12 26M16.5 20.8l2.6 4.6" stroke="url(#horus-g)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export default function Navbar({ onOpenDrawer }) {
  const [activeId, setActiveId] = useState('orbital-globe');
  const [hoverId, setHoverId] = useState(null);

  // Scroll-spy for the active section
  useEffect(() => {
    const targets = NAV_ITEMS.map((n) => document.getElementById(n.id)).filter(Boolean);
    if (!targets.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] }
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (e, id) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.15, ease: EASE_OUT }}
      className="no-print fixed top-5 left-1/2 z-40 w-[calc(100%-2rem)] max-w-[820px] select-none"
      style={{ x: '-50%' }}
    >
      <div className="glass-pill rounded-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-6">
        {/* Left — insignia + live pulse */}
        <a
          href="#orbital-globe"
          onClick={(e) => scrollTo(e, 'orbital-globe')}
          className="flex items-center gap-2.5 shrink-0 group"
        >
          <HorusInsignia />
          <span className="font-sans text-[12.5px] font-bold tracking-[0.24em] text-white whitespace-nowrap group-hover:text-amber-100 transition-colors">
            EAGLES OF HORUS
          </span>
          <span className="relative hidden sm:flex h-1.5 w-1.5 ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
        </a>

        {/* Center — smooth-scroll links */}
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-1"
          onMouseLeave={() => setHoverId(null)}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeId === item.id;
            const isHover = hoverId === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => scrollTo(e, item.id)}
                onMouseEnter={() => setHoverId(item.id)}
                className={`relative px-3.5 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-colors ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {isHover && (
                  <motion.span
                    layoutId="nav-hover"
                    transition={SPRING}
                    className="absolute inset-0 rounded-full bg-white/[0.05]"
                  />
                )}
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    transition={SPRING}
                    className="absolute left-3.5 right-3.5 -bottom-[3px] h-px bg-gradient-to-r from-transparent via-sky-300 to-transparent"
                  />
                )}
                <span className="relative">{item.label}</span>
              </a>
            );
          })}
        </nav>

        {/* Right — SitRep & CSV trigger */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onOpenDrawer && onOpenDrawer('sitrep')}
          className="relative shrink-0 inline-flex items-center gap-2 pl-3.5 pr-4 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap text-[#1a0f02] bg-gradient-to-b from-amber-200 to-amber-400 shadow-[0_0_24px_-4px_rgba(251,191,36,0.65),inset_0_1px_0_0_rgba(255,255,255,0.6)]"
        >
          <FileDown className="w-3.5 h-3.5" strokeWidth={2.2} />
          <span>SitRep &amp; CSV</span>
        </motion.button>
      </div>
    </motion.header>
  );
}
