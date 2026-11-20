// Far-forest placement (250-900 m): patchy forests on the lower mountain slopes, kept out of
// the river valley floor and off steep or high ground. Instances index impostor atlas cells.
import { computeHeight, riverAt, riverHalfWidth } from '../heightfield.js';
import { TERRAIN_SIZE } from '../layout.js';
import { makeRng } from '../../util/rng.js';

const HALF = TERRAIN_SIZE / 2;

export function planFarForest(cellSpecies, max = 7000) {
  const rng = makeRng(404);
  const bySpecies = {};
  cellSpecies.forEach((sp, i) => (bySpecies[sp] = bySpecies[sp] || []).push(i));
  const out = [];
  for (let i = 0; i < 70000 && out.length < max; i++) {
    const a = rng() * Math.PI * 2, r = 245 + Math.pow(rng(), 1.35) * 680;
    const x = -2 + Math.cos(a) * r, z = -6 + Math.sin(a) * r;
    if (Math.abs(x) < HALF && Math.abs(z) < HALF) continue;
    const y = computeHeight(x, z);
    const [rd, sp] = riverAt(x, z);
    if (rd < riverHalfWidth(sp) + 5 || y < 0.5 || y > 200) continue;
    const e = 3;
    const slope = Math.hypot(computeHeight(x + e, z) - computeHeight(x - e, z), computeHeight(x, z + e) - computeHeight(x, z - e)) / (2 * e);
    if (slope > 0.8) continue;
    if (Math.sin(x * 0.013 + Math.cos(z * 0.011) * 2) + Math.sin(z * 0.017 + 1.3) < -0.3 + rng() * 0.6) continue; // patches
    const pine = rng() < 0.5 + Math.min(0.35, y / 260);
    const species = pine ? 'pine' : rng() < 0.82 ? 'oak' : rng() < 0.6 ? 'maple' : 'birch';
    const cells = bySpecies[species] || bySpecies.oak;
    out.push({ x, y: y - 0.3, z, cell: cells[Math.floor(rng() * cells.length)], scale: (0.95 + rng() * 0.5) * (1 + r / 1400) });
  }
  return out;
}
