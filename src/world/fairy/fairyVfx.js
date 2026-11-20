// Fairy-circle VFX, all closed-form in world time (deterministic for capture):
//  - lush ring: a multiply-blended darkening of the ground under the mushroom band
//  - ground glow: additive pulsing annulus + soft inner light + slow swirl, flash on trigger
//  - motes: rising, orbiting, twinkling sprites (dots + 4-point star sparkles), HDR cores
//  - bursts: pooled sparkle explosions + flash sprite + ground shockwave + light pillar,
//    reusable anywhere (goblin spawn / death poof)
// Per-circle state (energy, integrated mote phase, flash) comes in through shared uniforms.
import * as THREE from 'three';
import { groundY } from '../heightfield.js';
import { makeRng } from '../../util/rng.js';

export const BURST_SLOTS = 6;
const BURST_N = 150;
const MOTES_PER_CIRCLE = 130;

const FOG_PARS_V = /* glsl */ `varying float vFogD;`;
const FOG_V = /* glsl */ `vFogD = -mv.z;`;
const FOG_F = /* glsl */ `
#ifdef USE_FOG
  col *= exp(-fogDensity * fogDensity * vFogD * vFogD);
#endif`;
const FOG_PARS_F = /* glsl */ `
varying float vFogD;
#ifdef USE_FOG
uniform float fogDensity;
#endif`;

const CIRCLE_PARS = /* glsl */ `
uniform vec4 uFairyCircle[4];  // x, y, z, r
uniform vec4 uFairyEnergy[4];  // energy, mote phase, flash, mote visibility
uniform vec3 uFairyColA[4];
uniform vec3 uFairyColB[4];
uniform float uFairyBoost, uFTime, uViewH;
`;

function fogUniforms() { return THREE.UniformsUtils.clone(THREE.UniformsLib.fog); }

// ---- ground decals (lush ring + glow), one merged polar grid for all circles ----
function groundGeometry(circles, lift) {
  const A = 56, R = 12, pos = [], loc = [], cir = [], idx = [];
  let base = 0;
  circles.forEach((c, ci) => {
    const outer = (c.r + 1.0) / c.r; // in units of r
    // centre vertex + R rings
    pos.push(c.x, groundY(c.x, c.z) + lift, c.z); loc.push(0, 0); cir.push(ci);
    for (let j = 1; j <= R; j++) {
      const rr = (j / R) * outer;
      for (let i = 0; i < A; i++) {
        const a = (i / A) * Math.PI * 2;
        const x = c.x + Math.cos(a) * rr * c.r, z = c.z + Math.sin(a) * rr * c.r;
        pos.push(x, groundY(x, z) + lift, z); loc.push(Math.cos(a) * rr, Math.sin(a) * rr); cir.push(ci);
      }
    }
    for (let i = 0; i < A; i++) idx.push(base, base + 1 + ((i + 1) % A), base + 1 + i);
    for (let j = 1; j < R; j++) for (let i = 0; i < A; i++) {
      const a0 = base + 1 + (j - 1) * A + i, a1 = base + 1 + (j - 1) * A + ((i + 1) % A);
      const b0 = a0 + A, b1 = a1 + A;
      idx.push(a0, a1, b0, a1, b1, b0);
    }
    base += 1 + R * A;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aLoc', new THREE.Float32BufferAttribute(loc, 2));
  g.setAttribute('aCircle', new THREE.Float32BufferAttribute(cir, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

const GROUND_VERT = /* glsl */ `
attribute vec2 aLoc; attribute float aCircle;
varying vec2 vLoc; varying float vC;
${FOG_PARS_V}
void main(){
  vLoc = aLoc; vC = aCircle;
  vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  ${FOG_V}
}`;

function lushMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, ...fogUniforms() }, fog: true, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor, blendEquation: THREE.AddEquation,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: GROUND_VERT,
    fragmentShader: /* glsl */ `
      varying vec2 vLoc; varying float vC;
      ${FOG_PARS_F}
      float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        float d = length(vLoc);
        float n = vnoise(vLoc * 7.0 + vC * 13.0) * 0.6 + vnoise(vLoc * 19.0) * 0.4;
        float band = exp(-pow((d - 1.12) / 0.2, 2.0)) * (0.7 + 0.6 * n);
        float inner = smoothstep(0.95, 0.3, d) * 0.2;
        float k = clamp(band * 0.62 + inner * 0.25, 0.0, 0.66) * smoothstep(1.6, 1.32, d);
        vec3 col = mix(vec3(1.0), vec3(0.55, 0.72, 0.46), k);
        // fog fades the darkening toward neutral
        #ifdef USE_FOG
          col = mix(vec3(1.0), col, exp(-fogDensity * fogDensity * vFogD * vFogD));
        #endif
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

function glowMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, ...fogUniforms() }, fog: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    vertexShader: GROUND_VERT,
    fragmentShader: /* glsl */ `
      varying vec2 vLoc; varying float vC;
      ${CIRCLE_PARS}
      ${FOG_PARS_F}
      void main(){
        int ci = int(vC + 0.5);
        vec4 E = uFairyEnergy[ci];
        vec3 A = uFairyColA[ci], B = uFairyColB[ci];
        float d = length(vLoc);
        float ang = atan(vLoc.y, vLoc.x);
        float t = uFTime;
        float pulse = 0.78 + 0.22 * sin(t * 1.7 + vC * 2.1) + 0.08 * sin(t * 4.3 + vC);
        float band = exp(-pow((d - 1.0) / 0.1, 2.0));
        float halo = exp(-pow((d - 1.0) / 0.32, 2.0)) * 0.22;
        float inner = smoothstep(0.98, 0.25, d);
        // slow swirl of light inside the ring: thin counter-rotating spiral arms, not a fill
        float sw = pow(0.5 + 0.5 * sin(ang * 4.0 + d * 8.0 - t * 0.9), 6.0);
        float sw2 = pow(0.5 + 0.5 * sin(-ang * 3.0 + d * 6.0 - t * 0.6 + 1.3), 6.0);
        float swirl = inner * (0.035 + 0.16 * (sw + sw2)) * smoothstep(0.0, 0.35, d);
        float e = E.x;
        vec3 col = (mix(A, B, 0.35 + 0.3 * sin(ang * 2.0 + t * 0.5)) * band * 1.05 + A * halo + mix(B, A, d) * swirl) * pulse;
        // trigger flash: bright fill + an expanding shock ring
        float fl = E.z;
        float shock = exp(-pow((d - (0.2 + 1.6 * (1.0 - fl))) / 0.12, 2.0)) * fl;
        col += (A * 1.6 * shock + mix(A, vec3(1.0), 0.4) * inner * fl * 0.45);
        col *= e * uFairyBoost * smoothstep(1.6, 1.2, d);
        ${FOG_F}
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// ---- motes ----
function motesGeometry(circles) {
  const rng = makeRng(9191);
  const n = circles.length * MOTES_PER_CIRCLE;
  const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4), cir = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    seed.set([rng(), rng(), rng(), rng()], i * 4);
    cir[i] = Math.floor(i / MOTES_PER_CIRCLE);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  g.setAttribute('aCircle', new THREE.BufferAttribute(cir, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  return g;
}

function motesMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, ...fogUniforms() }, fog: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 aSeed; attribute float aCircle;
      ${CIRCLE_PARS}
      varying vec3 vCol; varying float vA; varying float vStar;
      ${FOG_PARS_V}
      void main(){
        int ci = int(aCircle + 0.5);
        vec4 C = uFairyCircle[ci]; vec4 E = uFairyEnergy[ci];
        vec4 s = aSeed;
        float ph = E.y;                                     // integrated phase (slows in cooldown)
        float star = step(0.8, s.w);
        float life = mix(5.0, 9.0, s.x);
        float cyc = fract(ph / life + s.y);                 // 0..1 rise cycle
        float dir = s.z > 0.5 ? 1.0 : -1.0;
        float ang = s.z * 6.2832 + dir * ph * (0.12 + 0.2 * s.w) + cyc * 1.2 * dir;
        float rad = C.w * (0.15 + 0.95 * sqrt(fract(s.y * 7.13 + s.x))) ;
        rad *= 1.0 - 0.25 * cyc;                            // spiral in as they rise
        float h = 0.06 + cyc * (0.9 + 1.4 * s.w);
        vec3 p = C.xyz + vec3(cos(ang) * rad, h, sin(ang) * rad);
        p += 0.06 * vec3(sin(uFTime * 1.3 + s.x * 40.0), 0.0, cos(uFTime * 1.1 + s.y * 33.0));
        // trigger flash: motes jump up and out
        p += vec3(cos(ang), 1.6, sin(ang)) * E.z * (0.5 + s.w) * 0.6;
        float vis = step(s.x, E.w);                          // fewer motes while dimmed
        float fade = smoothstep(0.0, 0.12, cyc) * smoothstep(1.0, 0.7, cyc);
        float tw = 0.55 + 0.45 * sin(uFTime * (3.0 + 5.0 * s.w) + s.x * 60.0);
        tw = mix(tw, pow(max(0.0, sin(uFTime * (2.0 + 3.0 * s.z) + s.y * 80.0)), 6.0) * 1.6, star);
        vA = fade * tw * vis * min(E.x, 1.6);
        vec3 A = uFairyColA[ci], B = uFairyColB[ci];
        vCol = mix(A, B, s.z) ;
        vStar = star;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = mix(0.045, 0.075, s.w) * (1.0 + star * 1.6) * (1.0 + E.z * 0.6);
        gl_PointSize = vA > 0.002 ? size * projectionMatrix[1][1] * uViewH * 0.5 / max(-mv.z, 0.2) : 0.0;
        ${FOG_V}
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFairyBoost;
      varying vec3 vCol; varying float vA; varying float vStar;
      ${FOG_PARS_F}
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d);
        float dot_ = smoothstep(0.5, 0.0, r);
        float core = smoothstep(0.16, 0.0, r);
        // 4-point star sparkle
        float st = max(smoothstep(0.06, 0.0, abs(d.x)) , smoothstep(0.06, 0.0, abs(d.y))) * smoothstep(0.5, 0.05, r);
        float shape = mix(dot_ * dot_ * 0.8 + core * 1.2, st * 1.4 + core * 1.6, vStar);
        vec3 col = mix(vCol, vec3(1.0), core * 0.6) * shape * vA * 1.9 * uFairyBoost;
        ${FOG_F}
        if (shape * vA < 0.003) discard;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// ---- bursts ----
function burstPointsGeometry() {
  const rng = makeRng(707);
  const n = BURST_SLOTS * BURST_N;
  const seed = new Float32Array(n * 4), slot = new Float32Array(n);
  for (let i = 0; i < n; i++) { seed.set([rng(), rng(), rng(), rng()], i * 4); slot[i] = Math.floor(i / BURST_N); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  g.setAttribute('aSlot', new THREE.BufferAttribute(slot, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  return g;
}

const BURST_PARS = /* glsl */ `
uniform vec4 uBurstPos[${BURST_SLOTS}];  // xyz, t0
uniform vec4 uBurstCol[${BURST_SLOTS}];  // rgb, scale
uniform vec4 uBurstOpt[${BURST_SLOTS}];  // pillar, ring, life, -
uniform float uFTime, uViewH, uFairyBoost;
`;

function burstPointsMaterial(B) {
  return new THREE.ShaderMaterial({
    uniforms: { ...B, ...fogUniforms() }, fog: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 aSeed; attribute float aSlot;
      ${BURST_PARS}
      varying vec3 vCol; varying float vA; varying float vStar;
      ${FOG_PARS_V}
      void main(){
        int si = int(aSlot + 0.5);
        vec4 P = uBurstPos[si]; vec4 C = uBurstCol[si]; vec4 O = uBurstOpt[si];
        float age = uFTime - P.w, life = O.z;
        vec4 s = aSeed;
        float alive = step(0.0, age) * step(age, life);
        float k = clamp(age / life, 0.0, 1.0);
        // direction: sphere with an upward bias
        float th = s.x * 6.2832, cz = s.y * 2.0 - 1.0;
        vec3 dir = vec3(sqrt(1.0 - cz * cz) * cos(th), abs(cz) * 0.9 + 0.25, sqrt(1.0 - cz * cz) * sin(th));
        float sp = (1.2 + 2.8 * s.z * s.z) * C.w;
        float drag = 3.2;
        vec3 p = P.xyz + dir * sp * (1.0 - exp(-drag * age)) / drag;
        p.y += -0.55 * age * age * C.w + 0.25 * age;       // float, then drift down
        p += 0.12 * C.w * vec3(sin(age * 5.0 + s.w * 30.0), 0.0, cos(age * 4.0 + s.x * 20.0)) * k;
        float star = step(0.75, s.w);
        float tw = 0.6 + 0.4 * sin(age * (14.0 + 10.0 * s.w) + s.y * 50.0);
        vA = alive * pow(1.0 - k, 1.4) * tw * smoothstep(0.0, 0.04, age);
        vCol = mix(C.rgb, vec3(1.0), s.z * 0.5);
        vStar = star;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = (0.05 + 0.07 * s.w) * (1.0 + star) * mix(1.2, 0.6, k) * sqrt(C.w);
        gl_PointSize = vA > 0.002 ? size * projectionMatrix[1][1] * uViewH * 0.5 / max(-mv.z, 0.2) : 0.0;
        ${FOG_V}
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vA; varying float vStar;
      ${FOG_PARS_F}
      void main(){
        vec2 d = gl_PointCoord - 0.5; float r = length(d);
        float core = smoothstep(0.18, 0.0, r);
        float st = max(smoothstep(0.07, 0.0, abs(d.x)), smoothstep(0.07, 0.0, abs(d.y))) * smoothstep(0.5, 0.05, r);
        float shape = mix(smoothstep(0.5, 0.0, r) * 0.7 + core * 1.4, st * 1.5 + core * 1.8, vStar);
        vec3 col = mix(vCol, vec3(1.0), core * 0.5) * shape * vA * 2.4;
        ${FOG_F}
        if (shape * vA < 0.003) discard;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// flash sprite (kind 0), ground shock ring (kind 1), light pillar (kind 2) per slot
function burstFlashGeometry() {
  const pos = [], cor = [], slot = [], kind = [], idx = [];
  let v = 0;
  for (let si = 0; si < BURST_SLOTS; si++) for (let k = 0; k < 3; k++) {
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pos.push(0, 0, 0); cor.push(cx, cy); slot.push(si); kind.push(k); }
    idx.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aCorner', new THREE.Float32BufferAttribute(cor, 2));
  g.setAttribute('aSlot', new THREE.Float32BufferAttribute(slot, 1));
  g.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  return g;
}

function burstFlashMaterial(B) {
  return new THREE.ShaderMaterial({
    uniforms: { ...B, ...fogUniforms() }, fog: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec2 aCorner; attribute float aSlot; attribute float aKind;
      ${BURST_PARS}
      varying vec2 vUv; varying float vKind; varying float vAge; varying vec4 vC; varying vec4 vO;
      ${FOG_PARS_V}
      void main(){
        int si = int(aSlot + 0.5);
        vec4 P = uBurstPos[si]; vec4 C = uBurstCol[si]; vec4 O = uBurstOpt[si];
        float age = uFTime - P.w;
        vAge = age; vC = C; vO = O; vUv = aCorner; vKind = aKind;
        float on = step(0.0, age) * step(age, O.z);
        if (aKind > 1.5) on *= O.x; else if (aKind > 0.5) on *= O.y;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 p;
        if (aKind < 0.5) {            // camera-facing flash
          float sz = 1.3 * C.w;
          p = P.xyz + vec3(0.0, 0.35 * C.w, 0.0) + (right * aCorner.x + up * aCorner.y) * sz;
        } else if (aKind < 1.5) {     // horizontal shock ring
          float sz = 2.6 * C.w;
          p = P.xyz + vec3(aCorner.x * sz, 0.04, aCorner.y * sz);
        } else {                      // cylindrical light pillar
          vec3 camR = normalize(vec3(right.x, 0.0, right.z));
          p = P.xyz + camR * aCorner.x * 0.5 * C.w + vec3(0.0, (aCorner.y * 0.5 + 0.5) * 4.2 * C.w, 0.0);
        }
        p = mix(vec3(0.0, -1e4, 0.0), p, on);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        ${FOG_V}
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; varying float vKind; varying float vAge; varying vec4 vC; varying vec4 vO;
      ${FOG_PARS_F}
      void main(){
        float a = vAge;
        vec3 col;
        if (vKind < 0.5) {
          float env = smoothstep(0.0, 0.05, a) * exp(-max(a - 0.05, 0.0) * 6.0);
          float r = length(vUv);
          float g = exp(-r * r * 5.0) + 0.6 * exp(-r * r * 40.0);
          // 4 soft rays
          float rays = (exp(-abs(vUv.x) * 18.0) + exp(-abs(vUv.y) * 18.0)) * exp(-r * 1.6) * 0.6;
          col = mix(vC.rgb, vec3(1.0), 0.5) * (g * 0.8 + rays) * env * 1.5;
        } else if (vKind < 1.5) {
          float k = clamp(a / 0.9, 0.0, 1.0);
          float r = length(vUv);
          float rad = 0.12 + 0.85 * sqrt(k);
          float band = exp(-pow((r - rad) / (0.035 + 0.05 * k), 2.0));
          col = mix(vC.rgb, vec3(1.0), 0.35) * band * (1.0 - k) * (1.0 - k) * 2.2;
        } else {
          float env = smoothstep(0.0, 0.08, a) * exp(-max(a - 0.08, 0.0) * 2.6);
          float x = vUv.x, y = vUv.y * 0.5 + 0.5;
          float prof = (exp(-x * x * 9.0) * 0.7 + exp(-x * x * 60.0) * 0.6) * (1.0 - y) * (1.0 - y) * smoothstep(0.0, 0.06, y);
          float streak = 0.75 + 0.25 * sin(y * 30.0 - a * 18.0 + x * 4.0);
          col = mix(vC.rgb, vec3(1.0), 0.3) * prof * streak * env * 0.95;
        }
        ${FOG_F}
        if (max(col.r, max(col.g, col.b)) < 0.002) discard;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

export function createFairyVfx(circles, U) {
  const group = new THREE.Group();
  group.name = 'FairyVFX';
  group.userData.noExport = true;

  const lush = new THREE.Mesh(groundGeometry(circles, 0.02), lushMaterial(U));
  lush.name = 'Fairy_LushRing'; lush.renderOrder = 1; lush.frustumCulled = false;
  const glow = new THREE.Mesh(groundGeometry(circles, 0.035), glowMaterial(U));
  glow.name = 'Fairy_Glow'; glow.renderOrder = 2; glow.frustumCulled = false;
  const motes = new THREE.Points(motesGeometry(circles), motesMaterial(U));
  motes.name = 'Fairy_Motes'; motes.renderOrder = 3; motes.frustumCulled = false;

  // burst pool
  const B = {
    uBurstPos: { value: Array.from({ length: BURST_SLOTS }, () => new THREE.Vector4(0, -1e4, 0, -1e9)) },
    uBurstCol: { value: Array.from({ length: BURST_SLOTS }, () => new THREE.Vector4(1, 1, 1, 1)) },
    uBurstOpt: { value: Array.from({ length: BURST_SLOTS }, () => new THREE.Vector4(0, 1, 1.4, 0)) },
    uFTime: U.uFTime, uViewH: U.uViewH, uFairyBoost: U.uFairyBoost,
  };
  const bpts = new THREE.Points(burstPointsGeometry(), burstPointsMaterial(B));
  bpts.name = 'Fairy_BurstSparks'; bpts.renderOrder = 4; bpts.frustumCulled = false;
  const bflash = new THREE.Mesh(burstFlashGeometry(), burstFlashMaterial(B));
  bflash.name = 'Fairy_BurstFlash'; bflash.renderOrder = 4; bflash.frustumCulled = false;
  group.add(lush, glow, motes, bpts, bflash);
  group.traverse((o) => { o.userData.noExport = true; });

  const col = new THREE.Color();
  function burst(x, y, z, t, { color = 0xfff0b0, scale = 1, pillar = false, ring = true, life = 1.6 } = {}) {
    // free slot: expired, else the oldest
    let best = 0, bestT = Infinity;
    for (let i = 0; i < BURST_SLOTS; i++) {
      const t0 = B.uBurstPos.value[i].w, end = t0 + B.uBurstOpt.value[i].z;
      if (end < t) { best = i; bestT = -Infinity; break; }
      if (t0 < bestT) { bestT = t0; best = i; }
    }
    col.set(color);
    B.uBurstPos.value[best].set(x, y, z, t);
    B.uBurstCol.value[best].set(col.r, col.g, col.b, scale);
    B.uBurstOpt.value[best].set(pillar ? 1 : 0, ring ? 1 : 0, life, 0);
    return best;
  }
  function update(t) {
    // time went backwards (capture restart): drop bursts from the "future"
    for (let i = 0; i < BURST_SLOTS; i++) if (B.uBurstPos.value[i].w > t + 1e-4) B.uBurstPos.value[i].set(0, -1e4, 0, -1e9);
  }
  return { group, burst, update, meshes: { lush, glow, motes, bpts, bflash } };
}
