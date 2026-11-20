// Small hand-made props built into a Builder at a placement matrix:
// rustic chair, stave bucket, tackle box, barrel, crate.
import * as THREE from 'three';
import { boardGeo, logGeo, mtx } from '../cabin/geom.js';
import { rgb } from '../cabin/logWalls.js';

const tint = (rng, lo = 0.85, hi = 1.05) => { const k = rng.range(lo, hi); return rgb([k, k * rng.range(0.96, 1.0), k * rng.range(0.92, 1.0)]); };
const at = (M, ...a) => M.clone().multiply(mtx(...a));

function stick(b, rng, M, len, r, ...place) {
  const g = logGeo(len, r, rng, 8);
  const m = at(M, ...place);
  b.add('plankDark', g.side, m, tint(rng, 0.85, 1.0));
  b.add('end', g.capA, m); b.add('end', g.capB, m);
}

// Chair facing +X (a sitter looks along +X). Origin at floor centre.
export function buildChair(b, rng, M) {
  const sh = 0.45, sw = 0.46, sd = 0.42;
  for (const [x, z] of [[sd / 2 - 0.03, sw / 2 - 0.03], [sd / 2 - 0.03, -sw / 2 + 0.03]]) {
    stick(b, rng, M, sh, 0.022, x, sh / 2, z, 0, 0, Math.PI / 2 + 0.04);
  }
  for (const z of [sw / 2 - 0.03, -sw / 2 + 0.03]) { // rear legs run up into the back posts, slightly reclined
    stick(b, rng, M, 1.0, 0.024, -sd / 2 + 0.03 - 0.04, 0.5, z, 0, 0, Math.PI / 2 + 0.1);
  }
  for (let i = 0; i < 4; i++) {
    b.add('plank', boardGeo(sd + 0.02, 0.025, sw / 4 - 0.012, rng), at(M, 0, sh + 0.012, -sw / 2 + (sw / 4) * (i + 0.5)), tint(rng));
  }
  for (const y of [0.68, 0.82, 0.94]) {
    b.add('plank', boardGeo(0.025, 0.075, sw - 0.02, rng), at(M, -sd / 2 + 0.03 - 0.04 - (y - 0.5) * 0.1, y, 0, 0, 0, 0.1), tint(rng, 0.8, 1));
  }
  for (const z of [sw / 2 - 0.03, -sw / 2 + 0.03]) stick(b, rng, M, sd, 0.016, 0, 0.17, z); // stretchers
  stick(b, rng, M, sw, 0.016, sd / 2 - 0.03, 0.2, 0, 0, Math.PI / 2, 0);
}

// Wooden bucket made of staves with two iron bands and a wire handle. Origin at base.
export function buildBucket(b, rng, M, { h = 0.3, r0 = 0.12, r1 = 0.155, water = true } = {}) {
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = (r0 + r1) / 2, sw = (2 * Math.PI * r) / n + 0.006;
    const lean = Math.atan2(r1 - r0, h);
    b.add('plank', boardGeo(h, 0.018, sw, rng, 1.2), at(M, Math.cos(a) * r, h / 2, Math.sin(a) * r, 0, -a, Math.PI / 2 - lean, 1, 1, 1, 'YXZ'), tint(rng, 0.8, 1.05));
  }
  b.add('plank', new THREE.CylinderGeometry(r0, r0, 0.02, 14), at(M, 0, 0.012, 0), tint(rng, 0.7, 0.8));
  for (const [y, r] of [[0.06, r0 + (r1 - r0) * 0.2 + 0.012], [h - 0.05, r1 - (r1 - r0) * 0.15 + 0.012]]) {
    b.add('iron', new THREE.TorusGeometry(r, 0.008, 4, 24), at(M, 0, y, 0, Math.PI / 2, 0, 0, 1, 1, 2.2));
  }
  if (water) b.add('iron', new THREE.CircleGeometry(r1 - 0.02, 16), at(M, 0, h - 0.07, 0, -Math.PI / 2, 0, 0), 0x2a4a5a);
  const handle = new THREE.TorusGeometry(r1 + 0.01, 0.005, 4, 20, Math.PI);
  b.add('iron', handle, at(M, 0, h - 0.01, 0, 0, 0.3, 0));
}

export function buildTackleBox(b, rng, M) {
  b.add('paint', boardGeo(0.34, 0.14, 0.2, rng), at(M, 0, 0.07, 0), rgb([0.85, 0.95, 0.9]));
  b.add('paint', boardGeo(0.35, 0.04, 0.21, rng), at(M, 0, 0.16, 0), rgb([0.75, 0.85, 0.8]));
  b.add('iron', new THREE.TorusGeometry(0.05, 0.007, 4, 12, Math.PI), at(M, 0, 0.18, 0));
  b.add('iron', new THREE.BoxGeometry(0.04, 0.03, 0.01), at(M, 0, 0.13, 0.105));
}

// Barrel: bulging staves, hoops, lid. Origin at base.
export function buildBarrel(b, rng, M, { h = 0.85, r = 0.3 } = {}) {
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const sw = (2 * Math.PI * r) / n + 0.01;
    const k = rng.range(0.8, 1.05);
    for (const [y0, y1, rr] of [[0, h / 3, r * 0.88], [h / 3, (2 * h) / 3, r], [(2 * h) / 3, h, r * 0.88]]) {
      const rm = (y1 - y0) / 2 + y0;
      const lean = y0 === 0 ? -0.33 : y1 === h ? 0.33 : 0;
      const rr2 = y0 === 0 || y1 === h ? (rr + r) / 2 : r;
      b.add('plank', boardGeo((y1 - y0) / Math.cos(lean * 0.4) + 0.01, 0.03, sw, rng, 1.2),
        at(M, Math.cos(a) * rr2, rm, Math.sin(a) * rr2, 0, -a, Math.PI / 2 + lean * 0.4, 1, 1, 1, 'YXZ'), rgb([k, k * 0.97, k * 0.93]));
      void rr;
    }
  }
  for (const y of [0.1, h * 0.36, h * 0.64, h - 0.1]) {
    const rr = y < 0.2 || y > h - 0.2 ? r * 0.93 : r * 1.0;
    b.add('iron', new THREE.TorusGeometry(rr + 0.012, 0.012, 4, 28), at(M, 0, y, 0, Math.PI / 2, 0, 0, 1, 1, 2.0));
  }
  b.add('plank', new THREE.CylinderGeometry(r * 0.86, r * 0.86, 0.03, 18), at(M, 0, h - 0.04, 0), tint(rng, 0.75, 0.9));
}

export function buildCrate(b, rng, M, s = 0.55) {
  const t = 0.03;
  for (const [x, z, ry] of [[0, s / 2, 0], [0, -s / 2, 0], [s / 2, 0, Math.PI / 2], [-s / 2, 0, Math.PI / 2]]) {
    for (let i = 0; i < 4; i++) {
      b.add('weathered', boardGeo(s, s / 4 - 0.012, t, rng), at(M, x, (s / 4) * (i + 0.5), z, 0, ry, 0), tint(rng, 0.8, 1.05));
    }
    b.add('plankDark', boardGeo(Math.hypot(s, s) - 0.08, 0.06, t, rng), at(M, x * 1.04, s / 2, z * 1.04, 0, ry, Math.PI / 4), tint(rng, 0.8, 0.95));
  }
  for (let i = 0; i < 4; i++) b.add('weathered', boardGeo(s, t, s / 4 - 0.01, rng), at(M, 0, s - t / 2, -s / 2 + (s / 4) * (i + 0.5)), tint(rng, 0.85, 1.05));
}
