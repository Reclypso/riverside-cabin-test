// Leaf-card canopy: cards scattered in each cluster sphere, with normals blended from the
// whole-crown volume and the cluster (soft "ball" shading), plus baked AO and tint variation.
import * as THREE from 'three';

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _t = new THREE.Vector3(), _b = new THREE.Vector3();

function shuffleCards(arrays, stride, count, rng) {
  // shuffle whole cards (4 verts) so drawRange subsets are uniform (cheap LOD)
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return arrays.map(([arr, n]) => {
    const out = new Float32Array(arr.length);
    for (let c = 0; c < count; c++) out.set(arr.subarray(order[c] * 4 * n, order[c] * 4 * n + 4 * n), c * 4 * n);
    return out;
  });
}

export function buildCanopyGeometry(skel, P, rng) {
  const { centre, radius, minY, maxY } = skel.canopy;
  const swayH = Math.max(4, skel.height);
  const pos = [], nor = [], uv = [], col = [], sway = [];
  let cards = 0;
  for (const cl of skel.clusters) {
    const n = Math.round(P.cards * (cl.r / P.clusterR) ** 2);
    const tint = 1 + (rng() - 0.5) * (P.tintVar ?? 0.16);
    for (let k = 0; k < n; k++) {
      const [x, y, z] = rng.inSphere();
      _v.set(x, y * (P.squash ?? 0.8), z);
      const len = _v.length() || 1;
      const shell = 0.45 + 0.55 * Math.pow(rng(), 0.45); // bias toward the surface
      const p = _v.multiplyScalar((cl.r * shell) / len).add(cl.c);
      // card faces roughly outward from the crown, with random roll
      _n.copy(p).sub(cl.c).normalize().lerp(new THREE.Vector3(...rng.inSphere()), P.cardRandom ?? 0.32).normalize();
      _t.set(0, 1, 0).cross(_n);
      if (_t.lengthSq() < 1e-4) _t.set(1, 0, 0);
      _t.normalize();
      _b.crossVectors(_n, _t);
      const roll = rng() * Math.PI * 2, cr = Math.cos(roll), sr = Math.sin(roll);
      const tx = _t.clone().multiplyScalar(cr).addScaledVector(_b, sr);
      const bx = _b.clone().multiplyScalar(cr).addScaledVector(_t, -sr);
      const s = P.cardSize * (0.75 + rng() * 0.5) * 0.5;
      const flip = rng() < 0.5;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (const [a, c] of corners) {
        const vx = p.x + tx.x * a * s + bx.x * c * s, vy = p.y + tx.y * a * s + bx.y * c * s, vz = p.z + tx.z * a * s + bx.z * c * s;
        pos.push(vx, vy, vz);
        // crown-volume normal blended with cluster normal and a bit of up
        const cn = new THREE.Vector3(vx - centre.x, (vy - centre.y) * 1.2, vz - centre.z).normalize();
        const kn = new THREE.Vector3(vx - cl.c.x, vy - cl.c.y, vz - cl.c.z).normalize();
        const nn = cn.multiplyScalar(0.45).addScaledVector(kn, 0.55).addScaledVector(_n, 0.12);
        nn.y += 0.18; nn.normalize();
        nor.push(nn.x, nn.y, nn.z);
        uv.push(flip ? (1 - (a + 1) / 2) : (a + 1) / 2, (c + 1) / 2);
        // AO: deeper inside the crown and lower = darker
        const d = Math.hypot(vx - centre.x, (vy - centre.y) * 1.1, vz - centre.z) / radius;
        const h = (vy - minY) / Math.max(0.5, maxY - minY);
        let ao = 0.42 + 0.58 * THREE.MathUtils.smoothstep(d, 0.15, 0.95);
        ao *= 0.72 + 0.36 * h;
        // per-clump underside shading so each puff reads as its own soft ball
        const ch = THREE.MathUtils.clamp((vy - cl.c.y) / cl.r, -1, 1);
        ao *= 0.78 + 0.26 * (ch * 0.5 + 0.5);
        const k = Math.min(1.15, ao * tint);
        col.push(k, k * (0.98 + 0.04 * h), k);
        const sw = Math.pow(Math.max(0, vy) / swayH, 1.6) + 0.15 * Math.hypot(vx, vz) / swayH;
        sway.push(Math.min(sw, 1.5));
      }
      cards++;
    }
  }
  const [P2, N2, U2, C2, S2] = shuffleCards([[new Float32Array(pos), 3], [new Float32Array(nor), 3], [new Float32Array(uv), 2], [new Float32Array(col), 3], [new Float32Array(sway), 1]], 4, cards, rng);
  const idx = new Uint32Array(cards * 6);
  for (let c = 0; c < cards; c++) idx.set([c * 4, c * 4 + 1, c * 4 + 2, c * 4, c * 4 + 2, c * 4 + 3], c * 6);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P2, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N2, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(U2, 2));
  g.setAttribute('color', new THREE.BufferAttribute(C2, 3));
  g.setAttribute('aSway', new THREE.BufferAttribute(S2, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  g.userData.cards = cards;
  return g;
}
