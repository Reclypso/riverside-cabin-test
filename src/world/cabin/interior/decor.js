// Lived-in clutter: jars, crocks, pots, plates, skillet, flour barrel, herb bundles, beaver
// pelt on a willow hoop, muzzle-loader + powder horn over the mantel, axe and coat on pegs,
// broom, candles, oil lamp, bearskin rug, split firewood, table settings.
import * as THREE from 'three';
import { boardGeo, logGeo, mtx, pillowGeo, wedgeGeo, splitGroups } from '../geom.js';
import { rgb } from '../logWalls.js';
import { DIM } from '../dims.js';
import { buildBarrel } from '../../props/furniture.js';
import { LAYOUT } from './furniture.js';
import { makeRng } from '../../../util/rng.js';

const F = DIM.floorY;
const V2 = (pts) => pts.map(([r, y]) => new THREE.Vector2(r, y));
const T = (rng, lo = 0.82, hi = 1.04) => { const k = rng.range(lo, hi); return rgb([k, k * rng.range(0.95, 1.0), k * rng.range(0.9, 1.0)]); };

function jar(b, rng, x, y, z, fill) {
  const h = rng.range(0.15, 0.22), r = rng.range(0.05, 0.065);
  b.add('jar', new THREE.LatheGeometry(V2([[0, 0], [r, 0.005], [r + 0.004, h * 0.8], [r * 0.75, h * 0.92], [r * 0.75, h]]), 12), mtx(x, y, z), fill);
  if (rng() < 0.5) b.add('tin', new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.02, 12), mtx(x, y + h + 0.01, z), 0xffffff);
  else { b.add('linen', new THREE.CylinderGeometry(r * 0.95, r * 0.8, 0.035, 10), mtx(x, y + h + 0.012, z), 0xe6d8b8); b.add('rope', new THREE.TorusGeometry(r * 0.8, 0.004, 3, 10), mtx(x, y + h - 0.005, z, Math.PI / 2, 0, 0)); }
}
function crock(b, x, y, z, s = 1) {
  const prof = V2([[0, 0], [0.09, 0], [0.11, 0.05], [0.115, 0.14], [0.1, 0.2], [0.075, 0.23], [0.08, 0.25]]).map((v) => v.multiplyScalar(s));
  b.add('glaze', new THREE.LatheGeometry(prof.slice(0, 4), 14), mtx(x, y, z), 0xe2d2b0);
  b.add('glaze', new THREE.LatheGeometry(prof.slice(3), 14), mtx(x, y, z), 0x6a4026);
}
function pot(b, x, y, z, s = 1) {
  b.add('castIron', new THREE.LatheGeometry(V2([[0, 0], [0.09, 0.0], [0.12, 0.05], [0.125, 0.12], [0.11, 0.15], [0.115, 0.16]]).map((v) => v.multiplyScalar(s)), 14), mtx(x, y, z), 0x3a3634);
  b.add('castIron', new THREE.CylinderGeometry(0.115 * s, 0.12 * s, 0.02, 14), mtx(x, y + 0.17 * s, z), 0x2e2c2a);
  b.add('castIron', new THREE.TorusGeometry(0.12 * s, 0.006, 4, 12, Math.PI), mtx(x, y + 0.16 * s, z, 0, 0.3, 0), 0x444444);
}
function herbBundle(b, rng, x, yTop, z, col) {
  b.add('rope', new THREE.CylinderGeometry(0.004, 0.004, 0.42, 3), mtx(x, yTop - 0.21, z), 0xc9b07a);
  const y = yTop - 0.42, card = new THREE.PlaneGeometry(0.035, 0.11);
  b.add('rope', new THREE.CylinderGeometry(0.02, 0.016, 0.06, 6), mtx(x, y - 0.02, z), 0x9a8a5a);
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2, t = rng(), r = 0.015 + t * 0.07;
    const c = new THREE.Color(col).multiplyScalar(rng.range(0.75, 1.15));
    b.add('herb', card, mtx(x + Math.cos(a) * r, y - 0.05 - t * 0.22, z + Math.sin(a) * r, Math.PI - 0.35 * Math.cos(a) * t, a, 0), c.getHex());
  }
}

function shelvesDecor(b, rng) {
  const { x, z } = LAYOUT.shelves, zz = z + 0.15;
  const fills = [0x6f8a3a, 0xe09a40, 0xb38a5a, 0xd89a30, 0x9a3a32];
  [0.36, 0.5, 0.64, 1.62].forEach((dx, i) => jar(b, rng, x - 0.8 + dx, 1.57, zz, fills[i % fills.length]));
  crock(b, x + 0.05, 1.57, zz); crock(b, x + 0.35, 1.57, zz, 0.8);
  b.add('tin', new THREE.CylinderGeometry(0.035, 0.03, 0.08, 10), mtx(x + 0.55, 1.61, zz + 0.02), 0xffffff);
  for (let i = 0; i < 3; i++) b.add('tin', new THREE.CylinderGeometry(0.1, 0.1, 0.012, 16), mtx(x - 0.6 + i * 0.045, 2.12, zz - 0.07, Math.PI / 2 - 0.22, 0, 0), 0x8a9098);
  pot(b, x - 0.05, 2.02, zz, 0.9);
  b.add('plank', boardGeo(0.22, 0.12, 0.16, rng), mtx(x + 0.38, 2.08, zz), T(rng)); // salt box
  b.add('jar', new THREE.LatheGeometry(V2([[0, 0], [0.04, 0], [0.042, 0.14], [0.015, 0.2], [0.015, 0.25]]), 10), mtx(x + 0.62, 2.02, zz), 0x3a5a3a); // bottle
  // skillet hanging on a nail under the shelf
  b.add('castIron', new THREE.CylinderGeometry(0.15, 0.13, 0.03, 18), mtx(x + 0.72, 1.18, z + 0.04, Math.PI / 2, 0, 0), 0x333131);
  b.add('castIron', new THREE.BoxGeometry(0.035, 0.2, 0.02), mtx(x + 0.72, 1.41, z + 0.04), 0x333131);
  buildBarrel(b, rng, mtx(x - 0.55, F, z + 0.33), { h: 0.72, r: 0.24 });
  b.add('linen', pillowGeo(0.5, 2), mtx(x - 0.55, F + 0.71, z + 0.33, 0, 0, 0, 0.44, 0.06, 0.44), 0xe6d8b8); // flour cloth
  crock(b, x + 0.55, F, z + 0.24, 1.35);
}

function hearthDecor(b, rng) {
  // split firewood stacked against the wall beside the fireplace, end grain to the room
  for (let row = 0; row < 4; row++) for (let i = 0; i < 5 - (row % 2); i++) {
    const r = rng.range(0.07, 0.1), angle = rng.pick([Math.PI / 2, Math.PI * 0.62, Math.PI]);
    const geo = wedgeGeo(r, angle, 0.44, 7);
    const [caps, bark, split] = splitGroups(geo);
    const m = mtx(2.67, F + 0.09 + row * 0.16, 1.12 + (row % 2) * 0.07 + i * 0.15, rng.range(0, 6.28), Math.PI / 2, 0);
    b.add('end', caps, m, T(rng, 0.85, 1.05)); b.add('bark', bark, m, T(rng)); b.add('split', split, m, T(rng));
  }
  // dutch oven on the hearth + candles on the mantel
  pot(b, 2.05, F + 0.06, -0.62, 1.05);
  for (const s of [-1, 1]) {
    b.add('tin', new THREE.CylinderGeometry(0.05, 0.05, 0.012, 12), mtx(2.42, 1.562, s * 0.72), 0xffffff);
    b.add('wax', new THREE.CylinderGeometry(0.018, 0.02, s > 0 ? 0.16 : 0.11, 8), mtx(2.42, 1.56 + (s > 0 ? 0.08 : 0.055), s * 0.72), 0xffffff);
  }
  jar(b, rng, 2.42, 1.555, 0.38, 0xb38a5a);
  // muzzle-loader on pegs above the mantel, powder horn on a cord
  for (const z of [-0.42, 0.42]) b.add('plankDark', boardGeo(0.12, 0.035, 0.035, rng), mtx(2.42, 1.95, z), T(rng));
  const R = mtx(2.38, 2.0, 0, 0, Math.PI / 2, 0);
  const at = (...a) => R.clone().multiply(mtx(...a));
  b.add('castIron', new THREE.CylinderGeometry(0.012, 0.014, 1.05, 8), at(-0.12, 0.012, 0, 0, 0, Math.PI / 2), 0x3a3a3c);
  b.add('plank', boardGeo(0.9, 0.04, 0.032, rng), at(-0.1, -0.012, 0), rgb([0.75, 0.48, 0.3]));
  b.add('plank', boardGeo(0.36, 0.11, 0.04, rng), at(0.55, -0.03, 0, 0, 0, -0.12), rgb([0.72, 0.45, 0.28]));
  b.add('plank', boardGeo(0.14, 0.05, 0.035, rng), at(0.32, -0.005, 0), rgb([0.72, 0.45, 0.28]));
  b.add('brass', new THREE.BoxGeometry(0.1, 0.035, 0.012), at(0.3, 0.005, 0.02), 0xffffff);
  b.add('brass', new THREE.TorusGeometry(0.035, 0.005, 4, 10, Math.PI), at(0.28, -0.04, 0, 0, 0, Math.PI), 0xffffff);
  b.add('plankDark', new THREE.CylinderGeometry(0.005, 0.005, 0.95, 4), at(-0.08, -0.04, 0.0, 0, 0, Math.PI / 2), 0x6a4a2a);
  b.add('glaze', new THREE.ConeGeometry(0.045, 0.3, 10, 1, true), mtx(2.43, 1.72, -0.6, 0.2, 0, Math.PI / 2 + 0.5), 0xe9dcc0);
  b.add('rope', new THREE.TorusGeometry(0.16, 0.004, 3, 16, Math.PI), mtx(2.43, 1.82, -0.6, 0, Math.PI / 2, Math.PI), 0x6a4a2a);
}

function wallDecor(b, rng) {
  // beaver pelt on a willow hoop, west wall
  const px = -DIM.inX + 0.04, pz = 1.5, py = 1.7;
  b.add('pelt', new THREE.PlaneGeometry(0.62, 0.68), mtx(px + 0.02, py, pz, 0, Math.PI / 2, 0), 0xffffff);
  b.add('bark', new THREE.TorusGeometry(0.32, 0.014, 5, 24), mtx(px + 0.03, py, pz, 0, Math.PI / 2, 0, 1, 1.08, 1), 0xb09070);
  // axe on two pegs, front wall right of the door
  const fz = DIM.inZ - 0.05;
  for (const x of [0.75, 1.05]) b.add('plankDark', boardGeo(0.03, 0.03, 0.1, rng), mtx(x, 1.3, fz), T(rng));
  const handle = logGeo(0.78, 0.017, rng, 6);
  const hm = mtx(0.92, 1.33, fz - 0.02);
  b.add('plank', handle.side, hm, rgb([0.82, 0.62, 0.42]));
  b.add('castIron', new THREE.BoxGeometry(0.06, 0.15, 0.03), mtx(1.32, 1.36, fz - 0.02), 0x4a4a4c);
  b.add('tin', new THREE.BoxGeometry(0.012, 0.15, 0.031), mtx(1.355, 1.36, fz - 0.02), 0xffffff);
  // coat + felt hat on pegs
  for (const x of [0.05, 0.42]) b.add('plankDark', new THREE.CylinderGeometry(0.018, 0.018, 0.12, 6), mtx(x, 1.82, fz - 0.03, Math.PI / 2, 0, 0), 0x6a4a2a);
  const coat = new THREE.CylinderGeometry(0.14, 0.27, 0.95, 10, 4, true, Math.PI * 0.15, Math.PI * 1.7);
  coat.scale(1, 1, 0.45);
  b.add('leather', coat, mtx(0.05, 1.33, fz - 0.1, 0, Math.PI, 0), 0xb0814e);
  for (let i = 0; i < 14; i++) b.add('leather', new THREE.BoxGeometry(0.012, 0.08, 0.004), mtx(0.05 - 0.24 + i * 0.037, 0.83, fz - 0.06 - Math.abs(i - 7) * 0.006), 0x9a6c3e);
  b.add('wool', new THREE.CylinderGeometry(0.085, 0.1, 0.12, 12), mtx(0.42, 1.86, fz - 0.12), 0x4a3a2c);
  b.add('wool', new THREE.CylinderGeometry(0.18, 0.18, 0.012, 16), mtx(0.42, 1.8, fz - 0.12, 0.25, 0, 0), 0x45362a);
  // broom in the back corner
  b.add('plankDark', new THREE.CylinderGeometry(0.014, 0.014, 1.3, 6), mtx(2.78, F + 0.75, -2.16, 0.12, 0, -0.1), 0x8a6a48);
  b.add('straw', new THREE.ConeGeometry(0.13, 0.36, 10, 1, true), mtx(2.74, F + 0.16, -2.19, Math.PI + 0.12, 0, -0.1, 1, 1, 0.45), 0xffffff);
  // herb bundles from the joist nearest the hearth
  const cols = [0x7d9460, 0x9a86c0, 0xb39a5a, 0x5f7a46, 0x8a9a50, 0xa08a50];
  [-2.0, -1.6, -1.2, 0.95, 1.3, 1.7].forEach((z, i) => herbBundle(b, rng, 1.85, DIM.ceilY - 0.2, z, cols[i]));
}

function tableDecor(b, rng) {
  const { x, z } = LAYOUT.table, y = F + 0.76;
  b.add('plank', new THREE.LatheGeometry(V2([[0, 0], [0.06, 0.0], [0.11, 0.04], [0.13, 0.07]]), 14), mtx(x + 0.15, y, z - 0.12), rgb([0.85, 0.62, 0.4]));
  b.add('tin', new THREE.CylinderGeometry(0.04, 0.035, 0.09, 10), mtx(x + 0.42, y + 0.045, z + 0.1), 0xffffff);
  b.add('plank', boardGeo(0.34, 0.025, 0.22, rng), mtx(x - 0.2, y + 0.012, z + 0.18), T(rng));
  b.add('linen', pillowGeo(0.7, 2), mtx(x - 0.2, y + 0.07, z + 0.18, 0, 0.2, 0, 0.24, 0.1, 0.13), 0xc89058); // bread
  b.add('tin', new THREE.CylinderGeometry(0.05, 0.05, 0.012, 12), mtx(x + 0.42, y + 0.006, z + 0.28), 0xffffff);
  b.add('wax', new THREE.CylinderGeometry(0.018, 0.02, 0.13, 8), mtx(x + 0.42, y + 0.075, z + 0.28), 0xffffff);
  // oil lamp: brass font + glass chimney
  const lx = x - 0.32, lz = z - 0.12;
  b.add('brass', new THREE.LatheGeometry(V2([[0, 0], [0.07, 0.0], [0.075, 0.02], [0.05, 0.05], [0.075, 0.1], [0.07, 0.13], [0.03, 0.15], [0.032, 0.17]]), 14), mtx(lx, y, lz), 0xffffff);
  b.add('lanternGlass', new THREE.LatheGeometry(V2([[0.032, 0], [0.045, 0.04], [0.05, 0.08], [0.03, 0.17], [0.03, 0.22]]), 14), mtx(lx, y + 0.17, lz), 0xffffff);
  return { lamp: new THREE.Vector3(lx, y + 0.24, lz), candles: [new THREE.Vector3(x + 0.42, y + 0.15, z + 0.28)] };
}

export function buildDecor(b) {
  const rng = makeRng(1838);
  shelvesDecor(b, rng); hearthDecor(b, rng); wallDecor(b, rng);
  const t = tableDecor(b, rng);
  // rug: bearskin in front of the hearth (head toward the fire)
  b.add('rug', new THREE.PlaneGeometry(1.75, 1.3), mtx(1.25, F + 0.012, 0.02, -Math.PI / 2, 0, 0.08), 0xffffff);
  return {
    lamp: t.lamp,
    flames: [...t.candles, new THREE.Vector3(2.42, 1.56 + 0.17, 0.72), new THREE.Vector3(2.42, 1.56 + 0.12, -0.72)].map((p) => ({ p, s: [0.045, 0.1] }))
      .concat([{ p: t.lamp.clone().add(new THREE.Vector3(0, -0.06, 0)), s: [0.04, 0.09] }]),
  };
}
