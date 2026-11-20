// Conifer canopy: tiers of drooping fir-spray cards radiating from the trunk (cone silhouette).
import * as THREE from 'three';

export function buildPineCanopy(P, rng, height) {
  const pos = [], nor = [], uv = [], col = [], sway = [], idx = [];
  const y0 = height * P.crownStart, y1 = height * 1.02;
  const tiers = P.tiers;
  let v = 0;
  const golden = 2.39996;
  let az = rng() * 6.28;
  for (let ti = 0; ti < tiers; ti++) {
    const t = ti / (tiers - 1);
    const y = y0 + (y1 - y0) * Math.pow(t, 0.92);
    const R = P.baseR * Math.pow(1 - t, 0.85) + 0.35;
    const nb = Math.max(4, Math.round(P.branches * (1 - t * 0.55)));
    for (let b = 0; b < nb; b++) {
      az += golden + rng.range(-0.25, 0.25);
      const dx = Math.cos(az), dz = Math.sin(az);
      const len = R * rng.range(0.85, 1.15);
      const w = Math.max(0.8, len * 0.85) * rng.range(0.9, 1.15);
      const droop = (P.droop + rng.range(-0.1, 0.1)) * len;
      const lift = rng.range(0.05, 0.25) * len * (1 - t);
      const segs = 3;
      // card plane tilted: across vector horizontal-ish, slight random roll
      const ax = -dz, az2 = dx;
      const roll = rng.range(-0.35, 0.35);
      const base = v;
      for (let s = 0; s <= segs; s++) {
        const u = s / segs;
        const r = 0.08 + len * u;
        const cy = y + lift * u - droop * u * u;
        for (const side of [-1, 1]) {
          const half = (w / 2) * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, u * 0.85 + 0.15)));
          const px = dx * r + ax * side * half, pz = dz * r + az2 * side * half;
          const py = cy + side * half * roll - (1 - Math.abs(side)) * 0.0;
          pos.push(px, py, pz);
          // normals: outward from the trunk + up (soft cone shading)
          const n = new THREE.Vector3(dx * 0.75 + ax * side * 0.15, 0.65 + u * 0.1, dz * 0.75 + az2 * side * 0.15).normalize();
          nor.push(n.x, n.y, n.z);
          uv.push(side < 0 ? 0 : 1, u);
          const hcol = (py - y0) / (y1 - y0);
          const ao = (0.5 + 0.5 * u) * (0.78 + 0.32 * hcol);
          col.push(ao, ao, ao);
          sway.push(Math.min(1.5, Math.pow(py / height, 1.6) + 0.25 * r / height));
          v++;
        }
      }
      for (let s = 0; s < segs; s++) {
        const a = base + s * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
