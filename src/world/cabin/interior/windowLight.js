// Cool daylight from the three small windows: a glowing inner pane (wavy old glass with the
// mullion cross), a soft additive light shaft slanting down into the room, and a faint
// light pool where it lands. No extra lights; intensity follows the time-of-day preset.
import * as THREE from 'three';
import { DIM } from '../dims.js';

const PANE_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uK; varying vec2 vUv;
float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = clamp(vUv, 0.0, 1.0);
  float wav = sin(uv.y * 40.0 + sin(uv.x * 9.0) * 2.0) * 0.04 + h21(floor(uv * vec2(6.0, 8.0))) * 0.08;
  float sky = mix(0.75, 1.15, uv.y) + wav;
  float mull = smoothstep(0.018, 0.0, abs(uv.x - 0.5)) + smoothstep(0.018, 0.0, abs(uv.y - 0.55));
  float edge = smoothstep(0.0, 0.06, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
  vec3 c = uCol * sky * uK * edge * (1.0 - clamp(mull, 0.0, 1.0) * 0.85);
  gl_FragColor = vec4(c, 1.0);
}`;
const SHAFT_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uK; varying vec2 vUv;
void main(){
  vec2 uv = clamp(vUv, 0.0, 1.0);
  float along = uv.y;
  float a = pow(1.0 - along, 1.6) * smoothstep(0.0, 0.12, along) * smoothstep(0.0, 0.3, uv.x) * smoothstep(1.0, 0.7, uv.x);
  gl_FragColor = vec4(uCol * a * uK, 1.0);
}`;
const POOL_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uK; varying vec2 vUv;
void main(){
  vec2 d = abs(clamp(vUv, 0.0, 1.0) - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.35, 1.0, d.x)) * (1.0 - smoothstep(0.2, 1.0, d.y));
  gl_FragColor = vec4(uCol * a * uK, 1.0);
}`;
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

const additive = (frag, u) => new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

// window list in cabin-local space: centre on the inner wall face, inward normal, size
function windows() {
  const F = DIM.winFront, S = DIM.winSide, B = DIM.winBack;
  return [
    { c: new THREE.Vector3(F.x, (F.y0 + F.y1) / 2, DIM.inZ - 0.01), n: new THREE.Vector3(0, 0, -1), w: F.w, h: F.y1 - F.y0 },
    { c: new THREE.Vector3(-DIM.inX + 0.01, (S.y0 + S.y1) / 2, S.z), n: new THREE.Vector3(1, 0, 0), w: S.w, h: S.y1 - S.y0 },
    { c: new THREE.Vector3(B.x, (B.y0 + B.y1) / 2, -DIM.inZ + 0.01), n: new THREE.Vector3(0, 0, 1), w: B.w, h: B.y1 - B.y0 },
  ];
}

export function buildWindowLight() {
  const group = new THREE.Group();
  group.name = 'Interior_WindowLight';
  group.userData.noExport = true;
  const u = { uCol: { value: new THREE.Color(0.78, 0.88, 1.0) }, uK: { value: 1 } };
  const us = { uCol: u.uCol, uK: { value: 0.07 } }, up = { uCol: u.uCol, uK: { value: 0.09 } };
  const paneMat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: PANE_FRAG });
  const shaftMat = additive(SHAFT_FRAG, us), poolMat = additive(POOL_FRAG, up);
  const UP = new THREE.Vector3(0, 1, 0);
  for (const win of windows()) {
    const side = new THREE.Vector3().crossVectors(UP, win.n).normalize(); // along the window
    const basis = new THREE.Matrix4().makeBasis(side, UP, win.n);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(win.w, win.h), paneMat);
    pane.position.copy(win.c); pane.quaternion.setFromRotationMatrix(basis);
    pane.name = 'Interior_WindowPane';
    group.add(pane);
    // shaft: window rectangle swept along D (inward and down)
    const D = win.n.clone().multiplyScalar(1).add(new THREE.Vector3(0, -0.62, 0)).normalize();
    const L = 2.5;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => win.c.clone().addScaledVector(side, a * win.w * 0.46).addScaledVector(UP, b * win.h * 0.46));
    const pos = [], uv = [], idx = [];
    for (let f = 0; f < 4; f++) {
      const A = corners[f], B = corners[(f + 1) % 4], base = pos.length / 3;
      for (const [P, v] of [[A, 0], [B, 0], [B.clone().addScaledVector(D, L), 1], [A.clone().addScaledVector(D, L), 1]]) pos.push(P.x, P.y, P.z);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    const shaft = new THREE.Mesh(g, shaftMat);
    shaft.name = 'Interior_WindowShaft';
    shaft.renderOrder = 5;
    group.add(shaft);
    // pool where the centre ray meets the floor
    const t = (win.c.y - DIM.floorY - 0.01) / -D.y;
    const hit = win.c.clone().addScaledVector(D, Math.min(t, 3.0));
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(win.w * 1.15, win.h * 1.6), poolMat);
    pool.position.set(hit.x, DIM.floorY + 0.015, hit.z);
    pool.rotation.set(-Math.PI / 2, 0, Math.atan2(win.n.x, win.n.z));
    pool.name = 'Interior_WindowPool';
    pool.renderOrder = 5;
    group.add(pool);
  }
  group.setPreset = (p) => {
    const golden = p.windowGlow > 0.6;
    u.uCol.value.set(golden ? 0xc8b8f0 : 0xc8deff);
    u.uK.value = golden ? 1.05 : 1.6;
    us.uK.value = golden ? 0.05 : 0.075;
    up.uK.value = golden ? 0.06 : 0.1;
  };
  return group;
}
