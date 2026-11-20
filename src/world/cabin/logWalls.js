// Stacked round-log walls with crossing (saddle-notched) corners, overhanging log ends
// showing end grain, and openings cut for the door and windows.
import { Builder, logGeo, mtx } from './geom.js';
import { DIM } from './dims.js';
import { makeRng } from '../../util/rng.js';

// subtract [a,b] intervals from [x0,x1]
function cut(x0, x1, holes) {
  let segs = [[x0, x1]];
  for (const [a, b] of holes) {
    const next = [];
    for (const [s, e] of segs) {
      if (b <= s || a >= e) { next.push([s, e]); continue; }
      if (a > s) next.push([s, a]);
      if (b < e) next.push([b, e]);
    }
    segs = next;
  }
  return segs.filter(([s, e]) => e - s > 0.12);
}

const overlaps = (y, r, o) => y + r * 0.55 > o.y0 && y - r * 0.55 < o.y1;

export function buildLogWalls(builder = new Builder()) {
  const rng = makeRng(404);
  const { w, d, r, course, found, overhang } = DIM;
  const addLog = (x0, x1, y, fixed, alongX) => {
    const len = x1 - x0, mid = (x0 + x1) / 2;
    const rr = r * rng.range(0.93, 1.07);
    const { side, capA, capB } = logGeo(len, rr, rng);
    const m = alongX ? mtx(mid, y, fixed) : mtx(fixed, y, mid, 0, -Math.PI / 2, 0);
    const k = rng.range(0.86, 1.1);
    const tint = [k * rng.range(0.97, 1.03), k, k * rng.range(0.94, 1.02)];
    builder.add('log', side, m, rgb(tint));
    const kc = rng.range(0.9, 1.08);
    builder.add('end', capA, m, rgb([kc, kc, kc]));
    builder.add('end', capB, m, rgb([kc, kc, kc]));
  };

  const D = DIM;
  const fx0 = -w / 2 - overhang, fx1 = w / 2 + overhang;
  const sz0 = -d / 2 - overhang, sz1 = d / 2 + overhang;
  // front (+Z) and back (-Z) eave walls
  for (let k = 0; k < D.frontCourses; k++) {
    const y = found + r + k * course;
    const frontHoles = [D.door, D.winFront].filter((o) => overlaps(y, r, o)).map((o) => [o.x - o.w / 2 - 0.02, o.x + o.w / 2 + 0.02]);
    for (const [a, b] of cut(fx0, fx1, frontHoles)) addLog(a, b, y, D.frontZ, true);
    const backHoles = [D.winBack].filter((o) => overlaps(y, r, o)).map((o) => [o.x - o.w / 2 - 0.02, o.x + o.w / 2 + 0.02]);
    for (const [a, b] of cut(fx0, fx1, backHoles)) addLog(a, b, y, -D.frontZ, true);
  }
  // side (gable-end) walls, offset half a course; extra sill log at the bottom
  for (let k = -1; k < D.sideCourses; k++) {
    const y = found + r + (k + 0.5) * course;
    // log along Z: rotated so local +X maps to world -Z; holes in z are mirrored
    const westHoles = [D.winSide].filter((o) => overlaps(y, r, o)).map((o) => [-(o.z + o.w / 2 + 0.02), -(o.z - o.w / 2 - 0.02)]);
    for (const [a, b] of cut(sz0, sz1, westHoles)) addLog(-b, -a, y, -D.sideX, false);
    addLog(sz0, sz1, y, D.sideX, false);
  }
  return builder;
}

export function rgb([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return (c(r) << 16) | (c(g) << 8) | c(b);
}
