// CPU approximation of the terrain shader's albedo, baked into vertex colours for export
// (engines without the custom shader still get grass / path / bank / riverbed colours).
import * as THREE from 'three';
import { pathDist } from './heightfield.js';
import { PALETTE } from '../render/palette.js';
import { noise, smoothstep } from '../util/noise.js';

export function bakeTerrainColors(geo) {
  const P = PALETTE.ground;
  const C = Object.fromEntries(Object.entries(P).map(([k, v]) => [k, new THREE.Color(v)]));
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color(), t = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), h = pos.getY(i), z = pos.getZ(i);
    const n1 = noise.fbm2(x * 0.05, z * 0.05, 3) * 0.5 + 0.5;
    c.copy(C.uGrassA).lerp(C.uGrassB, smoothstep(0.32, 0.68, n1));
    c.lerp(C.uGrassC, smoothstep(0.5, 0.72, noise.fbm2(x * 0.018 + 7, z * 0.018, 2) * 0.5 + 0.5) * 0.75);
    if (nor.getY(i) < 0.75) c.lerp(C.uRock, smoothstep(0.75, 0.55, nor.getY(i)));
    c.lerp(t.copy(C.uSandWet).lerp(C.uSand, smoothstep(0, 0.2, h)), 1 - smoothstep(0.05, 0.3, h));
    if (Math.abs(x) < 119 && Math.abs(z) < 119) {
      const pd = pathDist(x, z);
      c.lerp(t.copy(C.uDirtEdge).lerp(C.uDirt, smoothstep(0.1, -0.7, pd)), 1 - smoothstep(-0.12, 0.16, pd));
    }
    if (h < 0) c.lerp(t.copy(C.uBed).lerp(C.uBedDeep, smoothstep(0.4, 1.8, -h)), smoothstep(0.02, -0.1, h));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
