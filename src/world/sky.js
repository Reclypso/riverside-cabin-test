// Painterly gradient sky dome with sun disc, glow and warm horizon haze toward the sun.
import * as THREE from 'three';
import { G } from '../render/globals.js';

export function createSky() {
  const uniforms = {
    uZenith: { value: new THREE.Color() }, uMid: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color() },
    uHaze: { value: new THREE.Color() }, uSunDisc: { value: 20 },
    uSunDir: G.uSunDir, uSunColor: G.uSunColor,
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // on the far plane
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith, uMid, uHorizon, uGround, uHaze, uSunDir, uSunColor;
      uniform float uSunDisc;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 col = mix(uHorizon, uMid, smoothstep(-0.02, 0.22, y));
        col = mix(col, uZenith, smoothstep(0.18, 0.9, y));
        col = mix(col, uGround, smoothstep(0.0, -0.2, y));
        float sd = max(dot(d, normalize(uSunDir)), 0.0);
        float low = 1.0 - smoothstep(0.0, 0.45, y);
        col += uHaze * pow(sd, 4.0) * low * 0.9;
        // glow gets whiter toward the core so tone mapping can't leave a saturated ring
        vec3 core = mix(uSunColor, vec3(1.0, 0.97, 0.92), smoothstep(0.995, 0.9999, sd));
        col += uSunColor * (pow(sd, 8.0) * 0.16 + pow(sd, 48.0) * 0.28);
        col += core * pow(sd, 420.0) * 0.9;
        float disc = smoothstep(0.9993, 0.99968, sd);
        col = mix(col, core * uSunDisc, disc);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(2600, 48, 24), mat);
  mesh.name = 'SkyDome';
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.userData.noExport = true;
  mesh.setPreset = (p) => {
    uniforms.uZenith.value.set(p.zenith); uniforms.uMid.value.set(p.mid);
    uniforms.uHorizon.value.set(p.horizon); uniforms.uGround.value.set(p.ground);
    uniforms.uHaze.value.set(p.haze); uniforms.uSunDisc.value = p.sunDisc;
  };
  return mesh;
}
