import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { feature } from 'topojson-client';
import worldAtlasData from 'world-atlas/countries-110m.json';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, RotateCcw } from 'lucide-react';
import { REGION_METADATA } from '../services/telemetryService';
import { AnimatedNumber, SPRING, EASE_OUT } from './ui/primitives';

const EARTH_RADIUS = 1.0;

const BLUE_MARBLE_URL = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
const TOPOLOGY_BUMP_URL = 'https://unpkg.com/three-globe/example/img/earth-topology.png';
const WATER_SPECULAR_URL = 'https://unpkg.com/three-globe/example/img/earth-water.png';

/**
 * Convert geographic (lat, lon) in degrees to Three.js SphereGeometry Cartesian coordinates.
 * Matches Three.js SphereGeometry UV mapping: u = (lon + 180) / 360, v = (lat + 90) / 180.
 */
function latLonToVec3(lat, lon, radius = EARTH_RADIUS) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

/**
 * High-detail offline fallback textures (NASA Blue Marble natural biome colors,
 * elevation bump map, and water specular map) so the globe is always photorealistic
 * even before remote textures finish loading or when offline.
 */
function buildNaturalEarthFallbackTextures() {
  const width = 2048;
  const height = 1024;

  // 1. Natural Blue Marble Color Canvas
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const ctx = colorCanvas.getContext('2d');

  // Deep natural ocean gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0.0, '#0a1f3d');
  oceanGrad.addColorStop(0.18, '#08264d');
  oceanGrad.addColorStop(0.5, '#062c5e');
  oceanGrad.addColorStop(0.82, '#08264d');
  oceanGrad.addColorStop(1.0, '#0a1f3d');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Topographic Bump Canvas (black = ocean, bright = continental relief)
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bCtx = bumpCanvas.getContext('2d');
  bCtx.fillStyle = '#000000';
  bCtx.fillRect(0, 0, width, height);

  // 3. Water Specular Canvas (white = reflective ocean, black = matte land)
  const specCanvas = document.createElement('canvas');
  specCanvas.width = width;
  specCanvas.height = height;
  const sCtx = specCanvas.getContext('2d');
  sCtx.fillStyle = '#d8e6f5';
  sCtx.fillRect(0, 0, width, height);

  const countriesGeo = feature(worldAtlasData, worldAtlasData.objects.countries);

  const drawRing = (context, ring) => {
    if (!ring || ring.length < 2) return;
    context.beginPath();
    let prevLon = ring[0][0];
    const startX = ((ring[0][0] + 180) / 360) * width;
    const startY = ((90 - ring[0][1]) / 180) * height;
    context.moveTo(startX, startY);

    for (let i = 1; i < ring.length; i++) {
      const [lon, lat] = ring[i];
      const x = ((lon + 180) / 360) * width;
      const y = ((90 - lat) / 180) * height;
      if (Math.abs(lon - prevLon) > 170) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
      prevLon = lon;
    }
    context.closePath();
  };

  // Natural latitude-based terrestrial biome gradient (Blue Marble aesthetic)
  const landGrad = ctx.createLinearGradient(0, 0, 0, height);
  landGrad.addColorStop(0.0, '#dce6f2'); // High Arctic snow/ice
  landGrad.addColorStop(0.14, '#3d5a3b'); // Boreal forest / taiga
  landGrad.addColorStop(0.26, '#4f6d3a'); // Temperate forest & plains
  landGrad.addColorStop(0.36, '#9c8253'); // Subtropical arid / desert belt
  landGrad.addColorStop(0.5, '#2d572c'); // Equatorial tropical rainforest
  landGrad.addColorStop(0.64, '#8f774a'); // Southern subtropical savanna/outback
  landGrad.addColorStop(0.78, '#3f5e3b'); // Southern temperate
  landGrad.addColorStop(0.9, '#e2ebf5'); // Antarctic ice sheet
  landGrad.addColorStop(1.0, '#f1f5f9');

  // Shallow coastal shelf glow in ocean
  ctx.save();
  ctx.shadowColor = 'rgba(24, 92, 145, 0.55)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = landGrad;
  ctx.strokeStyle = 'rgba(30, 58, 45, 0.35)';
  ctx.lineWidth = 0.6;

  bCtx.fillStyle = '#6b7280';
  bCtx.strokeStyle = '#9ca3af';
  bCtx.lineWidth = 1.2;

  sCtx.fillStyle = '#080808';

  for (const feat of countriesGeo.features) {
    const geom = feat.geometry;
    if (!geom) continue;
    const polygons =
      geom.type === 'Polygon'
        ? [geom.coordinates]
        : geom.type === 'MultiPolygon'
        ? geom.coordinates
        : [];

    for (const poly of polygons) {
      for (const ring of poly) {
        drawRing(ctx, ring);
        ctx.fill();
        ctx.stroke();

        drawRing(bCtx, ring);
        bCtx.fill();
        bCtx.stroke();

        drawRing(sCtx, ring);
        sCtx.fill();
      }
    }
  }
  ctx.restore();

  const colorTexture = new THREE.CanvasTexture(colorCanvas);
  colorTexture.wrapS = THREE.RepeatWrapping;
  colorTexture.wrapT = THREE.ClampToEdgeWrapping;
  colorTexture.colorSpace = THREE.SRGBColorSpace;
  colorTexture.anisotropy = 8;

  const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
  bumpTexture.wrapS = THREE.RepeatWrapping;
  bumpTexture.wrapT = THREE.ClampToEdgeWrapping;

  const specularTexture = new THREE.CanvasTexture(specCanvas);
  specularTexture.wrapS = THREE.RepeatWrapping;
  specularTexture.wrapT = THREE.ClampToEdgeWrapping;

  return { colorTexture, bumpTexture, specularTexture };
}

/**
 * Generate a delicate, realistic procedural atmospheric cloud layer texture.
 */
function buildCloudCanvasTexture() {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, width, height);

  // Deterministic pseudo-random helper for repeatable wispy cloud bands
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  // Planetary cloud bands (ITCZ equatorial band, mid-latitude storm tracks)
  const cloudBands = [
    { lat: 5, spread: 18, count: 240, alpha: 0.22 },
    { lat: 42, spread: 22, count: 280, alpha: 0.26 },
    { lat: -42, spread: 24, count: 300, alpha: 0.28 },
    { lat: 18, spread: 30, count: 180, alpha: 0.16 },
    { lat: -18, spread: 30, count: 180, alpha: 0.16 },
  ];

  for (const band of cloudBands) {
    for (let i = 0; i < band.count; i++) {
      const lon = rand() * 360 - 180;
      const lat = band.lat + (rand() - 0.5) * band.spread * 2;
      const x = ((lon + 180) / 360) * width;
      const y = ((90 - lat) / 180) * height;
      const rx = 14 + rand() * 42;
      const ry = 4 + rand() * 11;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rand() - 0.5) * 0.45);
      ctx.scale(1, ry / rx);
      const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, rx);
      const peakAlpha = band.alpha * (0.45 + 0.55 * rand());
      grad.addColorStop(0.0, `rgba(255, 255, 255, ${peakAlpha})`);
      grad.addColorStop(0.55, `rgba(248, 250, 252, ${peakAlpha * 0.5})`);
      grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  const cloudTexture = new THREE.CanvasTexture(canvas);
  cloudTexture.wrapS = THREE.RepeatWrapping;
  cloudTexture.wrapT = THREE.ClampToEdgeWrapping;
  cloudTexture.anisotropy = 4;
  return cloudTexture;
}

/**
 * Build a tiny, clean metallic satellite glint assembly (NO spotlight cones, NO giant blobs).
 */
function createMetallicSatelliteGlint(accentHex) {
  const group = new THREE.Group();

  // Compact metallic spacecraft bus
  const busGeo = new THREE.BoxGeometry(0.014, 0.01, 0.01);
  const busMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.9,
    roughness: 0.18,
  });
  group.add(new THREE.Mesh(busGeo, busMat));

  // Razor-thin metallic solar array wings
  const wingGeo = new THREE.BoxGeometry(0.005, 0.001, 0.042);
  const wingMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    metalness: 0.8,
    roughness: 0.2,
    emissive: accentHex,
    emissiveIntensity: 0.25,
  });
  group.add(new THREE.Mesh(wingGeo, wingMat));

  // Crisp pinpoint optical glint core
  const glintGeo = new THREE.SphereGeometry(0.0065, 12, 12);
  const glintMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });
  group.add(new THREE.Mesh(glintGeo, glintMat));

  // Subtle micro-halo around glint
  const haloGeo = new THREE.SphereGeometry(0.012, 12, 12);
  const haloMat = new THREE.MeshBasicMaterial({
    color: accentHex,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  group.add(new THREE.Mesh(haloGeo, haloMat));

  return group;
}

export default function OrbitalHero3D({
  telemetry,
  selectedCountry = 'USA',
  onSelectCountry,
  selectedAudience = 'Scientists',
  onExploreCommandDeck,
}) {
  const mountRef = useRef(null);
  const cameraTargetRef = useRef(null);
  const selectedCountryRef = useRef(selectedCountry);

  const [hoveredBeacon, setHoveredBeacon] = useState(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [autoRotateActive, setAutoRotateActive] = useState(true);

  useEffect(() => {
    selectedCountryRef.current = selectedCountry;
  }, [selectedCountry]);

  // Flatten all top active hotspots from telemetry_summary.json across all 5 basins
  const allHotspots = useMemo(() => {
    const countries = telemetry?.countries || {};
    const list = [];
    Object.entries(countries).forEach(([cName, cObj]) => {
      (cObj?.top_active_hotspots || []).forEach((h, idx) => {
        list.push({
          ...h,
          country: cName,
          rank: idx,
        });
      });
    });
    return list;
  }, [telemetry]);

  // Trigger smooth camera fly-to whenever selectedCountry changes externally
  useEffect(() => {
    const meta = REGION_METADATA[selectedCountry];
    if (!meta) return;
    const surfaceVec = latLonToVec3(meta.lat, meta.lon, 1.0).normalize();
    cameraTargetRef.current = {
      dir: surfaceVec,
      distance: 2.15,
      progress: 0,
    };
  }, [selectedCountry]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);

    // Position initial camera facing active region
    const initMeta = REGION_METADATA[selectedCountryRef.current] || REGION_METADATA.USA;
    const initDir = latLonToVec3(initMeta.lat, initMeta.lon, 2.38);
    camera.position.copy(initDir);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Cinematic framing: shift the globe right on wide screens so hero typography breathes on the left
    const applyViewOffset = (w, h) => {
      if (w >= 1024) {
        camera.setViewOffset(w, h, -w * 0.17, h * 0.02, w, h);
      } else {
        camera.clearViewOffset();
      }
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    applyViewOffset(width, height);

    // 3. Frictionless 360° Free-Control Camera (Exact user specifications)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.9;
    controls.enableRotate = true;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minDistance = 1.45;
    controls.maxDistance = 4.2;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.32;

    const stopAutoRotate = () => {
      if (controls.autoRotate) {
        controls.autoRotate = false;
        setAutoRotateActive(false);
      }
      cameraTargetRef.current = null;
    };
    controls.addEventListener('start', stopAutoRotate);

    // Natural Sunlight Directional Lighting + Soft Ambient Fill so all continents & oceans look crisp
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.95);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.15);
    sunLight.position.set(5, 2.8, 4);
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
    fillLight.position.set(-4.5, -1.8, -3.5);
    scene.add(fillLight);

    // Subtle Deep-Space Starfield
    const starCount = 2200;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 16 + Math.random() * 28;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);

      const tint = Math.random();
      if (tint > 0.84) {
        starColors[i * 3] = 0.72;
        starColors[i * 3 + 1] = 0.86;
        starColors[i * 3 + 2] = 1.0;
      } else if (tint > 0.7) {
        starColors[i * 3] = 1.0;
        starColors[i * 3 + 1] = 0.93;
        starColors[i * 3 + 2] = 0.8;
      } else {
        starColors[i * 3] = 0.9;
        starColors[i * 3 + 1] = 0.94;
        starColors[i * 3 + 2] = 0.98;
      }
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.055,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // 1. Photorealistic Natural Earth (NASA Blue Marble + Terrain Bump + Water Specular)
    const { colorTexture, bumpTexture, specularTexture } = buildNaturalEarthFallbackTextures();
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 128, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      map: colorTexture,
      bumpMap: bumpTexture,
      bumpScale: 0.035,
      specularMap: specularTexture,
      specular: new THREE.Color(0x3b6998),
      shininess: 22,
    });

    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earthMesh);

    // Load high-resolution NASA Blue Marble, Topology Bump, and Water Specular textures with automatic fallback
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    textureLoader.load(
      BLUE_MARBLE_URL,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = maxAnisotropy;
        earthMat.map = tex;
        earthMat.needsUpdate = true;
      },
      undefined,
      () => {
        // Offline / blocked: high-detail natural canvas fallback remains active
      }
    );

    textureLoader.load(
      TOPOLOGY_BUMP_URL,
      (tex) => {
        tex.anisotropy = maxAnisotropy;
        earthMat.bumpMap = tex;
        earthMat.bumpScale = 0.035;
        earthMat.needsUpdate = true;
      },
      undefined,
      () => {}
    );

    textureLoader.load(
      WATER_SPECULAR_URL,
      (tex) => {
        tex.anisotropy = maxAnisotropy;
        earthMat.specularMap = tex;
        earthMat.needsUpdate = true;
      },
      undefined,
      () => {}
    );

    // Delicate, slowly drifting semi-transparent cloud layer sphere slightly above surface (radius * 1.008)
    const cloudTexture = buildCloudCanvasTexture();
    const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.008, 96, 64);
    const cloudMat = new THREE.MeshLambertMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    scene.add(cloudMesh);

    // Realistic thin Rayleigh atmospheric halo around the horizon (#60A5FA -> transparent)
    const atmoGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.045, 96, 64);
    const atmoMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color('#60A5FA') },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vNormal = normalize(mat3(modelMatrix) * normal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float limb = clamp(0.62 - dot(vNormal, vViewDir), 0.0, 1.0);
          float alpha = pow(limb, 3.2) * 0.52;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });
    scene.add(new THREE.Mesh(atmoGeo, atmoMat));

    // Ultra-thin inner Rayleigh horizon scatter shell
    const horizonGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.003, 96, 64);
    const horizonMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color('#60A5FA') },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vNormal = normalize(mat3(modelMatrix) * normal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float rim = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 5.0);
          gl_FragColor = vec4(uColor, rim * 0.28);
        }
      `,
    });
    scene.add(new THREE.Mesh(horizonGeo, horizonMat));

    // 2. Key Active Hotspots plotted as crisp, refined micro-pinpoints on the surface (NO giant spikes)
    const hotspotsGroup = new THREE.Group();
    scene.add(hotspotsGroup);

    const hotspotPinGeo = new THREE.SphereGeometry(0.0042, 10, 10);
    const hotspotRingGeo = new THREE.RingGeometry(0.0068, 0.0086, 20);

    for (const h of allHotspots) {
      const surfacePos = latLonToVec3(h.lat_bin, h.lon_bin, EARTH_RADIUS + 0.002);
      const normalDir = surfacePos.clone().normalize();
      const pinColor = h.is_anomaly ? 0xf97316 : 0xfbbf24;

      const dotMat = new THREE.MeshBasicMaterial({
        color: pinColor,
      });
      const dotMesh = new THREE.Mesh(hotspotPinGeo, dotMat);
      dotMesh.position.copy(surfacePos);
      hotspotsGroup.add(dotMesh);

      if (h.rank < 3) {
        const ringMat = new THREE.MeshBasicMaterial({
          color: pinColor,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        });
        const ringMesh = new THREE.Mesh(hotspotRingGeo, ringMat);
        ringMesh.position.copy(normalDir.clone().multiplyScalar(EARTH_RADIUS + 0.0022));
        ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normalDir);
        hotspotsGroup.add(ringMesh);
      }
    }

    // 3. Five Target Regions (USA, Canada, Brazil, Greece, Australia) — Crisp, Refined Micro-Pinpoints
    // (Tiny 0.012 radius glowing core dot + delicate thin surface ring)
    const beaconHitMeshes = [];
    const beaconVisuals = [];

    Object.entries(REGION_METADATA).forEach(([countryKey, meta]) => {
      const countryStats = telemetry?.countries?.[countryKey] || {};
      const surfacePos = latLonToVec3(meta.lat, meta.lon, EARTH_RADIUS + 0.003);
      const normalDir = surfacePos.clone().normalize();
      const accentColor = new THREE.Color(meta.accent);

      const beaconGroup = new THREE.Group();
      beaconGroup.position.copy(surfacePos);
      beaconGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normalDir);

      // Tiny 0.012 radius glowing core dot
      const coreGeo = new THREE.SphereGeometry(0.012, 20, 20);
      const coreMat = new THREE.MeshBasicMaterial({
        color: accentColor,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.set(0, 0.002, 0);
      beaconGroup.add(coreMesh);

      // Crisp inner white pinpoint center for high-contrast clarity
      const centerGeo = new THREE.SphereGeometry(0.006, 14, 14);
      const centerMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
      });
      const centerMesh = new THREE.Mesh(centerGeo, centerMat);
      centerMesh.position.set(0, 0.008, 0);
      beaconGroup.add(centerMesh);

      // Delicate thin surface ring
      const baseRingGeo = new THREE.RingGeometry(0.019, 0.0235, 36);
      baseRingGeo.rotateX(-Math.PI / 2);
      const baseRingMat = new THREE.MeshBasicMaterial({
        color: accentColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      });
      const baseRingMesh = new THREE.Mesh(baseRingGeo, baseRingMat);
      baseRingMesh.position.set(0, 0.001, 0);
      beaconGroup.add(baseRingMesh);

      // Subtle outer pulse ring (razor-thin)
      const pulseRingGeo = new THREE.RingGeometry(0.025, 0.028, 36);
      pulseRingGeo.rotateX(-Math.PI / 2);
      const pulseRingMat = new THREE.MeshBasicMaterial({
        color: accentColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      });
      const pulseRingMesh = new THREE.Mesh(pulseRingGeo, pulseRingMat);
      pulseRingMesh.position.set(0, 0.001, 0);
      beaconGroup.add(pulseRingMesh);

      // Invisible hit collider sphere for effortless hover & click picking
      const hitGeo = new THREE.SphereGeometry(0.065, 16, 16);
      const hitMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.set(0, 0.01, 0);
      hitMesh.userData = {
        country: countryKey,
        meta,
        totals: countryStats.totals || {},
        benchmarkYears: countryStats.benchmark_years || meta.benchmarkYears,
      };
      beaconGroup.add(hitMesh);
      beaconHitMeshes.push(hitMesh);

      beaconVisuals.push({
        country: countryKey,
        coreMesh,
        baseRingMesh,
        pulseRingMesh,
        pulseRingMat,
        accentColor,
      });

      scene.add(beaconGroup);
    });

    // 4. Two Razor-Thin, Subtle Orbital Rings (MODIS #38BDF8 @ 0.25 & VIIRS #FBBF24 @ 0.25)
    const createRazorThinOrbitRing = (radius, tiltX, tiltZ, colorHex) => {
      const orbitGroup = new THREE.Group();
      orbitGroup.rotation.x = tiltX;
      orbitGroup.rotation.z = tiltZ;

      const pts = [];
      const segments = 240;
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
      }
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.25,
      });
      orbitGroup.add(new THREE.Line(lineGeo, lineMat));
      scene.add(orbitGroup);
      return orbitGroup;
    };

    const modisOrbitRadius = 1.18;
    const viirsOrbitRadius = 1.22;
    const modisOrbitGroup = createRazorThinOrbitRing(modisOrbitRadius, 1.38, 0.32, 0x38bdf8);
    const viirsOrbitGroup = createRazorThinOrbitRing(viirsOrbitRadius, -1.32, -0.46, 0xfbbf24);

    const modisGlint = createMetallicSatelliteGlint(0x38bdf8);
    const viirsGlint = createMetallicSatelliteGlint(0xfbbf24);
    modisOrbitGroup.add(modisGlint);
    viirsOrbitGroup.add(viirsGlint);

    // Raycaster for Interactive Country Beacons (Hover Tooltip & Click Camera Fly-To)
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const handlePointerMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      setCursorPos({ x: e.clientX, y: e.clientY });

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(beaconHitMeshes, false);
      if (hits.length > 0) {
        const data = hits[0].object.userData;
        renderer.domElement.style.cursor = 'pointer';
        setHoveredBeacon(data);
      } else {
        renderer.domElement.style.cursor = 'grab';
        setHoveredBeacon(null);
      }
    };

    const handlePointerDown = (e) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      renderer.domElement.style.cursor = 'grabbing';
      stopAutoRotate();
    };

    const handlePointerUp = (e) => {
      renderer.domElement.style.cursor = 'grab';
      const distMoved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (distMoved > 6) return; // Drag rotation, not a click

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(beaconHitMeshes, false);

      if (hits.length > 0) {
        const pickedCountry = hits[0].object.userData.country;
        if (onSelectCountry) {
          onSelectCountry(pickedCountry);
        }
        const meta = REGION_METADATA[pickedCountry];
        if (meta) {
          cameraTargetRef.current = {
            dir: latLonToVec3(meta.lat, meta.lon, 1.0).normalize(),
            distance: 2.05,
            progress: 0,
          };
        }
      }
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointermove', handlePointerMove);
    domElem.addEventListener('pointerdown', handlePointerDown);
    domElem.addEventListener('pointerup', handlePointerUp);

    // Resize Listener
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      applyViewOffset(w, h);
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let reqId;
    const clock = new THREE.Clock();

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Slowly drift the delicate cloud layer slightly above Earth's surface
      cloudMesh.rotation.y = elapsed * 0.007;

      // Orbit the two tiny metallic satellite glints smoothly along the razor-thin rings
      const modisAngle = elapsed * 0.34;
      modisGlint.position.set(
        Math.cos(modisAngle) * modisOrbitRadius,
        0,
        Math.sin(modisAngle) * modisOrbitRadius
      );
      modisGlint.rotation.y = -modisAngle;

      const viirsAngle = elapsed * 0.41 + 2.1;
      viirsGlint.position.set(
        Math.cos(viirsAngle) * viirsOrbitRadius,
        0,
        Math.sin(viirsAngle) * viirsOrbitRadius
      );
      viirsGlint.rotation.y = -viirsAngle;

      // Subtle micro-pulse on the 5 target region surface rings
      for (const b of beaconVisuals) {
        const isSel = b.country === selectedCountryRef.current;
        const cycle = (elapsed * 0.9) % 1.0;
        const pulseScale = isSel ? 1.0 + cycle * 0.85 : 1.0 + cycle * 0.45;
        b.pulseRingMesh.scale.setScalar(pulseScale);
        b.pulseRingMat.opacity = (1.0 - cycle) * (isSel ? 0.75 : 0.38);
        b.coreMesh.scale.setScalar(isSel ? 1.2 : 1.0);
      }

      // Smooth Camera Fly-To interpolation when a country is clicked
      if (cameraTargetRef.current) {
        const target = cameraTargetRef.current;
        target.progress += 0.045;
        const desiredPos = target.dir.clone().multiplyScalar(target.distance);
        camera.position.lerp(desiredPos, 0.08);
        if (camera.position.distanceTo(desiredPos) < 0.03 || target.progress >= 1.2) {
          cameraTargetRef.current = null;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', handleResize);
      domElem.removeEventListener('pointermove', handlePointerMove);
      domElem.removeEventListener('pointerdown', handlePointerDown);
      domElem.removeEventListener('pointerup', handlePointerUp);
      controls.dispose();
      renderer.dispose();
    };
  }, [allHotspots, onSelectCountry]);


  const handleResetOrbit = () => {
    const meta = REGION_METADATA[selectedCountry] || REGION_METADATA.USA;
    cameraTargetRef.current = {
      dir: latLonToVec3(meta.lat, meta.lon, 1.0).normalize(),
      distance: 2.35,
      progress: 0,
    };
  };

  const scrollToDeck = (e) => {
    if (e) e.preventDefault();
    if (onExploreCommandDeck) onExploreCommandDeck();
    document.getElementById('command-deck')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const heroStats = [
    { value: 18.87, format: (v) => `${v.toFixed(2)}M`, label: 'Raw Detections', tone: 'text-white' },
    { value: 293719, format: (v) => Math.round(v).toLocaleString('en-US'), label: 'Grid Cells', tone: 'text-sky-200' },
    { value: 0.8833, format: (v) => v.toFixed(4), label: 'R²', tone: 'text-emerald-200' },
    { value: 5, format: (v) => String(Math.round(v)), label: 'Fire Basins', tone: 'text-amber-200' },
  ];

  const titleWords = [
    { text: "THE PLANET'S", gradient: false },
    { text: 'EARLY WARNING', gradient: false },
    { text: 'SYSTEM', gradient: true },
  ];

  return (
    <section
      id="orbital-globe"
      className="relative w-full h-[100svh] min-h-[720px] bg-[#020408] overflow-hidden select-none"
    >
      {/* Ambient deep-space blooms */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 55% 60% at 66% 46%, rgba(37,99,235,0.16) 0%, rgba(56,189,248,0.05) 38%, transparent 70%), radial-gradient(ellipse 40% 40% at 12% 80%, rgba(245,158,11,0.07) 0%, transparent 70%)',
        }}
      />

      {/* Full-bleed interactive Three.js canvas */}
      <div
        ref={mountRef}
        style={{ touchAction: 'pan-y' }}
        className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
      />

      {/* Cinematic vignettes (non-blocking) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[11]"
        style={{
          background:
            'linear-gradient(90deg, rgba(2,4,8,0.92) 0%, rgba(2,4,8,0.55) 28%, rgba(2,4,8,0) 52%), linear-gradient(180deg, rgba(2,4,8,0.55) 0%, rgba(2,4,8,0) 18%, rgba(2,4,8,0) 72%, #020408 100%)',
        }}
      />

      {/* Hero typography */}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center">
        <div className="w-full max-w-[1480px] mx-auto px-6 lg:px-12 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease: EASE_OUT }}
            className="inline-flex items-center gap-2.5 rounded-full pl-2.5 pr-3.5 py-1 bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
            </span>
            <span className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-slate-300 whitespace-nowrap">
              NASA FIRMS · Space Apps
            </span>
          </motion.div>

          <h1 className="mt-6 font-sans font-extrabold text-white tracking-[-0.045em] leading-[0.9] text-[44px] sm:text-[68px] lg:text-[88px] xl:text-[100px]">
            {titleWords.map((w, i) => (
              <span key={w.text} className={`block overflow-hidden ${i === 2 ? 'pb-2' : ''}`}>
                <motion.span
                  initial={{ y: '110%', opacity: 0 }}
                  animate={{ y: '0%', opacity: 1 }}
                  transition={{ duration: 1.1, delay: 0.45 + i * 0.12, ease: EASE_OUT }}
                  className={`inline-block ${
                    w.gradient
                      ? 'bg-gradient-to-r from-amber-100 via-amber-300 to-orange-500 bg-clip-text text-transparent'
                      : ''
                  }`}
                >
                  {w.text}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, letterSpacing: '0.5em' }}
            animate={{ opacity: 1, letterSpacing: '0.32em' }}
            transition={{ duration: 1.4, delay: 0.95, ease: EASE_OUT }}
            className="mt-6 font-mono text-[11px] sm:text-[12.5px] uppercase text-slate-400 whitespace-nowrap"
          >
            MODIS 1KM <span className="text-amber-300/80">×</span> VIIRS 375M AI FUSION
          </motion.p>

          {/* Region pills (layoutId) */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.15, ease: EASE_OUT }}
            className="pointer-events-auto mt-9 flex flex-wrap items-center gap-2"
          >
            <div className="inline-flex items-center gap-0.5 rounded-full p-1 bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl">
              {Object.keys(REGION_METADATA).map((cKey) => {
                const isSelected = selectedCountry === cKey;
                const accent = REGION_METADATA[cKey].accent;
                return (
                  <button
                    key={cKey}
                    type="button"
                    onClick={() => onSelectCountry && onSelectCountry(cKey)}
                    className={`relative px-4 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-colors ${
                      isSelected ? 'text-white' : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {isSelected && (
                      <motion.span
                        layoutId="hero-region"
                        transition={SPRING}
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: `${accent}24`,
                          boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.14), 0 0 0 1px ${accent}55, 0 0 24px -6px ${accent}`,
                        }}
                      />
                    )}
                    <span className="relative">{cKey}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleResetOrbit}
              title="Re-center"
              className="p-2.5 rounded-full text-slate-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        </div>
      </div>

      {/* Cursor-following glass tooltip on beacon hover */}
      <AnimatePresence>
        {hoveredBeacon && (
          <motion.div
            key={hoveredBeacon.country}
            initial={{ opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            className="glass-pill pointer-events-none fixed z-40 px-4 py-3 rounded-2xl min-w-[210px]"
            style={{
              left: `${Math.min(window.innerWidth - 240, cursorPos.x + 18)}px`,
              top: `${Math.max(90, cursorPos.y + 18)}px`,
            }}
          >
            <div className="flex items-center gap-2 pb-2 mb-2 border-b border-white/[0.08]">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: REGION_METADATA[hoveredBeacon.country]?.accent }}
              />
              <span className="font-sans text-[13px] font-semibold tracking-tight text-white">
                {hoveredBeacon.country}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono tabular-nums">
              <span className="text-slate-400">Harmonized</span>
              <span className="text-right text-amber-200">
                {Number(hoveredBeacon.totals?.harmonized || 0).toLocaleString('en-US')}
              </span>
              <span className="text-slate-400">MODIS / VIIRS</span>
              <span className="text-right text-slate-200">
                {(Number(hoveredBeacon.totals?.raw_modis || 0) / 1000).toFixed(0)}k /{' '}
                {(Number(hoveredBeacon.totals?.raw_viirs || 0) / 1000).toFixed(0)}k
              </span>
              <span className="text-slate-400">FRP</span>
              <span className="text-right text-sky-200">
                {(Number(hoveredBeacon.totals?.frp_mw || 0) / 1e6).toFixed(2)}M MW
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating glass telemetry strip */}
      <div className="absolute z-30 bottom-6 inset-x-0 flex justify-center px-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.3, ease: EASE_OUT }}
          className="glass-pill pointer-events-auto rounded-[22px] pl-2 pr-2 py-2 flex items-center gap-2 max-w-full overflow-x-auto"
        >
          <div className="flex items-center divide-x divide-white/[0.07]">
            {heroStats.map((s) => (
              <div key={s.label} className="px-5 sm:px-7 py-1.5">
                <div className={`font-mono text-[17px] sm:text-[20px] font-semibold tracking-tight ${s.tone}`}>
                  <AnimatedNumber value={s.value} format={s.format} />
                </div>
                <div className="eyebrow mt-0.5 !text-[9.5px] !tracking-[0.2em] !text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
          <motion.a
            href="#command-deck"
            onClick={scrollToDeck}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="hidden md:flex items-center justify-center w-12 h-12 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-slate-200 shrink-0"
            aria-label="Explore command deck"
          >
            <motion.span
              animate={{ y: [0, 3, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ArrowDown className="w-4 h-4" />
            </motion.span>
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
