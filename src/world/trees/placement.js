// Decides where trees go: hand-placed heroes, the grove, riverbanks and the background forest.
import { HERO_TREES, GROVE, DOCK, WOODPILE, CHOPPING, inCabinFootprint } from '../layout.js';
import { groundY, riverAt, riverHalfWidth, pathDist } from '../heightfield.js';
import { makeRng } from '../../util/rng.js';
import { noise, smoothstep } from '../../util/noise.js';

const CENTER = [-2, -6];

function okSpot(x, z, { pathClear = 1.8 } = {}) {
  const [rd, s] = riverAt(x, z);
  if (rd < riverHalfWidth(s) + 1.6) return false;
  if (groundY(x, z) < 0.3) return false;
  if (Math.abs(x) < 118 && Math.abs(z) < 118 && pathDist(x, z) < pathClear) return false;
  if (inCabinFootprint(x, z, 3.2)) return false;
  if (Math.hypot(x - DOCK.x, z - DOCK.z) < 4) return false;
  if (Math.hypot(x - WOODPILE.x, z - WOODPILE.z) < 3 || Math.hypot(x - CHOPPING.x, z - CHOPPING.z) < 3) return false;
  if (Math.hypot(x - GROVE.x, z - GROVE.z) < 5) return false; // clearing for woodcutting
  return true;
}

// keep the default idle sightline (camera south-west, looking north-east) uncluttered
function inViewCorridor(x, z) {
  return z > 12 && z < 70 && x > -40 && x < 16;
}

function pickWeighted(rng, table) {
  let r = rng() * table.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of table) { r -= w; if (r <= 0) return k; }
  return table[0][0];
}

export function planTrees() {
  const rng = makeRng(2024);
  const out = HERO_TREES.map((t) => ({ ...t, rot: rng() * 6.28, tint: rng.int(0, 3) }));
  const taken = out.map((t) => [t.x, t.z, 5.5]);
  const free = (x, z, d) => taken.every(([tx, tz, td]) => (x - tx) ** 2 + (z - tz) ** 2 > (Math.max(d, td) * 0.9) ** 2);
  const add = (species, x, z, s, minD) => {
    out.push({ species, x, z, s, v: rng.int(0, 2), rot: rng() * 6.28, tint: rng.int(0, 3) });
    taken.push([x, z, minD]);
  };

  // grove ring around the clearing
  for (let i = 0, n = 0; i < 600 && n < 18; i++) {
    const a = rng() * Math.PI * 2, r = 5.5 + Math.sqrt(rng()) * (GROVE.r + 3);
    const x = GROVE.x + Math.cos(a) * r, z = GROVE.z + Math.sin(a) * r * 0.85;
    if (!okSpot(x, z) || !free(x, z, 5.2)) continue;
    add(pickWeighted(rng, [['oak', 3.5], ['maple', 3], ['birch', 2], ['pine', 1.5]]), x, z, rng.range(0.85, 1.15), 5.2);
    n++;
  }
  // riverbanks: loose lines of birch/oak/maple
  for (let i = 0, n = 0; i < 900 && n < 20; i++) {
    const x = rng.range(-10, 60), z = rng.range(-70, 70);
    const [rd, s] = riverAt(x, z);
    const hw = riverHalfWidth(s);
    if (rd < hw + 2.2 || rd > hw + 9) continue;
    if (inViewCorridor(x, z) && rng() < 0.75) continue;
    if (!okSpot(x, z) || !free(x, z, 7)) continue;
    add(pickWeighted(rng, [['birch', 5], ['oak', 3], ['maple', 1.5]]), x, z, rng.range(0.8, 1.1), 7);
    n++;
  }
  // background forest, densest to the north/west/east, sparse toward the camera side
  for (let i = 0; i < 40000 && out.length < 900; i++) {
    const a0 = rng() * Math.PI * 2, r0 = 30 + Math.sqrt(rng()) * 240;
    const x = CENTER[0] + Math.cos(a0) * r0, z = CENTER[1] + Math.sin(a0) * r0;
    const r = r0;
    if (r > 120 && rng() < 0.35) continue;
    if (r > 120 && groundY(x, z) > 140) continue;
    let dens = 0.25 + 0.75 * Math.min(1, (r - 30) / 25);
    if (z > 18) dens *= 0.25 + 0.75 * Math.min(1, (z - 18) / 70) * 0;
    if (z > 18 && r < 75) dens *= 0.15;
    dens *= 0.55 + 0.9 * (noise.fbm2(x * 0.02, z * 0.02, 2) * 0.5 + 0.5);
    // forests grow in patches with open meadows between them (reads better from the idle cam)
    const patch = noise.fbm2(x * 0.011 + 31, z * 0.011 - 17, 3);
    dens *= r < 55 ? 1 : smoothstep(-0.12, 0.2, patch);
    if (rng() > dens) continue;
    if (inViewCorridor(x, z)) continue;
    const minD = r > 120 ? 8 : r > 60 ? 6.5 : 7.5;
    if (!okSpot(x, z, { pathClear: 2.5 }) || !free(x, z, minD)) continue;
    const far = r > 62;
    const sp = far ? pickWeighted(rng, [['pine', 5.5], ['oak', 3.5], ['maple', 0.8], ['birch', 0.6]])
      : pickWeighted(rng, [['oak', 3.5], ['pine', 3], ['birch', 2], ['maple', 1.3]]);
    add(sp, x, z, rng.range(0.85, 1.3) * (far ? 1.1 : 1), minD);
  }
  for (const t of out) t.far = Math.hypot(t.x - CENTER[0], t.z - CENTER[1]) > 62;
  return out;
}
