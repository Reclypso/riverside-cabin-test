// Geometry helpers shared by cabin + props: a merge Builder, boards with length-wise UVs,
// wobbly logs with end caps, pillowy stones and split-log wedges.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

export function mtx(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, order = 'XYZ') {
  _e.set(rx, ry, rz, order); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

export function setColor(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

// Collects transformed geometry per material key and merges each key into one mesh.
export class Builder {
  constructor() { this.parts = new Map(); }
  add(key, geo, matrix, color = 0xffffff) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.color) setColor(g, color);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    if (matrix) g.applyMatrix4(matrix);
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g);
    return this;
  }
  build(materials, namePrefix, { cast = true, receive = true } = {}) {
    const group = new THREE.Group();
    for (const [key, list] of this.parts) {
      const mesh = new THREE.Mesh(mergeGeometries(list, false), materials[key]);
      mesh.name = `${namePrefix}_${key}`;
      mesh.castShadow = cast; mesh.receiveShadow = receive;
      group.add(mesh);
    }
    return group;
  }
}

// Box with its length along X; UVs run along the length so wood grain follows the board.
export function boardGeo(len, h, t, rng = Math.random, scale = 0.5) {
  const g = new THREE.BoxGeometry(len, h, t);
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  const ou = rng() * 4, ov = rng() * 4;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, z * scale + ou, y * scale + ov);
    else if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, x * scale + ou, z * scale + ov);
    else uv.setXY(i, x * scale + ou, y * scale + ov);
  }
  return g;
}

// Round log along X with gentle radius wobble/taper. Returns { side, capA, capB }.
export function logGeo(len, r, rng = Math.random, segs = 12) {
  const side = new THREE.CylinderGeometry(r, r, len, segs, Math.max(2, Math.round(len * 2)), true);
  side.rotateZ(-Math.PI / 2); // axis -> X (cylinder +Y -> +X)
  const p = side.attributes.position, uv = side.attributes.uv;
  const ph = rng() * 10, taper = rng.range ? rng.range(-0.06, 0.06) : 0;
  const ou = rng() * 4;
  const rad = (x, a) => r * (1 + taper * (x / len) + 0.035 * Math.sin(x * 2.3 + ph) + 0.03 * Math.sin(a * 3 + ph) + 0.02 * Math.cos(a * 5 + x));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, y);
    const k = rad(x, a) / r;
    p.setY(i, y * k); p.setZ(i, z * k);
    uv.setXY(i, x * 0.5 + ou, uv.getX(i) * 2 * Math.PI * r * 0.5);
  }
  side.computeVertexNormals();
  const cap = (sign) => {
    const c = new THREE.CircleGeometry(1, segs);
    const cp = c.attributes.position, nrm = c.attributes.normal;
    const x = (sign * len) / 2;
    for (let i = 0; i < cp.count; i++) {
      const u = cp.getX(i), v = cp.getY(i);
      const l = Math.hypot(u, v), a = Math.atan2(v, u);
      const rr = rad(x, a) * l;
      cp.setXYZ(i, x, Math.cos(a) * rr, Math.sin(a) * rr); // (u,v)->(y,z): faces +X
      nrm.setXYZ(i, sign, 0, 0);
    }
    if (sign < 0) {
      const idx = c.index.array;
      for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    }
    return c;
  };
  return { side, capA: cap(-1), capB: cap(1) };
}

// Pillowy rounded block (unit size) used for stones.
export function pillowGeo(round = 0.45, segs = 3) {
  const g = new THREE.BoxGeometry(1, 1, 1, segs, segs, segs);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const s = v.clone().normalize().multiplyScalar(0.5 * Math.sqrt(3) * 0.62);
    v.lerp(s, round);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// Split-log wedge: sector of a disc extruded along Z (length). Three groups:
// 0 = end grain caps, 1 = bark arc, 2 = split faces. Centred on its length.
export function wedgeGeo(r, angle, len, segs = 8) {
  const pos = [], nor = [], uv = [], groups = [[], [], []];
  const v3 = (a) => new THREE.Vector3(...a);
  // push a triangle, fixing winding so it faces along n (flat) or the per-vertex normals
  const push = (gi, A, B, C) => {
    const fn = v3(B[0]).sub(v3(A[0])).cross(v3(C[0]).sub(v3(A[0])));
    const want = v3(A[1]).add(v3(B[1])).add(v3(C[1]));
    if (fn.dot(want) < 0) { const t = B; B = C; C = t; }
    const base = pos.length / 3;
    for (const [P, N, U] of [A, B, C]) { pos.push(...P); nor.push(...N); uv.push(...U); }
    groups[gi].push(base, base + 1, base + 2);
  };
  const a0 = -angle / 2;
  const pt = (a, rr, z) => [Math.cos(a) * rr, Math.sin(a) * rr, z];
  const h = len / 2;
  const uvOf = (p) => [0.5 + (p[0] / (2 * r)) * 0.9, 0.5 + (p[1] / (2 * r)) * 0.9];
  for (const z of [-h, h]) {
    const n = [0, 0, Math.sign(z)];
    for (let i = 0; i < segs; i++) {
      const aa = a0 + (angle * i) / segs, ab = a0 + (angle * (i + 1)) / segs;
      const P0 = [0, 0, z], P1 = pt(aa, r, z), P2 = pt(ab, r, z);
      push(0, [P0, n, uvOf(P0)], [P1, n, uvOf(P1)], [P2, n, uvOf(P2)]);
    }
  }
  for (let i = 0; i < segs; i++) {
    const aa = a0 + (angle * i) / segs, ab = a0 + (angle * (i + 1)) / segs;
    const na = [Math.cos(aa), Math.sin(aa), 0], nb = [Math.cos(ab), Math.sin(ab), 0];
    const A = pt(aa, r, -h), B = pt(ab, r, -h), C = pt(ab, r, h), D = pt(aa, r, h);
    const ua = (aa - a0) * r, ub = (ab - a0) * r;
    push(1, [A, na, [-h, ua]], [B, nb, [-h, ub]], [C, nb, [h, ub]]);
    push(1, [A, na, [-h, ua]], [C, nb, [h, ub]], [D, na, [h, ua]]);
  }
  for (const [a, n] of [[a0, [Math.sin(a0), -Math.cos(a0), 0]], [a0 + angle, [-Math.sin(a0 + angle), Math.cos(a0 + angle), 0]]]) {
    const O0 = [0, 0, -h], O1 = [0, 0, h], E0 = pt(a, r, -h), E1 = pt(a, r, h);
    push(2, [O0, n, [-h, 0]], [O1, n, [h, 0]], [E1, n, [h, r]]);
    push(2, [O0, n, [-h, 0]], [E1, n, [h, r]], [E0, n, [-h, r]]);
  }
  const g = new THREE.BufferGeometry();
  const index = [];
  let start = 0;
  groups.forEach((list, gi) => { index.push(...list); g.addGroup(start, list.length, gi); start += list.length; });
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

// Split an indexed geometry with groups into one geometry per group (same attributes).
export function splitGroups(geo) {
  return geo.groups.map((gr) => {
    const g = new THREE.BufferGeometry();
    for (const [k, v] of Object.entries(geo.attributes)) g.setAttribute(k, v);
    g.setIndex(Array.from(geo.index.array.slice(gr.start, gr.start + gr.count)));
    return g;
  });
}
