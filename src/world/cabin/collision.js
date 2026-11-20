// Character collision + walkable heights for the cabin, in WORLD space (XZ).
// colliders: {type:'seg', ax, az, bx, bz, r} | {type:'circle', x, z, r} | {type:'box', x, z, hx, hz, rot}
// floorAt(x, z) -> world Y of porch deck / steps / doorway / interior floor, or null.
import * as THREE from 'three';
import { CABIN } from '../layout.js';
import { CABIN_PAD_H, groundY } from '../heightfield.js';
import { DIM } from './dims.js';
import { LAYOUT } from './interior/furniture.js';
import { FIRE } from './interior/structure.js';

const c = Math.cos(CABIN.rot), s = Math.sin(CABIN.rot);
const toWorld = (lx, lz) => [CABIN.x + lx * c + lz * s, CABIN.z - lx * s + lz * c];
const toLocal = (x, z) => { const dx = x - CABIN.x, dz = z - CABIN.z; return [dx * c - dz * s, dx * s + dz * c]; };

function seg(ax, az, bx, bz, r) { const [wax, waz] = toWorld(ax, az), [wbx, wbz] = toWorld(bx, bz); return { type: 'seg', ax: wax, az: waz, bx: wbx, bz: wbz, r }; }
function circle(x, z, r) { const [wx, wz] = toWorld(x, z); return { type: 'circle', x: wx, z: wz, r }; }
function box(x, z, hx, hz, rot = 0) { const [wx, wz] = toWorld(x, z); return { type: 'box', x: wx, z: wz, hx, hz, rot: CABIN.rot + rot }; }

export function cabinColliders() {
  const { w, d, porch, door, sideX, frontZ } = DIM;
  const out = [];
  const R = 0.2, X = sideX + 0.17, Z = frontZ;
  // outer walls (front wall has the doorway gap)
  // the doorway keeps its full clear width: thick wall segments stop short, thin jamb pieces finish
  const dl = door.x - door.w / 2 - 0.07, dr = door.x + door.w / 2 + 0.07;
  out.push(seg(-X, Z, dl - 0.25, Z, R), seg(dl - 0.3, Z, dl, Z, 0.07), seg(dr, Z, dr + 0.3, Z, 0.07), seg(dr + 0.25, Z, X, Z, R));
  out.push(seg(-X, -Z, X, -Z, R), seg(-sideX, -Z, -sideX, Z, R), seg(sideX, -Z, sideX, Z, R));
  out.push(box(3.82, 0, 0.52, 0.8)); // chimney
  // porch posts + railings, gap at the steps
  const postZ = d / 2 + porch - 0.18;
  const postsX = [-w / 2 + 0.1, door.x - 0.63, door.x + 0.63, w / 2 - 0.1];
  for (const px of postsX) out.push(circle(px, postZ, 0.13));
  out.push(seg(postsX[0], postZ, postsX[1], postZ, 0.07), seg(postsX[2], postZ, postsX[3], postZ, 0.07));
  for (const px of [postsX[0], postsX[3]]) out.push(seg(px, d / 2 + 0.25, px, postZ, 0.07));
  out.push(box(-w / 2 + 0.95, d / 2 + 0.33, 0.74, 0.2)); // porch bench
  // interior
  out.push(box((FIRE.front + 3.0) / 2, 0, (3.0 - FIRE.front) / 2 + 0.12, 0.98)); // fireplace + hearth lip
  out.push(box(2.67, 1.42, 0.27, 0.38)); // firewood stack
  const L = LAYOUT;
  out.push(box(L.table.x, L.table.z, L.table.hx, L.table.hz));
  for (const ch of L.chairs) out.push(circle(ch.x, ch.z, 0.26));
  out.push(box(L.rocker.x, L.rocker.z, 0.45, 0.33, L.rocker.ry));
  out.push(box(L.bed.x, L.bed.z, L.bed.hx, L.bed.hz));
  out.push(box(L.trunk.x, L.trunk.z, L.trunk.hx, L.trunk.hz));
  out.push(box(L.wash.x, L.wash.z, L.wash.hx, L.wash.hz));
  out.push(circle(L.shelves.x - 0.55, L.shelves.z + 0.33, 0.27), circle(L.shelves.x + 0.55, L.shelves.z + 0.24, 0.17)); // barrel, crock
  out.push(circle(2.76, -2.17, 0.15)); // broom corner
  return out;
}

export function floorAt(x, z) {
  const [lx, lz] = toLocal(x, z);
  const { w, d, porch, door, sideX, frontZ, floorY } = DIM;
  const base = CABIN_PAD_H;
  const inside = Math.abs(lx) < sideX && Math.abs(lz) < frontZ;
  const doorway = Math.abs(lx - door.x) < door.w / 2 + 0.1 && lz >= frontZ - 0.3 && lz <= frontZ + 0.3;
  const deck = Math.abs(lx) < w / 2 + 0.12 && lz > d / 2 - 0.05 && lz <= d / 2 + porch + 0.02;
  if (inside || doorway || deck) return base + floorY;
  const z0 = d / 2 + porch + 0.02, z1 = z0 + 0.75;
  if (Math.abs(lx - door.x) < 0.62 && lz > z0 && lz < z1) {
    const h = floorY * (1 - (lz - z0) / (z1 - z0));
    return Math.max(base + h, groundY(x, z));
  }
  return null;
}

// world-space centre of the doorway at floor level + outward normal
export function doorInfo() {
  const [x, z] = toWorld(DIM.door.x, DIM.frontZ);
  const n = new THREE.Vector3(s, 0, c).normalize(); // local +Z in world
  return { doorWorld: new THREE.Vector3(x, CABIN_PAD_H + DIM.floorY, z), doorNormal: n };
}
