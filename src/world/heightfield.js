// Global terrain height function + baked helper fields (river distance, path distance).
// Near fields cover the 240 m play terrain at 0.5 m; a coarse far field covers the backdrop.
import { Field2D, bakePolylineDistance } from '../util/field.js';
import { noise, lerp, smoothstep } from '../util/noise.js';
import { RIVER, PATHS, CABIN, TERRAIN_SIZE, TERRAIN_RES, WATER_LEVEL } from './layout.js';

export const FAR_SIZE = 2600;
export const riverField = new Field2D(TERRAIN_SIZE, TERRAIN_RES, 2); // [dist, arcParam]
const riverFar = new Field2D(FAR_SIZE, 521, 2);
export const pathField = new Field2D(TERRAIN_SIZE, TERRAIN_RES, 1); // signed distance to path edge
export const heightField = new Field2D(TERRAIN_SIZE, TERRAIN_RES, 1);

export const RIVER_LENGTH = bakePolylineDistance(riverField, RIVER.pts, 46, { storeParam: true });
bakePolylineDistance(riverFar, RIVER.pts, 260, { storeParam: true });
const RIVER_SEG = RIVER_LENGTH / (RIVER.pts.length - 1);

{
  const tmp = new Field2D(TERRAIN_SIZE, TERRAIN_RES, 1);
  pathField.data.fill(1e9);
  for (const p of PATHS) {
    bakePolylineDistance(tmp, p.pts, 10);
    for (let k = 0; k < tmp.data.length; k++) {
      const d = tmp.data[k] - p.hw * (1 + 0.18 * Math.sin(k * 0.0137)); // tiny width wobble
      if (d < pathField.data[k]) pathField.data[k] = d;
    }
  }
}

const NEAR_LIMIT = TERRAIN_SIZE / 2 - 1;
export function riverAt(x, z) {
  const f = Math.abs(x) < NEAR_LIMIT && Math.abs(z) < NEAR_LIMIT ? riverField : riverFar;
  return [f.sample(x, z, 0), f.sample(x, z, 1)];
}
export const riverHalfWidth = (s) => RIVER.halfWidthAt(s, s / RIVER_SEG);

const CENTER = [-2, -6];

function landHeight(x, z, rd) {
  let h = 0.9 + 1.5 * noise.fbm2(x * 0.011 + 3.1, z * 0.011 - 1.7, 4) + 0.28 * noise.fbm2(x * 0.045, z * 0.045, 3);
  h += 1.3 * Math.exp(-((x + 25) ** 2 + (z + 20) ** 2) / (2 * 13 * 13)); // grove knoll
  h += 0.9 * Math.exp(-((x + 6) ** 2 + (z + 16) ** 2) / (2 * 10 * 10)); // rise behind the cabin
  h -= 0.55 * (1 - smoothstep(6, 26, rd)); // valley falls toward the river
  const r = Math.hypot(x - CENTER[0], z - CENTER[1]);
  // rolling hills ringing the play area
  let rim = smoothstep(44, 112, r) * (7 + 14 * (0.5 + 0.5 * noise.fbm2(x * 0.018 + 4, z * 0.018, 3)));
  // keep the hills low along the idle camera's view (north-north-east) so the mountains show
  const vd = ((x - CENTER[0]) * 0.53 - (z - CENTER[1]) * 0.85) / Math.max(r, 1);
  rim *= 1 - 0.55 * smoothstep(0.35, 0.9, vd);
  h += rim * smoothstep(10, 40, rd);
  // mountains beyond, opened up by the river valley
  if (r > 100) {
    const ridged = 1 - Math.abs(noise.fbm2(x * 0.0028 + 11, z * 0.0028 - 4, 4, 2, 0.45));
    const soft = 0.5 + 0.5 * noise.fbm2(x * 0.0022 - 7, z * 0.0022 + 3, 3);
    const big = 0.55 + 0.45 * noise.fbm2(x * 0.0011 + 2, z * 0.0011 + 5, 2);
    const shape = 0.55 * Math.pow(ridged, 1.8) + 0.45 * soft * soft;
    const west = 0.38 + 0.62 * smoothstep(-0.8, 0.15, (x - CENTER[0]) / r); // lower toward the sunset
    const m = smoothstep(100, 600, r) * (18 + 300 * shape * big) * west;
    h += m * smoothstep(16, 70 + 0.25 * r, rd);
  }
  return Math.max(h, 0.42);
}

// Cabin pad: flatten the footprint (+ margin) toward the height at its centre.
const cabinPadH = landHeight(CABIN.x, CABIN.z, 30) + 0.05;
function cabinBlend(x, z) {
  const c = Math.cos(CABIN.rot), s = Math.sin(CABIN.rot);
  const dx = x - CABIN.x, dz = z - CABIN.z;
  if (dx * dx + dz * dz > 400) return 0;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  const ex = Math.abs(lx) - (CABIN.w / 2 + 1.2);
  const ez = Math.max(-CABIN.d / 2 - 1.2 - lz, lz - (CABIN.d / 2 + CABIN.porch + 0.8));
  const e = Math.max(ex, ez, 0);
  return 1 - smoothstep(0, 3.5, e);
}

export function computeHeight(x, z) {
  const [rd, s] = riverAt(x, z);
  let h = landHeight(x, z, rd);
  if (Math.abs(x) < NEAR_LIMIT && Math.abs(z) < NEAR_LIMIT) {
    h = lerp(h, cabinPadH, cabinBlend(x, z));
    const pe = pathField.sample(x, z);
    h -= 0.07 * (1 - smoothstep(-0.4, 0.7, pe));
  }
  // river channel
  const hw = riverHalfWidth(s);
  const bankW = 2.4 + 2.6 * (0.5 + 0.5 * noise.n2(s * 0.05, 9.1));
  const q = rd / hw;
  const bed = lerp(-1.8, 0.03, smoothstep(0.08, 1.0, q)) + 0.14 * noise.fbm2(x * 0.35, z * 0.35, 2);
  const t = smoothstep(hw * 0.88, hw + bankW, rd);
  return lerp(bed, h, t);
}

heightField.fill((x, z, i, j) => heightField.set(i, j, computeHeight(x, z)));

export const CABIN_PAD_H = cabinPadH;

export const groundY = (x, z) => (Math.abs(x) < NEAR_LIMIT && Math.abs(z) < NEAR_LIMIT ? heightField.sample(x, z) : computeHeight(x, z));
export const waterDepth = (x, z) => WATER_LEVEL - groundY(x, z);
export const riverDist = (x, z) => riverAt(x, z)[0];
export const pathDist = (x, z) => pathField.sample(x, z);

export function groundNormal(x, z) {
  const e = 0.5;
  const gx = (groundY(x + e, z) - groundY(x - e, z)) / (2 * e);
  const gz = (groundY(x, z + e) - groundY(x, z - e)) / (2 * e);
  const l = Math.hypot(gx, 1, gz);
  return [-gx / l, 1 / l, -gz / l];
}

// River tangent (flow direction) at arc parameter s.
export function riverTangent(s) {
  const p = RIVER.pts, n = p.length - 1;
  const i = Math.max(0, Math.min(n - 1, Math.floor(s / RIVER_SEG)));
  const dx = p[i + 1][0] - p[i][0], dz = p[i + 1][1] - p[i][1];
  const l = Math.hypot(dx, dz) || 1;
  return [dx / l, dz / l];
}
