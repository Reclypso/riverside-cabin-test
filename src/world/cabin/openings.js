// Door (planks, Z-brace, strap hinges, ring handle) and windows (frame, mullions, sill,
// glowing glass, painted shutters, flower box).
import * as THREE from 'three';
import { boardGeo, mtx } from './geom.js';
import { DIM } from './dims.js';
import { rgb } from './logWalls.js';
import { makeRng } from '../../util/rng.js';

const rng = makeRng(919);
const tint = (lo = 0.85, hi = 1.05) => { const k = rng.range(lo, hi); return rgb([k, k * rng.range(0.97, 1.0), k * rng.range(0.94, 1.0)]); };

// add a part built in an opening's canonical frame (X along wall, Y up, +Z out of the wall)
const place = (builder, frame) => (key, geo, m, color) => builder.add(key, geo, frame.clone().multiply(m), color);

function frameAndSill(add, w, y0, y1, depth = 0.4) {
  const h = y1 - y0;
  for (const s of [-1, 1]) add('plankDark', boardGeo(h + 0.16, 0.12, depth, rng), mtx(s * (w / 2 + 0.06), (y0 + y1) / 2, 0, 0, 0, Math.PI / 2), tint());
  add('plankDark', boardGeo(w + 0.36, 0.15, depth + 0.02, rng), mtx(0, y1 + 0.075, 0.01), tint());
}

export function buildDoor(builder) {
  const { x, w, y0, y1 } = DIM.door;
  const add = place(builder, mtx(x, 0, DIM.frontZ));
  frameAndSill(add, w, y0, y1);
  add('plankDark', boardGeo(w + 0.3, 0.05, 0.46, rng), mtx(0, y0 + 0.025, 0.03), tint(0.7, 0.85)); // threshold
  const h = y1 - y0 - 0.02, n = 5, pw = w / n;
  for (let i = 0; i < n; i++) {
    add('plank', boardGeo(h, pw - 0.008, 0.05, rng), mtx(-w / 2 + pw * (i + 0.5), y0 + 0.01 + h / 2, 0.02, 0, 0, Math.PI / 2), tint(0.72, 0.92));
  }
  const rails = [y0 + 0.32, y0 + h - 0.32];
  for (const ry of rails) add('plank', boardGeo(w - 0.1, 0.13, 0.045, rng), mtx(0, ry, 0.065), tint(0.65, 0.8));
  const dx = w - 0.22, dy = rails[1] - rails[0];
  add('plank', boardGeo(Math.hypot(dx, dy) - 0.05, 0.11, 0.04, rng), mtx(0, (rails[0] + rails[1]) / 2, 0.063, 0, 0, Math.atan2(dy, -dx) + Math.PI), tint(0.65, 0.8));
  for (const ry of rails) add('iron', new THREE.BoxGeometry(0.5, 0.045, 0.012), mtx(-w / 2 + 0.27, ry, 0.093), 0x666666);
  const ring = new THREE.TorusGeometry(0.055, 0.009, 6, 16);
  add('iron', new THREE.CylinderGeometry(0.035, 0.035, 0.012, 10), mtx(w / 2 - 0.16, y0 + 1.0, 0.052, Math.PI / 2, 0, 0), 0x888888);
  add('iron', ring, mtx(w / 2 - 0.16, y0 + 0.95, 0.065, 0.25, 0, 0), 0x999999);
}

export function buildWindow(builder, { cx, cz, ry, w, y0, y1, shutters = true, box = false }) {
  const add = place(builder, mtx(cx, 0, cz, 0, ry, 0));
  const h = y1 - y0;
  frameAndSill(add, w, y0, y1);
  // sill: protruding, slightly sloped
  add('plankDark', boardGeo(w + 0.4, 0.06, 0.52, rng), mtx(0, y0 - 0.03, 0.08, 0.08, 0, 0), tint(0.8, 0.95));
  add('plankDark', boardGeo(w + 0.02, 0.07, 0.36, rng), mtx(0, y0 + 0.02, -0.02), tint());
  // glass + mullions
  const glass = new THREE.PlaneGeometry(w, h);
  add('glass', glass, mtx(0, y0 + h / 2, -0.01));
  add('plankDark', boardGeo(w, 0.05, 0.08, rng), mtx(0, y0 + h * 0.55, 0.01), tint(0.9, 1.0));
  add('plankDark', boardGeo(h, 0.05, 0.08, rng), mtx(0, y0 + h / 2, 0.01, 0, 0, Math.PI / 2), tint(0.9, 1.0));
  if (shutters) {
    for (const s of [-1, 1]) {
      // hinged at the frame edge, swung open so it sits angled slightly off the wall
      const hinge = mtx(s * (w / 2 + 0.13), 0, 0.21, 0, -s * 0.38, 0);
      const sw = w / 2 + 0.02;
      for (let i = 0; i < 3; i++) {
        builder.add('paint', boardGeo(h + 0.08, sw / 3 - 0.01, 0.035, rng), mtx(cx, 0, cz, 0, ry, 0).multiply(hinge).multiply(mtx(s * (sw / 3) * (i + 0.5), y0 + h / 2, 0, 0, 0, Math.PI / 2)), tint(0.82, 1.02));
      }
      for (const yy of [y0 + 0.16, y0 + h - 0.16]) {
        builder.add('paint', boardGeo(sw, 0.09, 0.03, rng), mtx(cx, 0, cz, 0, ry, 0).multiply(hinge).multiply(mtx(s * sw / 2, yy, 0.03)), tint(0.7, 0.85));
      }
    }
  }
  if (box) {
    const bw = w + 0.2;
    add('plank', boardGeo(bw, 0.2, 0.03, rng), mtx(0, y0 - 0.2, 0.42), tint(0.75, 0.9));
    add('plank', boardGeo(bw, 0.03, 0.22, rng), mtx(0, y0 - 0.3, 0.32), tint(0.7, 0.85));
    for (const s of [-1, 1]) add('plank', boardGeo(0.22, 0.2, 0.03, rng), mtx(s * bw / 2, y0 - 0.2, 0.32, 0, Math.PI / 2, 0), tint(0.75, 0.9));
    add('plankDark', boardGeo(0.25, 0.04, 0.04, rng), mtx(-bw / 2 + 0.15, y0 - 0.33, 0.25, 0, Math.PI / 2, 0));
    add('plankDark', boardGeo(0.25, 0.04, 0.04, rng), mtx(bw / 2 - 0.15, y0 - 0.33, 0.25, 0, Math.PI / 2, 0));
    const leaf = new THREE.IcosahedronGeometry(0.075, 1), bloom = new THREE.IcosahedronGeometry(0.04, 0);
    const cols = [0xf25c54, 0xffffff, 0xf7b267, 0xe86fa0];
    for (let i = 0; i < 16; i++) {
      const lx = rng.range(-bw / 2 + 0.08, bw / 2 - 0.08), lz = rng.range(0.24, 0.42);
      add('leaf', leaf, mtx(lx, y0 - 0.1 + rng.range(0, 0.06), lz, rng(), rng(), rng(), 1, rng.range(0.7, 1.1), 1), rgb([rng.range(0.8, 1), rng.range(0.85, 1.05), 0.9]));
    }
    for (let i = 0; i < 18; i++) {
      add('petal', bloom, mtx(rng.range(-bw / 2 + 0.06, bw / 2 - 0.06), y0 - 0.02 + rng.range(0, 0.07), rng.range(0.24, 0.46)), cols[i % cols.length]);
    }
  }
}

export function buildOpenings(builder) {
  buildDoor(builder);
  const F = DIM.winFront, S = DIM.winSide, B = DIM.winBack;
  buildWindow(builder, { cx: F.x, cz: DIM.frontZ, ry: 0, w: F.w, y0: F.y0, y1: F.y1, box: true });
  buildWindow(builder, { cx: -DIM.sideX, cz: S.z, ry: -Math.PI / 2, w: S.w, y0: S.y0, y1: S.y1 });
  buildWindow(builder, { cx: B.x, cz: -DIM.frontZ, ry: Math.PI, w: B.w, y0: B.y0, y1: B.y1, shutters: false });
}
