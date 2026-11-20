// Hearth fire: split logs with glowing ember cracks on a coal bed, layered stylised flame
// billboards (noise-licked tongues, white-yellow core to red tips), rising embers, and a
// flickering warm point light. Everything is driven by G.uTime (deterministic captures).
import * as THREE from 'three';
import { G } from '../../../render/globals.js';
import { logGeo, mtx, pillowGeo } from '../geom.js';
import { makeRng } from '../../../util/rng.js';

const FLAME_VERT = /* glsl */ `
uniform float uTime;
attribute vec3 aCenter; attribute vec2 aSize; attribute float aSeed;
varying vec2 vUv; varying float vSeed;
void main(){
  vec3 c = (modelMatrix * vec4(aCenter, 1.0)).xyz;
  vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
  float lick = 0.8 + 0.2 * sin(uTime * (5.0 + aSeed * 3.0) + aSeed * 20.0);
  vec3 w = c + right * position.x * aSize.x + vec3(0.0, (position.y + 0.5) * aSize.y * lick, 0.0);
  w.x += sin(uTime * 3.1 + aSeed * 9.0) * 0.025 * (position.y + 0.5);
  vUv = uv; vSeed = aSeed;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

const FLAME_FRAG = /* glsl */ `
uniform float uTime; uniform float uIntensity;
varying vec2 vUv; varying float vSeed;
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), u.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), u.x), u.y); }
float fb(vec2 p){ return vn(p) * 0.55 + vn(p * 2.1 + 7.0) * 0.3 + vn(p * 4.3 + 3.0) * 0.15; }
void main(){
  vec2 uv = clamp(vUv, 0.0, 1.0); // MSAA can extrapolate varyings: keep pow() bases >= 0
  float t = uTime * (1.3 + vSeed * 0.5);
  vec2 q = vec2(uv.x * 2.6 + vSeed * 11.0, uv.y * 2.0 - t * 1.7);
  float n = fb(q);
  float x = (uv.x - 0.5) * 2.0 + (n - 0.5) * 0.85 * uv.y;
  float width = (1.0 - pow(uv.y, 0.85)) * (0.72 + 0.28 * sin(uv.y * 3.1416));
  float body = 1.0 - smoothstep(width * 0.55, width, abs(x));
  body *= smoothstep(0.0, 0.1, uv.y);
  float tongues = smoothstep(0.32, 0.62, fb(q * 1.6 + 3.0) + (1.0 - uv.y) * 0.55);
  float a = body * tongues;
  float heat = clamp((1.0 - uv.y * 1.05) * (1.0 - abs(x) / max(width, 0.01)) * 1.5, 0.0, 1.0);
  vec3 col = mix(vec3(0.85, 0.16, 0.03), vec3(1.0, 0.5, 0.08), smoothstep(0.08, 0.45, heat));
  col = mix(col, vec3(1.0, 0.9, 0.55), smoothstep(0.55, 0.95, heat));
  gl_FragColor = vec4(col * a * uIntensity * (1.2 + heat * 2.4), 1.0);
}`;

const EMBER_VERT = /* glsl */ `
uniform float uTime;
attribute float aSeed;
varying float vA;
void main(){
  float life = 1.6 + aSeed * 1.4;
  float age = fract(uTime / life + aSeed * 7.13);
  vec3 p = position;
  p.y += age * (0.9 + aSeed * 0.8);
  p.x += sin(uTime * 2.0 + aSeed * 40.0) * 0.06 * age;
  p.z += cos(uTime * 1.7 + aSeed * 30.0) * 0.08 * age;
  vA = smoothstep(0.0, 0.1, age) * (1.0 - age) * (0.6 + 0.4 * sin(uTime * 15.0 + aSeed * 80.0));
  vA = max(vA, 0.0);
  vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (2.0 + aSeed * 2.5) * (40.0 / max(-mv.z, 0.5));
}`;
const EMBER_FRAG = /* glsl */ `
varying float vA;
void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * vA;
  gl_FragColor = vec4(vec3(2.6, 0.9, 0.25) * a, 1.0); }`;

function flameGeometry(rng, n, list = null) {
  const pos = [], uv = [], ctr = [], size = [], seed = [], idx = [];
  if (list) n = list.length;
  for (let i = 0; i < n; i++) {
    const big = i < 3;
    const c = list ? list[i].p.toArray() : [rng.range(-0.08, 0.08), 0.06, (big ? (i - 1) * 0.14 : rng.range(-0.24, 0.24))];
    const s = list ? list[i].s : big ? [0.34 + rng() * 0.08, 0.62 + rng() * 0.2] : [0.18 + rng() * 0.08, 0.32 + rng() * 0.18];
    const sd = rng();
    const b = pos.length / 3;
    for (const [x, y] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
      pos.push(x, y, 0); uv.push(x + 0.5, y + 0.5); ctr.push(...c); size.push(...s); seed.push(sd);
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aCenter', new THREE.Float32BufferAttribute(ctr, 3));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 2));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  g.setIndex(idx);
  return g;
}

// Builds the fire at local position `at` (centre of the firebox floor, cabin local).
// Static log/coal geometry goes into `builder` (keys emberLog / soot); returns the dynamic
// group (flames, embers, light) and an update(t).
export function buildFire(builder, at, IM) {
  const rng = makeRng(1840);
  // coal bed + three split logs leaning together
  builder.add('soot', pillowGeo(0.6, 2), mtx(at.x, at.y + 0.02, at.z, 0, 0, 0, 0.55, 0.06, 0.7), 0x2a1d16);
  for (const [dz, ry, rz, len] of [[-0.12, 0.25, 0.18, 0.62], [0.12, -0.3, 0.16, 0.6], [0.0, 1.45, -0.05, 0.5]]) {
    const L = logGeo(len, 0.065, rng, 9);
    const m = mtx(at.x, at.y + 0.09, at.z + dz, 0, ry, rz);
    builder.add('emberLog', L.side, m, 0xffffff); builder.add('emberLog', L.capA, m, 0xffd0a0); builder.add('emberLog', L.capB, m, 0xffd0a0);
  }
  IM.fireUniforms.uFireBase.value = at.y; // updated to world in cabin.js

  const group = new THREE.Group();
  group.name = 'Interior_FireFX';
  group.userData.noExport = true;
  const flames = new THREE.Mesh(flameGeometry(rng, 9), new THREE.ShaderMaterial({
    uniforms: { uTime: G.uTime, uIntensity: { value: 1 } }, vertexShader: FLAME_VERT, fragmentShader: FLAME_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  flames.position.set(at.x, at.y, at.z);
  flames.frustumCulled = false;
  flames.renderOrder = 4;
  flames.name = 'Interior_Flames';
  const N = 40, ep = new Float32Array(N * 3), es = new Float32Array(N);
  for (let i = 0; i < N; i++) { ep.set([rng.range(-0.12, 0.12), 0.15, rng.range(-0.25, 0.25)], i * 3); es[i] = rng(); }
  const eg = new THREE.BufferGeometry();
  eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
  eg.setAttribute('aSeed', new THREE.BufferAttribute(es, 1));
  const embers = new THREE.Points(eg, new THREE.ShaderMaterial({
    uniforms: { uTime: G.uTime }, vertexShader: EMBER_VERT, fragmentShader: EMBER_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  embers.position.copy(flames.position);
  embers.frustumCulled = false;
  embers.name = 'Interior_Embers';
  const light = new THREE.PointLight(0xff8a3a, 9, 7.5, 1.7);
  light.name = 'Interior_FireLight';
  light.position.set(at.x - 0.8, at.y + 0.7, at.z);
  const base = light.position.clone();
  group.add(flames, embers, light);
  group.update = (t) => {
    const f = 0.84 + 0.08 * Math.sin(t * 13.1) + 0.06 * Math.sin(t * 7.3 + 1.2) + 0.05 * Math.sin(t * 23.0 + 0.5) + 0.04 * Math.sin(t * 3.1);
    light.intensity = group.userData.baseIntensity * f;
    light.position.set(base.x + Math.sin(t * 5.3) * 0.03, base.y + Math.sin(t * 7.1) * 0.03, base.z + Math.sin(t * 4.1) * 0.04);
    IM.fireUniforms.uFireGlow.value = 0.8 + 0.25 * f;
  };
  group.userData.baseIntensity = 9;
  group.userData.light = light;
  return group;
}

// Tiny calm flames for candles and the oil lamp (same shader, low turbulence via size).
export function buildSmallFlames(list) {
  const rng = makeRng(77);
  const mesh = new THREE.Mesh(flameGeometry(rng, 0, list), new THREE.ShaderMaterial({
    uniforms: { uTime: G.uTime, uIntensity: { value: 1.4 } }, vertexShader: FLAME_VERT, fragmentShader: FLAME_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  mesh.name = 'Interior_CandleFlames';
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  mesh.userData.noExport = true;
  return mesh;
}
