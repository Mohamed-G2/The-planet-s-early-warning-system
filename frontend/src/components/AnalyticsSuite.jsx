import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, BarChart3, Cpu, ShieldCheck } from 'lucide-react';
import {
  AUDIENCE_ROLES,
  AUDIENCE_BRIEFINGS,
} from '../services/telemetryService';
import { useCommandAnalytics } from '../hooks/useCommandAnalytics';
import { ROLE_SHORT } from './Navbar';
import {
  SpotlightCard,
  CardHeader,
  AnimatedNumber,
  SegmentedControl,
  Reveal,
  fmtCompact,
  fmtInt,
  EASE_OUT,
} from './ui/primitives';

export default function AnalyticsSuite({
  selectedCountry = 'USA',
  countryTelemetry,
  aoiResult,
  selectedAudience = 'Scientists',
  onSelectAudience,
  selectedHotspot,
}) {
  const [hoveredTimeIdx, setHoveredTimeIdx] = useState(null);
  const [hoveredBarIdx, setHoveredBarIdx] = useState(null);

  const { kpiStats, anomalySeries, shapRanked } = useCommandAnalytics({
    countryTelemetry,
    aoiResult,
    selectedHotspot,
  });

  const audienceBrief =
    AUDIENCE_BRIEFINGS[selectedAudience] || AUDIENCE_BRIEFINGS.Scientists;

  const roleOptions = useMemo(
    () => AUDIENCE_ROLES.map((r) => ({ id: r, label: ROLE_SHORT[r] || r })),
    []
  );

  // SVG Time-Series Geometry
  const svgWidth = 520;
  const svgHeight = 225;
  const padLeft = 44;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 26;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const maxTimeY = useMemo(() => {
    if (!anomalySeries.length) return 100;
    return Math.max(
      ...anomalySeries.map((d) =>
        Math.max(
          Number(d.harmonized_high || 0),
          Number(d.raw_viirs || 0),
          Number(d.harmonized || 0),
          Number(d.raw_modis || 0)
        )
      ),
      10
    );
  }, [anomalySeries]);

  const getX = (i, len) => padLeft + (len <= 1 ? plotW / 2 : (i / (len - 1)) * plotW);
  const getY = (val) =>
    padTop + plotH - Math.min(1, Math.max(0, Number(val || 0) / maxTimeY)) * plotH;

  const { ciAreaPath, harmAreaPath, harmLinePath, modisLinePath, viirsLinePath } = useMemo(() => {
    const n = anomalySeries.length;
    if (!n) {
      return { ciAreaPath: '', harmAreaPath: '', harmLinePath: '', modisLinePath: '', viirsLinePath: '' };
    }

    const upperPts = anomalySeries.map(
      (d, i) => `${getX(i, n).toFixed(1)},${getY(d.harmonized_high).toFixed(1)}`
    );
    const lowerPts = [...anomalySeries]
      .reverse()
      .map((d, idx) => {
        const origIdx = n - 1 - idx;
        return `${getX(origIdx, n).toFixed(1)},${getY(d.harmonized_low).toFixed(1)}`;
      });

    const baseY = (padTop + plotH).toFixed(1);
    const harmPts = anomalySeries.map(
      (d, i) => `${getX(i, n).toFixed(1)},${getY(d.harmonized).toFixed(1)}`
    );

    return {
      ciAreaPath: `M ${upperPts.join(' L ')} L ${lowerPts.join(' L ')} Z`,
      harmAreaPath: `M ${getX(0, n).toFixed(1)},${baseY} L ${harmPts.join(' L ')} L ${getX(
        n - 1,
        n
      ).toFixed(1)},${baseY} Z`,
      harmLinePath: `M ${harmPts.join(' L ')}`,
      modisLinePath: `M ${anomalySeries
        .map((d, i) => `${getX(i, n).toFixed(1)},${getY(d.raw_modis).toFixed(1)}`)
        .join(' L ')}`,
      viirsLinePath: `M ${anomalySeries
        .map((d, i) => `${getX(i, n).toFixed(1)},${getY(d.raw_viirs).toFixed(1)}`)
        .join(' L ')}`,
    };
  }, [anomalySeries, maxTimeY]);

  const activeHoverPoint =
    hoveredTimeIdx !== null && anomalySeries[hoveredTimeIdx]
      ? anomalySeries[hoveredTimeIdx]
      : anomalySeries[anomalySeries.length - 1] || null;

  const recentBars = useMemo(() => anomalySeries.slice(-28), [anomalySeries]);
  const activeHoverBar =
    hoveredBarIdx !== null && recentBars[hoveredBarIdx]
      ? recentBars[hoveredBarIdx]
      : recentBars[recentBars.length - 1] || null;

  const kpiTiles = [
    {
      label: 'MODIS Count',
      value: kpiStats.rawModis,
      format: fmtInt,
      sub: '1km Sensor',
      accent: 'text-sky-300',
    },
    {
      label: 'VIIRS Count',
      value: kpiStats.rawViirs,
      format: fmtInt,
      sub: '375m Sensor',
      accent: 'text-amber-300',
    },
    {
      label: 'AI Harmonized',
      value: kpiStats.harmonized,
      format: fmtInt,
      sub: `CI [${fmtCompact(kpiStats.harmonizedLow, 0)}–${fmtCompact(kpiStats.harmonizedHigh, 0)}]`,
      accent: 'text-emerald-300',
    },
    {
      label: 'Total FRP',
      value: kpiStats.frpMw,
      format: (v) => `${fmtCompact(v, 2)} MW`,
      sub: `P90 ${kpiStats.maxFrpP90.toFixed(1)} MW`,
      accent: 'text-orange-300',
    },
    {
      label: 'Anomaly Months',
      value: kpiStats.anomalyMonths,
      format: fmtInt,
      sub: `${kpiStats.anomalyCells.toLocaleString('en-US')} Cells`,
      accent: 'text-rose-400',
    },
  ];

  return (
    <section id="telemetry" aria-label="Telemetry & XAI" className="space-y-6">
      {/* KPI Telemetry Ribbon */}
      <Reveal y={24}>
        <SpotlightCard glow="#38BDF8" className="overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
            {kpiTiles.map((tile) => (
              <div key={tile.label} className="p-5 sm:p-6 space-y-1.5">
                <div className="eyebrow !text-[10px] !text-slate-400">{tile.label}</div>
                <div className={`font-mono text-xl sm:text-2xl font-bold tracking-tight whitespace-nowrap ${tile.accent}`}>
                  <AnimatedNumber value={tile.value} format={tile.format} />
                </div>
                <div className="font-mono text-[10.5px] text-slate-500 tabular-nums whitespace-nowrap">
                  {tile.sub}
                </div>
              </div>
            ))}
          </div>
        </SpotlightCard>
      </Reveal>

      {/* Row 3 — 3 Equal Spotlight Bento Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
        {/* Card 1: Sensor Harmonization */}
        <Reveal y={28} delay={0.04} className="flex">
          <SpotlightCard glow="#34D399" className="w-full p-6 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <CardHeader
                icon={TrendingUp}
                iconColor="text-emerald-300"
                title="Sensor Harmonization"
                info="LightGBM Quantile Regression (α ∈ {0.10, 0.50, 0.90}) bridges the ~4× detection gap between 1km MODIS and 375m VIIRS with calibrated 80% confidence intervals."
              />

              <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                <span className="flex items-center gap-1.5 text-emerald-300">
                  <span className="w-2.5 h-0.5 bg-emerald-400 inline-block rounded-full" />
                  Harmonized
                </span>
                <span className="flex items-center gap-1.5 text-sky-300/80">
                  <span className="w-2.5 h-2 rounded-sm bg-sky-400/25 border border-sky-400/40 inline-block" />
                  80% CI
                </span>
                <span className="flex items-center gap-1.5 text-amber-300">
                  <span className="w-2.5 h-0.5 bg-amber-400 inline-block rounded-full" />
                  VIIRS
                </span>
                <span className="flex items-center gap-1.5 text-sky-400">
                  <span className="w-2.5 h-0.5 border-t border-dashed border-sky-400 inline-block" />
                  MODIS
                </span>
              </div>
            </div>

            <div className="relative w-full">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-52 select-none overflow-visible"
                onMouseLeave={() => setHoveredTimeIdx(null)}
              >
                <defs>
                  <linearGradient id="harm-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34D399" stopOpacity="0.24" />
                    <stop offset="100%" stopColor="#34D399" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="ci-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.05" />
                  </linearGradient>
                </defs>

                {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
                  const y = padTop + plotH * (1 - frac);
                  const val = Math.round(maxTimeY * frac);
                  return (
                    <g key={frac}>
                      <line
                        x1={padLeft}
                        y1={y}
                        x2={svgWidth - padRight}
                        y2={y}
                        stroke="rgba(255,255,255,0.06)"
                        strokeDasharray="3,3"
                      />
                      <text
                        x={padLeft - 6}
                        y={y + 3}
                        textAnchor="end"
                        className="fill-slate-500 font-mono text-[9px] tabular-nums"
                      >
                        {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                      </text>
                    </g>
                  );
                })}

                {ciAreaPath && (
                  <path
                    d={ciAreaPath}
                    fill="url(#ci-grad)"
                    stroke="rgba(56, 189, 248, 0.28)"
                    strokeWidth="0.75"
                  />
                )}

                {harmAreaPath && <path d={harmAreaPath} fill="url(#harm-grad)" />}

                {modisLinePath && (
                  <path
                    d={modisLinePath}
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="1.4"
                    strokeDasharray="4,3"
                  />
                )}

                {viirsLinePath && (
                  <path
                    d={viirsLinePath}
                    fill="none"
                    stroke="#FBBF24"
                    strokeWidth="1.4"
                    strokeOpacity="0.85"
                  />
                )}

                {harmLinePath && (
                  <path
                    d={harmLinePath}
                    fill="none"
                    stroke="#34D399"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                )}

                {anomalySeries.map((d, i) => {
                  const x = getX(i, anomalySeries.length);
                  const yHarm = getY(d.harmonized);
                  const sliceW = Math.max(4, plotW / Math.max(1, anomalySeries.length));
                  const isHovered = hoveredTimeIdx === i;

                  return (
                    <g key={d.period || i}>
                      {d.is_anomaly && (
                        <circle
                          cx={x}
                          cy={yHarm}
                          r={isHovered ? 4.5 : 2.6}
                          fill="#F43F5E"
                          stroke="#FFFFFF"
                          strokeWidth="1"
                        />
                      )}
                      {isHovered && (
                        <line
                          x1={x}
                          y1={padTop}
                          x2={x}
                          y2={padTop + plotH}
                          stroke="rgba(255,255,255,0.35)"
                          strokeWidth="1"
                        />
                      )}
                      {i % Math.max(1, Math.floor(anomalySeries.length / 5)) === 0 && (
                        <text
                          x={x}
                          y={svgHeight - 6}
                          textAnchor="middle"
                          className="fill-slate-500 font-mono text-[9px] tabular-nums"
                        >
                          {d.period}
                        </text>
                      )}
                      <rect
                        x={x - sliceW / 2}
                        y={padTop}
                        width={sliceW}
                        height={plotH}
                        fill="transparent"
                        className="cursor-crosshair"
                        onMouseEnter={() => setHoveredTimeIdx(i)}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {activeHoverPoint && (
              <div className="px-3.5 py-2 rounded-2xl bg-white/[0.025] border border-white/[0.06] flex flex-wrap items-center justify-between gap-2 font-mono text-[10.5px] tabular-nums whitespace-nowrap">
                <span className="text-white font-semibold">{activeHoverPoint.period}</span>
                <span className="text-emerald-300">
                  Q50 <strong>{Number(activeHoverPoint.harmonized).toLocaleString('en-US')}</strong>
                </span>
                <span className="text-sky-300">
                  M {fmtCompact(activeHoverPoint.raw_modis, 1)}
                </span>
                <span className="text-amber-300">
                  V {fmtCompact(activeHoverPoint.raw_viirs, 1)}
                </span>
              </div>
            )}
          </SpotlightCard>
        </Reveal>

        {/* Card 2: Anomaly Surge Index */}
        <Reveal y={28} delay={0.1} className="flex">
          <SpotlightCard glow="#F43F5E" className="w-full p-6 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <CardHeader
                icon={BarChart3}
                iconColor="text-rose-400"
                title="Anomaly Surge Index"
                info="Standardized Z-score and percentage deviation of AI Harmonized detections against each month's multi-year climatology baseline."
                right={
                  <span className="font-mono text-[10.5px] text-slate-400 whitespace-nowrap">
                    Z / % Baseline
                  </span>
                }
              />

              <div className="flex items-center gap-4 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_#F43F5E]" />
                  Surge
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Above Avg
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400/70" />
                  Below Avg
                </span>
              </div>
            </div>

            <div
              className="h-52 flex items-center gap-1 px-1 relative select-none"
              onMouseLeave={() => setHoveredBarIdx(null)}
            >
              <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-white/[0.14] pointer-events-none" />

              {recentBars.map((item, idx) => {
                const clampedPct = Math.max(-100, Math.min(240, item.pctDeviation));
                const isPos = clampedPct >= 0;
                const barHeightPct = Math.min(46, (Math.abs(clampedPct) / 240) * 46);
                const isHover = hoveredBarIdx === idx;

                return (
                  <div
                    key={item.period || idx}
                    onMouseEnter={() => setHoveredBarIdx(idx)}
                    className="flex-1 h-full relative flex flex-col justify-center cursor-crosshair group"
                  >
                    <div
                      style={{
                        height: `${Math.max(3, barHeightPct)}%`,
                        bottom: isPos ? '50%' : undefined,
                        top: isPos ? undefined : '50%',
                        boxShadow: item.is_anomaly
                          ? '0 0 14px rgba(244, 63, 94, 0.55)'
                          : isHover
                          ? '0 0 10px rgba(251, 191, 36, 0.4)'
                          : 'none',
                      }}
                      className={`w-full rounded-full transition-all duration-200 ${
                        item.is_anomaly
                          ? 'bg-gradient-to-t from-rose-500 to-rose-300'
                          : isPos
                          ? 'bg-gradient-to-t from-amber-500/75 to-amber-300/90'
                          : 'bg-sky-400/45 group-hover:bg-sky-300/80'
                      } ${isHover ? 'scale-x-125 brightness-125' : ''}`}
                    />
                  </div>
                );
              })}
            </div>

            {activeHoverBar && (
              <div className="px-3.5 py-2 rounded-2xl bg-white/[0.025] border border-white/[0.06] flex items-center justify-between gap-2 font-mono text-[10.5px] tabular-nums whitespace-nowrap">
                <span className="text-white font-semibold">{activeHoverBar.period}</span>
                <span className={activeHoverBar.pctDeviation >= 0 ? 'text-rose-300' : 'text-sky-300'}>
                  {activeHoverBar.pctDeviation >= 0 ? '+' : ''}
                  {activeHoverBar.pctDeviation}%
                </span>
                <span className="text-slate-400">
                  Z <strong className="text-amber-200">{activeHoverBar.harmonized_z}</strong>
                </span>
              </div>
            )}
          </SpotlightCard>
        </Reveal>

        {/* Card 3: Physical Drivers (SHAP) & Role Directive */}
        <Reveal y={28} delay={0.16} className="flex">
          <SpotlightCard glow="#FBBF24" className="w-full p-6 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <CardHeader
                icon={Cpu}
                iconColor="text-amber-300"
                title="Physical Drivers (SHAP)"
                info="Mean absolute TreeSHAP feature attributions explaining LightGBM cross-sensor fire harmonization across the active basin."
                right={
                  <span className="font-mono text-[10.5px] text-sky-300 whitespace-nowrap">
                    {selectedCountry}
                  </span>
                }
              />

              <div className="space-y-2.5">
                {shapRanked.slice(0, 6).map((drv, idx) => {
                  const barPct = Math.min(100, Math.max(4, drv.attribution_pct * 1.3));
                  return (
                    <div key={drv.feature} className="space-y-1">
                      <div className="flex items-center justify-between text-[11.5px] font-mono tabular-nums">
                        <span className="text-slate-200 flex items-center gap-2 whitespace-nowrap">
                          <span className="text-slate-500 text-[10px]">0{idx + 1}</span>
                          <span>{drv.label}</span>
                        </span>
                        <span className="font-semibold whitespace-nowrap" style={{ color: drv.color }}>
                          {drv.attribution_pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${barPct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.85, delay: idx * 0.05, ease: EASE_OUT }}
                          className="h-full rounded-full"
                          style={{
                            background: `linear-gradient(90deg, ${drv.color}99, ${drv.color})`,
                            boxShadow: `0 0 12px -2px ${drv.color}88`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Compact Role Directive Callout */}
            <div className="pt-4 border-t border-white/[0.06] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-300" />
                  <span className="eyebrow !text-slate-300">Role Directive</span>
                </div>

                <SegmentedControl
                  options={roleOptions}
                  value={selectedAudience}
                  onChange={onSelectAudience}
                  layoutId="shap-role"
                  size="sm"
                  accent="rgba(56, 189, 248, 0.16)"
                  accentBorder="rgba(56, 189, 248, 0.35)"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/[0.06] text-[12px] text-slate-300 leading-relaxed">
                {audienceBrief.actionProtocol}
              </div>
            </div>
          </SpotlightCard>
        </Reveal>
      </div>
    </section>
  );
}
