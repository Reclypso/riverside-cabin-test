// Lily pads (notched discs with a lighter rim) and a few white-pink water lilies, gently bobbing.
import * as THREE from 'three';
import { stylize } from '../../render/stylize.js';

function padGeometry() {
  const g = new THREE.CircleGeometry(1, 20, 0.35, Math.PI * 2 - 0.7);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, col = [];
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    const k = 0.75 + 0.35 * r;
    col.push(0.26 * k, 0.55 * k, 0.2 * k);
    pos.setY(i, 0.02 * r * r); // slight upturned rim
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function lilyGeometry() {
  // two rings of pointed petals around a yellow centre
  const pos = [], col = [], idx = [];
  const ring = (n, len, lift, off, c) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + off, ca = Math.cos(a), sa = Math.sin(a), w = 0.045;
      const b = pos.length / 3;
      pos.push(-sa * w, 0.02, ca * w, sa * w, 0.02, -ca * w, ca * len, lift, sa * len);
      for (let k = 0; k < 3; k++) col.push(...c);
      idx.push(b, b + 2, b + 1);
    }
  };
  ring(8, 0.17, 0.07, 0, [0.98, 0.93, 0.95]);
  ring(7, 0.12, 0.12, 0.4, [1.0, 0.8, 0.88]);
  const b = pos.length / 3;
  pos.push(0, 0.06, 0, 0.03, 0.04, 0, -0.03, 0.04, 0.02, 0, 0.04, -0.03);
  for (let k = 0; k < 4; k++) col.push(1, 0.8, 0.2);
  idx.push(b, b + 1, b + 2, b, b + 2, b + 3, b, b + 3, b + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const BOB = /* glsl */ `
  #ifdef USE_INSTANCING
    vec3 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #else
    vec3 root = modelMatrix[3].xyz;
  #endif
  float ph = hash12(root.xz) * 6.28;
  wPos.y += sin(uTime * 1.3 + ph) * 0.012;
  wPos.xz += vec2(sin(uTime * 0.4 + ph), cos(uTime * 0.37 + ph)) * 0.04;`;

export function createLilies(spots) {
  const group = new THREE.Group();
  group.name = 'LilyPads';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const mat = stylize(new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide }), { wrap: 0.3, worldVertex: BOB });
  const pads = new THREE.InstancedMesh(padGeometry(), mat, spots.length);
  const flowers = spots.filter((l) => l.flower);
  const lily = new THREE.InstancedMesh(lilyGeometry(), mat, Math.max(1, flowers.length));
  spots.forEach((l, i) => {
    p.set(l.x, 0.012, l.z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), l.rot); s.setScalar(l.r);
    pads.setMatrixAt(i, m4.compose(p, q, s));
  });
  flowers.forEach((l, i) => {
    p.set(l.x + 0.08, 0.03, l.z - 0.05); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), l.rot * 3); s.setScalar(0.9 + l.r * 0.4);
    lily.setMatrixAt(i, m4.compose(p, q, s));
  });
  lily.count = flowers.length;
  pads.name = 'LilyPads'; lily.name = 'WaterLilies';
  pads.receiveShadow = true; lily.receiveShadow = true;
  pads.computeBoundingSphere(); lily.computeBoundingSphere();
  group.add(pads, lily);
  return group;
}
