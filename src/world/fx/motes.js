// Floating light motes (pollen in the sun by day, fireflies near the grass at golden hour).
import * as THREE from 'three';
import { G } from '../../render/globals.js';
import { groundY } from '../heightfield.js';
import { makeRng } from '../../util/rng.js';

export function createMotes(count = 700) {
  const rng = makeRng(808);
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const x = rng.range(-38, 34), z = rng.range(-38, 34);
    pos[i * 3] = x; pos[i * 3 + 1] = groundY(x, z) + 0.3 + Math.pow(rng(), 2) * 5; pos[i * 3 + 2] = z;
    seed[i] = rng();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.computeBoundingSphere();
  const uniforms = { uTime: G.uTime, uWind: G.uWind, uGlow: { value: 0 }, uScale: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime, uGlow, uScale; uniform vec4 uWind;
      attribute float aSeed;
      varying float vA; varying float vFly;
      void main(){
        vec3 p = position;
        float t = uTime * (0.25 + aSeed * 0.3);
        p.x += sin(t + aSeed * 30.0) * 1.2 + uWind.x * sin(uTime * 0.1 + aSeed * 9.0) * 1.5;
        p.z += cos(t * 0.8 + aSeed * 17.0) * 1.2 + uWind.y * sin(uTime * 0.1 + aSeed * 9.0) * 1.5;
        p.y += sin(t * 1.3 + aSeed * 7.0) * 0.4;
        vFly = step(0.55, aSeed); // half of them become fireflies near the ground at dusk
        p.y = mix(p.y, position.y * 0.25 + 0.4 + sin(t * 2.0 + aSeed * 40.0) * 0.25, vFly * uGlow);
        vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float blink = 0.5 + 0.5 * sin(uTime * (1.5 + aSeed * 2.0) + aSeed * 50.0);
        vA = mix(0.1 + 0.12 * blink, blink * blink * 1.6 * vFly, uGlow);
        gl_PointSize = (mix(1.6, 3.4, uGlow) + aSeed * 1.2) * uScale * (60.0 / max(-mv.z, 1.0));
      }`,
    fragmentShader: /* glsl */ `
      uniform float uGlow;
      varying float vA; varying float vFly;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(d));
        vec3 day = vec3(1.0, 0.92, 0.7);
        vec3 fly = vec3(1.0, 0.85, 0.35) * 3.0;
        gl_FragColor = vec4(mix(day, fly, uGlow * vFly) * a * vA, 1.0);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.name = 'LightMotes';
  pts.frustumCulled = false;
  pts.setPreset = (p) => { uniforms.uGlow.value = p.lanternGlow; };
  pts.setScale = (s) => { uniforms.uScale.value = s; };
  return pts;
}
