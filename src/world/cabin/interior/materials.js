// Interior-only stylised materials (fabric, fur, cast iron, brass, glazed crockery, jar glass,
// wax, herbs, soot, ember logs). Wood/stone come from the cabin's own material set.
import * as THREE from 'three';
import { stylize } from '../../../render/stylize.js';
import { quiltTexture, plaidTexture, furTexture, rugTexture, peltTexture } from './textures.js';
import { logTexture, stoneTexture } from '../woodTextures.js';

const lam = (opts, st = {}) => stylize(new THREE.MeshLambertMaterial(opts), { wrap: 0.35, ramp: 0.3, ...st });

// small view-dependent highlight for metal / glaze / glass (stylised, not PBR)
const SHEEN = (pow, k) => /* glsl */ `{
  vec3 Vd = normalize(vViewPosition);
  vec3 Ld = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
  vec3 H = normalize(Vd + Ld);
  float s = pow(max(dot(normalize(normal), H), 0.0), ${pow.toFixed(1)});
  float rim = pow(1.0 - clamp(dot(normalize(normal), Vd), 0.0, 1.0), 3.0);
  outgoingLight += (uSunColor * s * ${k.toFixed(2)} + vec3(0.9, 0.55, 0.25) * rim * ${(k * 0.35).toFixed(2)}) * (0.35 + 0.65 * cloudShadow(vStyWorld.xz));
}`;

// glowing embers inside split logs: hot near the bottom, flickering cracks
const EMBER = /* glsl */ `{
  float h = clamp((vStyWorld.y - uFireBase) / 0.35, 0.0, 1.0);
  float n = fbm2(vStyWorld.xz * 16.0 + vStyWorld.y * 9.0 + vec2(uTime * 0.25, 0.0));
  float crack = smoothstep(0.52, 0.72, n) * (1.0 - h);
  float flick = 0.75 + 0.25 * sin(uTime * 9.0 + vStyWorld.x * 30.0);
  outgoingLight = mix(outgoingLight, outgoingLight * 0.35, 1.0 - h); // charred
  outgoingLight += vec3(2.4, 0.75, 0.15) * crack * flick * uFireGlow;
}`;

let cached = null;
export function interiorMaterials() {
  if (cached) return cached;
  const fireUniforms = { uFireBase: { value: 0 }, uFireGlow: { value: 1 } };
  const m = {
    quilt: lam({ map: quiltTexture(), vertexColors: true }, { wrap: 0.55 }),
    plaid: lam({ map: plaidTexture(), vertexColors: true }, { wrap: 0.55 }),
    linen: lam({ color: 0xece2cc, vertexColors: true }, { wrap: 0.6 }),
    wool: lam({ color: 0x6f5a46, vertexColors: true }, { wrap: 0.5 }),
    fur: lam({ map: furTexture(), vertexColors: true }, { wrap: 0.6 }),
    rug: lam({ map: rugTexture(), alphaTest: 0.5, side: THREE.DoubleSide }, { wrap: 0.6, normalHook: 'normal = normalize(vNormal);' }),
    pelt: lam({ map: peltTexture(), alphaTest: 0.4, side: THREE.DoubleSide }, { wrap: 0.5 }),
    leather: lam({ color: 0x8a5a36, vertexColors: true, side: THREE.DoubleSide }, { wrap: 0.4 }),
    castIron: lam({ color: 0x2e2c2c, vertexColors: true }, { wrap: 0.3, postLight: SHEEN(30, 0.35) }),
    brass: lam({ color: 0xc89a4a, vertexColors: true }, { wrap: 0.3, postLight: SHEEN(40, 0.9) }),
    tin: lam({ color: 0xb7bcc2, vertexColors: true }, { wrap: 0.35, postLight: SHEEN(60, 0.8) }),
    glaze: lam({ color: 0xffffff, vertexColors: true }, { wrap: 0.4, postLight: SHEEN(70, 0.6) }),
    jar: lam({ color: 0xffffff, vertexColors: true }, { wrap: 0.45, postLight: SHEEN(110, 1.2) }),
    wax: lam({ color: 0xf2e8d2, vertexColors: true }, { wrap: 0.7, postLight: 'outgoingLight += vec3(0.25, 0.14, 0.05) * uFireGlow;' , uniforms: fireUniforms, fragmentPars: 'uniform float uFireGlow;' }),
    herb: lam({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide }, { wrap: 0.6, normalHook: 'normal = normalize(vNormal);' }),
    straw: lam({ color: 0xd8b86a, vertexColors: true }, { wrap: 0.5 }),
    soot: lam({ map: stoneTexture(9), color: 0x3a302a, vertexColors: true }, { wrap: 0.2 }),
    fieldstone: lam({ map: stoneTexture(13), color: 0xcfc2b2, vertexColors: true }, { wrap: 0.35 }),
    emberLog: lam({ map: logTexture(8), color: 0x7a5236, vertexColors: true }, {
      wrap: 0.3, uniforms: fireUniforms, fragmentPars: 'uniform float uFireBase; uniform float uFireGlow;', postLight: EMBER,
    }),
  };
  for (const [k, v] of Object.entries(m)) v.name = `MI_${k}`;
  m.fireUniforms = fireUniforms;
  cached = m;
  return m;
}
