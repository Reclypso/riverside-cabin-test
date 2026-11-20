// GPU copy of the baked fields: R = signed path distance, G = ground height,
// BA = river flow vector (direction * speed). Sampled by terrain, water and grass shaders.
import * as THREE from 'three';
import { heightField, pathField, riverField, riverTangent, riverHalfWidth } from './heightfield.js';
import { TERRAIN_SIZE } from './layout.js';
import { smoothstep } from '../util/noise.js';

const RES = 768;
const toHalf = THREE.DataUtils.toHalfFloat;

function build() {
  const data = new Uint16Array(RES * RES * 4);
  const half = TERRAIN_SIZE / 2, step = TERRAIN_SIZE / (RES - 1);
  for (let j = 0; j < RES; j++) {
    const z = -half + j * step;
    for (let i = 0; i < RES; i++) {
      const x = -half + i * step;
      const k = (j * RES + i) * 4;
      const pd = Math.min(pathField.sample(x, z), 50);
      const h = heightField.sample(x, z);
      const rd = riverField.sample(x, z, 0);
      const s = riverField.sample(x, z, 1);
      const hw = riverHalfWidth(s);
      let fx = 0, fz = 0;
      if (rd < hw + 3) {
        const [tx, tz] = riverTangent(s);
        const q = Math.min(rd / hw, 1);
        let speed = 0.25 + 0.75 * (1 - q * q);
        speed *= 1 - 0.55 * Math.exp(-((x - 18.6) ** 2 + (z - 5.5) ** 2) / 150); // calm pool by the dock
        speed *= 1 - 0.5 * smoothstep(0.9, 1.3, rd / hw);
        fx = tx * speed; fz = tz * speed;
      }
      data[k] = toHalf(pd); data[k + 1] = toHalf(h); data[k + 2] = toHalf(fx); data[k + 3] = toHalf(fz);
    }
  }
  const tex = new THREE.DataTexture(data, RES, RES, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export const worldDataTex = build();
// uniforms to map world XZ -> uv: uv = xz * scale + offset
export const worldDataUniforms = {
  uWorldData: { value: worldDataTex },
  uWorldXform: { value: new THREE.Vector2(1 / TERRAIN_SIZE, 0.5) },
};
export const GLSL_WORLD = /* glsl */ `
uniform sampler2D uWorldData;
uniform vec2 uWorldXform;
vec4 worldData(vec2 xz){ return texture2D(uWorldData, xz * uWorldXform.x + uWorldXform.y); }
`;
