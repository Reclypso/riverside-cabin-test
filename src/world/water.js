// River surface: a ribbon mesh following the river spline (covers only the channel),
// rendered with the stylised water shader + planar reflections.
import * as THREE from 'three';
import { RIVER, RIVER_ROCKS, WATER_LEVEL } from './layout.js';
import { riverHalfWidth } from './heightfield.js';
import { worldDataUniforms } from './worldData.js';
import { makeWaterNormals } from './waterNormals.js';
import { WATER_VERT, WATER_FRAG } from './waterShader.js';
import { G } from '../render/globals.js';
import { PALETTE } from '../render/palette.js';

function ribbonGeometry() {
  const pts = RIVER.pts;
  const step = 2, across = 18;
  const rows = [];
  let s = 0;
  for (let i = 0; i < pts.length; i += step) {
    if (i > 0) s += Math.hypot(pts[i][0] - pts[i - step][0], pts[i][1] - pts[i - step][1]);
    rows.push({ i, s });
  }
  const pos = [], tan = [], acr = [], idx = [];
  for (const { i, s: si } of rows) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const hw = riverHalfWidth(si) + 3.5;
    for (let k = 0; k <= across; k++) {
      const u = (k / across) * 2 - 1;
      pos.push(pts[i][0] - tz * u * hw, WATER_LEVEL, pts[i][1] + tx * u * hw);
      tan.push(tx, tz); acr.push(u);
    }
  }
  const W = across + 1;
  for (let r = 0; r < rows.length - 1; r++) {
    for (let k = 0; k < across; k++) {
      const a = r * W + k, b = a + 1, c = a + W, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aTan', new THREE.Float32BufferAttribute(tan, 2));
  g.setAttribute('aAcross', new THREE.Float32BufferAttribute(acr, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  // flat up normals so the mesh exports cleanly
  const n = new Float32Array(pos.length); for (let k = 1; k < n.length; k += 3) n[k] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return g;
}

export function createWater(reflection) {
  const P = PALETTE.water;
  const rocks = Array.from({ length: 8 }, (_, i) => {
    const r = RIVER_ROCKS[i];
    return r ? new THREE.Vector4(r.x, r.z, r.r, r.h) : new THREE.Vector4(0, 0, 0, 0);
  });
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
  Object.assign(uniforms, G, worldDataUniforms, {
    uNormals: { value: makeWaterNormals() },
    uReflTex: { value: reflection.target.texture },
    uReflMatrix: { value: reflection.textureMatrix },
    uReflStrength: { value: 1 },
    uDebug: { value: new URLSearchParams(location.search).has('waterDebug') ? 1 : 0 },
    uShallow: { value: new THREE.Color(P.shallow) }, uMid: { value: new THREE.Color(P.mid) },
    uDeep: { value: new THREE.Color(P.deep) }, uFoam: { value: new THREE.Color(P.foam) },
    uWaterLight: { value: new THREE.Color(1, 1, 1) }, uSkyRefl: { value: new THREE.Color(0.6, 0.8, 1) },
    uRocks: { value: rocks },
  });
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG,
    transparent: true, depthWrite: false, fog: true,
  });
  const mesh = new THREE.Mesh(ribbonGeometry(), mat);
  mesh.name = 'River_Water';
  mesh.renderOrder = 2;
  mesh.userData.export = 'water';
  mesh.setPreset = (p) => {
    uniforms.uWaterLight.value.set(p.waterLight);
    uniforms.uSkyRefl.value.set(p.mid);
  };
  return mesh;
}
