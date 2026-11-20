// Hand-made frontier furniture, built in cabin-local space. LAYOUT is shared with the
// colliders so the character walks around what you see.
import * as THREE from 'three';
import { boardGeo, logGeo, mtx, pillowGeo } from '../geom.js';
import { rgb } from '../logWalls.js';
import { DIM } from '../dims.js';
import { buildChair } from '../../props/furniture.js';
import { makeRng } from '../../../util/rng.js';

const F = DIM.floorY;
export const LAYOUT = {
  table: { x: -1.75, z: 0.45, hx: 0.68, hz: 0.4 },
  chairs: [{ x: -1.8, z: -0.2, ry: -Math.PI / 2 }, { x: -1.6, z: 1.12, ry: Math.PI / 2 + 0.25 }],
  rocker: { x: 1.15, z: -1.3, ry: -0.75 },
  bed: { x: -1.93, z: -1.82, hx: 1.02, hz: 0.55 },
  trunk: { x: -0.62, z: -1.85, hx: 0.24, hz: 0.42 },
  wash: { x: 1.72, z: 2.06, hx: 0.32, hz: 0.22 },
  shelves: { x: 1.0, z: -DIM.inZ, len: 1.6 },
};

const T = (rng, lo = 0.82, hi = 1.04) => { const k = rng.range(lo, hi); return rgb([k, k * rng.range(0.95, 1.0), k * rng.range(0.9, 1.0)]); };
const at = (M, ...a) => M.clone().multiply(mtx(...a));
function stick(b, rng, M, len, r, key, ...place) {
  const g = logGeo(len, r, rng, 8), m = at(M, ...place);
  b.add(key, g.side, m, T(rng)); b.add('end', g.capA, m); b.add('end', g.capB, m);
}

function table(b, rng) {
  const { x, z } = LAYOUT.table, M = mtx(x, F, z), top = 0.76;
  for (let i = 0; i < 3; i++) b.add('plank', boardGeo(1.36, 0.055, 0.26, rng), at(M, 0, top - 0.027, -0.26 + i * 0.26 + rng.range(-0.004, 0.004)), T(rng, 0.85, 1.05));
  for (const s of [-1, 1]) { // trestles: post, foot, top cleat
    b.add('plankDark', boardGeo(top - 0.11, 0.09, 0.16, rng), at(M, s * 0.5, (top - 0.06) / 2 + 0.03, 0, 0, 0, Math.PI / 2), T(rng));
    b.add('plankDark', boardGeo(0.66, 0.07, 0.1, rng), at(M, s * 0.5, 0.035, 0, 0, Math.PI / 2, 0), T(rng));
    b.add('plankDark', boardGeo(0.6, 0.06, 0.09, rng), at(M, s * 0.5, top - 0.085, 0, 0, Math.PI / 2, 0), T(rng));
  }
  b.add('plankDark', boardGeo(1.05, 0.07, 0.06, rng), at(M, 0, 0.26, 0), T(rng));
  for (const c of LAYOUT.chairs) buildChair(b, rng, mtx(c.x, F, c.z, 0, c.ry, 0));
}

function rocker(b, rng, IM) {
  const { x, z, ry } = LAYOUT.rocker, M = mtx(x, F, z, 0, ry, 0);
  for (const s of [-1, 1]) { // curved runners from short segments
    const R = 1.25, n = 8;
    for (let i = 0; i < n; i++) {
      const a0 = -0.42 + (0.84 * i) / n, a1 = -0.42 + (0.84 * (i + 1)) / n, am = (a0 + a1) / 2;
      b.add('plankDark', boardGeo(R * (a1 - a0) + 0.01, 0.045, 0.035, rng), at(M, Math.sin(am) * R, R - Math.cos(am) * R + 0.025, s * 0.25, 0, 0, am), T(rng));
    }
    stick(b, rng, M, 0.38, 0.022, 'plankDark', 0.2, 0.22, s * 0.25, 0, 0, Math.PI / 2); // front legs
    stick(b, rng, M, 1.05, 0.026, 'plankDark', -0.24, 0.55, s * 0.25, 0, 0, Math.PI / 2 + 0.18); // back posts
    b.add('plank', boardGeo(0.5, 0.04, 0.07, rng), at(M, 0.0, 0.64, s * 0.29), T(rng)); // arms
    stick(b, rng, M, 0.24, 0.018, 'plankDark', 0.2, 0.52, s * 0.28, 0, 0, Math.PI / 2);
  }
  for (let i = 0; i < 4; i++) b.add('plank', boardGeo(0.46, 0.03, 0.12, rng), at(M, -0.02, 0.43, -0.18 + i * 0.12), T(rng));
  b.add('plankDark', boardGeo(0.08, 0.09, 0.56, rng), at(M, -0.36, 1.03, 0, 0, 0, 0.18), T(rng));
  for (let i = 0; i < 5; i++) stick(b, rng, M, 0.52, 0.012, 'plankDark', -0.31, 0.73, -0.18 + i * 0.09, 0, 0, Math.PI / 2 + 0.18);
  // knitted plaid blanket over the back
  const blanket = pillowGeo(0.25, 2);
  b.add('plaid', blanket, at(M, -0.3, 0.86, 0.02, 0, 0, 0.2, 0.08, 0.42, 0.5), 0xffffff);
  b.add('plaid', blanket, at(M, -0.1, 0.47, 0.02, 0, 0, 1.45, 0.06, 0.36, 0.5), 0xffffff);
  void IM;
}

function bed(b, rng) {
  const { x, z } = LAYOUT.bed, M = mtx(x, F, z);
  const L = 1.98, W = 1.06;
  for (const [px, pz, h] of [[-L / 2, -W / 2, 1.05], [-L / 2, W / 2, 1.05], [L / 2, -W / 2, 0.62], [L / 2, W / 2, 0.62]]) {
    stick(b, rng, M, h, 0.055, 'log', px, h / 2, pz, 0, 0, Math.PI / 2);
  }
  for (const s of [-1, 1]) b.add('plankDark', boardGeo(L, 0.16, 0.05, rng), at(M, 0, 0.32, s * (W / 2 - 0.02)), T(rng));
  for (const [px, n, h0] of [[-L / 2, 4, 0.42], [L / 2, 2, 0.4]]) for (let i = 0; i < n; i++) {
    b.add('plank', boardGeo(W - 0.08, 0.12, 0.035, rng), at(M, px, h0 + i * 0.14, 0, 0, Math.PI / 2, 0), T(rng, 0.8, 1.0));
  }
  b.add('linen', pillowGeo(0.35, 3), at(M, 0, 0.5, 0, 0, 0, 0, L - 0.08, 0.2, W - 0.1), 0xf3ead6); // tick mattress
  b.add('linen', pillowGeo(0.6, 3), at(M, -L / 2 + 0.3, 0.66, 0, 0, 0, 0.12, 0.34, 0.13, 0.76), 0xffffff); // pillow
  // quilt: draped over the lower 3/4 with sides hanging down, a folded edge at the top
  b.add('quilt', pillowGeo(0.18, 3), at(M, 0.25, 0.6, 0, 0, 0, 0, L - 0.45, 0.07, W + 0.08), 0xffffff);
  for (const s of [-1, 1]) b.add('quilt', pillowGeo(0.15, 2), at(M, 0.25, 0.45, s * (W / 2 + 0.04), 0.08 * s, 0, 0, L - 0.47, 0.32, 0.035), 0xe8e0d8);
  b.add('quilt', pillowGeo(0.4, 2), at(M, -0.47, 0.64, 0, 0, 0, 0.0, 0.16, 0.09, W + 0.06), 0xdcd2c8);
  b.add('fur', pillowGeo(0.4, 2), at(M, 0.72, 0.65, 0.05, 0, 0.2, 0, 0.45, 0.07, W - 0.05), 0xffffff); // fur throw at the foot
}

function trunk(b, rng) {
  const { x, z } = LAYOUT.trunk, M = mtx(x, F, z, 0, Math.PI / 2, 0);
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) b.add('plankDark', boardGeo(0.82, 0.12, 0.03, rng), at(M, 0, 0.07 + i * 0.12, s * 0.22), T(rng, 0.7, 0.9));
  for (const s of [-1, 1]) b.add('plankDark', boardGeo(0.44, 0.36, 0.03, rng), at(M, s * 0.4, 0.19, 0, 0, Math.PI / 2, 0), T(rng, 0.7, 0.9));
  const lid = new THREE.CylinderGeometry(0.235, 0.235, 0.84, 12, 1, false, 0, Math.PI);
  b.add('leather', lid, at(M, 0, 0.38, 0, 0, 0, Math.PI / 2), 0x8a5a3a);
  for (const px of [-0.3, 0, 0.3]) b.add('castIron', new THREE.TorusGeometry(0.236, 0.012, 4, 14, Math.PI), at(M, px, 0.38, 0, 0, Math.PI / 2, 0), 0x555555);
  b.add('brass', new THREE.BoxGeometry(0.07, 0.09, 0.02), at(M, 0, 0.36, 0.245), 0xffffff);
}

function washStand(b, rng) {
  const { x, z } = LAYOUT.wash, M = mtx(x, F, z);
  b.add('plank', boardGeo(0.64, 0.04, 0.44, rng), at(M, 0, 0.78, 0), T(rng));
  b.add('plank', boardGeo(0.58, 0.03, 0.38, rng), at(M, 0, 0.25, 0), T(rng));
  for (const [px, pz] of [[-0.28, -0.18], [0.28, -0.18], [-0.28, 0.18], [0.28, 0.18]]) stick(b, rng, M, 0.78, 0.022, 'plankDark', px, 0.39, pz, 0, 0, Math.PI / 2);
  b.add('plankDark', boardGeo(0.64, 0.12, 0.03, rng), at(M, 0, 0.88, 0.21), T(rng)); // splash back
  const basin = new THREE.LatheGeometry([[0.0, 0.0], [0.09, 0.005], [0.17, 0.06], [0.2, 0.1], [0.205, 0.105]].map(([r, y]) => new THREE.Vector2(r, y)), 18);
  b.add('glaze', basin, at(M, -0.05, 0.8, -0.02), 0xf1f3f0);
  b.add('glaze', new THREE.TorusGeometry(0.2, 0.008, 4, 20), at(M, -0.05, 0.904, -0.02, Math.PI / 2, 0, 0), 0x3a5a8a);
  const pitcher = new THREE.LatheGeometry([[0.0, 0.0], [0.07, 0.0], [0.085, 0.06], [0.08, 0.14], [0.055, 0.2], [0.06, 0.24], [0.072, 0.26]].map(([r, y]) => new THREE.Vector2(r, y)), 14);
  b.add('glaze', pitcher, at(M, 0.2, 0.8, 0.06), 0xf1f3f0);
  b.add('glaze', new THREE.TorusGeometry(0.06, 0.01, 4, 10, Math.PI), at(M, 0.26, 0.96, 0.06, 0, 0, -Math.PI / 2), 0xf1f3f0);
  b.add('linen', pillowGeo(0.3, 2), at(M, -0.33, 0.62, 0, 0, 0, 0, 0.03, 0.3, 0.26), 0xe9e2d0); // towel
}

function shelves(b, rng) {
  const { x, z, len } = LAYOUT.shelves;
  for (const y of [1.55, 2.0]) {
    b.add('plank', boardGeo(len, 0.04, 0.27, rng), mtx(x, y, z + 0.14), T(rng));
    for (const s of [-1, 1]) { // L bracket: upright against the wall + diagonal brace
      const bx = x + s * (len / 2 - 0.15);
      b.add('plankDark', boardGeo(0.22, 0.05, 0.035, rng), mtx(bx, y - 0.13, z + 0.02, 0, 0, Math.PI / 2), T(rng));
      b.add('plankDark', boardGeo(0.3, 0.04, 0.03, rng), mtx(bx, y - 0.1, z + 0.12, -Math.PI / 4, Math.PI / 2, 0), T(rng));
    }
  }
}

export function buildFurniture(b, IM) {
  const rng = makeRng(1849);
  table(b, rng); rocker(b, rng, IM); bed(b, rng); trunk(b, rng); washStand(b, rng); shelves(b, rng);
}
