// Interior shell: wide plank floor, boarded ceiling on log joists at the eave line, and a
// fieldstone fireplace on the east wall (sooty firebox, lintel stone, mantel, chimney
// breast up to the ceiling, flagstone hearth, iron crane with a hanging pot).
import * as THREE from 'three';
import { boardGeo, logGeo, mtx, pillowGeo } from '../geom.js';
import { DIM } from '../dims.js';
import { rgb } from '../logWalls.js';
import { box } from '../chimney.js';
import { makeRng } from '../../../util/rng.js';

export const FIRE = { x: 2.7, z: 0, front: 2.36 }; // firebox centre / fireplace front face (local)

export function buildFloorAndCeiling(b) {
  const rng = makeRng(1870);
  const { inX, inZ, floorY, ceilY } = DIM;
  const bw = 0.235;
  for (let x = -inX + bw / 2; x < inX; x += bw) {
    const split = rng.range(-1.6, 1.6);
    for (const [z0, z1] of [[-inZ - 0.1, split], [split, inZ + 0.1]]) {
      const k = rng.range(0.78, 1.04);
      b.add('plank', boardGeo(z1 - z0 - 0.006, 0.04, bw - 0.008, rng), mtx(x, floorY - 0.02 + rng.range(-0.003, 0.003), (z0 + z1) / 2, 0, Math.PI / 2, 0), rgb([k, k * 0.95, k * 0.9]));
    }
  }
  // joists (round logs along Z) and ceiling boards along X
  for (const jx of [-2.05, -0.75, 0.55, 1.85]) {
    const L = logGeo(DIM.frontZ * 2, 0.1, rng, 10);
    const m = mtx(jx, ceilY - 0.1, 0, 0, Math.PI / 2, 0);
    b.add('log', L.side, m, rgb([0.78, 0.72, 0.66])); b.add('end', L.capA, m); b.add('end', L.capB, m);
  }
  for (let z = -inZ + 0.12; z < inZ; z += 0.24) {
    const k = rng.range(0.7, 0.92);
    b.add('plankDark', boardGeo(inX * 2 + 0.1, 0.04, 0.235, rng), mtx(0, ceilY + 0.02, z), rgb([k, k * 0.96, k * 0.92]));
  }
}

export function buildFireplace(b) {
  const rng = makeRng(1846);
  const { floorY, ceilY } = DIM;
  const X0 = FIRE.front, X1 = 3.06, open = 0.42, half = 0.95, top = 1.16;
  // jambs: room faces in fieldstone, firebox faces sooty
  const FS = { key: 'fieldstone' };
  box(b, rng, X0, X1, floorY, top, open, half, ['nx', 'pz'], FS);
  box(b, rng, X0, X1, floorY, top, -half, -open, ['nx', 'nz'], FS);
  // firebox: flat sooty side/back panels (no protruding stones cluttering the opening)
  for (const sz of [-1, 1]) b.add('soot', new THREE.BoxGeometry(X1 - X0, top - floorY, 0.06), mtx((X0 + X1) / 2, (floorY + top) / 2, sz * (open + 0.02)), 0x2e2622);
  b.add('soot', new THREE.BoxGeometry(0.06, top - floorY, open * 2 + 0.04), mtx(X1 - 0.04, (floorY + top) / 2, 0), 0x2a221e);
  b.add('soot', new THREE.BoxGeometry(X1 - X0, 0.06, open * 2 + 0.04), mtx((X0 + X1) / 2, top - 0.03, 0), 0x241e1a);
  b.add('soot', new THREE.BoxGeometry(X1 - X0, 0.02, open * 2), mtx((X0 + X1) / 2, floorY + 0.005, 0), 0x241c18);
  // lintel course across the opening, then mantel beam on carved corbels
  box(b, rng, X0, X1, top, 1.44, -half, half, ['nx', 'pz', 'nz'], FS);
  b.add('plankDark', boardGeo(half * 2 + 0.2, 0.11, 0.38, rng), mtx(2.43, 1.5, 0, 0, Math.PI / 2, 0), rgb([0.86, 0.8, 0.74]));
  for (const s of [-1, 1]) b.add('plankDark', boardGeo(0.16, 0.16, 0.08, rng), mtx(2.31, 1.38, s * 0.82, 0, Math.PI / 2, 0.6), rgb([0.8, 0.74, 0.68]));
  // chimney breast up to the ceiling
  box(b, rng, 2.52, X1, 1.555, ceilY, -0.72, 0.72, ['nx', 'pz', 'nz'], FS);
  // flagstone hearth
  const flags = [[2.08, -0.62, 0.42, 0.62], [2.12, 0.05, 0.5, 0.7], [2.06, 0.7, 0.4, 0.55], [1.86, -0.15, 0.22, 0.5], [1.88, 0.45, 0.22, 0.45]];
  for (const [x, z, sx, sz] of flags) { const k = rng.range(0.5, 0.68); b.add('fieldstone', pillowGeo(0.35, 2), mtx(x, floorY + 0.012, z, 0, rng.range(-0.1, 0.1), 0, sx * 0.94, 0.045, sz * 0.92), rgb([k, k * 0.97, k * 0.94])); }
  // iron crane: pivot post on the jamb, arm over the fire, hook + pot
  const iron = 0x444444;
  b.add('castIron', new THREE.CylinderGeometry(0.014, 0.014, 0.85, 6), mtx(2.92, floorY + 0.55, 0.36), iron);
  b.add('castIron', new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), mtx(2.8, floorY + 0.94, 0.18, 0.65, 0, Math.PI / 2 + 0.3), iron);
  b.add('castIron', new THREE.CylinderGeometry(0.008, 0.008, 0.16, 5), mtx(FIRE.x - 0.08, floorY + 0.86, 0.02), iron);
  const pot = new THREE.LatheGeometry([[0.0, -0.13], [0.1, -0.125], [0.15, -0.07], [0.16, 0.02], [0.14, 0.09], [0.15, 0.1], [0.13, 0.11]].map(([r, y]) => new THREE.Vector2(r, y)), 14);
  b.add('castIron', pot, mtx(FIRE.x - 0.08, floorY + 0.62, 0.02), 0x3a3634);
  b.add('castIron', new THREE.TorusGeometry(0.15, 0.007, 5, 14, Math.PI), mtx(FIRE.x - 0.08, floorY + 0.72, 0.02, 0, 0.4, 0), iron);
  return { fireAt: new THREE.Vector3(FIRE.x, floorY + 0.01, FIRE.z) };
}
