// Character collision: a 10 cm 2D occupancy grid rasterised from the real cabin/prop geometry
// (only triangles in the body-height band above the local walkable floor count, so decks,
// porch and floors stay walkable), plus analytic tree-trunk circles, deep water and bounds.
// Also owns the walkable floor height (terrain, dock deck, cabin porch/interior).
import * as THREE from 'three';
import { groundY, waterDepth } from '../world/heightfield.js';
import { DOCK } from '../world/layout.js';
import { DECK_TOP } from '../world/props/dock.js';

const CELL = 0.1, X0 = -75, Z0 = -75, N = 1400; // covers [-75, 65]^2
const BAND_LO = 0.32, BAND_HI = 1.75;

export function createCollision(root) {
  const grid = new Uint8Array(N * N);
  const cabin = root.getObjectByName('Cabin');
  const cabinFloor = cabin?.userData.floorAt;
  const cd = Math.cos(DOCK.rot), sd = Math.sin(DOCK.rot);

  function dockFloor(x, z) {
    const dx = x - DOCK.x, dz = z - DOCK.z;
    const along = dx * cd - dz * sd, across = dx * sd + dz * cd;
    return along > -0.2 && along < DOCK.len && Math.abs(across) < DOCK.w / 2 - 0.05 ? DECK_TOP : null;
  }
  // walkable surface height under (x, z); `kind` tells the controller what it's standing on
  function floorAt(x, z) {
    const c = cabinFloor ? cabinFloor(x, z) : null;
    if (c != null) return { y: c, kind: 'cabin' };
    const d = dockFloor(x, z);
    if (d != null) return { y: d, kind: 'dock' };
    return { y: groundY(x, z), kind: 'ground' };
  }

  // ---- rasterise obstacle triangles ----
  const idx = (i, j) => j * N + i;
  const mark = (x, z) => {
    const i = Math.floor((x - X0) / CELL), j = Math.floor((z - Z0) / CELL);
    if (i >= 0 && j >= 0 && i < N && j < N) grid[idx(i, j)] = 1;
  };
  const line = (ax, az, bx, bz) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / (CELL * 0.5)));
    for (let k = 0; k <= n; k++) mark(ax + (bx - ax) * (k / n), az + (bz - az) * (k / n));
  };
  const fill = (a, b, c) => {
    const minX = Math.min(a.x, b.x, c.x), maxX = Math.max(a.x, b.x, c.x), minZ = Math.min(a.z, b.z, c.z), maxZ = Math.max(a.z, b.z, c.z);
    if ((maxX - minX) * (maxZ - minZ) < CELL * CELL * 0.5) return;
    const area = (b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z);
    if (Math.abs(area) < 1e-6) return;
    for (let z = Math.floor((minZ - Z0) / CELL) * CELL + Z0 + CELL / 2; z <= maxZ; z += CELL) {
      for (let x = Math.floor((minX - X0) / CELL) * CELL + X0 + CELL / 2; x <= maxX; x += CELL) {
        const w0 = ((b.x - x) * (c.z - z) - (c.x - x) * (b.z - z)) / area;
        const w1 = ((c.x - x) * (a.z - z) - (a.x - x) * (c.z - z)) / area;
        if (w0 >= 0 && w1 >= 0 && w0 + w1 <= 1) mark(x, z);
      }
    }
  };
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), M4 = new THREE.Matrix4(), IM = new THREE.Matrix4();
  let tris = 0;
  function rasterMesh(mesh, world) {
    const g = mesh.geometry, pos = g.attributes.position;
    if (!pos) return;
    const index = g.index ? g.index.array : null;
    const count = index ? index.length : pos.count;
    for (let t = 0; t < count; t += 3) {
      const ia = index ? index[t] : t, ib = index ? index[t + 1] : t + 1, ic = index ? index[t + 2] : t + 2;
      A.fromBufferAttribute(pos, ia).applyMatrix4(world);
      B.fromBufferAttribute(pos, ib).applyMatrix4(world);
      C.fromBufferAttribute(pos, ic).applyMatrix4(world);
      const cx = (A.x + B.x + C.x) / 3, cz = (A.z + B.z + C.z) / 3;
      if (cx < X0 || cz < Z0 || cx > X0 + N * CELL || cz > Z0 + N * CELL) continue;
      const f = floorAt(cx, cz).y;
      const ylo = Math.min(A.y, B.y, C.y), yhi = Math.max(A.y, B.y, C.y);
      if (yhi < f + BAND_LO || ylo > f + BAND_HI) continue;
      line(A.x, A.z, B.x, B.z); line(B.x, B.z, C.x, C.z); line(C.x, C.z, A.x, A.z);
      fill(A, B, C);
      tris++;
    }
  }
  const skip = (o) => {
    for (let p = o; p; p = p.parent) {
      if (/Cabin_Door|Ripple|Bobber|FishingLine|Smoke|Light|Glow|Shaft|Rug|Fire|Herb/i.test(p.name)) return true;
      if (p.userData.noCollide) return true;
    }
    return false;
  };
  // the cabin brings its own analytic colliders (walls with a doorway gap, porch rails with a
  // gap at the steps, furniture), so only props are rasterised
  for (const name of ['Props']) {
    const g = root.getObjectByName(name);
    if (!g) continue;
    g.updateMatrixWorld(true);
    g.traverse((o) => {
      if (!o.isMesh || skip(o) || o.material?.transparent) return;
      if (o.isInstancedMesh) {
        for (let k = 0; k < o.count; k++) { o.getMatrixAt(k, IM); rasterMesh(o, M4.multiplyMatrices(o.matrixWorld, IM)); }
      } else rasterMesh(o, o.matrixWorld);
    });
  }
  // grove dressing (stumps, felled log) lives in Plants
  root.getObjectByName('GroveDressing')?.traverse((o) => { if (o.isMesh) rasterMesh(o, o.matrixWorld); });
  const trunks = root.getObjectByName('Trees')?.userData.trunks || [];
  console.log('collision grid: triangles', tris, 'trunks', trunks.length);

  // ---- queries ----
  const trunkHash = new Map();
  for (const t of trunks) {
    const k = `${Math.floor(t.x / 4)},${Math.floor(t.z / 4)}`;
    if (!trunkHash.has(k)) trunkHash.set(k, []);
    trunkHash.get(k).push(t);
  }
  function hitsTrunk(x, z, r) {
    const ci = Math.floor(x / 4), cj = Math.floor(z / 4);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const list = trunkHash.get(`${ci + a},${cj + b}`);
      if (list) for (const t of list) if ((x - t.x) ** 2 + (z - t.z) ** 2 < (r + t.r) ** 2) return true;
    }
    return false;
  }
  function gridHit(x, z, r) {
    const i0 = Math.floor((x - r - X0) / CELL), i1 = Math.floor((x + r - X0) / CELL);
    const j0 = Math.floor((z - r - Z0) / CELL), j1 = Math.floor((z + r - Z0) / CELL);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (i < 0 || j < 0 || i >= N || j >= N) return true;
      if (!grid[idx(i, j)]) continue;
      const cx = X0 + (i + 0.5) * CELL, cz = Z0 + (j + 0.5) * CELL;
      if ((cx - x) ** 2 + (cz - z) ** 2 < r * r) return true;
    }
    return false;
  }
  const cabinCols = cabin?.userData.colliders || [];
  function hitsCabin(x, z, r) {
    for (const c of cabinCols) {
      if (c.type === 'circle') { if ((x - c.x) ** 2 + (z - c.z) ** 2 < (r + c.r) ** 2) return true; }
      else if (c.type === 'seg') {
        const dx = c.bx - c.ax, dz = c.bz - c.az, l2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - c.ax) * dx + (z - c.az) * dz) / l2));
        if ((x - c.ax - dx * t) ** 2 + (z - c.az - dz * t) ** 2 < (r + c.r) ** 2) return true;
      } else if (c.type === 'box') {
        const cs = Math.cos(c.rot), sn = Math.sin(c.rot), dx = x - c.x, dz = z - c.z;
        const bx = dx * cs - dz * sn, bz = dx * sn + dz * cs;
        const qx = Math.max(Math.abs(bx) - c.hx, 0), qz = Math.max(Math.abs(bz) - c.hz, 0);
        if (qx * qx + qz * qz < r * r) return true;
      }
    }
    return false;
  }
  function blocked(x, z, r, fromY) {
    if (Math.hypot(x + 2, z + 4) > 62) return true; // play-area bounds
    const f = floorAt(x, z);
    if (f.kind === 'ground' && waterDepth(x, z) > 0.12) return true; // river: stay out
    if (fromY !== undefined && f.y - fromY > 0.45) return true; // ledge too high to step up
    return hitsTrunk(x, z, r) || hitsCabin(x, z, r) || gridHit(x, z, r);
  }
  // move from p toward p+d, sliding along obstacles
  function move(p, dx, dz, r) {
    const y = floorAt(p.x, p.z).y;
    if (!blocked(p.x + dx, p.z + dz, r, y)) { p.x += dx; p.z += dz; return 'free'; }
    if (!blocked(p.x + dx, p.z, r, y)) { p.x += dx; return 'slide'; }
    if (!blocked(p.x, p.z + dz, r, y)) { p.z += dz; return 'slide'; }
    return 'stuck';
  }
  return { floorAt, blocked, move, grid, CELL, X0, Z0, N, debugTris: tris };
}
