// Plants: bushes (cabin, forest edges, banks), reeds + cattails, lily pads.
import * as THREE from 'three';
import { createBushes } from './bushes.js';
import { createReeds } from './reeds.js';
import { createLilies } from './lilies.js';
import { createStumps } from './stumps.js';
import { groundY, pathDist, riverAt, riverHalfWidth, waterDepth } from '../heightfield.js';
import { CABIN, DOCK, GROVE, cabinLocal, inCabinFootprint, RIVER_ROCKS } from '../layout.js';
import { makeRng } from '../../util/rng.js';
import { noise } from '../../util/noise.js';

function planBushes(rng) {
  const out = [];
  const ok = (x, z, clear = 1.4) => pathDist(x, z) > clear && !inCabinFootprint(x, z, 0.2) && waterDepth(x, z) < -0.35
    && Math.hypot(x - DOCK.x, z - DOCK.z) > 2.5;
  // foundation shrubs along the cabin sides and back
  for (const [lx, lz] of [[-3.9, -1.5], [-3.9, 1.2], [3.9, -2.0], [2.2, -3.4], [-1.6, -3.4], [3.9, 0.6]]) {
    const [x, z] = cabinLocal(lx, lz);
    if (ok(x, z, 0.8)) out.push({ x, z, s: rng.range(0.7, 1.0) });
  }
  // grove edge and around tree bases
  for (let i = 0; i < 600 && out.length < 70; i++) {
    const a = rng() * 6.28, r = rng.range(GROVE.r - 2, GROVE.r + 9);
    const x = GROVE.x + Math.cos(a) * r, z = GROVE.z + Math.sin(a) * r;
    if (ok(x, z) && noise.n2(x * 0.2, z * 0.2) > -0.1) out.push({ x, z, s: rng.range(0.8, 1.4) });
  }
  // riverbank clumps
  for (let i = 0; i < 2000 && out.length < 120; i++) {
    const x = rng.range(-5, 45), z = rng.range(-45, 45);
    const [rd, s] = riverAt(x, z);
    const hw = riverHalfWidth(s);
    if (rd < hw + 1.2 || rd > hw + 5) continue;
    if (z > 2 && z < 12 && x < 14) continue; // keep the dock approach open
    if (ok(x, z) && rng() < 0.5) out.push({ x, z, s: rng.range(0.7, 1.25) });
  }
  // scattered meadow bushes
  for (let i = 0; i < 2000 && out.length < 150; i++) {
    const x = rng.range(-45, 40), z = rng.range(-45, 40);
    if (ok(x, z, 2) && noise.fbm2(x * 0.05, z * 0.05, 2) > 0.25) out.push({ x, z, s: rng.range(0.7, 1.1) });
  }
  return out.map((b) => ({ ...b, y: groundY(b.x, b.z), rot: rng() * 6.28 }));
}

function planReeds(rng) {
  const out = [];
  for (let i = 0; i < 20000 && out.length < 260; i++) {
    const x = rng.range(-10, 50), z = rng.range(-60, 60);
    const d = waterDepth(x, z);
    if (d < -0.12 || d > 0.35) continue;
    if (Math.hypot(x - (DOCK.x + 3), z - DOCK.z) < 4.5) continue;
    if (RIVER_ROCKS.some((r) => Math.hypot(x - r.x, z - r.z) < r.r + 0.5)) continue;
    if (noise.n2(x * 0.12 + 5, z * 0.12) < 0.05) continue; // patches
    out.push({ x, z, y: groundY(x, z), h: rng.range(0.9, 1.35), rot: rng() * 6.28, cattails: rng() < 0.4 ? rng.int(1, 2) : 0 });
  }
  return out;
}

function planLilies(rng) {
  const out = [];
  const centres = [[23.5, 6.5], [22.5, 12], [16.5, -14], [27, 27], [21, -3]];
  for (const [cx, cz] of centres) {
    const n = rng.int(6, 11);
    for (let i = 0, k = 0; i < 60 && k < n; i++) {
      const x = cx + rng.range(-2.2, 2.2), z = cz + rng.range(-2.2, 2.2);
      const d = waterDepth(x, z);
      if (d < 0.25 || d > 1.3) continue;
      if (Math.hypot(x - (DOCK.x + 5.8), z - (DOCK.z - 1.3)) < 2.2) continue; // fishing line spot
      if (out.some((l) => Math.hypot(l.x - x, l.z - z) < 0.75)) continue;
      out.push({ x, z, r: rng.range(0.25, 0.42), rot: rng() * 6.28, flower: rng() < 0.22 });
      k++;
    }
  }
  return out;
}

export async function createPlants() {
  const rng = makeRng(3131);
  const group = new THREE.Group();
  group.name = 'Plants';
  group.userData.export = 'plants';
  group.add(createBushes(planBushes(rng)), createReeds(planReeds(rng)), createLilies(planLilies(rng)), createStumps());
  return group;
}
