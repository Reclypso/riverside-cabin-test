// Gable roof: log ridge pole + purlins poking out at the gables, plank deck, staggered
// shingle rows with lifted butts (stepped shadow lines), fascia/barge boards, ridge cap,
// and board-and-batten gable infill.
import { boardGeo, logGeo, mtx } from './geom.js';
import { DIM } from './dims.js';
import { rgb } from './logWalls.js';
import { makeRng } from '../../util/rng.js';

// Shingle rows on a slope frame f(x, s, n, tilt, yaw) -> Matrix4 (s down-slope from the top).
// Butts are lifted so each row laps the one below, giving stepped shadow lines.
export function layShingles(builder, f, halfX, slopeLen, rng, { L = 0.5, e = 0.26, lift = 0.05 } = {}) {
  const th = 0.022;
  const rows = Math.ceil((slopeLen - L) / e) + 1;
  for (let i = 0; i < rows; i++) {
    const s0 = Math.min(i * e, slopeLen - L);
    let x = -halfX + (i % 2 ? -0.12 : 0) + rng.range(0, 0.1);
    while (x < halfX) {
      const sw = Math.min(rng.range(0.24, 0.42), halfX - x);
      if (sw > 0.06) {
        const sL = L + rng.range(-0.03, 0.02);
        const k = rng.range(0.86, 1.08) * (i === rows - 1 ? 0.92 : 1);
        const tint = rgb([k * rng.range(0.96, 1.05), k * rng.range(0.92, 1.0), k * rng.range(0.9, 1.0)]);
        builder.add('roof', boardGeo(sw, th, sL, rng, 0.9),
          f(x + sw / 2, s0 + sL / 2, th / 2 + lift / 2 + 0.002 * (i % 3), -Math.atan2(lift, L) + rng.range(-0.015, 0.015), rng.range(-0.025, 0.025)), tint);
      }
      x += sw + 0.014;
    }
  }
}

export function buildRoof(builder) {
  const rng = makeRng(77);
  const { w, d, pitch, roofOverEave, roofOverGable } = DIM;
  const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
  const halfX = w / 2 + roofOverGable;
  const slopeLen = (d / 2 + roofOverEave) / cosP;
  const deckT = 0.06;
  // slope frame: s = distance down-slope from the ridge, n = offset along the roof normal
  const at = (side, x, s, n, tilt = 0, yaw = 0) => {
    const y = DIM.ridgeY - s * sinP + n * cosP;
    const z = side * (s * cosP + n * sinP);
    return mtx(x, y, z, side * (pitch + tilt), yaw, 0, 1, 1, 1, 'YXZ');
  };

  for (const side of [1, -1]) {
    // roof deck boards running along X
    for (let s = 0.12; s < slopeLen; s += 0.3) {
      builder.add('plankDark', boardGeo(halfX * 2, deckT, 0.29, rng), at(side, 0, s, -deckT / 2));
    }
    layShingles(builder, (x, sl, n, tilt, yaw) => at(side, x, sl, n, tilt, yaw), halfX, slopeLen, rng);
    // fascia board along the eave
    builder.add('plankDark', boardGeo(halfX * 2 + 0.1, 0.2, 0.05, rng), at(side, 0, slopeLen + 0.02, -0.05, -pitch));
    // barge boards along both gable edges
    for (const gx of [-halfX - 0.03, halfX + 0.03]) {
      const g = boardGeo(slopeLen + 0.05, 0.24, 0.05, rng);
      const sm = slopeLen / 2, n = -0.05;
      builder.add('plankDark', g, mtx(gx, DIM.ridgeY - sm * sinP + n * cosP, side * (sm * cosP + n * sinP), side * pitch, Math.PI / 2, 0, 1, 1, 1, 'XYZ'));
    }
  }
  // ridge cap (split log) and ridge pole / purlins sticking out of the gables
  const cap = logGeo(halfX * 2 + 0.2, 0.11, rng);
  const capM = mtx(0, DIM.ridgeY + 0.07, 0);
  builder.add('log', cap.side, capM, rgb([0.82, 0.8, 0.78]));
  builder.add('end', cap.capA, capM); builder.add('end', cap.capB, capM);
  const poleLen = halfX * 2 - 0.08;
  for (const [z, drop] of [[0, 0.16], [1.45, 0.16], [-1.45, 0.16]]) {
    const y = DIM.roofY(Math.abs(z)) - drop;
    const pole = logGeo(poleLen, 0.13, rng);
    const m = mtx(0, y, z);
    builder.add('log', pole.side, m, rgb([0.9, 0.88, 0.86]));
    builder.add('end', pole.capA, m); builder.add('end', pole.capB, m);
  }
  // gable infill: vertical boards + battens on both gable ends
  const yBase = DIM.found + DIM.r + (DIM.sideCourses - 0.5) * DIM.course + DIM.r * 0.6;
  for (const gx of [-DIM.sideX - 0.02, DIM.sideX + 0.02]) {
    const sgn = Math.sign(gx);
    for (let z = -d / 2 + 0.12; z < d / 2; z += 0.25) {
      const top = DIM.roofY(Math.abs(z) + 0.12) - 0.04;
      const h = top - yBase;
      if (h < 0.05) continue;
      const g = boardGeo(h, 0.045, 0.24, rng);
      builder.add('weathered', g, mtx(gx, yBase + h / 2, z, 0, 0, Math.PI / 2), (() => { const k = rng.range(0.8, 1.0); return rgb([k, k * 0.98, k * 0.95]); })());
      if (h > 0.2) {
        const b = boardGeo(h - 0.05, 0.03, 0.055, rng);
        builder.add('plankDark', b, mtx(gx + sgn * 0.035, yBase + h / 2 - 0.02, z + 0.125, 0, 0, Math.PI / 2));
      }
    }
  }
  return builder;
}
