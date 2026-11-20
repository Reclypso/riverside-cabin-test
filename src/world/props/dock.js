// Small fishing dock: log posts down to the riverbed, stringers, cross-planks with gaps and
// per-plank wear, X-bracing, a mooring post with rope, a lantern post, plus the chair,
// bucket and tackle box at the end. Built in dock space (X = out over the water).
import * as THREE from 'three';
import { DOCK, dockLocal } from '../layout.js';
import { groundY } from '../heightfield.js';
import { Builder, boardGeo, logGeo, mtx } from '../cabin/geom.js';
import { getMaterials } from '../cabin/materials.js';
import { rgb } from '../cabin/logWalls.js';
import { buildLantern } from '../cabin/lantern.js';
import { buildChair, buildBucket, buildTackleBox } from './furniture.js';
import { makeRng } from '../../util/rng.js';

export const DECK_TOP = 0.82;

const tint = (rng, lo = 0.8, hi = 1.05) => { const k = rng.range(lo, hi); return rgb([k, k * rng.range(0.95, 1.0), k * rng.range(0.9, 1.0)]); };

function vertLog(b, rng, x, z, y0, y1, r) {
  const g = logGeo(y1 - y0, r, rng, 10);
  const m = mtx(x, (y0 + y1) / 2, z, 0, 0, Math.PI / 2);
  b.add('log', g.side, m, tint(rng, 0.7, 0.9));
  b.add('end', g.capA, m); b.add('end', g.capB, m);
}

export function buildDock() {
  const rng = makeRng(808);
  const g = new THREE.Group();
  g.name = 'Dock';
  g.position.set(DOCK.x, 0, DOCK.z);
  g.rotation.y = DOCK.rot;
  const b = new Builder();
  const L = DOCK.len, W = DOCK.w, top = DECK_TOP;
  const bed = (a, c) => { const [x, z] = dockLocal(a, c); return groundY(x, z); };

  // posts in pairs, the two at the far end rise above the deck as mooring/lantern posts
  const postsAt = [0.35, 2.2, 4.1, L - 0.12];
  for (const a of postsAt) {
    for (const c of [-W / 2 + 0.06, W / 2 - 0.06]) {
      const end = a === postsAt[postsAt.length - 1];
      vertLog(b, rng, a, c, Math.min(bed(a, c), 0.3) - 0.35, top + (end ? (c > 0 ? 0.95 : 0.45) : -0.06), 0.1);
    }
    // cross beam under the planks + X-bracing toward the water
    b.add('plankDark', boardGeo(W + 0.1, 0.14, 0.09, rng), mtx(a, top - 0.13, 0, 0, Math.PI / 2, 0), tint(rng, 0.7, 0.85));
    if (a > 1) {
      const y0 = Math.max(bed(a, 0), -0.6) + 0.15, y1 = top - 0.22;
      const len = Math.hypot(W - 0.12, y1 - y0), ang = Math.atan2(y1 - y0, W - 0.12);
      for (const s of [1, -1]) b.add('plankDark', boardGeo(len, 0.11, 0.04, rng), mtx(a + 0.08 * s, (y0 + y1) / 2, 0, 0, Math.PI / 2, s * ang, 1, 1, 1, 'YXZ'), tint(rng, 0.65, 0.8));
    }
  }
  // sill log bedded into the bank under the land end
  {
    const gl = logGeo(W + 0.5, 0.11, rng, 10);
    const m = mtx(0.25, Math.min(bed(0.25, 0) + 0.06, top - 0.16), 0, 0, Math.PI / 2, 0);
    b.add('log', gl.side, m, tint(rng, 0.65, 0.8)); b.add('end', gl.capA, m); b.add('end', gl.capB, m);
  }
  // stringers along the dock
  for (const c of [-W / 2 + 0.12, 0, W / 2 - 0.12]) b.add('plankDark', boardGeo(L + 0.2, 0.16, 0.09, rng), mtx(L / 2, top - 0.05 - 0.08, c), tint(rng, 0.7, 0.85));
  // deck planks across the width, with gaps, slight twist and a few worn/short ones
  let a = 0.02, i = 0;
  while (a < L - 0.05) {
    const pw = rng.range(0.19, 0.24);
    const len = W + rng.range(-0.04, 0.12);
    const off = rng.range(-0.05, 0.05);
    const key = rng() < 0.18 ? 'weathered' : 'plank';
    b.add(key, boardGeo(len, 0.05, pw, rng), mtx(a + pw / 2, top - 0.025 + rng.range(-0.006, 0.006), off, rng.range(-0.012, 0.012), Math.PI / 2 + rng.range(-0.02, 0.02), 0, 1, 1, 1, 'YXZ'), tint(rng, 0.78, 1.05));
    // nail heads
    for (const c of [-W / 2 + 0.12, 0, W / 2 - 0.12]) b.add('iron', new THREE.BoxGeometry(0.018, 0.006, 0.018), mtx(a + pw / 2, top + 0.002, c + off * 0), 0x555555);
    a += pw + rng.range(0.018, 0.03);
    i++;
  }
  // rope coil on the mooring post + loose rope across the deck
  b.add('rope', new THREE.TorusGeometry(0.13, 0.025, 6, 18), mtx(L - 0.12, top + 0.32, -W / 2 + 0.06, Math.PI / 2, 0, 0));
  b.add('rope', new THREE.TorusGeometry(0.16, 0.022, 6, 20), mtx(L - 0.55, top + 0.02, -W / 2 + 0.35, Math.PI / 2, 0, 0, 1, 1, 0.5));
  b.add('rope', new THREE.TorusGeometry(0.11, 0.022, 6, 20), mtx(L - 0.55, top + 0.045, -W / 2 + 0.35, Math.PI / 2, 0, 0.4, 1, 1, 0.5));

  // lantern on the tall end post
  const lanternPos = buildLantern(b, mtx(L - 0.12, top + 0.95 + 0.0, W / 2 - 0.06), 1.0);

  // seating spot at the end: chair angled to look downstream, bucket and tackle box
  buildChair(b, rng, mtx(L - 1.25, top, -0.25, 0, 0.35, 0));
  buildBucket(b, rng, mtx(L - 1.05, top, 0.55, 0, 0.4, 0));
  buildTackleBox(b, rng, mtx(L - 1.95, top, 0.62, 0, -0.25, 0));

  const meshes = b.build(getMaterials(), 'Dock');
  for (const m of meshes.children) if (/lanternGlass|rope/.test(m.name)) m.castShadow = false;
  g.add(...meshes.children);
  const light = new THREE.PointLight(0xffa850, 0, 6.5, 1.6);
  light.name = 'Dock_LanternLight';
  light.position.copy(lanternPos);
  g.add(light);
  g.userData.lanternLight = light;
  return g;
}
