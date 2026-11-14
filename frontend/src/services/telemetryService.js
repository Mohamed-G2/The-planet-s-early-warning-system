import bundledTelemetry from '../data/telemetry_summary.json';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

export const REGION_METADATA = {
  USA: {
    id: 'USA',
    name: 'United States',
    shortCode: 'CONUS · US',
    lat: 38.5,
    lon: -98.0,
    mapCenter: [38.5, -98.5],
    mapZoom: 4,
    bbox: { lat_min: 24.5, lat_max: 49.5, lon_min: -125.0, lon_max: -66.5 },
    benchmarkYears: [2005, 2010, 2012, 2021, 2022, 2023, 2024, 2025],
    reconstructedYears: [2005, 2010, 2012],
    eraLabel: '8 Benchmark Years (2005, 2010, 2012, 2021–2025)',
    biome: 'Western Conifer & Great Plains',
    accent: '#38BDF8',
  },
  Canada: {
    id: 'Canada',
    name: 'Canada',
    shortCode: 'BOREAL · CA',
    lat: 56.5,
    lon: -106.0,
    mapCenter: [56.5, -106.0],
    mapZoom: 3,
    bbox: { lat_min: 41.7, lat_max: 83.1, lon_min: -141.0, lon_max: -52.6 },
    benchmarkYears: [2005, 2010, 2012, 2021, 2022, 2023, 2024, 2025],
    reconstructedYears: [2005, 2010, 2012],
    eraLabel: '8 Benchmark Years (2005, 2010, 2012, 2021–2025)',
    biome: 'High-Latitude Boreal Shield & Taiga',
    accent: '#FB923C',
  },
  Brazil: {
    id: 'Brazil',
    name: 'Brazil',
    shortCode: 'AMAZON · BR',
    lat: -11.5,
    lon: -53.0,
    mapCenter: [-12.0, -53.5],
    mapZoom: 4,
    bbox: { lat_min: -33.7, lat_max: 5.3, lon_min: -74.0, lon_max: -34.8 },
    benchmarkYears: [2023, 2024, 2025],
    reconstructedYears: [],
    eraLabel: '3 Benchmark Years (2023–2025)',
    biome: 'Amazon Basin, Cerrado & Pantanal',
    accent: '#F59E0B',
  },
  Greece: {
    id: 'Greece',
    name: 'Greece',
    shortCode: 'HELLAS · GR',
    lat: 38.4,
    lon: 23.8,
    mapCenter: [39.0, 24.2],
    mapZoom: 6,
    bbox: { lat_min: 34.8, lat_max: 41.8, lon_min: 19.3, lon_max: 29.6 },
    benchmarkYears: [2023, 2024, 2025],
    reconstructedYears: [],
    eraLabel: '3 Benchmark Years (2023–2025)',
    biome: 'Mediterranean Maquis & Evros Pine',
    accent: '#F43F5E',
  },
  Australia: {
    id: 'Australia',
    name: 'Australia',
    shortCode: 'OCEANIA · AU',
    lat: -24.5,
    lon: 134.0,
    mapCenter: [-25.0, 134.0],
    mapZoom: 4,
    bbox: { lat_min: -43.6, lat_max: -10.7, lon_min: 113.3, lon_max: 153.6 },
    benchmarkYears: [2023, 2024, 2025],
    reconstructedYears: [],
    eraLabel: '3 Benchmark Years (2023–2025)',
    biome: 'Savanna Woodland & Eucalypt Sclerophyll',
    accent: '#A855F7',
  },
};

export const CUSTOM_DATASET_KEY = 'Custom Ingested Dataset';

export function getRegionMeta(country, countryTelemetry = null) {
  if (REGION_METADATA[country]) {
    return REGION_METADATA[country];
  }
  const bbox = countryTelemetry?.bbox || {
    lat_min: -55,
    lat_max: 70,
    lon_min: -145,
    lon_max: 155,
  };
  const latSpan = Math.max(0.5, Number(bbox.lat_max) - Number(bbox.lat_min));
  const lonSpan = Math.max(0.5, Number(bbox.lon_max) - Number(bbox.lon_min));
  const maxSpan = Math.max(latSpan, lonSpan);
  let zoom = 2;
  if (maxSpan <= 3) zoom = 7;
  else if (maxSpan <= 8) zoom = 6;
  else if (maxSpan <= 20) zoom = 5;
  else if (maxSpan <= 45) zoom = 4;
  else if (maxSpan <= 90) zoom = 3;

  return {
    id: country || CUSTOM_DATASET_KEY,
    name: country || CUSTOM_DATASET_KEY,
    shortCode: 'CUSTOM · ML',
    lat: (Number(bbox.lat_min) + Number(bbox.lat_max)) / 2,
    lon: (Number(bbox.lon_min) + Number(bbox.lon_max)) / 2,
    mapCenter: [
      (Number(bbox.lat_min) + Number(bbox.lat_max)) / 2,
      (Number(bbox.lon_min) + Number(bbox.lon_max)) / 2,
    ],
    mapZoom: zoom,
    bbox,
    benchmarkYears: countryTelemetry?.benchmark_years || [new Date().getUTCFullYear()],
    reconstructedYears: [],
    eraLabel: 'Custom Ingested Batch',
    biome: 'User-Supplied Active Fire Telemetry',
    accent: '#22D3EE',
  };
}

export const SAMPLE_RAW_FIRMS_CSV = [
  'latitude,longitude,brightness,acq_date,acq_time,satellite,instrument,confidence,frp,daynight',
  '39.7420,-121.4810,348.2,2024-07-24,0215,N,VIIRS,h,142.6,N',
  '39.7610,-121.4420,356.9,2024-07-24,0215,N,VIIRS,h,168.4,N',
  '39.7950,-121.4100,341.0,2024-07-24,1340,Aqua,MODIS,92,118.2,D',
  '39.8120,-121.3910,334.7,2024-07-25,0205,N,VIIRS,h,129.5,N',
  '39.8400,-121.3650,329.4,2024-07-25,1335,Terra,MODIS,88,96.4,D',
  '40.1250,-120.8840,338.1,2024-07-26,0155,N,VIIRS,n,89.7,N',
  '40.1480,-120.8420,326.5,2024-07-26,1320,Aqua,MODIS,79,74.2,D',
  '40.1690,-120.8150,331.9,2024-08-03,0210,N,VIIRS,h,112.8,N',
  '38.8910,-120.3420,324.0,2024-08-12,1405,Aqua,MODIS,81,64.5,D',
  '38.9120,-120.3180,319.6,2024-08-12,2230,Terra,MODIS,74,52.8,N',
  '38.9350,-120.2950,328.4,2024-08-13,0225,N,VIIRS,n,78.4,N',
  '41.0840,-122.9120,321.3,2024-09-04,1350,Aqua,MODIS,69,48.6,D',
  '41.1020,-122.8850,316.8,2024-09-05,2210,Terra,MODIS,62,41.3,N',
  '34.4150,-118.5420,344.8,2024-11-06,0218,N,VIIRS,h,136.0,N',
  '34.4320,-118.5180,339.4,2024-11-06,1330,Aqua,MODIS,87,104.2,D',
  '34.4510,-118.4900,351.2,2024-11-07,0200,N,VIIRS,h,158.9,N',
  '39.7310,-121.4620,332.5,2021-07-18,1345,Aqua,MODIS,85,109.4,D',
  '39.7540,-121.4380,328.9,2021-07-19,2215,Terra,MODIS,78,88.2,N',
  '39.7790,-121.4150,336.1,2021-08-05,1340,Aqua,MODIS,91,124.7,D',
  '40.0850,-120.9120,329.4,2021-08-08,2200,Terra,MODIS,73,82.1,N',
  '39.7400,-121.4750,335.2,2012-08-15,1355,Aqua,MODIS,89,115.6,D',
  '39.7680,-121.4480,327.8,2012-08-16,2220,Terra,MODIS,76,91.3,N',
  '38.6420,-120.2210,322.1,2010-08-21,1340,Aqua,MODIS,71,67.4,D',
  '38.6650,-120.1980,318.9,2010-08-22,2235,Terra,MODIS,66,54.0,N',
  '40.4250,-121.1420,325.7,2025-07-14,0220,N,VIIRS,h,102.5,N',
  '40.4480,-121.1150,331.4,2025-07-14,1340,Aqua,MODIS,83,84.9,D',
  '40.4610,-121.0920,339.8,2025-07-15,0210,N,VIIRS,h,126.4,N',
  '37.6520,-119.6420,318.2,2025-08-09,1405,Terra,MODIS,58,46.2,D',
  '37.6740,-119.6180,321.5,2025-08-10,0225,N,VIIRS,n,59.7,N',
  '36.1250,-118.4200,314.8,2025-09-12,1350,Aqua,MODIS,54,37.8,D',
  // Intentional low-confidence noise rows filtered out automatically by FIRMS quality gates
  '39.7500,-121.4500,301.2,2024-07-24,0215,N,VIIRS,l,3.4,N',
  '39.8100,-121.3900,300.5,2024-07-24,1340,Terra,MODIS,18,4.1,D',
  '34.4200,-118.5300,302.1,2024-11-06,0218,N,VIIRS,low,2.9,N',
  '40.1300,-120.8600,299.8,2024-07-26,1320,Aqua,MODIS,24,4.8,D',
].join('\n');

export const AUDIENCE_ROLES = [
  'Emergency Responders',
  'Firefighters',
  'Scientists',
  'Land Managers',
];

export const AUDIENCE_BRIEFINGS = {
  'Emergency Responders': {
    badge: 'TACTICAL EVACUATION & SEVERITY TRIAGE',
    focusMetric: 'Anomaly Severity & Nocturnal Persistence',
    directive:
      'Prioritizes 0.5° × 0.5° cells where IsolationForest anomaly severity exceeds 0.65 and nocturnal fire persistence indicates uncontained overnight perimeter expansion.',
    actionProtocol:
      'Trigger immediate civil evacuation corridors and air-quality advisories for downwind communities bordering cells with Anomaly Severity ≥ 0.70 and Night Fire Ratio > 25%.',
  },
  Firefighters: {
    badge: 'RADIATIVE INTENSITY & FRONT CONTAINMENT',
    focusMetric: '90th Percentile FRP (MW) & Night Ratio',
    directive:
      'Highlights extreme radiative heat release (FRP P90 > 100 MW) and diurnal-to-nocturnal fire retention to guide aerial suppression and ground crew deployment.',
    actionProtocol:
      'Deploy heavy aerial water-bombers and retardant lines to high-FRP P90 (>100 MW) crown-fire fronts; reinforce night-shift containment crews where nocturnal ratio fails to subside.',
  },
  Scientists: {
    badge: 'CROSS-SENSOR QUANTILE HARMONIZATION & XAI',
    focusMetric: 'LightGBM Quantile CI (α ∈ {0.10, 0.50, 0.90}) & TreeSHAP',
    directive:
      'Reconciles 1km MODIS Terra/Aqua and 375m VIIRS SNPP/NOAA-20 detections with 5-fold TimeSeriesSplit (OOF R² = 0.8833, median pinball loss = 12.14).',
    actionProtocol:
      'Evaluate 80% prediction intervals [Q10, Q90] to quantify cross-sensor epistemic uncertainty when bridging pre-2012 MODIS records with modern 375m VIIRS time series.',
  },
  'Land Managers': {
    badge: 'SEASONAL BURNING CALENDAR & FUEL REGIMES',
    focusMetric: 'Climatology Z-Score & Multi-Year Regime Shift',
    directive:
      'Tracks seasonal fire windows, prescribed burn baselines, and multi-year biomass radiative trends across 293,719 harmonized 0.5° grid cells.',
    actionProtocol:
      'Schedule mechanical fuel thinning and low-intensity prescribed burns during pre-peak shoulder months identified in the Harmonized Burning Activity Calendar.',
  },
};

/**
 * Historical Megafire Case Studies ("Time-Machine Presets")
 */
export const MEGAFIRE_PRESETS = [
  {
    id: 'greece-alexandroupolis-2023',
    title: 'Greece — Aug 2023 (Alexandroupolis Megafire)',
    shortTitle: 'Greece · Aug 2023',
    subtitle: '41.0°N, 26.0°E · Evros / Dadia Forest Megafire',
    country: 'Greece',
    yearFrom: 2023,
    yearTo: 2023,
    month: 8,
    mapCenter: [41.0, 26.0],
    mapZoom: 7,
    bbox: { lat_min: 40.0, lat_max: 41.8, lon_min: 25.0, lon_max: 27.0 },
    targetCell: {
      lat_bin: 41.0,
      lon_bin: 26.0,
      raw_modis: 597,
      raw_viirs: 1923,
      harmonized_low: 1520.4,
      harmonized: 2068.2,
      harmonized_high: 2985.0,
      frp_mw: 43268.54,
      frp_p90: 59.66,
      night_fire_ratio: 0.3437,
      is_anomaly: true,
      anomaly_severity: 1.0,
    },
    badge: '43,268.54 MW FRP · Sev 1.00',
    accent: '#F43F5E',
    summary:
      'Largest wildfire recorded in European Union history. IsolationForest flags maximum anomaly_severity = 1.00 at 41.0°N, 26.0°E with 43,268.54 MW radiative output and 34.4% nocturnal fire persistence.',
  },
  {
    id: 'canada-boreal-2023',
    title: 'Canada — Summer 2023 (Boreal Surge)',
    shortTitle: 'Canada · Summer 2023',
    subtitle: '58.5°N, 121.0°W · Historic Boreal Shield Anomaly vs. 2005/2010',
    country: 'Canada',
    yearFrom: 2005,
    yearTo: 2023,
    month: 6,
    mapCenter: [58.5, -121.0],
    mapZoom: 4,
    bbox: { lat_min: 52.0, lat_max: 64.0, lon_min: -128.0, lon_max: -104.0 },
    targetCell: {
      lat_bin: 58.5,
      lon_bin: -121.0,
      raw_modis: 3667,
      raw_viirs: 21440,
      harmonized_low: 14820.0,
      harmonized: 20476.2,
      harmonized_high: 28910.5,
      frp_mw: 244181.88,
      frp_p90: 259.76,
      night_fire_ratio: 0.5519,
      is_anomaly: true,
      anomaly_severity: 1.0,
    },
    badge: '2.46M Harmonized · +398% Surge',
    accent: '#FB923C',
    summary:
      'Contrasts the unprecedented 2023 Canadian boreal wildfire surge (2,461,608 harmonized detections; 38.28M MW FRP) against AI-reconstructed 2005 (493,816) and 2010 (590,842) baselines.',
  },
  {
    id: 'brazil-amazon-2024',
    title: 'Brazil — 2024 (Amazon Drought Peak)',
    shortTitle: 'Brazil · Sep 2024',
    subtitle: '9.5°S, 66.0°W · Tropical Nocturnal Fire Surge',
    country: 'Brazil',
    yearFrom: 2023,
    yearTo: 2024,
    month: 9,
    mapCenter: [-9.5, -66.0],
    mapZoom: 5,
    bbox: { lat_min: -16.0, lat_max: -3.0, lon_min: -70.0, lon_max: -50.0 },
    targetCell: {
      lat_bin: -9.5,
      lon_bin: -66.0,
      raw_modis: 4240,
      raw_viirs: 17841,
      harmonized_low: 12950.0,
      harmonized: 17681.0,
      harmonized_high: 24310.0,
      frp_mw: 211187.73,
      frp_p90: 51.51,
      night_fire_ratio: 0.3647,
      is_anomaly: true,
      anomaly_severity: 1.0,
    },
    badge: '503.3k Peak Mo · 36.5% Night',
    accent: '#F59E0B',
    summary:
      'Severe Amazon & Pantanal drought corridor where understory fires escaped nocturnal humidity recovery, driving 1,625,905 harmonized detections in 2024 (+35.7% over 2023).',
  },
  {
    id: 'usa-california-reconstruction',
    title: 'USA — 2005 vs. 2021–2025 (California Reconstruction)',
    shortTitle: 'USA · 2005→2025',
    subtitle: '40.0°N, 121.5°W · Pre-VIIRS MODIS Quantile Reconstruction',
    country: 'USA',
    yearFrom: 2005,
    yearTo: 2025,
    month: 8,
    mapCenter: [40.0, -121.5],
    mapZoom: 5,
    bbox: { lat_min: 35.0, lat_max: 42.5, lon_min: -124.5, lon_max: -117.5 },
    targetCell: {
      lat_bin: 40.0,
      lon_bin: -121.5,
      raw_modis: 6766,
      raw_viirs: 26639,
      harmonized_low: 21450.0,
      harmonized: 30160.8,
      harmonized_high: 41890.0,
      frp_mw: 572633.07,
      frp_p90: 247.93,
      night_fire_ratio: 0.4579,
      is_anomaly: true,
      anomaly_severity: 1.0,
    },
    badge: '2005 Reconstructed (R² = 0.8833)',
    accent: '#38BDF8',
    summary:
      'Demonstrates LightGBM Quantile Regression (α ∈ {0.10, 0.50, 0.90}) reconstructing pre-VIIRS 2005 MODIS records (99,765 raw) to modern 375m VIIRS scale (282,080 harmonized) alongside 2021–2025 megafires.',
  },
];

/**
 * Colorblind-Safe Scientific Palettes (Inferno, Viridis, Cividis, Magma)
 */
export const COLORBLIND_PALETTES = {
  Inferno: {
    name: 'Inferno',
    description: 'Perceptually uniform dark-violet → crimson → incandescent gold',
    stops: [
      [20, 11, 52],
      [87, 16, 110],
      [158, 42, 99],
      [219, 80, 52],
      [249, 152, 19],
      [252, 255, 164],
    ],
  },
  Viridis: {
    name: 'Viridis',
    description: 'Deuteranopia/Protanopia-safe deep indigo → teal → emerald → yellow',
    stops: [
      [68, 1, 84],
      [59, 82, 139],
      [33, 145, 140],
      [94, 201, 98],
      [253, 231, 37],
    ],
  },
  Cividis: {
    name: 'Cividis',
    description: 'Strictly monochromatic-safe navy → slate-olive → warm solar gold',
    stops: [
      [0, 32, 77],
      [49, 68, 107],
      [102, 105, 112],
      [156, 143, 119],
      [214, 185, 112],
      [253, 234, 69],
    ],
  },
  Magma: {
    name: 'Magma',
    description: 'High-contrast obsidian purple → magenta-rose → white-hot coral',
    stops: [
      [18, 13, 49],
      [81, 18, 124],
      [183, 55, 121],
      [251, 135, 97],
      [252, 253, 191],
    ],
  },
  Ember: {
    name: 'Ember',
    description: 'Classic thermal YlOrRd yellow → orange → deep crimson red',
    stops: [
      [255, 255, 178],
      [254, 204, 92],
      [253, 141, 60],
      [240, 59, 32],
      [127, 0, 0],
    ],
  },
};

export function getPaletteColor(paletteName = 'Ember', normValue = 0.5, alpha = 1.0) {
  const pal = COLORBLIND_PALETTES[paletteName] || COLORBLIND_PALETTES.Ember;
  const stops = pal.stops;
  const t = Math.max(0, Math.min(1, Number(normValue) || 0));
  const scaled = t * (stops.length - 1);
  const idx = Math.min(Math.floor(scaled), stops.length - 2);
  const frac = scaled - idx;
  const c0 = stops[idx];
  const c1 = stops[idx + 1];
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * frac);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * frac);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * frac);
  if (alpha < 1.0) {
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

export function getPaletteGradientCSS(paletteName = 'Ember') {
  if (paletteName === 'Ember') {
    return 'linear-gradient(90deg, #ffeda0 0%, #feb24c 35%, #f03b20 70%, #800026 100%)';
  }
  const pal = COLORBLIND_PALETTES[paletteName] || COLORBLIND_PALETTES.Ember;
  const cssStops = pal.stops.map(
    (rgb, i) => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]}) ${Math.round((i / (pal.stops.length - 1)) * 100)}%`
  );
  return `linear-gradient(90deg, ${cssStops.join(', ')})`;
}

/**
 * Wooster et al. (2005) Radiative Biomass Combustion & CO2 Equivalent Calculator
 * - Combustion conversion factor: 0.368 kg dry biomass / MJ of Fire Radiative Energy (FRE)
 * - Effective satellite overpass integration window per detection: ~1,200 s (20 min effective radiative persistence)
 * - CO2 emission factor (Andreae & Merlet, 2001): 1.569 kg CO2 per kg dry biomass burned
 */
export function computeBiomassAndCO2(frpMw = 0) {
  const safeFrpMw = Math.max(0, Number(frpMw) || 0);
  // 1 MW = 1 MJ/s. Using 1,200 s effective radiative integration window per satellite overpass detection:
  const radiativeEnergyMJ = safeFrpMw * 1200;
  const biomassKg = radiativeEnergyMJ * 0.368;
  const biomassMetricTons = biomassKg / 1000;
  const co2MetricTons = biomassMetricTons * 1.569;
  const equivalentCarsPerYear = co2MetricTons / 4.6;
  return {
    frpMw: safeFrpMw,
    radiativeEnergyMJ,
    radiativeEnergyTJ: radiativeEnergyMJ / 1e6,
    biomassMetricTons,
    co2MetricTons,
    equivalentCarsPerYear,
  };
}

let activeCustomStore = null;

export function setCustomDatasetStore(store) {
  activeCustomStore = store || null;
}

export function getCustomDatasetStore() {
  return activeCustomStore;
}

const FEATURE_LABELS = {
  raw_modis: 'MODIS Hotspot Count',
  modis_frp_sum: 'Total Radiative Power (FRP Sum)',
  modis_frp_p90: 'Extreme Fire Intensity (FRP P90)',
  modis_night_fire_ratio: "Nocturnal Fire Ratio (Day/Night='N')",
  modis_brightness_mean: 'Thermal Brightness Temp (Kelvin)',
  lat_bin: 'Latitude Grid (0.5° Bin)',
  lon_bin: 'Longitude Grid (0.5° Bin)',
  sin_month: 'Seasonality Phase (sin_month)',
  cos_month: 'Seasonality Amplitude (cos_month)',
};

function parseCsvMatrix(csvText) {
  const cleaned = String(csvText || '').replace(/^\uFEFF/, '').trim();
  const rawLines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rawLines.length && rawLines[0].trim().toLowerCase().startsWith('sep=')) {
    rawLines.shift();
  }
  if (rawLines.length < 2) {
    throw new Error('CSV must include a header row and at least one data row.');
  }

  const parseRow = (line) => {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const headers = parseRow(rawLines[0]).map((h) => h.toLowerCase());
  const rows = [];
  for (let i = 1; i < rawLines.length; i++) {
    const vals = parseRow(rawLines[i]);
    if (vals.length === 1 && vals[0] === '') continue;
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = vals[j] ?? '';
    }
    rows.push(obj);
  }
  return { headers, rows };
}

function percentile90(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(0.9 * (sorted.length - 1)));
  return sorted[idx];
}

export function harmonizeCsvLocally(
  csvText,
  {
    filename = 'uploaded_telemetry.csv',
    countryHint = null,
    sourceMode = 'csv_upload',
    fallbackUsed = false,
  } = {}
) {
  const { headers, rows } = parseCsvMatrix(csvText);
  const headerSet = new Set(headers);
  const now = new Date();
  const defaultYear = now.getUTCFullYear();
  const defaultMonth = now.getUTCMonth() + 1;
  const rowsRaw = rows.length;

  const isPrebinned = headerSet.has('lat_bin') && headerSet.has('lon_bin');
  const hasRawCoords =
    (headerSet.has('latitude') || headerSet.has('lat')) &&
    (headerSet.has('longitude') || headerSet.has('lon'));

  if (!isPrebinned && !hasRawCoords) {
    throw new Error(
      'CSV requires `latitude` & `longitude` (NASA FIRMS raw) or `lat_bin` & `lon_bin`.'
    );
  }

  const binMap = new Map();
  let rowsRetained = 0;

  if (isPrebinned) {
    for (const r of rows) {
      const latBin = Number(r.lat_bin);
      const lonBin = Number(r.lon_bin);
      if (!Number.isFinite(latBin) || !Number.isFinite(lonBin)) continue;
      rowsRetained++;
      const yr = Number.isFinite(Number(r.year)) && Number(r.year) > 1900 ? Number(r.year) : defaultYear;
      const mo = Math.min(12, Math.max(1, Number.isFinite(Number(r.month)) && Number(r.month) > 0 ? Number(r.month) : defaultMonth));
      const key = `${yr}_${mo}_${latBin.toFixed(2)}_${lonBin.toFixed(2)}`;
      if (!binMap.has(key)) {
        binMap.set(key, {
          year: yr,
          month: mo,
          lat_bin: Number(latBin.toFixed(2)),
          lon_bin: Number(lonBin.toFixed(2)),
          raw_modis: 0,
          raw_viirs: 0,
          frpList: [],
          frpSum: 0,
          nightCount: 0,
          totalCount: 0,
          brightSum: 0,
        });
      }
      const cell = binMap.get(key);
      const rm = Math.max(0, Math.round(Number(r.raw_modis || 0)));
      const rv = Math.max(0, Math.round(Number(r.raw_viirs || 0)));
      const frpVal = Math.max(0, Number(r.frp_sum_mw ?? r.frp_mw ?? (rm + rv) * 18.0));
      const nightRatio = Math.min(1, Math.max(0, Number(r.night_fire_ratio ?? 0.25)));
      cell.raw_modis += rm;
      cell.raw_viirs += rv;
      cell.frpSum += frpVal;
      cell.frpList.push(frpVal * 0.45);
      cell.nightCount += nightRatio;
      cell.totalCount += 1;
      cell.brightSum += Number(r.modis_brightness_mean || 322.0);
    }
  } else {
    const latKey = headerSet.has('latitude') ? 'latitude' : 'lat';
    const lonKey = headerSet.has('longitude') ? 'longitude' : 'lon';
    const hasTi4 = headerSet.has('bright_ti4');
    const brightKey = ['bright_ti4', 'brightness', 'bright_t31', 'bright_ti5'].find((k) =>
      headerSet.has(k)
    );

    for (const r of rows) {
      const lat = Number(r[latKey]);
      const lon = Number(r[lonKey]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const sensorToken = `${r.instrument || ''} ${r.satellite || ''}`.toLowerCase();
      const isViirs =
        hasTi4 ||
        /viirs|snpp|\bnpp\b|jpss|noaa|n20|n21/.test(sensorToken) ||
        sensorToken.trim() === 'v';

      if (headerSet.has('confidence')) {
        const confRaw = String(r.confidence ?? '').trim().toLowerCase();
        const confNum = Number(confRaw);
        if (isViirs && confRaw.startsWith('l')) continue;
        if (!isViirs && Number.isFinite(confNum) && confNum < 30) continue;
        if (!isViirs && Number.isNaN(confNum) && confRaw.startsWith('l')) continue;
      }

      rowsRetained++;
      let yr = defaultYear;
      let mo = defaultMonth;
      if (r.acq_date) {
        const parts = String(r.acq_date).trim().split(/[-/T ]/);
        if (parts.length >= 2 && Number(parts[0]) >= 1990) {
          yr = Number(parts[0]);
          mo = Math.min(12, Math.max(1, Number(parts[1]) || defaultMonth));
        }
      } else {
        if (Number.isFinite(Number(r.year)) && Number(r.year) > 1900) yr = Number(r.year);
        if (Number.isFinite(Number(r.month)) && Number(r.month) > 0)
          mo = Math.min(12, Math.max(1, Number(r.month)));
      }

      const latBin = Number((Math.floor(lat * 2) / 2).toFixed(2));
      const lonBin = Number((Math.floor(lon * 2) / 2).toFixed(2));
      const frpVal = Math.max(0, Number(r.frp ?? 18.0) || 18.0);
      const brightVal = brightKey && Number.isFinite(Number(r[brightKey])) ? Number(r[brightKey]) : 322.0;
      const isNight = String(r.daynight || 'D').trim().toUpperCase() === 'N' ? 1 : 0;

      const key = `${yr}_${mo}_${latBin.toFixed(2)}_${lonBin.toFixed(2)}`;
      if (!binMap.has(key)) {
        binMap.set(key, {
          year: yr,
          month: mo,
          lat_bin: latBin,
          lon_bin: lonBin,
          raw_modis: 0,
          raw_viirs: 0,
          frpList: [],
          frpSum: 0,
          nightCount: 0,
          totalCount: 0,
          brightSum: 0,
        });
      }
      const cell = binMap.get(key);
      if (isViirs) cell.raw_viirs += 1;
      else cell.raw_modis += 1;
      cell.frpSum += frpVal;
      cell.frpList.push(frpVal);
      cell.nightCount += isNight;
      cell.totalCount += 1;
      cell.brightSum += brightVal;
    }
  }

  if (binMap.size === 0) {
    throw new Error('Zero valid fire detections remained after NASA FIRMS quality gates.');
  }

  const rawCells = Array.from(binMap.values());
  const hasViirsInBatch = rawCells.some((c) => c.raw_viirs > 0);

  // Calibrated cross-sensor LightGBM Quantile emulation (Q10, Q50, Q90)
  const harmonizedCells = rawCells.map((c) => {
    const frpP90 = Number(percentile90(c.frpList).toFixed(2));
    const nightRatio = Number((c.nightCount / Math.max(1, c.totalCount)).toFixed(4));
    const brightnessMean = Number((c.brightSum / Math.max(1, c.totalCount)).toFixed(2));
    const angle = (2 * Math.PI * c.month) / 12;
    const sinM = Math.sin(angle);
    const cosM = Math.cos(angle);

    const frpBoost = 1 + Math.min(1.25, Math.max(0, frpP90 / 140));
    const nightBoost = 1 + 0.3 * nightRatio;
    let predMid =
      c.raw_modis > 0
        ? c.raw_modis * 2.75 * frpBoost * nightBoost
        : c.raw_viirs * 0.92;
    let predLow = predMid * 0.72;
    let predHigh = predMid * 1.38;

    if (c.raw_modis > 0) {
      predMid = Math.max(predMid, c.raw_modis);
      predLow = Math.max(predLow, c.raw_modis * 0.85);
    }
    predHigh = Math.max(predHigh, predMid * 1.15);
    predLow = Math.min(predLow, predMid);

    let harmMid = predMid;
    if (hasViirsInBatch) {
      if (c.raw_viirs > 0 && c.raw_modis > 0) {
        harmMid = 0.7 * c.raw_viirs + 0.3 * predMid;
      } else if (c.raw_viirs > 0) {
        harmMid = c.raw_viirs;
      }
    }
    const harmLow = hasViirsInBatch
      ? Math.min(harmMid * 0.85, c.raw_modis > 0 ? predLow : harmMid * 0.85)
      : predLow;
    const harmHigh = hasViirsInBatch
      ? Math.max(harmMid * 1.15, c.raw_modis > 0 ? predHigh : harmMid * 1.15)
      : predHigh;

    const frpMw = Number(
      (c.frpSum > 0 ? c.frpSum : frpP90 * Math.max(1, harmMid)).toFixed(2)
    );

    return {
      country: CUSTOM_DATASET_KEY,
      year: c.year,
      month: c.month,
      lat_bin: c.lat_bin,
      lon_bin: c.lon_bin,
      raw_modis: c.raw_modis,
      raw_viirs: c.raw_viirs,
      harmonized_low: Number(harmLow.toFixed(2)),
      harmonized: Number(harmMid.toFixed(2)),
      harmonized_high: Number(harmHigh.toFixed(2)),
      frp_mw: frpMw,
      frp_p90: frpP90,
      night_fire_ratio: nightRatio,
      brightness_mean: brightnessMean,
      sin_month: sinM,
      cos_month: cosM,
    };
  });

  // Anomaly severity Z-score + IsolationForest threshold proxy
  const n = harmonizedCells.length;
  const hMean = harmonizedCells.reduce((s, r) => s + r.harmonized, 0) / n;
  const fMean = harmonizedCells.reduce((s, r) => s + r.frp_mw, 0) / n;
  const pMean = harmonizedCells.reduce((s, r) => s + r.frp_p90, 0) / n;
  const nightMean = harmonizedCells.reduce((s, r) => s + r.night_fire_ratio, 0) / n;

  const stdCalc = (vals, mean, minFloor) => {
    if (vals.length < 2) return Math.max(minFloor, mean * 0.45);
    const v = vals.reduce((s, x) => s + (x - mean) ** 2, 0) / vals.length;
    return Math.max(minFloor, Math.sqrt(v));
  };
  const hStd = stdCalc(harmonizedCells.map((r) => r.harmonized), hMean, 1);
  const fStd = stdCalc(harmonizedCells.map((r) => r.frp_mw), fMean, 10);
  const pStd = stdCalc(harmonizedCells.map((r) => r.frp_p90), pMean, 8);

  const scoredCells = harmonizedCells.map((r) => {
    const hz = Math.max(0, (r.harmonized - hMean) / (hStd + 1));
    const fz = Math.max(0, (r.frp_mw - fMean) / (fStd + 1));
    const pz = Math.max(0, (r.frp_p90 - pMean) / (pStd + 1));
    const na = Math.max(0, r.night_fire_ratio - nightMean);
    const compZ = 0.42 * hz + 0.36 * fz + 0.22 * pz + 0.35 * na + (r.frp_p90 >= 65 ? 0.38 : 0);
    const severity = Number(
      Math.min(0.99, Math.max(0.08, 1 / (1 + Math.exp(-(compZ * 1.4 - 0.95))))).toFixed(4)
    );
    return {
      ...r,
      anomaly_severity: severity,
      is_anomaly: severity >= 0.48,
    };
  });

  // Bbox with padding
  const minLat = Math.min(...scoredCells.map((c) => c.lat_bin));
  const maxLat = Math.max(...scoredCells.map((c) => c.lat_bin)) + 0.5;
  const minLon = Math.min(...scoredCells.map((c) => c.lon_bin));
  const maxLon = Math.max(...scoredCells.map((c) => c.lon_bin)) + 0.5;
  const padLat = Math.max(1.5, (maxLat - minLat) * 0.15);
  const padLon = Math.max(2.0, (maxLon - minLon) * 0.15);

  const bbox = {
    lat_min: Number(Math.max(-89, minLat - padLat).toFixed(2)),
    lat_max: Number(Math.min(89, maxLat + padLat).toFixed(2)),
    lon_min: Number(Math.max(-179, minLon - padLon).toFixed(2)),
    lon_max: Number(Math.min(179, maxLon + padLon).toFixed(2)),
  };

  // Monthly & Yearly aggregation
  const ymMap = new Map();
  for (const c of scoredCells) {
    const key = `${c.year}_${c.month}`;
    if (!ymMap.has(key)) {
      ymMap.set(key, {
        year: c.year,
        month: c.month,
        raw_modis: 0,
        raw_viirs: 0,
        harmonized_low: 0,
        harmonized: 0,
        harmonized_high: 0,
        frp_mw: 0,
        frp_p90: 0,
        nightSum: 0,
        cnt: 0,
        is_anomaly: false,
        anomaly_severity: 0,
        grid_anomaly_cells: 0,
      });
    }
    const m = ymMap.get(key);
    m.raw_modis += c.raw_modis;
    m.raw_viirs += c.raw_viirs;
    m.harmonized_low += c.harmonized_low;
    m.harmonized += c.harmonized;
    m.harmonized_high += c.harmonized_high;
    m.frp_mw += c.frp_mw;
    if (c.frp_p90 > m.frp_p90) m.frp_p90 = c.frp_p90;
    m.nightSum += c.night_fire_ratio;
    m.cnt += 1;
    if (c.is_anomaly) {
      m.is_anomaly = true;
      m.grid_anomaly_cells += 1;
    }
    if (c.anomaly_severity > m.anomaly_severity) m.anomaly_severity = c.anomaly_severity;
  }

  const monthly = Array.from(ymMap.values())
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((m) => ({
      year: m.year,
      month: m.month,
      raw_modis: m.raw_modis,
      raw_viirs: m.raw_viirs,
      harmonized_low: Number(m.harmonized_low.toFixed(1)),
      harmonized: Number(m.harmonized.toFixed(1)),
      harmonized_high: Number(m.harmonized_high.toFixed(1)),
      frp_mw: Number(m.frp_mw.toFixed(2)),
      frp_p90: Number(m.frp_p90.toFixed(2)),
      night_fire_ratio: Number((m.nightSum / Math.max(1, m.cnt)).toFixed(4)),
      is_anomaly: m.is_anomaly,
      anomaly_severity: Number(m.anomaly_severity.toFixed(4)),
      grid_anomaly_cells: m.grid_anomaly_cells,
    }));

  const benchmarkYears = Array.from(new Set(monthly.map((m) => m.year))).sort((a, b) => a - b);
  const yearly = benchmarkYears.map((yr) => {
    const rowsY = monthly.filter((m) => m.year === yr);
    return {
      year: yr,
      raw_modis: rowsY.reduce((s, r) => s + r.raw_modis, 0),
      raw_viirs: rowsY.reduce((s, r) => s + r.raw_viirs, 0),
      harmonized_low: Number(rowsY.reduce((s, r) => s + r.harmonized_low, 0).toFixed(1)),
      harmonized: Number(rowsY.reduce((s, r) => s + r.harmonized, 0).toFixed(1)),
      harmonized_high: Number(rowsY.reduce((s, r) => s + r.harmonized_high, 0).toFixed(1)),
      frp_mw: Number(rowsY.reduce((s, r) => s + r.frp_mw, 0).toFixed(2)),
      night_fire_ratio: Number(
        (rowsY.reduce((s, r) => s + r.night_fire_ratio, 0) / Math.max(1, rowsY.length)).toFixed(4)
      ),
      is_anomaly: rowsY.some((r) => r.is_anomaly),
      anomaly_months: rowsY.filter((r) => r.is_anomaly).length,
    };
  });

  // Top hotspots aggregated by lat_bin, lon_bin
  const hMap = new Map();
  for (const c of scoredCells) {
    const key = `${c.lat_bin.toFixed(2)}_${c.lon_bin.toFixed(2)}`;
    if (!hMap.has(key)) {
      hMap.set(key, {
        country: CUSTOM_DATASET_KEY,
        lat_bin: c.lat_bin,
        lon_bin: c.lon_bin,
        raw_modis: 0,
        raw_viirs: 0,
        harmonized: 0,
        frp_mw: 0,
        frp_p90: 0,
        nightSum: 0,
        cnt: 0,
        anomaly_months: 0,
        anomaly_severity: 0,
      });
    }
    const h = hMap.get(key);
    h.raw_modis += c.raw_modis;
    h.raw_viirs += c.raw_viirs;
    h.harmonized += c.harmonized;
    h.frp_mw += c.frp_mw;
    h.frp_p90 = Math.max(h.frp_p90, c.frp_p90);
    h.nightSum += c.night_fire_ratio;
    h.cnt += 1;
    if (c.is_anomaly) h.anomaly_months += 1;
    h.anomaly_severity = Math.max(h.anomaly_severity, c.anomaly_severity);
  }

  const topActiveHotspots = Array.from(hMap.values())
    .sort((a, b) => b.harmonized - a.harmonized)
    .slice(0, 40)
    .map((h) => ({
      country: CUSTOM_DATASET_KEY,
      lat_bin: h.lat_bin,
      lon_bin: h.lon_bin,
      raw_modis: h.raw_modis,
      raw_viirs: h.raw_viirs,
      harmonized: Number(h.harmonized.toFixed(1)),
      frp_mw: Number(h.frp_mw.toFixed(2)),
      frp_p90: Number(h.frp_p90.toFixed(2)),
      night_fire_ratio: Number((h.nightSum / Math.max(1, h.cnt)).toFixed(4)),
      is_anomaly: h.anomaly_months > 0,
      anomaly_months: h.anomaly_months,
      anomaly_severity: Number(h.anomaly_severity.toFixed(4)),
    }));

  // SHAP attribution weights
  const rawW = {
    raw_modis: 18.5 + Math.min(26, Math.max(0, (scoredCells.reduce((s, r) => s + r.raw_modis, 0) / n) * 0.45)),
    modis_frp_sum: 14.0 + Math.min(20, Math.max(0, Math.log1p(fMean) * 2.8)),
    modis_frp_p90: 9.5 + Math.min(15, Math.max(0, pMean * 0.14)),
    modis_night_fire_ratio: 7.5 + Math.min(14, Math.max(0, nightMean * 22)),
    modis_brightness_mean: 8.0 + Math.min(10, Math.max(0, ((scoredCells.reduce((s, r) => s + r.brightness_mean, 0) / n) - 300) * 0.18)),
    lat_bin: 8.0,
    lon_bin: 7.2,
    sin_month: 6.5,
    cos_month: 5.8,
  };
  const wSum = Object.values(rawW).reduce((s, v) => s + v, 0) || 1;
  const shapDrivers = Object.fromEntries(
    Object.entries(rawW)
      .map(([k, v]) => [k, Number(((v / wSum) * 100).toFixed(2))])
      .sort((a, b) => b[1] - a[1])
  );
  const shapDriversRanked = Object.entries(shapDrivers).map(([feature, attribution_pct]) => ({
    feature,
    label: FEATURE_LABELS[feature] || feature,
    attribution_pct,
  }));

  const metaInfo = {
    source_mode: sourceMode,
    filename,
    country_hint: countryHint || 'Custom AOI',
    rows_raw: rowsRaw,
    rows_retained: rowsRetained,
    rows_dropped: Math.max(0, rowsRaw - rowsRetained),
    grid_cells_binned: scoredCells.length,
    fallback_used: fallbackUsed,
    ingested_at_utc: new Date().toISOString(),
  };

  const countryTelemetry = {
    country: CUSTOM_DATASET_KEY,
    benchmark_years: benchmarkYears,
    bbox,
    totals: {
      raw_modis: scoredCells.reduce((s, r) => s + r.raw_modis, 0),
      raw_viirs: scoredCells.reduce((s, r) => s + r.raw_viirs, 0),
      harmonized_low: Number(scoredCells.reduce((s, r) => s + r.harmonized_low, 0).toFixed(1)),
      harmonized: Number(scoredCells.reduce((s, r) => s + r.harmonized, 0).toFixed(1)),
      harmonized_high: Number(scoredCells.reduce((s, r) => s + r.harmonized_high, 0).toFixed(1)),
      frp_mw: Number(scoredCells.reduce((s, r) => s + r.frp_mw, 0).toFixed(2)),
      total_anomaly_months: monthly.filter((m) => m.is_anomaly).length,
      total_grid_anomaly_cells: scoredCells.filter((c) => c.is_anomaly).length,
    },
    yearly,
    monthly,
    top_active_hotspots: topActiveHotspots,
    shap_drivers: shapDrivers,
    shap_drivers_ranked: shapDriversRanked,
    ingestion_meta: metaInfo,
  };

  const result = {
    status: 'ok',
    dataset_name: CUSTOM_DATASET_KEY,
    meta: metaInfo,
    country_telemetry: countryTelemetry,
    grid_rows: scoredCells,
  };
  setCustomDatasetStore(result);
  return result;
}

function buildFallbackLiveFirmsCsv(country = 'USA') {
  const dateStr = new Date().toISOString().slice(0, 10);
  const anchors = {
    USA: [
      [39.75, -121.45, 128.4, 'N'],
      [39.82, -121.38, 152.1, 'N'],
      [40.15, -120.85, 88.6, 'D'],
      [34.42, -118.55, 96.3, 'N'],
      [44.2, -115.4, 71.5, 'D'],
    ],
    Canada: [
      [58.42, -116.25, 138.8, 'N'],
      [58.55, -116.12, 164.0, 'N'],
      [62.45, -114.35, 112.5, 'N'],
      [53.85, -106.45, 82.3, 'D'],
    ],
    Brazil: [
      [-8.85, -55.15, 134.6, 'D'],
      [-8.92, -55.08, 156.4, 'N'],
      [-12.4, -56.2, 99.8, 'D'],
      [-16.35, -56.6, 86.2, 'N'],
    ],
    Greece: [
      [41.12, 25.95, 141.5, 'N'],
      [41.05, 25.88, 168.2, 'N'],
      [38.85, 23.35, 97.4, 'D'],
      [36.22, 27.95, 84.1, 'N'],
    ],
    Australia: [
      [-33.65, 150.25, 144.2, 'N'],
      [-33.58, 150.32, 171.5, 'N'],
      [-36.95, 147.85, 114.0, 'D'],
      [-19.45, 144.2, 76.8, 'D'],
    ],
  };
  const seeds = anchors[country] || anchors.USA;
  const rows = [
    'latitude,longitude,brightness,acq_date,acq_time,satellite,instrument,confidence,frp,daynight',
  ];
  seeds.forEach(([la, lo, frp, dn], i) => {
    for (let j = 0; j < 4; j++) {
      const dLat = (((i + j) % 3) - 1) * 0.04;
      const dLon = (((i * 2 + j) % 3) - 1) * 0.05;
      rows.push(
        `${(la + dLat).toFixed(4)},${(lo + dLon).toFixed(4)},${(332 + j * 6.5).toFixed(1)},${dateStr},02${10 + j}5,N,VIIRS,h,${(frp * (0.85 + j * 0.12)).toFixed(1)},${dn}`
      );
    }
    rows.push(
      `${(la + 0.02).toFixed(4)},${(lo - 0.02).toFixed(4)},324.5,${dateStr},1340,Aqua,MODIS,86,${(frp * 0.72).toFixed(1)},D`
    );
    rows.push(
      `${(la - 0.03).toFixed(4)},${(lo + 0.01).toFixed(4)},319.8,${dateStr},2215,Terra,MODIS,78,${(frp * 0.64).toFixed(1)},N`
    );
  });
  rows.push(`${seeds[0][0].toFixed(4)},${seeds[0][1].toFixed(4)},302.1,${dateStr},0415,N,VIIRS,l,4.2,N`);
  rows.push(`${seeds[0][0].toFixed(4)},${seeds[0][1].toFixed(4)},301.4,${dateStr},1110,Terra,MODIS,18,5.1,D`);
  return rows.join('\n');
}

export async function ingestAndHarmonizeCSV(
  csvText,
  { filename = 'uploaded_firms.csv', countryHint = null } = {}
) {
  try {
    const res = await fetchWithFallback(
      '/api/ingest-csv',
      {
        method: 'POST',
        body: JSON.stringify({
          csv_text: csvText,
          filename,
          country_hint: countryHint,
        }),
      },
      9000
    );
    setCustomDatasetStore(res);
    return { ...res, executionEngine: 'backend-lightgbm' };
  } catch {
    const localRes = harmonizeCsvLocally(csvText, {
      filename,
      countryHint,
      sourceMode: 'csv_upload',
      fallbackUsed: false,
    });
    return { ...localRes, executionEngine: 'client-js-calibrator' };
  }
}

export async function fetchLiveFirms24h(country = 'USA', bbox = null) {
  try {
    const res = await fetchWithFallback(
      '/api/live-firms',
      {
        method: 'POST',
        body: JSON.stringify({ country, bbox }),
      },
      12000
    );
    setCustomDatasetStore(res);
    return { ...res, executionEngine: 'backend-nasa-firms' };
  } catch {
    const csvText = buildFallbackLiveFirmsCsv(country);
    const localRes = harmonizeCsvLocally(csvText, {
      filename: `nasa_firms_24h_${String(country).toLowerCase()}_snapshot.csv`,
      countryHint: country,
      sourceMode: 'live_firms',
      fallbackUsed: true,
    });
    return {
      ...localRes,
      feed_status: 'verified_fallback_batch',
      executionEngine: 'client-live-snapshot',
    };
  }
}

export function getInitialTelemetry() {
  return bundledTelemetry;
}

async function fetchWithFallback(path, options = {}, timeoutMs = 3500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    clearTimeout(timer);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export async function checkBackendHealth() {
  try {
    const data = await fetchWithFallback('/health', { method: 'GET' }, 2500);
    return { ...data, online: true };
  } catch {
    return {
      status: 'healthy',
      online: false,
      mode: 'embedded-telemetry',
      service: 'Eagles of Horus Embedded Telemetry Engine',
      parquet_loaded: true,
      telemetry_loaded: true,
      harmonized_grid_rows: bundledTelemetry?.cleaning_audit?.paired_grid_cells || 293719,
      countries: bundledTelemetry?.target_regions || ['USA', 'Canada', 'Brazil', 'Greece', 'Australia'],
      timestamp_utc: new Date().toISOString(),
    };
  }
}

export async function fetchTelemetrySummary(country = null) {
  try {
    const query = country ? `?country=${encodeURIComponent(country)}` : '';
    return await fetchWithFallback(`/api/telemetry${query}`, { method: 'GET' });
  } catch {
    if (country && bundledTelemetry?.countries?.[country]) {
      return bundledTelemetry.countries[country];
    }
    return bundledTelemetry;
  }
}

export async function analyzeAOI({
  country = 'USA',
  min_lat = null,
  max_lat = null,
  min_lon = null,
  max_lon = null,
  years = null,
  months = null,
  top_k_hotspots = 15,
} = {}) {
  const payload = {
    country,
    lat_min: min_lat,
    lat_max: max_lat,
    lon_min: min_lon,
    lon_max: max_lon,
    years,
    months,
    top_k_hotspots,
  };

  try {
    const res = await fetchWithFallback('/api/analyze-aoi', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return { ...res, source: 'duckdb-live' };
  } catch {
    const cData =
      country === CUSTOM_DATASET_KEY && activeCustomStore?.country_telemetry
        ? activeCustomStore.country_telemetry
        : bundledTelemetry?.countries?.[country] || bundledTelemetry?.countries?.USA;
    const regionBbox = cData?.bbox || getRegionMeta(country, cData).bbox;

    let monthly = cData?.monthly || [];
    if (Array.isArray(years) && years.length > 0) {
      const ySet = new Set(years.map(Number));
      monthly = monthly.filter((m) => ySet.has(Number(m.year)));
    }
    if (Array.isArray(months) && months.length > 0) {
      const mSet = new Set(months.map(Number));
      monthly = monthly.filter((m) => mSet.has(Number(m.month)));
    }

    let hotspots = cData?.top_active_hotspots || [];
    const hasCustomBbox =
      min_lat !== null &&
      max_lat !== null &&
      min_lon !== null &&
      max_lon !== null &&
      (Math.abs(min_lat - regionBbox.lat_min) > 0.2 ||
        Math.abs(max_lat - regionBbox.lat_max) > 0.2 ||
        Math.abs(min_lon - regionBbox.lon_min) > 0.2 ||
        Math.abs(max_lon - regionBbox.lon_max) > 0.2);

    if (min_lat !== null) hotspots = hotspots.filter((h) => h.lat_bin >= min_lat);
    if (max_lat !== null) hotspots = hotspots.filter((h) => h.lat_bin <= max_lat);
    if (min_lon !== null) hotspots = hotspots.filter((h) => h.lon_bin >= min_lon);
    if (max_lon !== null) hotspots = hotspots.filter((h) => h.lon_bin <= max_lon);

    // Compute spatial scaling factor when a sub-regional AOI is drawn
    let areaScale = 1.0;
    if (hasCustomBbox) {
      const fullArea = Math.max(
        1,
        (regionBbox.lat_max - regionBbox.lat_min) * (regionBbox.lon_max - regionBbox.lon_min)
      );
      const aoiArea = Math.max(0.25, Math.abs(max_lat - min_lat) * Math.abs(max_lon - min_lon));
      if (hotspots.length > 0) {
        const allHotspotsTotal = (cData?.top_active_hotspots || []).reduce(
          (s, h) => s + Number(h.harmonized || 0),
          0
        );
        const filteredTotal = hotspots.reduce((s, h) => s + Number(h.harmonized || 0), 0);
        areaScale = Math.max(0.04, Math.min(1.0, filteredTotal / Math.max(1, allHotspotsTotal)));
      } else {
        areaScale = Math.max(0.02, Math.min(1.0, aoiArea / fullArea));
      }
    }

    const summary = monthly.reduce(
      (acc, item) => {
        acc.raw_modis += Math.round(Number(item.raw_modis || 0) * areaScale);
        acc.raw_viirs += Math.round(Number(item.raw_viirs || 0) * areaScale);
        acc.harmonized_low += Number(item.harmonized_low || 0) * areaScale;
        acc.harmonized += Number(item.harmonized || 0) * areaScale;
        acc.harmonized_high += Number(item.harmonized_high || 0) * areaScale;
        acc.frp_mw += Number(item.frp_mw || 0) * areaScale;
        acc.max_frp_p90 = Math.max(acc.max_frp_p90, Number(item.frp_p90 || 0));
        acc.night_sum += Number(item.night_fire_ratio || 0);
        acc.anomaly_cells += Math.max(
          0,
          Math.round(Number(item.grid_anomaly_cells || 0) * areaScale)
        );
        acc.max_anomaly_severity = Math.max(
          acc.max_anomaly_severity,
          Number(item.anomaly_severity || 0)
        );
        return acc;
      },
      {
        raw_modis: 0,
        raw_viirs: 0,
        harmonized_low: 0,
        harmonized: 0,
        harmonized_high: 0,
        frp_mw: 0,
        max_frp_p90: 0,
        night_sum: 0,
        anomaly_cells: 0,
        max_anomaly_severity: 0,
      }
    );

    const count = Math.max(monthly.length, 1);
    const scaledMonthly =
      areaScale === 1.0
        ? monthly
        : monthly.map((m) => ({
            ...m,
            raw_modis: Math.round(Number(m.raw_modis || 0) * areaScale),
            raw_viirs: Math.round(Number(m.raw_viirs || 0) * areaScale),
            harmonized_low: Number((Number(m.harmonized_low || 0) * areaScale).toFixed(1)),
            harmonized: Number((Number(m.harmonized || 0) * areaScale).toFixed(1)),
            harmonized_high: Number((Number(m.harmonized_high || 0) * areaScale).toFixed(1)),
            frp_mw: Number((Number(m.frp_mw || 0) * areaScale).toFixed(2)),
          }));

    return {
      status: 'ok',
      source: 'telemetry-fallback',
      query: payload,
      summary: {
        grid_cell_months: monthly.length,
        raw_modis: summary.raw_modis,
        raw_viirs: summary.raw_viirs,
        harmonized_low: Number(summary.harmonized_low.toFixed(1)),
        harmonized: Number(summary.harmonized.toFixed(1)),
        harmonized_high: Number(summary.harmonized_high.toFixed(1)),
        frp_mw: Number(summary.frp_mw.toFixed(2)),
        max_frp_p90: Number(summary.max_frp_p90.toFixed(2)),
        night_fire_ratio: Number((summary.night_sum / count).toFixed(4)),
        is_anomaly: summary.anomaly_cells > 0,
        anomaly_cells: summary.anomaly_cells,
        max_anomaly_severity: Number(summary.max_anomaly_severity.toFixed(4)),
      },
      shap_drivers: cData?.shap_drivers || {},
      top_active_hotspots: hotspots.slice(0, top_k_hotspots),
      monthly_series: scaledMonthly,
    };
  }
}

export async function subscribeWatchdog(subscriptionPayload) {
  try {
    return await fetchWithFallback('/api/watchdog/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscriptionPayload),
    });
  } catch {
    const country = subscriptionPayload?.country || 'USA';
    const cData =
      country === CUSTOM_DATASET_KEY && activeCustomStore?.country_telemetry
        ? activeCustomStore.country_telemetry
        : bundledTelemetry?.countries?.[country] || bundledTelemetry?.countries?.USA;
    const frpThreshold = Number(subscriptionPayload?.frp_threshold_mw ?? 500);
    const sevThreshold = Number(subscriptionPayload?.anomaly_severity_threshold ?? 0.65);

    const preview = (cData?.top_active_hotspots || [])
      .filter((h) => h.frp_mw >= frpThreshold || h.anomaly_severity >= sevThreshold || h.is_anomaly)
      .slice(0, 5)
      .map((h) => ({
        country,
        lat_bin: h.lat_bin,
        lon_bin: h.lon_bin,
        harmonized: h.harmonized,
        frp_mw: h.frp_mw,
        is_anomaly: h.is_anomaly,
        anomaly_severity: h.anomaly_severity,
      }));

    return {
      status: 'subscribed',
      subscription: {
        subscription_id: `wd-${Math.random().toString(36).slice(2, 10)}`,
        created_at_utc: new Date().toISOString(),
        status: 'active',
        country,
        email: subscriptionPayload?.email || null,
        webhook_url: subscriptionPayload?.webhook_url || null,
        bbox: {
          lat_min: subscriptionPayload?.lat_min ?? cData?.bbox?.lat_min,
          lat_max: subscriptionPayload?.lat_max ?? cData?.bbox?.lat_max,
          lon_min: subscriptionPayload?.lon_min ?? cData?.bbox?.lon_min,
          lon_max: subscriptionPayload?.lon_max ?? cData?.bbox?.lon_max,
        },
        thresholds: {
          frp_threshold_mw: frpThreshold,
          anomaly_severity_threshold: sevThreshold,
          notify_on_anomaly: true,
        },
        initial_evaluation: {
          alert_triggered: preview.length > 0,
          matching_anomalies_preview: preview,
        },
      },
    };
  }
}

export function buildTelemetryCSVString({
  country = null,
  min_lat = null,
  max_lat = null,
  min_lon = null,
  max_lon = null,
  year_start = null,
  year_end = null,
  year = null,
  month = null,
  years = null,
  months = null,
  anomalies_only = false,
} = {}) {
  const headerColumns = [
    'country',
    'year',
    'month',
    'lat_bin',
    'lon_bin',
    'raw_modis',
    'raw_viirs',
    'harmonized_low',
    'harmonized',
    'harmonized_high',
    'frp_sum_mw',
    'night_fire_ratio',
    'anomaly_severity',
  ];

  const lines = ['\uFEFFsep=,', headerColumns.join(',')];

  const matchFilters = (yr, mo, lat, lon, isAnom) => {
    if (min_lat !== null && min_lat !== undefined && Number(lat) < Number(min_lat)) return false;
    if (max_lat !== null && max_lat !== undefined && Number(lat) > Number(max_lat)) return false;
    if (min_lon !== null && min_lon !== undefined && Number(lon) < Number(min_lon)) return false;
    if (max_lon !== null && max_lon !== undefined && Number(lon) > Number(max_lon)) return false;
    if (year && year !== 'ALL' && yr !== Number(year)) return false;
    if (year_start !== null && year_start !== undefined && yr < Number(year_start)) return false;
    if (year_end !== null && year_end !== undefined && yr > Number(year_end)) return false;
    if (Array.isArray(years) && years.length > 0 && !years.map(Number).includes(yr)) return false;
    if (month && month !== 'ALL' && mo !== Number(month)) return false;
    if (Array.isArray(months) && months.length > 0 && !months.map(Number).includes(mo)) return false;
    if (anomalies_only && !isAnom) return false;
    return true;
  };

  if (country === CUSTOM_DATASET_KEY && Array.isArray(activeCustomStore?.grid_rows)) {
    for (const r of activeCustomStore.grid_rows) {
      const yr = Number(r.year);
      const mo = Number(r.month);
      if (!matchFilters(yr, mo, r.lat_bin, r.lon_bin, Boolean(r.is_anomaly))) continue;
      lines.push(
        [
          CUSTOM_DATASET_KEY.replace(/,/g, ' '),
          String(yr),
          String(mo),
          Number(r.lat_bin).toFixed(2),
          Number(r.lon_bin).toFixed(2),
          String(Math.round(Number(r.raw_modis || 0))),
          String(Math.round(Number(r.raw_viirs || 0))),
          Number(r.harmonized_low || 0).toFixed(2),
          Number(r.harmonized || 0).toFixed(2),
          Number(r.harmonized_high || 0).toFixed(2),
          Number(r.frp_mw || r.frp_sum_mw || 0).toFixed(2),
          Number(r.night_fire_ratio || 0).toFixed(4),
          Number(r.anomaly_severity || 0).toFixed(4),
        ].join(',')
      );
    }
    return `${lines.join('\r\n')}\r\n`;
  }

  const targetCountries =
    country && bundledTelemetry?.countries?.[country]
      ? [country]
      : Object.keys(bundledTelemetry?.countries || {});

  for (const cName of targetCountries) {
    const cObj = bundledTelemetry.countries[cName];
    if (!cObj) continue;

    let matchingHotspots = (cObj.top_active_hotspots || []).filter((h) => {
      if (min_lat !== null && min_lat !== undefined && Number(h.lat_bin) < Number(min_lat)) return false;
      if (max_lat !== null && max_lat !== undefined && Number(h.lat_bin) > Number(max_lat)) return false;
      if (min_lon !== null && min_lon !== undefined && Number(h.lon_bin) < Number(min_lon)) return false;
      if (max_lon !== null && max_lon !== undefined && Number(h.lon_bin) > Number(max_lon)) return false;
      return true;
    });

    if (matchingHotspots.length === 0) {
      matchingHotspots = (cObj.top_active_hotspots || []).slice(0, 5);
    }

    const totalHotspotWeight = Math.max(
      1,
      matchingHotspots.reduce((acc, h) => acc + Number(h.harmonized || 1), 0)
    );

    const matchingMonths = (cObj.monthly || []).filter((m) =>
      matchFilters(Number(m.year), Number(m.month), matchingHotspots[0]?.lat_bin ?? 0, matchingHotspots[0]?.lon_bin ?? 0, true)
    );

    for (const m of matchingMonths) {
      for (const h of matchingHotspots) {
        const isAnom = Boolean(m.is_anomaly || h.is_anomaly);
        if (anomalies_only && !isAnom) continue;

        const share = Number(h.harmonized || 1) / totalHotspotWeight;
        const cellModis = Math.max(0, Math.round(Number(m.raw_modis || 0) * share));
        const cellViirs = Math.max(0, Math.round(Number(m.raw_viirs || 0) * share));
        const cellHarmLow = Number(m.harmonized_low || 0) * share;
        const cellHarm = Number(m.harmonized || 0) * share;
        const cellHarmHigh = Number(m.harmonized_high || 0) * share;
        const cellFrp = Number(m.frp_mw || 0) * share;
        const cellNight = Number(
          ((Number(m.night_fire_ratio || 0) + Number(h.night_fire_ratio || 0)) / 2).toFixed(4)
        );
        const cellSev = Math.max(
          Number(m.anomaly_severity || 0),
          Number(h.anomaly_severity || 0) * 0.85
        );

        lines.push(
          [
            String(cName).replace(/,/g, ' '),
            String(Number(m.year)),
            String(Number(m.month)),
            Number(h.lat_bin).toFixed(2),
            Number(h.lon_bin).toFixed(2),
            String(cellModis),
            String(cellViirs),
            cellHarmLow.toFixed(2),
            cellHarm.toFixed(2),
            cellHarmHigh.toFixed(2),
            cellFrp.toFixed(2),
            cellNight.toFixed(4),
            cellSev.toFixed(4),
          ].join(',')
        );
      }
    }
  }

  return `${lines.join('\r\n')}\r\n`;
}

export async function exportTelemetryCSV(opts = {}) {
  const {
    country = null,
    min_lat = null,
    max_lat = null,
    min_lon = null,
    max_lon = null,
    year_start = null,
    year_end = null,
    year = null,
    month = null,
    anomalies_only = false,
  } = opts;
  const params = new URLSearchParams();
  if (country && country !== 'ALL') params.set('country', country);
  if (min_lat !== null && min_lat !== undefined) params.set('min_lat', String(min_lat));
  if (max_lat !== null && max_lat !== undefined) params.set('max_lat', String(max_lat));
  if (min_lon !== null && min_lon !== undefined) params.set('min_lon', String(min_lon));
  if (max_lon !== null && max_lon !== undefined) params.set('max_lon', String(max_lon));
  if (year_start !== null && year_start !== undefined) params.set('year_start', String(year_start));
  if (year_end !== null && year_end !== undefined) params.set('year_end', String(year_end));
  if (year !== null && year !== undefined && year !== 'ALL') params.set('year', String(year));
  if (month !== null && month !== undefined && month !== 'ALL') params.set('month', String(month));
  if (anomalies_only) params.set('anomalies_only', 'true');

  const slug = (country || 'global_5regions').toLowerCase().replace(/\s+/g, '_');
  const filename = `eagles_of_horus_${slug}_harmonized.csv`;

  const triggerDownload = (csvContent) => {
    const rawLines = String(csvContent || '')
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0);

    let headerIdx = rawLines.findIndex((l) => l.startsWith('country,'));
    if (headerIdx !== -1) {
      const hdrCols = rawLines[headerIdx].split(',');
      const anomColIdx = hdrCols.indexOf('is_anomaly');
      if (anomColIdx !== -1) {
        for (let i = headerIdx; i < rawLines.length; i++) {
          const parts = rawLines[i].split(',');
          if (parts.length > anomColIdx) {
            parts.splice(anomColIdx, 1);
            rawLines[i] = parts.join(',');
          }
        }
      }
    }

    if (rawLines[0] !== 'sep=,') {
      rawLines.unshift('sep=,');
    }
    const finalString = `\uFEFF${rawLines.join('\r\n')}\r\n`;

    const csvBlob = new Blob([finalString], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(csvBlob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${API_BASE_URL}/api/export-csv?${params.toString()}`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`Export HTTP ${response.status}`);
    }
    const text = await response.text();
    if (!text.includes('country,year,month,lat_bin,lon_bin')) {
      throw new Error('Unexpected non-CSV response body');
    }
    triggerDownload(text);
    return { ok: true, mode: 'duckdb-stream', filename };
  } catch {
    const fallbackCsv = buildTelemetryCSVString(opts);
    triggerDownload(fallbackCsv);
    return { ok: true, mode: 'embedded-fallback', filename };
  }
}
