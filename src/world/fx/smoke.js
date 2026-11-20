// Chimney smoke: soft painted puffs rising and drifting downwind. Fully deterministic from
// uTime (no simulation state), camera-facing in the vertex shader.
import * as THREE from 'three';
import { G } from '../../render/globals.js';

function puffTexture() {
  const s = 128, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  for (let i = 0; i < 9; i++) {
    const x = s / 2 + Math.cos(i * 2.4) * s * 0.14 * (i ? 1 : 0), y = s / 2 + Math.sin(i * 2.4) * s * 0.12 * (i ? 1 : 0);
    const r = s * (i ? 0.2 : 0.3);
    const g = ctx.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.7, 'rgba(225,225,225,0.55)'); g.addColorStop(1, 'rgba(200,200,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export function createSmoke(origin, count = 22) {
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry().copy(quad);
  geo.instanceCount = count;
  const phase = new Float32Array(count), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) { phase[i] = i / count; seed[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1 * 0.5 + 0.5; }
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
  Object.assign(uniforms, {
    uTime: G.uTime, uWind: G.uWind, uSunColor: G.uSunColor, uSunDir: G.uSunDir,
    uOrigin: { value: origin.clone() }, uMap: { value: puffTexture() },
    uLit: { value: new THREE.Color(0xf4f1ec) }, uShade: { value: new THREE.Color(0x9aa6b8) },
  });
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, fog: true,
    vertexShader: /* glsl */ `
      uniform float uTime; uniform vec4 uWind; uniform vec3 uOrigin;
      attribute float aPhase; attribute float aSeed;
      varying vec2 vUv; varying float vAlpha; varying float vAge;
      #include <fog_pars_vertex>
      void main(){
        float life = 7.0;
        float age = fract(uTime / life + aPhase);
        vAge = age;
        vec3 c = uOrigin;
        c.y += age * 4.2 + age * age * 1.2;
        c.xz += uWind.xy * (age * age * 4.5 + age * 0.6) * uWind.z;
        c.x += sin(uTime * 0.7 + aSeed * 20.0) * 0.35 * age;
        c.z += cos(uTime * 0.6 + aSeed * 13.0) * 0.35 * age;
        float size = 0.45 + age * 2.1 + aSeed * 0.3;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float rot = aSeed * 6.28 + age * 1.5;
        vec2 p = vec2(position.x * cos(rot) - position.y * sin(rot), position.x * sin(rot) + position.y * cos(rot));
        vec3 w = c + (right * p.x + up * p.y) * size;
        vUv = uv;
        vAlpha = smoothstep(0.0, 0.08, age) * pow(1.0 - age, 1.6) * 0.6;
        vec4 mvPosition = viewMatrix * vec4(w, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform vec3 uLit, uShade, uSunColor;
      varying vec2 vUv; varying float vAlpha; varying float vAge;
      #include <fog_pars_fragment>
      void main(){
        vec4 t = texture2D(uMap, vUv);
        float shade = smoothstep(0.2, 0.9, vUv.y);
        vec3 col = mix(uShade, uLit * (0.6 + 0.4 * uSunColor), shade);
        gl_FragColor = vec4(col, t.a * vAlpha);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.name = 'ChimneySmoke';
  mesh.renderOrder = 3;
  return mesh;
}
