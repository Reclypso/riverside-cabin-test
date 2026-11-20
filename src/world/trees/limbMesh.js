// Builds tapered, smoothly curved tube geometry for all limbs of a skeleton (one merged mesh).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const RADIAL = [12, 7, 5];

function tube(limb, swayH, aoTop) {
  const curve = new THREE.CatmullRomCurve3(limb.pts, false, 'centripetal');
  const len = curve.getLength();
  const segs = Math.max(3, Math.ceil(len / (limb.level === 0 ? 0.3 : 0.45)));
  const radial = RADIAL[Math.min(limb.level, 2)];
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], nor = [], uv = [], col = [], sway = [], idx = [];
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  const uRepeat = limb.level === 0 ? 2 : 1;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, p);
    let r = limb.r0 + (limb.r1 - limb.r0) * Math.pow(t, 0.8);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      n.copy(frames.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a)).normalize();
      let rr = r;
      if (limb.flare) {
        const f = Math.exp(-(p.y) * 2.2) * limb.flare;
        rr *= 1 + f * (1 + 0.45 * Math.sin(a * 5 + 1.3));
      }
      pos.push(p.x + n.x * rr, p.y + n.y * rr, p.z + n.z * rr);
      nor.push(n.x, n.y, n.z);
      uv.push((j / radial) * uRepeat, (t * len) / (2 * Math.PI * Math.max(limb.r0, 0.12)) * (limb.level === 0 ? 0.55 : 0.4));
      // darker at the base of the trunk and where limbs meet the crown interior
      const ao = limb.level === 0 ? 0.55 + 0.45 * Math.min(1, p.y / 1.6) : 0.7 + 0.3 * t;
      const k = ao * (0.85 + 0.15 * Math.min(1, p.y / aoTop));
      col.push(k, k, k);
      const sw = Math.pow(Math.max(0, p.y) / swayH, 1.6) + 0.15 * Math.hypot(p.x, p.z) / swayH;
      sway.push(Math.min(sw, 1.5));
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 1));
  g.setIndex(idx);
  return g;
}

export function buildLimbGeometry(skel) {
  const swayH = Math.max(4, skel.height);
  const geos = skel.limbs.map((l) => tube(l, swayH, swayH * 0.6));
  const g = mergeGeometries(geos, false);
  geos.forEach((x) => x.dispose());
  g.computeBoundingSphere();
  return g;
}
