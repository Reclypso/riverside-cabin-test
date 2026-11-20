// One grass clump: several curved, tapered blades around a root (instanced across the field).
// uv.y = position along the blade (0 root .. 1 tip), aBlade = per-blade random.
import * as THREE from 'three';
import { makeRng } from '../../util/rng.js';

export function createClumpGeometry({ blades = 7, segs = 4, seed = 11, radius = 0.17, width = 1, leanK = 1 } = {}) {
  const rng = makeRng(seed);
  const pos = [], nor = [], uv = [], rnd = [], idx = [];
  for (let b = 0; b < blades; b++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * radius;
    const rx = Math.cos(a) * r, rz = Math.sin(a) * r;
    const yaw = rng() * Math.PI * 2;
    const fx = Math.cos(yaw), fz = Math.sin(yaw); // blade facing (normal dir)
    const sx = -fz, sz = fx; // across the blade
    const h = 0.75 + rng() * 0.45;
    const w = (0.045 + rng() * 0.035) * width;
    const lean = (0.12 + rng() * 0.3) * leanK; // outward lean / curl at the tip
    const ox = Math.cos(a), oz = Math.sin(a);
    const br = rng();
    const base = pos.length / 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const y = t * h;
      const bend = lean * t * t * h;
      const cx = rx + ox * bend, cz = rz + oz * bend;
      const half = s === segs ? 0 : w * (1 - Math.pow(t, 1.4) * 0.85) * 0.5;
      const sides = s === segs ? [0] : [-1, 1];
      for (const side of sides) {
        pos.push(cx + sx * half * side, y, cz + sz * half * side);
        // normal: blade face tilted back so it catches light like the ground
        const n = new THREE.Vector3(fx, 0.9, fz).normalize();
        nor.push(n.x, n.y, n.z);
        uv.push(side < 0 ? 0 : side > 0 ? 1 : 0.5, t);
        rnd.push(br);
      }
    }
    for (let s = 0; s < segs - 1; s++) {
      const a0 = base + s * 2;
      idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2);
    }
    const last = base + (segs - 1) * 2;
    idx.push(last, last + 1, last + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aBlade', new THREE.Float32BufferAttribute(rnd, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
