import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/*
 * Procedural 3D models of the greenhouse fruits, built to look like the real thing: lobed bell peppers, curved chillies, ridged cucumbers,
 * teardrop eggplants with a green cup, strawberries with a leafy cap, netted melons, striped zucchini, bunches of green bean pods and
 * tomatoes with a star-shaped calyx. Each fruit is a body (coloured per fruit, so ripeness varies) and a cap (always green).
 * All fruit are about 1 unit tall/long; the scene scales them to the plant.
 */
const color = (g, hex) => {
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
};
const white = (g) => color(g, '#ffffff');
const merge = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)), false);

/** A body of revolution from a profile [[radius, y], ...] (bottom to top) with optional lobes and a slight random wobble. */
function lathe(profile, { seg = 20, lobes = 0, lobeDepth = 0.06, wobble = 0 } = {}) {
  const rings = profile.length;
  const pos = [];
  const idx = [];
  for (let j = 0; j < rings; j += 1) {
    const [r, y] = profile[j];
    for (let i = 0; i <= seg; i += 1) {
      const t = (i / seg) * Math.PI * 2;
      const k = 1 + (lobes ? Math.cos(t * lobes) * lobeDepth : 0) + (wobble ? Math.sin(t * 3 + j) * wobble : 0);
      pos.push(Math.cos(t) * r * k, y, Math.sin(t) * r * k);
    }
  }
  for (let j = 0; j < rings - 1; j += 1) {
    for (let i = 0; i < seg; i += 1) {
      const a = j * (seg + 1) + i;
      const b = a + seg + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** Profile from a function r(v), v in 0..1, over a height. */
const profileOf = (fn, h, steps = 16) => Array.from({ length: steps + 1 }, (_, i) => { const v = i / steps; return [Math.max(0.0001, fn(v)), (v - 0.5) * h]; });

/** A tube along points with a radius that changes along its length. */
function tube(points, radiusAt, radial = 8, segs = 14) {
  const curve = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = g.attributes.position;
  const frames = curve.computeFrenetFrames(segs, false);
  for (let s = 0; s <= segs; s += 1) {
    const u = s / segs;
    const c = curve.getPointAt(u);
    for (let r = 0; r <= radial; r += 1) {
      const i = s * (radial + 1) + r;
      const dx = pos.getX(i) - c.x;
      const dy = pos.getY(i) - c.y;
      const dz = pos.getZ(i) - c.z;
      const rad = radiusAt(u);
      pos.setXYZ(i, c.x + dx * rad, c.y + dy * rad, c.z + dz * rad);
    }
  }
  void frames;
  g.computeVertexNormals();
  return g;
}

/** A calyx: a ring of pointed sepals lying on top of the fruit, and a short stem. */
function calyx(n, size, y, stemLen = 0.18, stemR = 0.04, droop = 0.35) {
  const parts = [];
  for (let i = 0; i < n; i += 1) {
    const sep = new THREE.ConeGeometry(size * 0.28, size, 5);
    sep.translate(0, size / 2, 0);
    sep.rotateZ(Math.PI / 2 - droop); // lie out from the stem, tips drooping onto the fruit
    sep.rotateY((i / n) * Math.PI * 2);
    sep.translate(0, y, 0);
    parts.push(sep);
  }
  const stem = new THREE.CylinderGeometry(stemR, stemR * 1.3, stemLen, 6);
  stem.translate(0, y + stemLen / 2, 0);
  parts.push(stem);
  return merge(parts);
}

const MODELS = {};

MODELS.tomato = () => {
  const body = lathe(profileOf((v) => { const t = v * Math.PI; return Math.sin(t) * 0.5 * (1 + 0.08 * Math.cos(t)); }, 0.82, 18), { seg: 24, lobes: 5, lobeDepth: 0.025 });
  // a shallow dimple at the stem end
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i += 1) { const y = p.getY(i); if (y > 0.3) p.setY(i, y - (0.45 - Math.hypot(p.getX(i), p.getZ(i))) * 0.12); }
  body.computeVertexNormals();
  return { body: white(body), cap: color(calyx(5, 0.3, 0.4), '#2E7D32'), palette: ['#D32F2F', '#E53935', '#C62828', '#EF6C00', '#E64A19'], hang: false };
};
MODELS.cherry_tomato = () => {
  const m = MODELS.tomato();
  return { ...m, palette: ['#E53935', '#D32F2F', '#C62828', '#F9A825', '#EF6C00'] };
};
MODELS.sweet_pepper = () => {
  const body = lathe(profileOf((v) => {
    const shoulder = Math.sin(Math.min(1, v * 1.15) * Math.PI * 0.5);
    const taper = v < 0.12 ? 0.55 + 4 * v : 1;
    return 0.46 * shoulder * taper * (v > 0.85 ? 1 - (v - 0.85) * 2.6 : 1);
  }, 1.0, 18), { seg: 28, lobes: 4, lobeDepth: 0.075 });
  const cap = merge([
    (() => { const s = new THREE.CylinderGeometry(0.05, 0.075, 0.2, 7); s.translate(0.03, 0.58, 0); s.rotateZ(-0.25); return s; })(),
    (() => { const s = new THREE.TorusGeometry(0.16, 0.05, 6, 12); s.rotateX(Math.PI / 2); s.translate(0, 0.46, 0); return s; })(),
  ]);
  return { body: white(body), cap: color(cap, '#2E7D32'), palette: ['#C62828', '#F9A825', '#EF6C00', '#D32F2F', '#FBC02D', '#2E7D32'], hang: true };
};
MODELS.hot_pepper = () => {
  const pts = [new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0.04, 0.2, 0.02), new THREE.Vector3(0.12, -0.15, 0.04), new THREE.Vector3(0.28, -0.45, 0.02), new THREE.Vector3(0.5, -0.62, 0)];
  const body = tube(pts, (u) => 0.1 * (1 - Math.pow(u, 1.6)) + 0.012, 10, 18);
  const cap = merge([calyx(5, 0.14, 0.5, 0.2, 0.025, 0.7)]);
  return { body: white(body), cap: color(cap, '#2E7D32'), palette: ['#C62828', '#D32F2F', '#2E7D32', '#E53935', '#43A047'], hang: true };
};
MODELS.cucumber = () => {
  const pts = [new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0.02, 0.2, 0), new THREE.Vector3(0.05, -0.1, 0.01), new THREE.Vector3(0.04, -0.5, 0)];
  const body = tube(pts, (u) => 0.1 * (0.78 + 0.22 * Math.sin(Math.min(1, u * 1.1) * Math.PI) ** 0.5) * (u < 0.04 ? 0.5 + u * 12 : 1) * (u > 0.94 ? 1 - (u - 0.94) * 9 : 1) + 0.004, 12, 20);
  // faint bumps: perturb the radius a little
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i += 1) { const w = 1 + 0.03 * Math.sin(i * 12.9898) * Math.sin(i * 78.233); p.setX(i, p.getX(i) * w); p.setZ(i, p.getZ(i) * w); }
  body.computeVertexNormals();
  const cap = merge([(() => { const s = new THREE.CylinderGeometry(0.02, 0.035, 0.1, 6); s.translate(0, 0.55, 0); return s; })()]);
  return { body: white(body), cap: color(cap, '#558B2F'), palette: ['#2E7D32', '#388E3C', '#1B5E20', '#43A047'], hang: true };
};
MODELS.eggplant = () => {
  const body = lathe(profileOf((v) => 0.5 * Math.sin(Math.pow(v, 0.55) * Math.PI) * (0.55 + 0.45 * (1 - v) ** 0.6) + 0.002, 1.0, 22), { seg: 24, wobble: 0.01 });
  const cup = (() => { const c = new THREE.ConeGeometry(0.22, 0.16, 12, 1, true); c.rotateX(Math.PI); c.translate(0, 0.44, 0); return c; })();
  const cap = merge([cup, calyx(5, 0.18, 0.46, 0.2, 0.04, 0.9)]);
  return { body: white(body), cap: color(cap, '#33691E'), palette: ['#4A148C', '#38006B', '#311B92', '#2D1B4E', '#5E35B1'], hang: true };
};
MODELS.strawberry = () => {
  const body = lathe(profileOf((v) => 0.42 * Math.sin(Math.min(1, v * 1.08) * Math.PI * 0.62 + 0.35) ** 1.2 * (v > 0.9 ? 1 - (v - 0.9) * 3 : 1) * (1 - 0.0 * v), 0.85, 16), { seg: 20, wobble: 0.015 });
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i += 1) { const w = 1 + 0.025 * Math.sin(p.getX(i) * 40) * Math.sin(p.getY(i) * 40 + p.getZ(i) * 30); p.setX(i, p.getX(i) * w); p.setZ(i, p.getZ(i) * w); }
  body.computeVertexNormals();
  return { body: white(body), cap: color(calyx(7, 0.34, 0.4, 0.14, 0.03, 0.15), '#2E7D32'), palette: ['#D32F2F', '#E53935', '#C62828', '#EF5350'], hang: true };
};
MODELS.zucchini = () => {
  const body = lathe(profileOf((v) => 0.17 * (0.9 + 0.2 * v) * Math.sin(Math.min(1, v * 1.05 + 0.02) * Math.PI * 0.5 + 0.15) ** 0.5 * (v > 0.93 ? 1 - (v - 0.93) * 7 : 1) * (v < 0.05 ? 0.5 + v * 10 : 1) + 0.003, 1.0, 20), { seg: 24, lobes: 8, lobeDepth: 0.05 });
  // light stripes along the fruit
  const col = [];
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i += 1) { const a = Math.atan2(p.getZ(i), p.getX(i)); const s = 0.82 + 0.18 * Math.cos(a * 8); col.push(s, s, s); }
  body.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const cap = merge([(() => { const s = new THREE.CylinderGeometry(0.05, 0.07, 0.12, 5); s.translate(0, 0.56, 0); return s; })()]);
  return { body, cap: color(cap, '#33691E'), palette: ['#33691E', '#558B2F', '#2E5E1E', '#689F38'], hang: false };
};
MODELS.melon = () => {
  const body = lathe(profileOf((v) => 0.5 * Math.sin(v * Math.PI) ** 0.9, 0.95, 20), { seg: 26, lobes: 10, lobeDepth: 0.02 });
  // netting: a fine diamond grid of ridges
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i); const y = p.getY(i); const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const net = Math.abs(Math.sin(a * 9 + y * 18)) * Math.abs(Math.sin(a * 9 - y * 18));
    const k = 1 + 0.035 * net;
    p.setXYZ(i, x * k, y, z * k);
  }
  body.computeVertexNormals();
  const cap = merge([(() => { const s = new THREE.CylinderGeometry(0.04, 0.06, 0.1, 6); s.translate(0, 0.5, 0); return s; })()]);
  return { body: white(body), cap: color(cap, '#6D4C41'), palette: ['#C9B26B', '#D4BE78', '#BFA85C', '#CDB874'], hang: false };
};
MODELS.green_beans = () => {
  const pods = [];
  for (let k = 0; k < 3; k += 1) {
    const dx = (k - 1) * 0.07;
    const pts = [new THREE.Vector3(dx, 0.5, 0), new THREE.Vector3(dx + 0.02, 0.25, 0.01 * k), new THREE.Vector3(dx + 0.05, -0.1, 0.02), new THREE.Vector3(dx + 0.03, -0.42, 0.0), new THREE.Vector3(dx - 0.02, -0.55, 0)];
    pods.push(tube(pts, (u) => 0.03 * (0.7 + 0.3 * Math.sin(u * Math.PI)) * (u > 0.9 ? 1 - (u - 0.9) * 8 : 1) + 0.003, 6, 14));
  }
  const cap = merge([(() => { const s = new THREE.CylinderGeometry(0.02, 0.03, 0.08, 5); s.translate(0, 0.53, 0); return s; })()]);
  return { body: white(merge(pods)), cap: color(cap, '#33691E'), palette: ['#558B2F', '#66BB6A', '#7CB342', '#43A047'], hang: true };
};
MODELS.custom = () => MODELS.tomato();

/** The plant's habit: how tall the stem is, how wide the leaves spread, where fruit hang, how many leaves, and the fruit's size relative to the plant. */
export const HABIT = {
  cherry_tomato: { tall: 3.2, spread: 0.9, fruitSize: 0.34, cluster: 5, leaves: 7, zone: [0.35, 0.9] },
  tomato: { tall: 3.2, spread: 1.0, fruitSize: 0.55, cluster: 3, leaves: 7, zone: [0.3, 0.85] },
  sweet_pepper: { tall: 2.3, spread: 0.95, fruitSize: 0.75, cluster: 1, leaves: 7, zone: [0.35, 0.85] },
  hot_pepper: { tall: 2.0, spread: 0.85, fruitSize: 0.6, cluster: 2, leaves: 7, zone: [0.35, 0.85] },
  cucumber: { tall: 3.4, spread: 0.8, fruitSize: 1.1, cluster: 1, leaves: 8, zone: [0.25, 0.8] },
  eggplant: { tall: 2.2, spread: 1.0, fruitSize: 0.8, cluster: 1, leaves: 6, zone: [0.3, 0.8] },
  strawberry: { tall: 0.9, spread: 1.1, fruitSize: 0.32, cluster: 3, leaves: 8, zone: [0.1, 0.45] },
  zucchini: { tall: 1.2, spread: 1.3, fruitSize: 1.2, cluster: 1, leaves: 6, zone: [0.05, 0.35] },
  melon: { tall: 0.9, spread: 1.4, fruitSize: 1.1, cluster: 1, leaves: 6, zone: [0.02, 0.2] },
  green_beans: { tall: 2.8, spread: 0.7, fruitSize: 0.9, cluster: 3, leaves: 7, zone: [0.3, 0.8] },
  custom: { tall: 2.4, spread: 1.0, fruitSize: 0.5, cluster: 3, leaves: 7, zone: [0.3, 0.85] },
};
export const habitOf = (key) => HABIT[key] || HABIT.custom;

/** Builds (once per crop key) { body, cap, palette } geometries. */
const cache = new Map();
export function fruitModel(key) {
  const k = MODELS[key] ? key : 'custom';
  if (!cache.has(k)) cache.set(k, MODELS[k]());
  return cache.get(k);
}

/** A leaf blade: a pointed oval with a bent mid-rib, double-sided. */
export function leafGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.35, 0.12, 0.55, 0.55, 0, 1.0);
  s.bezierCurveTo(-0.55, 0.55, -0.35, 0.12, 0, 0);
  const g = new THREE.ShapeGeometry(s, 8);
  g.rotateX(-Math.PI / 2); // lie flat, pointing along +z
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i += 1) p.setY(i, Math.abs(p.getX(i)) * 0.25 - p.getZ(i) * 0.12); // a fold along the rib, drooping at the tip
  g.computeVertexNormals();
  return g;
}

/** Deterministic pseudo random numbers per plant, so a plant looks the same every time. */
export function rng(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
