// Woodcutting spot: stacked split-log woodpile under a small lean-to against the cabin's
// west wall, a chopping block with an embedded axe, wood chips, loose splits and a sawhorse.
import * as THREE from 'three';
import { CABIN, CHOPPING, cabinLocal } from '../layout.js';
import { groundY } from '../heightfield.js';
import { Builder, boardGeo, logGeo, mtx, wedgeGeo, splitGroups } from '../cabin/geom.js';
import { getMaterials } from '../cabin/materials.js';
import { rgb } from '../cabin/logWalls.js';
import { makeRng } from '../../util/rng.js';

const tint = (rng, lo = 0.8, hi = 1.05) => { const k = rng.range(lo, hi); return rgb([k, k * rng.range(0.95, 1.0), k * rng.range(0.9, 1.0)]); };

// woodpile placement (local override, see report): against the west wall, facing west
const [PX, PZ] = cabinLocal(-4.2, 1.4);
export const WOODPILE_PLACED = { x: PX, z: PZ, rot: CABIN.rot - Math.PI / 2 };

function addLog(b, rng, len, r, m, k = [0.75, 0.95]) {
  const g = logGeo(len, r, rng, 10);
  b.add('log', g.side, m, tint(rng, ...k));
  b.add('end', g.capA, m, tint(rng, 0.9, 1.05)); b.add('end', g.capB, m, tint(rng, 0.9, 1.05));
}

// one split piece (length along local Z), rotated about its centroid by `roll`
function addSplit(b, rng, m, { r = rng.range(0.085, 0.13), len = 0.46 } = {}) {
  const angle = rng.pick([Math.PI / 2, Math.PI * 0.62, Math.PI]);
  const geo = wedgeGeo(r, angle, len + rng.range(-0.04, 0.03), 7);
  const cx = (4 * r * Math.sin(angle / 2)) / (3 * angle);
  geo.translate(-cx, 0, 0);
  const [caps, bark, split] = splitGroups(geo);
  b.add('end', caps, m, tint(rng, 0.85, 1.08));
  b.add('bark', bark, m, tint(rng, 0.85, 1.05));
  b.add('split', split, m, tint(rng, 0.85, 1.05));
  return r;
}

function buildPile(b, rng) {
  const len = 2.5, depth = 0.46;
  // base rails and posts
  for (const z of [-0.14, 0.14]) addLog(b, rng, len + 0.3, 0.06, mtx(0, 0.06, z));
  const posts = [[-1.36, 0.3, 1.62], [1.36, 0.3, 1.62], [-1.36, -0.32, 1.42], [1.36, -0.32, 1.42]];
  for (const [x, z, h] of posts) addLog(b, rng, h + 0.15, 0.065, mtx(x, h / 2 - 0.08, z, 0, 0, Math.PI / 2));
  // rows of split wood, end grain toward +Z (front)
  let y = 0.2;
  for (let row = 0; row < 7; row++) {
    let x = -len / 2 + rng.range(0.04, 0.12);
    const rowTop = 1.32 - Math.abs(row - 3) * 0.0;
    while (x < len / 2 - 0.08) {
      const r = rng.range(0.085, 0.125);
      const w = r * 1.75;
      const roll = rng() * Math.PI * 2;
      addSplit(b, rng, mtx(x + w / 2, y + rng.range(-0.015, 0.02), rng.range(-0.03, 0.03), rng.range(-0.04, 0.04), rng.range(-0.05, 0.05), roll), { r, len: depth });
      x += w + rng.range(-0.01, 0.02);
    }
    y += 0.165;
    if (y > rowTop) break;
  }
  // lean-to roof: planks across the depth, falling toward the wall
  const pitch = Math.atan2(0.2, 0.62);
  for (let x = -1.5; x < 1.5; x += 0.24) {
    b.add('weathered', boardGeo(0.95, 0.035, 0.23, rng), mtx(x + 0.12, 1.56, -0.01, 0, Math.PI / 2, -pitch, 1, 1, 1, 'YXZ'), tint(rng, 0.75, 1.0));
  }
  addLog(b, rng, 3.05, 0.055, mtx(0, 1.62, 0.3));
  addLog(b, rng, 3.05, 0.055, mtx(0, 1.42, -0.32));
}

function buildAxe(b, rng, m) {
  const s = new THREE.Shape();
  s.moveTo(-0.045, 0.05); s.lineTo(0.045, 0.05); s.lineTo(0.042, -0.04);
  s.quadraticCurveTo(0.04, -0.12, 0.095, -0.185);
  s.quadraticCurveTo(0.0, -0.215, -0.095, -0.175);
  s.quadraticCurveTo(-0.04, -0.115, -0.042, -0.04);
  s.lineTo(-0.045, 0.05);
  const head = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 6 });
  head.translate(0, 0, -0.015);
  b.add('steel', head, m);
  const h = logGeo(0.8, 0.018, rng, 8);
  const hm = m.clone().multiply(mtx(0.37, 0.005, 0));
  b.add('plank', h.side, hm, rgb([1.0, 0.92, 0.8])); b.add('plank', h.capA, hm); b.add('plank', h.capB, hm);
}

function buildChopping(b, rng) {
  const top = 0.52;
  addLog(b, rng, top + 0.12, 0.28, mtx(0, (top - 0.12) / 2, 0, 0, 0, Math.PI / 2), [0.6, 0.75]);
  // axe bitten into the top at an angle
  const phi = 0.62;
  const edgeLocal = new THREE.Vector3(0, -0.2, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), phi);
  buildAxe(b, rng, mtx(0.04, 0, 0.02, 0, 0.6, 0).multiply(mtx(-edgeLocal.x, top - 0.035 - edgeLocal.y, 0, 0, 0, phi)));
  // loose splits on the ground + chips
  addSplit(b, rng, mtx(0.62, 0.07, 0.25, 0, 0.9, Math.PI / 2 + 0.2));
  addSplit(b, rng, mtx(-0.55, 0.07, 0.45, 0, 0.3, 2.4));
  addSplit(b, rng, mtx(-0.62, 0.075, -0.3, 0, -0.9, -1.2), { len: 0.44 });
  const chip = new THREE.BoxGeometry(0.07, 0.008, 0.035);
  for (let i = 0; i < 34; i++) {
    const a = rng() * Math.PI * 2, r = 0.3 + Math.pow(rng(), 1.6) * 1.1;
    b.add('split', chip, mtx(Math.cos(a) * r, 0.01, Math.sin(a) * r, rng.range(-0.3, 0.3), rng() * 6, rng.range(-0.3, 0.3), rng.range(0.6, 1.4), 1, rng.range(0.6, 1.3)), tint(rng, 0.8, 1.05));
  }
}

function buildSawhorse(b, rng) {
  for (const x of [-0.45, 0.45]) {
    for (const s of [-1, 1]) {
      const g = logGeo(0.82, 0.03, rng, 6);
      const m = mtx(x, 0.36, s * 0.13, -s * 0.33, 0, Math.PI / 2);
      b.add('plankDark', g.side, m, tint(rng)); b.add('end', g.capA, m); b.add('end', g.capB, m);
    }
  }
  b.add('plankDark', boardGeo(1.2, 0.08, 0.08, rng), mtx(0, 0.72, 0), tint(rng));
  addLog(b, rng, 1.6, 0.13, mtx(0.15, 0.89, 0, 0, 0.1, 0));
}

export function buildWoodcutting() {
  const rng = makeRng(1717);
  const group = new THREE.Group();
  group.name = 'Woodcutting';
  const parts = [
    ['Woodpile', WOODPILE_PLACED.x, WOODPILE_PLACED.z, WOODPILE_PLACED.rot, buildPile],
    ['ChoppingBlock', CHOPPING.x, CHOPPING.z, 0.4, buildChopping],
    ['Sawhorse', CHOPPING.x - 1.9, CHOPPING.z - 2.1, 0.75, buildSawhorse],
  ];
  const mats = getMaterials();
  for (const [name, x, z, rot, fn] of parts) {
    const b = new Builder();
    fn(b, rng);
    const g = b.build(mats, name);
    g.name = name;
    g.position.set(x, groundY(x, z) - 0.02, z);
    g.rotation.y = rot;
    group.add(g);
  }
  return group;
}
