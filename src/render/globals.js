// Shared uniforms (one object per uniform, referenced by every material) and common GLSL.
import * as THREE from 'three';

export const G = {
  uTime: { value: 0 },
  // xy = wind direction (normalised, world XZ), z = strength, w = gustiness
  uWind: { value: new THREE.Vector4(0.8, 0.6, 1.0, 1.0) },
  uSunDir: { value: new THREE.Vector3(-0.6, 0.6, -0.4).normalize() },
  uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
  uCloudShadow: { value: 0.3 },
  uShadowTint: { value: new THREE.Vector3(0.84, 0.95, 1.12) }, // multiplier where only sky light reaches
  uLitTint: { value: new THREE.Vector3(1.07, 1.03, 0.9) }, // multiplier in full sun
  uFogHeight: { value: new THREE.Vector4(0, 6, 0.0, 0) }, // base, falloff, strength
  // interior volume (world -> box-local matrix + half extents): sky fill is occluded inside it
  uInteriorInv: { value: new THREE.Matrix4().makeTranslation(0, -1e5, 0) },
  uInteriorHalf: { value: new THREE.Vector3(0, 0, 0) },
  uInteriorAmbient: { value: 0.28 }, // fraction of sky fill that survives inside
  // screen-space AO (render/ao.js): x,y = 1/resolution, z = strength (0 in side passes)
  uAOTex: { value: null }, uAODepth: { value: null },
  uAOParams: { value: new THREE.Vector3(1, 1, 0) }, uAOProj: { value: new THREE.Vector2(0.3, 4000) },
};

export const GLSL_COMMON = /* glsl */ `
uniform float uTime;
uniform vec4 uWind;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uCloudShadow;
uniform vec3 uShadowTint;
uniform vec3 uLitTint;
uniform mat4 uInteriorInv;
uniform vec3 uInteriorHalf;
uniform float uInteriorAmbient;
uniform sampler2D uAOTex;
uniform sampler2D uAODepth;
uniform vec3 uAOParams;
uniform vec2 uAOProj;
// 1 inside the cabin interior volume (soft 0.35 m edges), 0 outside
float interiorK(vec3 wp){
  vec3 lp = (uInteriorInv * vec4(wp, 1.0)).xyz;
  vec3 e = uInteriorHalf - abs(lp);
  return smoothstep(-0.05, 0.3, min(e.x, min(e.y, e.z)));
}
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a*vnoise(p); p = p*2.03 + 17.1; a *= 0.5; } return s; }
// rolling wind gusts across the world (0..1)
float windGust(vec2 xz){
  vec2 d = uWind.xy;
  float g = vnoise(xz*0.035 - d*uTime*0.22) * 0.65 + vnoise(xz*0.11 - d*uTime*0.6) * 0.35;
  return smoothstep(0.2, 0.9, g) * uWind.w;
}
// soft travelling cloud shadows (1 = lit)
float cloudShadow(vec2 xz){
  float n = fbm2(xz*0.011 - uWind.xy*uTime*0.018 + vec2(3.0, 7.0));
  return 1.0 - uCloudShadow * smoothstep(0.5, 0.68, n);
}
`;
