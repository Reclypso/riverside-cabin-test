// Shared stylised materials for the cabin and props (wood, stone, iron, glass, glow).
import * as THREE from 'three';
import { stylize } from '../../render/stylize.js';
import { PALETTE } from '../../render/palette.js';
import { grainTexture, logTexture, endGrainTexture, stoneTexture } from './woodTextures.js';
import { worldDataUniforms, GLSL_WORLD } from '../worldData.js';

// world-space normal varying (works for instanced and plain meshes)
const WN_PARS = 'varying vec3 vWN;';
const WN_WORLD = `
  vec3 wnObj = objectNormal;
  #ifdef USE_INSTANCING
    wnObj = mat3(instanceMatrix) * wnObj;
  #endif
  vWN = normalize(mat3(modelMatrix) * wnObj);`;

// darken toward the ground (cheap contact AO) + optional moss on up-facing surfaces
const groundAO = (k) => `{ float gh = worldData(vStyWorld.xz).g; diffuseColor.rgb *= mix(${k.toFixed(2)}, 1.0, smoothstep(gh - 0.05, gh + 0.9, vStyWorld.y)); }`;
const MOSS = `
  float mossN = fbm2(vStyWorld.xz * 2.2 + vStyWorld.y);
  float moss = smoothstep(0.45, 0.8, vWN.y + (mossN - 0.5) * 0.7) * uMoss;
  diffuseColor.rgb = mix(diffuseColor.rgb, uMossColor * (0.8 + 0.4 * mossN), moss);`;

const lam = (opts, st = {}) => stylize(new THREE.MeshLambertMaterial(opts), { wrap: 0.3, ramp: 0.35, ...st });

let cached = null;

export function getMaterials() {
  if (cached) return cached;
  const W = PALETTE.wood;
  const glow = { uGlow: { value: 0.25 }, uGlowColor: { value: new THREE.Color(1.0, 0.6, 0.28) }, uSkyRefl: { value: new THREE.Color(0.55, 0.72, 0.9) } };
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); white.needsUpdate = true;
  const aoUniforms = { ...worldDataUniforms };
  const mossUniforms = { uMoss: { value: 1 }, uMossColor: { value: new THREE.Color(PALETTE.stone.moss) }, ...worldDataUniforms };

  const m = {
    log: lam({ map: logTexture(3), color: 0xc08452, vertexColors: true }, { uniforms: aoUniforms, fragmentPars: GLSL_WORLD, albedo: groundAO(0.62) }),
    bark: lam({ map: logTexture(8), color: 0x8a5e3e, vertexColors: true }),
    end: lam({ map: endGrainTexture(5), color: 0xffffff, vertexColors: true }),
    plank: lam({ map: grainTexture(1), color: 0xc99260, vertexColors: true }, { uniforms: aoUniforms, fragmentPars: GLSL_WORLD, albedo: groundAO(0.7) }),
    plankDark: lam({ map: grainTexture(2), color: 0x9c6a42, vertexColors: true }, { uniforms: aoUniforms, fragmentPars: GLSL_WORLD, albedo: groundAO(0.7) }),
    weathered: lam({ map: grainTexture(4), color: 0xb7a58e, vertexColors: true }, { uniforms: aoUniforms, fragmentPars: GLSL_WORLD, albedo: groundAO(0.75) }),
    roof: lam({ map: grainTexture(7), color: 0x9a5a44, vertexColors: true }, { wrap: 0.2 }),
    stone: lam({ map: stoneTexture(9), color: 0xead6ba, vertexColors: true }, {
      uniforms: { ...mossUniforms, uMoss: { value: 0.3 } }, vertexPars: WN_PARS, worldVertex: WN_WORLD, fragmentPars: WN_PARS + GLSL_WORLD + 'uniform float uMoss; uniform vec3 uMossColor;', albedo: MOSS + groundAO(0.65),
    }),
    split: lam({ map: grainTexture(12), color: 0xf2d6a2, vertexColors: true }),
    paint: lam({ map: grainTexture(5), color: 0x6aa898, vertexColors: true }),
    leaf: lam({ color: 0x5aa83e, vertexColors: true }, { wrap: 0.6 }),
    petal: lam({ color: 0xffffff, vertexColors: true }, { wrap: 0.6 }),
    rock: lam({ map: stoneTexture(13), color: 0xe4e9ee, vertexColors: true }, {
      wrap: 0.5, uniforms: mossUniforms, vertexPars: WN_PARS, worldVertex: WN_WORLD,
      fragmentPars: WN_PARS + GLSL_WORLD + 'uniform float uMoss; uniform vec3 uMossColor;',
      albedo: MOSS + groundAO(0.82) + `
        diffuseColor.rgb *= mix(0.68, 1.0, smoothstep(-0.05, 0.22, vStyWorld.y)); // wet near the waterline
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.8, 0.9, 1.0), smoothstep(0.2, -0.6, vStyWorld.y));`,
    }),
    mortar: lam({ color: 0x77726b }),
    iron: lam({ color: 0x3b4048 }),
    rope: lam({ color: 0xc9b07a }),
    cloth: lam({ color: 0x9a3f32 }),
    glass: lam({ color: 0x18222e, map: white }, {
      uniforms: glow, fragmentPars: 'uniform float uGlow; uniform vec3 uGlowColor, uSkyRefl;',
      postLight: `{
        vec3 Vd = normalize(vViewPosition);
        float fr = pow(1.0 - clamp(abs(dot(normalize(normal), Vd)), 0.0, 1.0), 3.0);
        float d = vMapUv.x + vMapUv.y;
        float streak = smoothstep(0.09, 0.0, abs(d - 0.75)) * 0.55 + smoothstep(0.035, 0.0, abs(d - 1.05)) * 0.4;
        vec3 inside = uGlowColor * uGlow * uGlow * (1.6 + 1.0 * (1.0 - vMapUv.y));
        outgoingLight += inside + uSkyRefl * (0.04 + 0.3 * fr + streak * 0.3);
      }`,
    }),
    lanternGlass: lam({ color: 0xffe2a8, emissive: 0xffa040, emissiveIntensity: 0.2 }),
    bobberRed: lam({ color: 0xd8332a }),
    bobberWhite: lam({ color: 0xf4f1ea }),
    cork: lam({ map: grainTexture(11), color: 0xd8b07a }),
    steel: lam({ color: 0x8d97a3 }, {
      postLight: `{ vec3 Vd = normalize(vViewPosition); vec3 H = normalize(Vd + normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz));
        outgoingLight += uSunColor * pow(max(dot(normalize(normal), H), 0.0), 40.0) * 0.6; }`,
    }),
  };
  for (const [k, v] of Object.entries(m)) v.name = `M_${k}`;
  m.glowUniforms = glow;
  cached = m;
  return m;
}

export function applyGlow(preset) {
  const m = getMaterials();
  m.glowUniforms.uGlow.value = preset.windowGlow;
  m.lanternGlass.emissiveIntensity = 0.15 + 4.5 * preset.lanternGlow;
}
