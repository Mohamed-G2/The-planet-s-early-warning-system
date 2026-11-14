import React, { useEffect, useRef, useState } from 'react';
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
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollYRef = useRef(0);

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
      { rootMargin: '-35% 0px -45% 0px', threshold: [0, 0.2, 0.5, 0.8] }
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);

  // Smart auto-hide on scroll down, reveal on scroll up
  useEffect(() => {
    const onScroll = () => {
      const currentScrollY = window.scrollY;
      const lastScrollY = lastScrollYRef.current;

      if (currentScrollY > lastScrollY + 8 && currentScrollY > 60) {
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY - 5 || currentScrollY <= 60) {
        setIsVisible(true);
      }

      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNavClick = (e, id) => {
    e.preventDefault();
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -24, scale: 0.96 }}
      animate={{ opacity: isVisible ? 1 : 0, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: EASE_OUT }}
      className={`no-print fixed top-3 sm:top-5 left-1/2 z-40 w-[calc(100%-1rem)] max-w-[95vw] sm:max-w-[820px] select-none transition-all duration-300 ease-out ${
        isVisible
          ? 'translate-y-0 opacity-100 pointer-events-auto'
          : '-translate-y-28 opacity-0 pointer-events-none'
      }`}
      style={{ x: '-50%' }}
    >
      <div className="glass-pill rounded-full px-3 py-2 sm:px-6 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-6">
        {/* Left — insignia + live pulse */}
        <a
          href="#orbital-globe"
          onClick={(e) => handleNavClick(e, 'orbital-globe')}
          className="flex items-center gap-2 sm:gap-2.5 shrink-0 group min-h-[36px]"
        >
          <HorusInsignia />
          <span className="font-sans text-[11px] sm:text-[12.5px] font-bold tracking-[0.18em] sm:tracking-[0.24em] text-white whitespace-nowrap group-hover:text-amber-100 transition-colors">
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
              <button
                key={item.id}
                type="button"
                onClick={(e) => handleNavClick(e, item.id)}
                onMouseEnter={() => setHoverId(item.id)}
                className={`relative px-3.5 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-colors ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {isHover && !isActive && (
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
                    className="absolute inset-0 rounded-full bg-white/[0.1] border border-sky-400/35 shadow-[0_0_16px_-4px_rgba(56,189,248,0.45)]"
                  />
                )}
                <span className="relative">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right — SitRep & CSV trigger */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onOpenDrawer && onOpenDrawer('sitrep')}
          className="relative shrink-0 min-h-[36px] inline-flex items-center gap-1.5 sm:gap-2 pl-3 pr-3.5 sm:pl-3.5 sm:pr-4 py-1.5 rounded-full text-[11.5px] sm:text-[12px] font-semibold whitespace-nowrap text-[#1a0f02] bg-gradient-to-b from-amber-200 to-amber-400 shadow-[0_0_24px_-4px_rgba(251,191,36,0.65),inset_0_1px_0_0_rgba(255,255,255,0.6)]"
        >
          <FileDown className="w-3.5 h-3.5" strokeWidth={2.2} />
          <span>SitRep &amp; CSV</span>
        </motion.button>
      </div>

      {/* Mobile scrollable quick-jump strip */}
      <nav
        aria-label="Mobile sections"
        className="flex md:hidden items-center gap-1 overflow-x-auto no-scrollbar mt-1.5 px-2 py-1 glass-pill rounded-full"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={(e) => handleNavClick(e, item.id)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-sky-400/20 border border-sky-400/40 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </motion.header>
  );
}
