// Ground-truth-style ambient occlusion (GTAO, Jimenez 2016) computed at half resolution from a
// depth pre-pass of the solid geometry (layer LAYER_AO). The result is sampled by the shared
// stylised shader and applied ONLY to indirect (sky) light, with a depth-match test so foliage
// in front of an occluded surface is not darkened. Debug: ?aoDebug shows the visibility buffer.
import * as THREE from 'three';
import { G } from './globals.js';

export const LAYER_AO = 2;
export const markAO = (obj) => { obj.traverse((o) => o.layers.enable(LAYER_AO)); return obj; };

const FS_QUAD = new THREE.PlaneGeometry(2, 2);
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const GTAO = /* glsl */ `
precision highp float;
uniform sampler2D tDepth; uniform mat4 uProjInv; uniform vec2 uTexel; uniform float uProjScale;
uniform float uRadius, uIntensity, uPower, uFalloff, uAspect;
varying vec2 vUv;
#define PI 3.14159265
vec3 vpos(vec2 uv){ float d = textureLod(tDepth, uv, 0.0).r; vec4 c = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return c.xyz / c.w; }
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main(){
  float d0 = texture2D(tDepth, vUv).r;
  if (d0 >= 0.999999) { gl_FragColor = vec4(1.0); return; }
  vec3 P = vpos(vUv);
  // normal from the smaller of forward/backward differences (keeps silhouettes clean)
  vec3 dx1 = vpos(vUv + vec2(uTexel.x, 0.0)) - P, dx0 = P - vpos(vUv - vec2(uTexel.x, 0.0));
  vec3 dy1 = vpos(vUv + vec2(0.0, uTexel.y)) - P, dy0 = P - vpos(vUv - vec2(0.0, uTexel.y));
  vec3 N = normalize(cross(abs(dx1.z) < abs(dx0.z) ? dx1 : dx0, abs(dy1.z) < abs(dy0.z) ? dy1 : dy0));
  vec3 V = normalize(-P);
  if (dot(N, V) < 0.0) N = -N;
  float rUv = clamp(uRadius * uProjScale / max(-P.z, 1e-4) * 0.5, 0.003, 0.08);
  float noise = ign(gl_FragCoord.xy);
  float vis = 0.0;
  for (int s = 0; s < 2; s++) {
    float ang = (float(s) * 0.5 + noise) * PI;
    vec2 dir = vec2(cos(ang), sin(ang));
    vec3 dirV = normalize(vec3(dir, 0.0));
    vec3 ortho = dirV - dot(dirV, V) * V;
    vec3 axis = normalize(cross(dirV, V));
    vec3 projN = N - axis * dot(N, axis);
    float projLen = max(length(projN), 1e-4);
    float cosN = clamp(dot(projN, V) / projLen, -1.0, 1.0);
    float n = sign(dot(ortho, projN)) * acos(cosN);
    float h0 = -1.0, h1 = -1.0;
    for (int k = 0; k < 4; k++) {
      float t = (float(k) + fract(noise * 7.13 + float(k) * 0.37) + 0.5) / 4.0;
      vec2 off = dir * rUv * t * vec2(1.0, uAspect);
      vec3 d1 = vpos(vUv + off) - P, d0v = vpos(vUv - off) - P;
      float l1 = length(d1), l0 = length(d0v);
      float w1 = clamp(1.0 - l1 / (uRadius * uFalloff), 0.0, 1.0), w0 = clamp(1.0 - l0 / (uRadius * uFalloff), 0.0, 1.0);
      h1 = max(h1, mix(-1.0, dot(d1 / l1, V), w1));
      h0 = max(h0, mix(-1.0, dot(d0v / l0, V), w0));
    }
    float a0 = n + max(-acos(h0) - n, -PI * 0.5);
    float a1 = n + min(acos(h1) - n, PI * 0.5);
    float sn = sin(n);
    vis += projLen * 0.25 * ((-cos(2.0 * a0 - n) + cosN + 2.0 * a0 * sn) + (-cos(2.0 * a1 - n) + cosN + 2.0 * a1 * sn));
  }
  vis = clamp(vis * 0.5, 0.0, 1.0);
  vis = mix(1.0, pow(vis, uPower), uIntensity);
  gl_FragColor = vec4(vis, vis, vis, 1.0);
}`;

const BLUR = /* glsl */ `
precision highp float;
uniform sampler2D tAO, tDepth; uniform vec2 uTexel; uniform mat4 uProjInv;
varying vec2 vUv;
float lz(vec2 uv){ float d = textureLod(tDepth, uv, 0.0).r; vec4 c = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return -c.z / c.w; }
void main(){
  float z0 = lz(vUv), sum = 0.0, wsum = 0.0;
  for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
    vec2 uv = vUv + vec2(float(x), float(y)) * uTexel;
    float w = exp(-abs(lz(uv) - z0) / max(z0 * 0.03, 0.02)) * (1.0 - 0.12 * float(abs(x) + abs(y)));
    sum += textureLod(tAO, uv, 0.0).r * w; wsum += w;
  }
  gl_FragColor = vec4(vec3(sum / max(wsum, 1e-4)), 1.0);
}`;

export function createAO(renderer, scene, camera) {
  const size = new THREE.Vector2();
  const make = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  const depthRT = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
  depthRT.depthTexture = new THREE.DepthTexture(1, 1, THREE.FloatType);
  const aoRT = make(), blurRT = make();
  const depthMat = new THREE.MeshBasicMaterial({ colorWrite: false });
  const aoCam = new THREE.PerspectiveCamera();
  aoCam.layers.set(LAYER_AO);
  const uni = {
    tDepth: { value: depthRT.depthTexture }, uProjInv: { value: new THREE.Matrix4() }, uTexel: { value: new THREE.Vector2() },
    uProjScale: { value: 1 }, uAspect: { value: 1 }, uRadius: { value: 1.3 }, uIntensity: { value: 1.0 }, uPower: { value: 2.2 }, uFalloff: { value: 1.0 },
  };
  const gtao = new THREE.Mesh(FS_QUAD, new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT, fragmentShader: GTAO, depthTest: false, depthWrite: false }));
  const blurU = { tAO: { value: aoRT.texture }, tDepth: uni.tDepth, uTexel: uni.uTexel, uProjInv: uni.uProjInv };
  const blur = new THREE.Mesh(FS_QUAD, new THREE.ShaderMaterial({ uniforms: blurU, vertexShader: VERT, fragmentShader: BLUR, depthTest: false, depthWrite: false }));
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadScene = new THREE.Scene();

  // shared uniforms read by stylize.js
  G.uAOTex.value = blurRT.texture;
  G.uAODepth.value = depthRT.depthTexture;

  function setSize(w, h) {
    const hw = Math.max(1, Math.round(w / 2)), hh = Math.max(1, Math.round(h / 2));
    depthRT.setSize(hw, hh); aoRT.setSize(hw, hh); blurRT.setSize(hw, hh);
    uni.uTexel.value.set(1 / hw, 1 / hh);
    G.uAOParams.value.x = 1 / w; G.uAOParams.value.y = 1 / h;
  }
  renderer.getDrawingBufferSize(size); setSize(size.x, size.y);

  const dbgMesh = new THREE.Mesh(FS_QUAD, new THREE.MeshBasicMaterial({ map: blurRT.texture, depthTest: false }));
  return {
    setSize,
    params: uni,
    debugToScreen() { quadScene.add(dbgMesh); renderer.setRenderTarget(null); renderer.render(quadScene, quadCam); quadScene.remove(dbgMesh); },
    update() {
      aoCam.position.copy(camera.position); aoCam.quaternion.copy(camera.quaternion);
      aoCam.projectionMatrix.copy(camera.projectionMatrix); aoCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
      aoCam.matrixWorld.copy(camera.matrixWorld); aoCam.matrixWorldInverse.copy(camera.matrixWorldInverse);
      aoCam.near = camera.near; aoCam.far = camera.far;
      uni.uProjInv.value.copy(camera.projectionMatrixInverse);
      uni.uProjScale.value = camera.projectionMatrix.elements[0];
      uni.uAspect.value = camera.projectionMatrix.elements[5] / camera.projectionMatrix.elements[0];
      G.uAOProj.value.set(camera.near, camera.far);
      const prevTarget = renderer.getRenderTarget(), prevOverride = scene.overrideMaterial, prevBg = scene.background;
      scene.overrideMaterial = depthMat; scene.background = null;
      renderer.setRenderTarget(depthRT); renderer.clear(true, true, false);
      renderer.render(scene, aoCam);
      scene.overrideMaterial = prevOverride; scene.background = prevBg;
      quadScene.add(gtao); renderer.setRenderTarget(aoRT); renderer.render(quadScene, quadCam); quadScene.remove(gtao);
      quadScene.add(blur); renderer.setRenderTarget(blurRT); renderer.render(quadScene, quadCam); quadScene.remove(blur);
      renderer.setRenderTarget(prevTarget);
    },
  };
}
