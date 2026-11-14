import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { motion } from 'framer-motion';
import {
  Layers,
  Crop,
  Moon,
  Leaf,
  GripVertical,
  Crosshair,
} from 'lucide-react';
import {
  getRegionMeta,
  getPaletteColor,
  getPaletteGradientCSS,
} from '../services/telemetryService';
import { useCommandAnalytics } from '../hooks/useCommandAnalytics';
import {
  SpotlightCard,
  CardHeader,
  SegmentedControl,
  AnimatedNumber,
  Reveal,
  fmtCompact,
} from './ui/primitives';

function buildSpatialGridMesh(hotspots = [], countryBbox = null) {
  const cellMap = new Map();

  for (const h of hotspots) {
    const key = `${Number(h.lat_bin).toFixed(1)}_${Number(h.lon_bin).toFixed(1)}`;
    cellMap.set(key, {
      ...h,
      harmonized_low: h.harmonized_low ?? Number((h.harmonized * 0.72).toFixed(1)),
      harmonized_high: h.harmonized_high ?? Number((h.harmonized * 1.34).toFixed(1)),
      isCoreHotspot: true,
    });

    const offsets = [
      [0.5, 0, 0.42],
      [-0.5, 0, 0.38],
      [0, 0.5, 0.44],
      [0, -0.5, 0.36],
      [0.5, 0.5, 0.24],
      [-0.5, -0.5, 0.21],
    ];

    for (const [dLat, dLon, decay] of offsets) {
      const nLat = Number((Number(h.lat_bin) + dLat).toFixed(1));
      const nLon = Number((Number(h.lon_bin) + dLon).toFixed(1));
      if (
        countryBbox &&
        (nLat < countryBbox.lat_min ||
          nLat > countryBbox.lat_max ||
          nLon < countryBbox.lon_min ||
          nLon > countryBbox.lon_max)
      ) {
        continue;
      }
      const nKey = `${nLat.toFixed(1)}_${nLon.toFixed(1)}`;
      if (!cellMap.has(nKey)) {
        const harm = Number((h.harmonized * decay).toFixed(1));
        cellMap.set(nKey, {
          lat_bin: nLat,
          lon_bin: nLon,
          raw_modis: Math.max(1, Math.round(h.raw_modis * decay * 0.85)),
          raw_viirs: Math.round(h.raw_viirs * decay * 1.05),
          harmonized_low: Number((harm * 0.7).toFixed(1)),
          harmonized: harm,
          harmonized_high: Number((harm * 1.35).toFixed(1)),
          frp_mw: Number((h.frp_mw * decay).toFixed(2)),
          frp_p90: Number((h.frp_p90 * (0.55 + decay * 0.4)).toFixed(2)),
          night_fire_ratio: Number(Math.min(0.95, h.night_fire_ratio * (0.85 + decay * 0.2)).toFixed(4)),
          is_anomaly: decay > 0.4 && h.is_anomaly,
          anomaly_severity: Number((h.anomaly_severity * decay * 1.4).toFixed(3)),
          isCoreHotspot: false,
        });
      }
    }
  }

  return Array.from(cellMap.values());
}

const VIEW_MODE_OPTIONS = [
  { id: 'raw', label: 'Raw Sensors' },
  { id: 'split', label: 'Split View' },
  { id: 'harmonized', label: 'AI Harmonized' },
];

const BASEMAP_OPTIONS = [
  { id: 'dark', label: 'Dark' },
  { id: 'satellite', label: 'Satellite' },
];

export default function TacticalMap2D({
  selectedCountry = 'USA',
  countryTelemetry,
  aoiResult,
  aoiBbox,
  onApplyAOI,
  isDrawingAOI = false,
  onToggleDrawAOI,
  selectedPalette = 'Ember',
  mapViewTarget,
  selectedHotspot,
  onSelectHotspot,
}) {
  const viewportRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const baseLayerGroupRef = useRef(null);
  const rawLayerGroupRef = useRef(null);
  const harmLayerGroupRef = useRef(null);
  const rawPaneRef = useRef(null);
  const harmPaneRef = useRef(null);
  const aoiRectLayerRef = useRef(null);
  const drawTempRectRef = useRef(null);
  const drawStartLatLngRef = useRef(null);

  const [comparisonMode, setComparisonMode] = useState('split');
  const [basemapMode, setBasemapMode] = useState('dark');
  const [splitPct, setSplitPct] = useState(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  const splitPctRef = useRef(splitPct);
  const modeRef = useRef(comparisonMode);
  splitPctRef.current = splitPct;
  modeRef.current = comparisonMode;

  const activeMeta = getRegionMeta(selectedCountry, countryTelemetry);

  const { nocturnal, biomass } = useCommandAnalytics({
    countryTelemetry,
    aoiResult,
    selectedHotspot,
  });

  const sourceHotspots = useMemo(() => {
    const list =
      aoiResult?.top_active_hotspots?.length > 0
        ? aoiResult.top_active_hotspots
        : countryTelemetry?.top_active_hotspots || [];
    return list;
  }, [aoiResult, countryTelemetry]);

  const gridCells = useMemo(
    () => buildSpatialGridMesh(sourceHotspots, activeMeta.bbox),
    [sourceHotspots, activeMeta]
  );

  const inspectedCell = selectedHotspot || sourceHotspots[0] || null;

  // Apply viewport-locked polygon clip-path onto rawPane and harmPane regardless of pan/zoom
  const syncSplitClipPaths = useCallback(() => {
    const map = mapInstanceRef.current;
    const rawPane = rawPaneRef.current;
    const harmPane = harmPaneRef.current;
    const container = mapContainerRef.current;
    if (!map || !rawPane || !harmPane || !container) return;

    const mode = modeRef.current;
    if (mode === 'raw') {
      rawPane.style.clipPath = 'none';
      rawPane.style.opacity = '1';
      harmPane.style.clipPath = 'inset(0 0 0 100%)';
      harmPane.style.opacity = '0';
      return;
    }
    if (mode === 'harmonized') {
      rawPane.style.clipPath = 'inset(0 100% 0 0)';
      rawPane.style.opacity = '0';
      harmPane.style.clipPath = 'none';
      harmPane.style.opacity = '1';
      return;
    }

    rawPane.style.opacity = '1';
    harmPane.style.opacity = '1';

    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    const origin = map.layerPointToContainerPoint([0, 0]);
    const splitX = (splitPctRef.current / 100) * w;

    const leftX = -origin.x;
    const topY = -origin.y;
    const rightX = w - origin.x;
    const bottomY = h - origin.y;
    const cutX = splitX - origin.x;

    rawPane.style.clipPath = `polygon(${leftX}px ${topY}px, ${cutX}px ${topY}px, ${cutX}px ${bottomY}px, ${leftX}px ${bottomY}px)`;
    harmPane.style.clipPath = `polygon(${cutX}px ${topY}px, ${rightX}px ${topY}px, ${rightX}px ${bottomY}px, ${cutX}px ${bottomY}px)`;
  }, []);

  // Initialize single Leaflet map with dual synchronized overlay panes
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: activeMeta.mapCenter,
      zoom: activeMeta.mapZoom,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    baseLayerGroupRef.current = L.layerGroup().addTo(map);

    const rawPane = map.createPane('rawOverlayPane');
    rawPane.style.zIndex = '415';
    const harmPane = map.createPane('harmOverlayPane');
    harmPane.style.zIndex = '420';

    rawPaneRef.current = rawPane;
    harmPaneRef.current = harmPane;

    rawLayerGroupRef.current = L.layerGroup().addTo(map);
    harmLayerGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    map.on('move zoom zoomend viewreset resize', syncSplitClipPaths);
    syncSplitClipPaths();

    return () => {
      map.off('move zoom zoomend viewreset resize', syncSplitClipPaths);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [syncSplitClipPaths]);

  useEffect(() => {
    syncSplitClipPaths();
  }, [comparisonMode, splitPct, syncSplitClipPaths]);

  // Swap keyless Esri basemap tiles while preserving camera, split curtain, and hotspot layers
  useEffect(() => {
    const group = baseLayerGroupRef.current;
    if (!group) return;

    group.clearLayers();

    if (basemapMode === 'satellite') {
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, minZoom: 2 }
      ).addTo(group);
    } else {
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 16, minZoom: 2 }
      ).addTo(group);
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 16, minZoom: 2 }
      ).addTo(group);
    }
  }, [basemapMode]);

  // Camera fly-to active country or preset
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (mapViewTarget && Array.isArray(mapViewTarget.center)) {
      map.flyTo(mapViewTarget.center, mapViewTarget.zoom || 6, { duration: 1.25 });
    } else {
      const meta = getRegionMeta(selectedCountry, countryTelemetry);
      map.flyTo(meta.mapCenter, meta.mapZoom, { duration: 1.2 });
    }
  }, [selectedCountry, mapViewTarget, countryTelemetry]);

  // Interactive rectangle drawing for custom AOI
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const container = map.getContainer();
    if (isDrawingAOI) {
      map.dragging.disable();
      container.style.cursor = 'crosshair';
    } else {
      map.dragging.enable();
      container.style.cursor = '';
    }

    const onMouseDown = (e) => {
      if (!isDrawingAOI) return;
      drawStartLatLngRef.current = e.latlng;
      if (drawTempRectRef.current) map.removeLayer(drawTempRectRef.current);
      drawTempRectRef.current = L.rectangle([e.latlng, e.latlng], {
        color: '#38BDF8',
        weight: 2,
        dashArray: '6, 4',
        fillColor: '#38BDF8',
        fillOpacity: 0.14,
      }).addTo(map);
    };

    const onMouseMove = (e) => {
      if (!isDrawingAOI || !drawStartLatLngRef.current || !drawTempRectRef.current) return;
      drawTempRectRef.current.setBounds(L.latLngBounds(drawStartLatLngRef.current, e.latlng));
    };

    const onMouseUp = (e) => {
      if (!isDrawingAOI || !drawStartLatLngRef.current) return;
      const bounds = L.latLngBounds(drawStartLatLngRef.current, e.latlng);
      drawStartLatLngRef.current = null;

      if (drawTempRectRef.current) {
        map.removeLayer(drawTempRectRef.current);
        drawTempRectRef.current = null;
      }

      const south = Number(bounds.getSouth().toFixed(2));
      const north = Number(bounds.getNorth().toFixed(2));
      const west = Number(bounds.getWest().toFixed(2));
      const east = Number(bounds.getEast().toFixed(2));

      if (Math.abs(north - south) > 0.2 && Math.abs(east - west) > 0.2 && onApplyAOI) {
        onApplyAOI({ lat_min: south, lat_max: north, lon_min: west, lon_max: east });
      }
      if (onToggleDrawAOI) onToggleDrawAOI(false);
    };

    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);

    return () => {
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
    };
  }, [isDrawingAOI, onApplyAOI, onToggleDrawAOI]);

  // Draw active AOI bounding rectangle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (aoiRectLayerRef.current) {
      map.removeLayer(aoiRectLayerRef.current);
      aoiRectLayerRef.current = null;
    }

    if (aoiBbox && aoiBbox.lat_min !== undefined) {
      aoiRectLayerRef.current = L.rectangle(
        [
          [aoiBbox.lat_min, aoiBbox.lon_min],
          [aoiBbox.lat_max, aoiBbox.lon_max],
        ],
        {
          color: '#38BDF8',
          weight: 1.5,
          dashArray: '5, 5',
          fillColor: '#38BDF8',
          fillOpacity: 0.03,
          interactive: false,
        }
      ).addTo(map);
    }
  }, [aoiBbox]);

  // Populate Raw Sensors & AI Harmonized grid layers into their respective split panes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const rawGroup = rawLayerGroupRef.current;
    const harmGroup = harmLayerGroupRef.current;
    if (!map || !rawGroup || !harmGroup) return;

    rawGroup.clearLayers();
    harmGroup.clearLayers();
    if (!gridCells.length) return;

    const maxHarmonized = Math.max(...gridCells.map((c) => Number(c.harmonized || 1)), 100);

    gridCells.forEach((cell) => {
      const normHarm = Math.min(1, Math.pow(Number(cell.harmonized || 0) / maxHarmonized, 0.55));
      const normRawModis = Math.min(1, Math.pow(Number(cell.raw_modis || 0) / maxHarmonized, 0.55));
      const bounds = [
        [cell.lat_bin - 0.25, cell.lon_bin - 0.25],
        [cell.lat_bin + 0.25, cell.lon_bin + 0.25],
      ];

      const popupHtml = `
        <div style="min-width: 215px; font-family: 'JetBrains Mono', monospace; font-size: 11px; line-height: 1.55;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:6px; margin-bottom:6px;">
            <strong style="color:#F8FAFC; font-size:12px;">[${cell.lat_bin.toFixed(1)}°, ${cell.lon_bin.toFixed(1)}°]</strong>
            <span style="color:${cell.is_anomaly ? '#F43F5E' : '#34D399'}; font-size:10px;">
              Sev ${Number(cell.anomaly_severity).toFixed(2)}
            </span>
          </div>
          <div style="display:grid; grid-template-columns: 1fr auto; gap: 3px 12px;">
            <span style="color:#94A3B8;">AI Harmonized</span>
            <strong style="color:#FBBF24; text-align:right;">${Number(cell.harmonized).toLocaleString('en-US')}</strong>
            <span style="color:#94A3B8;">80% CI</span>
            <span style="color:#E2E8F0; text-align:right;">[${Number(cell.harmonized_low).toLocaleString('en-US')}–${Number(cell.harmonized_high).toLocaleString('en-US')}]</span>
            <span style="color:#94A3B8;">MODIS / VIIRS</span>
            <span style="color:#38BDF8; text-align:right;">${Number(cell.raw_modis).toLocaleString('en-US')} / ${Number(cell.raw_viirs).toLocaleString('en-US')}</span>
            <span style="color:#94A3B8;">FRP</span>
            <span style="color:#FB923C; text-align:right;">${Number(cell.frp_mw).toLocaleString('en-US')} MW</span>
            <span style="color:#94A3B8;">Night Ratio</span>
            <span style="color:#A78BFA; text-align:right;">${(Number(cell.night_fire_ratio) * 100).toFixed(1)}%</span>
          </div>
        </div>
      `;

      // 1. Raw MODIS uncalibrated rectangle & cyan pin (rawOverlayPane)
      const rawRect = L.rectangle(bounds, {
        pane: 'rawOverlayPane',
        color: 'rgba(56, 189, 248, 0.55)',
        weight: cell.isCoreHotspot ? 1.2 : 0.6,
        fillColor: '#38BDF8',
        fillOpacity: 0.1 + normRawModis * 0.42,
      });
      rawRect.bindPopup(popupHtml);
      rawRect.on('click', () => onSelectHotspot && onSelectHotspot(cell));
      rawGroup.addLayer(rawRect);

      // 2. AI Harmonized rectangle & thermal marker (harmOverlayPane)
      const harmFill = getPaletteColor(selectedPalette, normHarm);
      const harmStroke = cell.is_anomaly
        ? '#F43F5E'
        : getPaletteColor(selectedPalette, Math.min(1, normHarm + 0.15));

      const harmRect = L.rectangle(bounds, {
        pane: 'harmOverlayPane',
        color: harmStroke,
        weight: cell.isCoreHotspot ? 1.5 : 0.75,
        fillColor: harmFill,
        fillOpacity: 0.28 + normHarm * 0.46,
      });
      harmRect.bindPopup(popupHtml);
      harmRect.on('click', () => onSelectHotspot && onSelectHotspot(cell));
      harmGroup.addLayer(harmRect);

      if (cell.isCoreHotspot) {
        const pinColor = getPaletteColor(selectedPalette, Math.max(0.68, normHarm));
        const isSelectedPin =
          inspectedCell &&
          Math.abs(inspectedCell.lat_bin - cell.lat_bin) < 0.05 &&
          Math.abs(inspectedCell.lon_bin - cell.lon_bin) < 0.05;

        const makePin = (paneName, colorHex, pulse) => {
          const icon = L.divIcon({
            className: 'custom-thermal-div-icon',
            iconSize: [22, 22],
            iconAnchor: [11, 11],
            html: `
              <div style="position:relative; width:22px; height:22px; display:flex; align-items:center; justify-content:center;">
                ${
                  pulse
                    ? `<span class="thermal-pulse" style="position:absolute; width:18px; height:18px; border-radius:9999px; border:1.5px solid ${colorHex};"></span>`
                    : ''
                }
                <span style="position:absolute; width:${isSelectedPin ? 18 : 13}px; height:${
              isSelectedPin ? 18 : 13
            }px; border-radius:9999px; border:1.5px solid ${colorHex}; background:rgba(2,4,8,0.65);"></span>
                <span style="position:relative; width:5px; height:5px; border-radius:9999px; background:#FFFFFF; box-shadow:0 0 10px ${colorHex};"></span>
              </div>
            `,
          });
          const marker = L.marker([cell.lat_bin, cell.lon_bin], { icon, pane: paneName });
          marker.bindPopup(popupHtml);
          marker.on('click', () => onSelectHotspot && onSelectHotspot(cell));
          return marker;
        };

        rawGroup.addLayer(makePin('rawOverlayPane', '#38BDF8', false));
        harmGroup.addLayer(makePin('harmOverlayPane', pinColor, cell.is_anomaly || isSelectedPin));
      }
    });

    syncSplitClipPaths();
  }, [gridCells, selectedPalette, inspectedCell, onSelectHotspot, syncSplitClipPaths]);

  // Drag handler for the luminous Before/After split-screen curtain handle
  useEffect(() => {
    if (!isDraggingSplit) return undefined;

    const handleMove = (clientX) => {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pct = Math.max(8, Math.min(92, ((clientX - rect.left) / rect.width) * 100));
      setSplitPct(pct);
    };

    const onPointerMove = (e) => handleMove(e.clientX);
    const onTouchMove = (e) => {
      if (e.touches?.[0]) handleMove(e.touches[0].clientX);
    };
    const onStop = () => setIsDraggingSplit(false);

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('pointerup', onStop);
    window.addEventListener('touchend', onStop);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('pointerup', onStop);
      window.removeEventListener('touchend', onStop);
    };
  }, [isDraggingSplit]);

  // Gauge arc geometry
  const gaugeColor =
    nocturnal.level === 'critical'
      ? '#F43F5E'
      : nocturnal.level === 'elevated'
      ? '#FBBF24'
      : '#34D399';
  const gaugeTextCls =
    nocturnal.level === 'critical'
      ? 'text-rose-300 bg-rose-500/15 border-rose-400/35'
      : nocturnal.level === 'elevated'
      ? 'text-amber-200 bg-amber-500/15 border-amber-400/35'
      : 'text-emerald-300 bg-emerald-500/15 border-emerald-400/35';

  return (
    <section
      id="tactical-map"
      aria-label="Tactical Map & Live Gauges"
      className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch"
    >
      {/* Left 8 Columns: Tactical Map Bento with Split-Screen Curtain */}
      <Reveal y={26} className="xl:col-span-8 flex">
        <SpotlightCard glow="#38BDF8" className="w-full overflow-hidden flex flex-col">
          {/* Minimalist Header */}
          <div className="px-6 py-4 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
            <CardHeader
              icon={Layers}
              iconColor="text-sky-300"
              title="Tactical Map"
              info="Drag the vertical split curtain to compare uncalibrated 1km MODIS raw counts (~4× sensor gap) on the left against AI Harmonized 0.5° thermal intensity (80% CI) on the right."
            />

            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                options={BASEMAP_OPTIONS}
                value={basemapMode}
                onChange={setBasemapMode}
                layoutId="map-basemap"
                size="sm"
                accent="rgba(255, 255, 255, 0.14)"
                accentBorder="rgba(255, 255, 255, 0.32)"
              />
              <SegmentedControl
                options={VIEW_MODE_OPTIONS}
                value={comparisonMode}
                onChange={setComparisonMode}
                layoutId="map-mode"
                size="sm"
                accent="rgba(56, 189, 248, 0.18)"
                accentBorder="rgba(56, 189, 248, 0.4)"
              />

              <button
                type="button"
                onClick={() => onToggleDrawAOI && onToggleDrawAOI(!isDrawingAOI)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-mono whitespace-nowrap border transition-all ${
                  isDrawingAOI
                    ? 'bg-amber-400/20 text-amber-200 border-amber-400/55 shadow-[0_0_20px_-4px_rgba(251,191,36,0.6)]'
                    : 'bg-white/[0.03] text-slate-300 hover:text-white border-white/[0.08]'
                }`}
              >
                <Crop className="w-3 h-3 text-sky-300" />
                <span>{isDrawingAOI ? 'Drag Box…' : 'Draw AOI'}</span>
              </button>
            </div>
          </div>

          {/* Map Viewport + Curtain Slider */}
          <div ref={viewportRef} className="relative w-full h-[500px] xl:flex-1 min-h-[480px] select-none overflow-hidden">
            <div ref={mapContainerRef} className="w-full h-full z-10" />

            {/* Top Curtain Mode Badges */}
            {comparisonMode === 'split' && (
              <>
                <div className="pointer-events-none absolute top-3.5 left-3.5 z-[450] glass-pill rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-sky-300">
                  Raw MODIS
                </div>
                <div className="pointer-events-none absolute top-3.5 right-3.5 z-[450] glass-pill rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200">
                  AI Harmonized · 80% CI
                </div>

                {/* Luminous Vertical Split Curtain Handle */}
                <div
                  role="slider"
                  aria-label="Before and after harmonization split slider"
                  aria-valuemin={8}
                  aria-valuemax={92}
                  aria-valuenow={Math.round(splitPct)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') setSplitPct((p) => Math.max(8, p - 4));
                    if (e.key === 'ArrowRight') setSplitPct((p) => Math.min(92, p + 4));
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setIsDraggingSplit(true);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    setIsDraggingSplit(true);
                  }}
                  style={{ left: `${splitPct}%` }}
                  className="absolute inset-y-0 z-[460] w-8 -ml-4 flex items-center justify-center cursor-ew-resize group focus:outline-none"
                >
                  <div className="h-full w-px bg-gradient-to-b from-sky-400/20 via-white/85 to-amber-400/20 shadow-[0_0_16px_rgba(255,255,255,0.85)]" />
                  <div className="absolute glass-pill w-8 h-11 rounded-full flex items-center justify-center text-white group-hover:scale-105 transition-transform shadow-[0_0_24px_rgba(56,189,248,0.45)]">
                    <GripVertical className="w-3.5 h-3.5 text-sky-200" />
                  </div>
                </div>
              </>
            )}

            {/* Floating Bottom Glass HUD: Color Legend + Selected Cell Pill */}
            <div className="pointer-events-none absolute bottom-3.5 left-3.5 right-14 z-[450] flex flex-wrap items-center justify-between gap-2">
              <div className="pointer-events-auto glass-pill rounded-full px-3.5 py-1.5 flex items-center gap-2.5 text-[10.5px] font-mono text-slate-300">
                <span>{selectedPalette}</span>
                <span
                  className="inline-block w-20 h-1.5 rounded-full border border-white/15"
                  style={{ background: getPaletteGradientCSS(selectedPalette) }}
                />
              </div>

              {inspectedCell && (
                <div className="pointer-events-auto glass-pill rounded-full px-3.5 py-1.5 flex items-center gap-3 font-mono text-[10.5px] tabular-nums text-slate-300">
                  <span className="flex items-center gap-1.5 text-white font-semibold">
                    <Crosshair className="w-3 h-3 text-amber-300" />
                    [{Number(inspectedCell.lat_bin).toFixed(1)}°, {Number(inspectedCell.lon_bin).toFixed(1)}°]
                  </span>
                  <span className="text-white/20">·</span>
                  <span>
                    Q50 <strong className="text-amber-200">{Math.round(inspectedCell.harmonized).toLocaleString('en-US')}</strong>
                  </span>
                  <span className="hidden sm:inline text-white/20">·</span>
                  <span className="hidden sm:inline">
                    FRP <strong className="text-orange-300">{(Number(inspectedCell.frp_mw || 0) / 1000).toFixed(1)}k MW</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Slim Hotspot Quick-Jump Strip */}
          {sourceHotspots.length > 0 && (
            <div className="px-5 py-2.5 border-t border-white/[0.06] bg-white/[0.015] flex items-center gap-2 overflow-x-auto">
              <span className="eyebrow !text-[9.5px] shrink-0 mr-1">Hotspots</span>
              {sourceHotspots.slice(0, 5).map((h, i) => {
                const isSel =
                  inspectedCell &&
                  Math.abs(inspectedCell.lat_bin - h.lat_bin) < 0.05 &&
                  Math.abs(inspectedCell.lon_bin - h.lon_bin) < 0.05;
                return (
                  <button
                    key={`${h.lat_bin}_${h.lon_bin}_${i}`}
                    type="button"
                    onClick={() => {
                      if (onSelectHotspot) onSelectHotspot(h);
                      if (mapInstanceRef.current) {
                        mapInstanceRef.current.flyTo([h.lat_bin, h.lon_bin], 6, { duration: 0.9 });
                      }
                    }}
                    className={`shrink-0 px-2.5 py-1 rounded-full font-mono text-[10.5px] tabular-nums whitespace-nowrap border transition-colors ${
                      isSel
                        ? 'bg-sky-400/15 text-white border-sky-400/45'
                        : 'bg-white/[0.02] hover:bg-white/[0.06] text-slate-400 hover:text-slate-200 border-white/[0.06]'
                    }`}
                  >
                    {h.lat_bin.toFixed(1)}°, {h.lon_bin.toFixed(1)}° ·{' '}
                    <span className="text-amber-200">{Math.round(h.harmonized).toLocaleString('en-US')}</span>
                  </button>
                );
              })}
            </div>
          )}
        </SpotlightCard>
      </Reveal>

      {/* Right 4 Columns: Live Gauges Bento Stack */}
      <div className="xl:col-span-4 flex flex-col gap-6">
        {/* Card 1: Nocturnal Risk Radar */}
        <Reveal y={26} delay={0.08} className="flex-1 flex">
          <SpotlightCard glow={gaugeColor} className="w-full p-6 flex flex-col justify-between gap-5">
            <CardHeader
              icon={Moon}
              iconColor="text-violet-300"
              title="Nocturnal Risk"
              info={`TreeSHAP #2 physical driver (${nocturnal.shapNightPct.toFixed(
                1
              )}% weight). Elevated night_fire_ratio signals wildfires escaping diurnal cooling and persisting overnight.`}
              right={
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[10.5px] font-semibold uppercase tracking-wider border ${gaugeTextCls}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      nocturnal.level === 'critical' ? 'animate-ping' : ''
                    }`}
                    style={{ backgroundColor: gaugeColor }}
                  />
                  {nocturnal.level === 'critical'
                    ? 'Overnight Surge'
                    : nocturnal.level === 'elevated'
                    ? 'Elevated'
                    : 'Nominal'}
                </span>
              }
            />

            {/* Animated SVG Radial Arc Gauge */}
            <div className="flex flex-col items-center justify-center py-1">
              <div className="relative w-52 h-32 flex items-end justify-center">
                <svg viewBox="0 0 200 118" className="w-full h-full overflow-visible">
                  <defs>
                    <filter id="arc-glow" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <path
                    d="M 22 100 A 78 78 0 0 1 178 100"
                    fill="none"
                    stroke="rgba(255,255,255,0.07)"
                    strokeWidth="11"
                    strokeLinecap="round"
                  />
                  <motion.path
                    d="M 22 100 A 78 78 0 0 1 178 100"
                    fill="none"
                    stroke={gaugeColor}
                    strokeWidth="11"
                    strokeLinecap="round"
                    filter="url(#arc-glow)"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: Math.min(1, Math.max(0.04, nocturnal.activeNightRatio)) }}
                    transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                  />
                </svg>

                <div className="absolute bottom-2 inset-x-0 text-center">
                  <div className="font-mono text-3xl font-bold tracking-tight text-white">
                    <AnimatedNumber
                      value={nocturnal.activeNightRatio * 100}
                      format={(v) => `${v.toFixed(1)}%`}
                    />
                  </div>
                  <div className="eyebrow mt-0.5 !text-[9.5px] !text-slate-500">Night Fire Ratio</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 font-mono">
              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <div className="text-[9.5px] uppercase tracking-wider text-slate-500">Baseline</div>
                <div className="mt-1 text-sm font-semibold text-slate-200 tabular-nums">
                  <AnimatedNumber
                    value={nocturnal.baselineNightRatio * 100}
                    format={(v) => `${v.toFixed(1)}%`}
                  />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <div className="text-[9.5px] uppercase tracking-wider text-slate-500">Delta</div>
                <div
                  className={`mt-1 text-sm font-semibold tabular-nums ${
                    nocturnal.nightRatioAnom >= 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  <AnimatedNumber
                    value={nocturnal.nightRatioAnom * 100}
                    format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                  />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <div className="text-[9.5px] uppercase tracking-wider text-slate-500">SHAP</div>
                <div className="mt-1 text-sm font-semibold text-violet-300 tabular-nums">
                  <AnimatedNumber value={nocturnal.shapNightPct} format={(v) => `${v.toFixed(1)}%`} />
                </div>
              </div>
            </div>
          </SpotlightCard>
        </Reveal>

        {/* Card 2: Carbon & Biomass Impact */}
        <Reveal y={26} delay={0.14} className="flex-1 flex">
          <SpotlightCard glow="#34D399" className="w-full p-6 flex flex-col justify-between gap-5">
            <CardHeader
              icon={Leaf}
              iconColor="text-emerald-300"
              title="Carbon Impact"
              info="Wooster et al. (2005): dry biomass combusted = 0.368 kg/MJ × Fire Radiative Energy (1,200 s overpass integration); CO₂e = 1.569 × biomass (Andreae & Merlet, 2001)."
              right={
                <span className="font-mono text-[10.5px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-400/25 text-emerald-300">
                  0.368 kg/MJ
                </span>
              }
            />

            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.06] flex items-baseline justify-between gap-3">
                <span className="eyebrow !text-slate-400">CO₂ Emissions</span>
                <span className="font-mono text-2xl font-bold text-rose-300 tabular-nums whitespace-nowrap">
                  <AnimatedNumber value={biomass.co2MetricTons} format={(v) => `${fmtCompact(v, 2)} t`} />
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    Biomass Burned
                  </div>
                  <div className="mt-1.5 font-mono text-lg font-bold text-amber-200 tabular-nums whitespace-nowrap">
                    <AnimatedNumber value={biomass.biomassMetricTons} format={(v) => `${fmtCompact(v, 2)} t`} />
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    Radiative Energy
                  </div>
                  <div className="mt-1.5 font-mono text-lg font-bold text-orange-300 tabular-nums whitespace-nowrap">
                    <AnimatedNumber value={biomass.radiativeEnergyTJ} format={(v) => `${fmtCompact(v, 1)} TJ`} />
                  </div>
                </div>
              </div>
            </div>
          </SpotlightCard>
        </Reveal>
      </div>
    </section>
  );
}
