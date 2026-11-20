// Distant backdrop: a polar ring of terrain (same height function and ground shader as the
// play area, continuing into mountains and the river valley) plus an instanced "forest carpet"
// of cheap tree blobs on the lower slopes.
import * as THREE from 'three';
import { computeHeight, riverAt, riverHalfWidth } from './heightfield.js';
import { TERRAIN_SIZE } from './layout.js';
import { makeRng } from '../util/rng.js';
import { stylize } from '../render/stylize.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// stylised distant tree silhouettes: tiered pine, lumpy broadleaf
function pineGeo() {
  const parts = [[1.0, 0.5, 0.28], [0.76, 0.46, 0.5], [0.52, 0.42, 0.72]].map(([r, h, y]) =>
    new THREE.ConeGeometry(r, h, 8, 1, true).translate(0, y, 0).toNonIndexed());
  return mergeGeometries(parts);
}
function broadGeo() {
  const parts = [[0, 0.82, 0, 0.72], [0.42, 0.6, 0.18, 0.5], [-0.38, 0.62, -0.2, 0.52], [0.05, 0.55, -0.45, 0.45]].map(([x, y, z, r]) =>
    new THREE.IcosahedronGeometry(r, 1).translate(x, y, z));
  return mergeGeometries(parts);
}

const HALF = TERRAIN_SIZE / 2;

function ringGeometry() {
  const segA = 420, rows = 90, r0 = 108, r1 = 1700;
  const pos = [], idx = [];
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    const r = r0 * Math.pow(r1 / r0, Math.pow(t, 0.85));
    for (let i = 0; i < segA; i++) {
      const a = (i / segA) * Math.PI * 2;
      const x = -2 + Math.cos(a) * r, z = -6 + Math.sin(a) * r;
      let y = computeHeight(x, z);
      // hide under the play terrain where they overlap (avoids z-fighting)
      if (Math.abs(x) < HALF - 0.5 && Math.abs(z) < HALF - 0.5) y -= 0.8;
      pos.push(x, y, z);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < segA; i++) {
      const a = j * segA + i, b = j * segA + ((i + 1) % segA), c = a + segA, d = b + segA;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

function forestCarpet() {
  const rng = makeRng(404);
  const cone = pineGeo();
  const blob = broadGeo();
  const mat = stylize(new THREE.MeshLambertMaterial({ color: 0xffffff }), { wrap: 0.5, ramp: 0.2, hue: 1.3 });
  const pines = [], broads = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < 60000 && pines.length + broads.length < 9000; i++) {
    const a = rng() * Math.PI * 2, r = 250 + Math.pow(rng(), 1.4) * 650;
    const x = -2 + Math.cos(a) * r, z = -6 + Math.sin(a) * r;
    if (Math.abs(x) < HALF && Math.abs(z) < HALF) continue;
    const y = computeHeight(x, z);
    const [rd, sp] = riverAt(x, z);
    if (rd < riverHalfWidth(sp) + 4 || y < 0.5 || y > 210) continue;
    const e = 3;
    const slope = Math.hypot(computeHeight(x + e, z) - computeHeight(x - e, z), computeHeight(x, z + e) - computeHeight(x, z - e)) / (2 * e);
    if (slope > 0.75) continue;
    // clustered: forests in patches
    if (Math.sin(x * 0.013 + Math.cos(z * 0.011) * 2) + Math.sin(z * 0.017 + 1.3) < -0.3 + rng() * 0.6) continue;
    const isPine = rng() < 0.45 + Math.min(0.4, y / 250);
    const h = (isPine ? 11 : 8) * (0.8 + rng() * 0.6) * (1 + r / 900);
    p.set(x, y - 0.5, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * 6.28);
    s.set(isPine ? h * 0.36 : h * 0.6, isPine ? h : h * 0.7, isPine ? h * 0.36 : h * 0.6);
    m4.compose(p, q, s);
    const col = new THREE.Color().setHSL(isPine ? 0.43 + rng() * 0.04 : 0.28 + rng() * 0.06, 0.42, isPine ? 0.16 + rng() * 0.05 : 0.22 + rng() * 0.06);
    (isPine ? pines : broads).push([m4.clone(), col]);
  }
  const out = [];
  for (const [geo, list, name] of [[cone, pines, 'Backdrop_Pines'], [blob, broads, 'Backdrop_Broadleaf']]) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([m, c], i) => { im.setMatrixAt(i, m); im.setColorAt(i, c); });
    im.name = name;
    im.computeBoundingSphere();
    out.push(im);
  }
  return out;
}

export async function createBackdrop({ root }) {
  const group = new THREE.Group();
  group.name = 'Backdrop';
  group.userData.noExport = true;
  const terrain = root.getObjectByName('Terrain');
  const ring = new THREE.Mesh(ringGeometry(), terrain.material);
  ring.name = 'Backdrop_Terrain';
  ring.receiveShadow = false;
  group.add(ring, ...forestCarpet());
  return group;
}
