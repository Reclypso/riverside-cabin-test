// Reeds and cattails along the shallow, slow river edges.
import * as THREE from 'three';
import { createClumpGeometry } from '../grass/grassGeometry.js';
import { createGrassMaterial } from '../grass/grassMaterial.js';
import { stylize } from '../../render/stylize.js';

const REED_PALETTE = { base: 0x3d5e2a, midA: 0x6f9a3a, midB: 0x8fb046, tipA: 0xc6cf73, tipB: 0xd9d58a, dry: 0xd8c58a };

export function createReeds(spots) {
  const group = new THREE.Group();
  group.name = 'Reeds';
  const geo = createClumpGeometry({ blades: 11, radius: 0.3, width: 0.75, leanK: 0.6, seed: 31 });
  const mat = createGrassMaterial(REED_PALETTE);
  const reeds = new THREE.InstancedMesh(geo, mat, spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const heads = [];
  spots.forEach((r, i) => {
    p.set(r.x, r.y - 0.05, r.z);
    q.setFromAxisAngle(UP, r.rot);
    s.set(1.1, r.h, 1.1);
    reeds.setMatrixAt(i, m4.compose(p, q, s));
    if (r.cattails) for (let k = 0; k < r.cattails; k++) heads.push({ x: r.x + Math.cos(r.rot + k * 2.1) * 0.12, y: r.y, z: r.z + Math.sin(r.rot + k * 2.1) * 0.12, h: r.h * (1.05 + k * 0.08) });
  });
  reeds.name = 'Reeds';
  reeds.receiveShadow = true;
  reeds.computeBoundingSphere();
  group.add(reeds);

  // cattails: thin stem + brown seed head, swaying from the root
  const stem = new THREE.CylinderGeometry(0.008, 0.012, 1, 4, 1).translate(0, 0.5, 0);
  const head = new THREE.CapsuleGeometry(0.03, 0.14, 3, 6).translate(0, 1.0, 0);
  const cat = mergeTwo(stem, head);
  const cmat = stylize(new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), {
    wrap: 0.4,
    worldVertex: /* glsl */ `
      #ifdef USE_INSTANCING
        vec3 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      #else
        vec3 root = modelMatrix[3].xyz;
      #endif
      float h = wPos.y - root.y;
      float a = uWind.z * (0.06 + 0.25 * windGust(root.xz) + 0.05 * sin(uTime * 1.7 + root.x)) * h;
      wPos.xz += uWind.xy * h * sin(a);`,
  });
  const cm = new THREE.InstancedMesh(cat, cmat, Math.max(1, heads.length));
  heads.forEach((c, i) => {
    p.set(c.x, c.y - 0.05, c.z); q.identity(); s.set(1, c.h, 1);
    cm.setMatrixAt(i, m4.compose(p, q, s));
  });
  cm.count = heads.length;
  cm.name = 'Cattails';
  cm.castShadow = true;
  cm.computeBoundingSphere();
  group.add(cm);
  return group;
}

function mergeTwo(a, b) {
  const g = new THREE.BufferGeometry();
  const ca = new THREE.Color(0x5f7f34), cb = new THREE.Color(0x6b3f22);
  const pos = [...a.attributes.position.array, ...b.attributes.position.array];
  const nor = [...a.attributes.normal.array, ...b.attributes.normal.array];
  const col = [];
  for (let i = 0; i < a.attributes.position.count; i++) col.push(ca.r, ca.g, ca.b);
  for (let i = 0; i < b.attributes.position.count; i++) col.push(cb.r, cb.g, cb.b);
  const off = a.attributes.position.count;
  const idx = [...a.index.array, ...Array.from(b.index.array, (v) => v + off)];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
