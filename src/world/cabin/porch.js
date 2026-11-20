// Front porch: plank deck with rim boards, log posts + beam + knee braces, rafters, a low
// shingled shed roof tucked under the main eave, log railing, steps, bench and lantern.
import * as THREE from 'three';
import { boardGeo, logGeo, mtx } from './geom.js';
import { DIM } from './dims.js';
import { rgb } from './logWalls.js';
import { layShingles } from './roof.js';
import { buildLantern } from './lantern.js';
import { makeRng } from '../../util/rng.js';

const rng = makeRng(2024);
const tint = (lo = 0.85, hi = 1.05) => { const k = rng.range(lo, hi); return rgb([k, k * rng.range(0.96, 1.0), k * rng.range(0.93, 1.0)]); };

function addLog(builder, len, r, m, key = 'log') {
  const g = logGeo(len, r, rng, 10);
  builder.add(key, g.side, m, tint(0.82, 1.0));
  builder.add('end', g.capA, m, tint(0.9, 1.0));
  builder.add('end', g.capB, m, tint(0.9, 1.0));
}
// log between two points
function logBetween(builder, a, b, r) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
  addLog(builder, len, r, m);
}

export function buildPorch(builder, roofBuilder = builder) {
  const { w, d, porch } = DIM;
  const deckY = DIM.found + 0.03, z0 = d / 2 + 0.02, z1 = d / 2 + porch;
  const hx = w / 2 + 0.1;
  // deck boards (two staggered lengths per row)
  for (let z = z0 + 0.07, i = 0; z < z1; z += 0.152, i++) {
    const split = rng.range(-1.2, 1.2) + (i % 2 ? 1.5 : -1.5);
    for (const [a, b] of [[-hx, split], [split, hx]]) {
      builder.add('plank', boardGeo(b - a - 0.01, 0.05, 0.14, rng), mtx((a + b) / 2, deckY - 0.025 + rng.range(-0.004, 0.004), z, 0, rng.range(-0.004, 0.004), 0), tint(0.78, 1.05));
    }
  }
  builder.add('plankDark', boardGeo(hx * 2 + 0.06, 0.32, 0.05, rng), mtx(0, deckY - 0.17, z1 + 0.03), tint(0.8, 0.9));
  for (const s of [-1, 1]) builder.add('plankDark', boardGeo(porch, 0.32, 0.05, rng), mtx(s * (hx + 0.03), deckY - 0.17, d / 2 + porch / 2, 0, Math.PI / 2, 0), tint(0.8, 0.9));

  // porch roof plane
  const pp = THREE.MathUtils.degToRad(11), zA = d / 2 + DIM.roofOverEave;
  const yAtA = DIM.roofY(zA) - 0.16;
  const y0 = yAtA + (zA - d / 2) * Math.tan(pp);
  const roofZ1 = z1 + 0.5;
  const slopeLen = (roofZ1 - d / 2) / Math.cos(pp);
  const roofHalfX = w / 2 + 0.25;
  const frame = (x, s, n = 0, tilt = 0, yaw = 0) => mtx(x, y0 - s * Math.sin(pp) + n * Math.cos(pp), d / 2 + s * Math.cos(pp) + n * Math.sin(pp), pp + tilt, yaw, 0, 1, 1, 1, 'YXZ');
  for (let s = 0.15; s < slopeLen; s += 0.3) roofBuilder.add('plankDark', boardGeo(roofHalfX * 2, 0.05, 0.29, rng), frame(0, s, -0.025), tint(0.75, 0.9));
  layShingles(roofBuilder, frame, roofHalfX, slopeLen, rng, { e: 0.27 });
  roofBuilder.add('plankDark', boardGeo(roofHalfX * 2 + 0.06, 0.16, 0.045, rng), frame(0, slopeLen + 0.02, -0.04, -pp), tint(0.75, 0.85));
  const yRoof = (z) => y0 - (z - d / 2) * Math.tan(pp);

  // beam, posts, knee braces, rafters
  const postZ = z1 - 0.18;
  const beamY = yRoof(postZ) - 0.05 - 0.11;
  addLog(builder, w + 0.7, 0.11, mtx(0, beamY, postZ));
  const postsX = [-w / 2 + 0.1, DIM.door.x - 0.63, DIM.door.x + 0.63, w / 2 - 0.1];
  for (const px of postsX) {
    const top = beamY - 0.05;
    addLog(builder, top - deckY, 0.095, mtx(px, (deckY + top) / 2, postZ, 0, 0, Math.PI / 2));
    builder.add('stone', new THREE.BoxGeometry(0.3, 0.3, 0.3), mtx(px, deckY - 0.2, postZ, 0, rng.range(0, 1), 0), 0xb8b8b8);
  }
  for (const px of [postsX[0], postsX[3]]) {
    const s = px < 0 ? 1 : -1;
    logBetween(builder, new THREE.Vector3(px, beamY - 0.55, postZ), new THREE.Vector3(px + s * 0.5, beamY - 0.05, postZ), 0.045);
  }
  for (let x = -w / 2 + 0.2; x <= w / 2 - 0.1; x += (w - 0.3) / 5) {
    const a = new THREE.Vector3(x, yRoof(d / 2 + 0.05) - 0.1, d / 2 + 0.05), b = new THREE.Vector3(x, yRoof(roofZ1 - 0.05) - 0.1, roofZ1 - 0.05);
    logBetween(builder, a, b, 0.06);
  }

  // railing (log rails + thin pickets)
  const railY = deckY + 0.9;
  const rail = (ax, az, bx, bz) => {
    const A = new THREE.Vector3(ax, railY, az), B = new THREE.Vector3(bx, railY, bz);
    logBetween(builder, A, B, 0.045);
    logBetween(builder, A.clone().setY(deckY + 0.14), B.clone().setY(deckY + 0.14), 0.035);
    const len = A.distanceTo(B), n = Math.floor(len / 0.2);
    for (let i = 1; i < n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const lean = rng.range(-0.03, 0.03);
      logBetween(builder, new THREE.Vector3(x, deckY + 0.1, z), new THREE.Vector3(x + lean, railY + 0.02, z), 0.022);
    }
  };
  rail(postsX[0], postZ, postsX[1], postZ);
  rail(postsX[2], postZ, postsX[3], postZ);
  for (const px of [postsX[0], postsX[3]]) rail(px, d / 2 + 0.25, px, postZ);

  // steps down to the path
  const sx = DIM.door.x, sw = 1.12;
  const steps = [[z1 + 0.18, deckY - 0.12], [z1 + 0.48, deckY - 0.235]];
  for (const [sz, top] of steps) {
    builder.add('plank', boardGeo(sw, 0.05, 0.32, rng), mtx(sx, top - 0.025, sz), tint(0.85, 1.0));
    builder.add('plankDark', boardGeo(sw - 0.04, top - 0.05, 0.03, rng), mtx(sx, (top - 0.05) / 2, sz + 0.14), tint(0.7, 0.8));
  }
  for (const s of [-1, 1]) {
    const a = Math.atan2(deckY, 0.7);
    builder.add('plankDark', boardGeo(0.82, 0.2, 0.05, rng), mtx(sx + s * (sw / 2 - 0.03), deckY / 2 - 0.08, z1 + 0.33, a, -Math.PI / 2, 0, 1, 1, 1, 'XYZ'), tint(0.7, 0.8));
  }

  // bench left of the door
  const bx = -w / 2 + 0.95, bz = d / 2 + 0.33;
  builder.add('plank', boardGeo(1.45, 0.06, 0.34, rng), mtx(bx, deckY + 0.45, bz), tint(0.85, 1.0));
  for (const s of [-1, 1]) addLog(builder, 0.42, 0.075, mtx(bx + s * 0.55, deckY + 0.21, bz, 0, 0, Math.PI / 2));

  // wall lantern on a bracket right of the door
  const lx = DIM.door.x + DIM.door.w / 2 + 0.38, ly = 1.62, lz = d / 2 + 0.3;
  builder.add('iron', new THREE.BoxGeometry(0.03, 0.03, 0.34), mtx(lx, ly + 0.5, d / 2 + 0.14));
  builder.add('iron', new THREE.BoxGeometry(0.02, 0.12, 0.02), mtx(lx, ly + 0.43, lz));
  const glow = buildLantern(builder, mtx(lx, ly, lz));
  return { lanternPos: glow };
}
