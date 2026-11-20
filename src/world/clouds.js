// Ring of big painted cumulus clouds plus small wisps, slowly drifting.
// Each cloud is a quad facing the world centre; colours come from the time-of-day preset.
import * as THREE from 'three';
import { paintCloud } from './cloudTexture.js';
import { makeRng } from '../util/rng.js';
import { G } from '../render/globals.js';

export function createClouds() {
  const rng = makeRng(99);
  const group = new THREE.Group();
  group.name = 'Clouds';
  group.userData.noExport = true;
  const textures = [0, 1, 2, 3, 4].map((i) => paintCloud(11 + i * 17, { puffs: 22 + i * 3 }));
  const wisps = [0, 1, 2].map((i) => paintCloud(301 + i * 7, { wispy: true, puffs: 30 }));
  const uniforms = {
    uLit: { value: new THREE.Color() }, uShade: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() }, uSunDir: G.uSunDir, uSunColor: G.uSunColor, uTime: G.uTime,
  };
  const make = (tex, opacity) => new THREE.ShaderMaterial({
    uniforms: { ...uniforms, map: { value: tex }, uOpacity: { value: opacity } },
    transparent: true, depthWrite: false, fog: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vWorld;
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform vec3 uLit, uShade, uHorizon, uSunDir, uSunColor; uniform float uOpacity;
      varying vec2 vUv; varying vec3 vWorld;
      void main(){
        vec4 t = texture2D(map, vUv);
        if (t.a < 0.01) discard;
        float l = t.r;
        vec3 col = mix(uShade, uLit, smoothstep(0.18, 0.92, l));
        float edge = 1.0 - smoothstep(0.25, 0.95, t.a);
        col = mix(col, uLit, edge * 0.25); // soft bright fringe at the silhouette
        vec3 d = normalize(vWorld - cameraPosition);
        float toward = pow(max(dot(d, normalize(uSunDir)), 0.0), 6.0);
        col += uSunColor * toward * (1.0 - l * 0.5) * 0.35; // silver lining toward the sun
        float elev = d.y;
        col = mix(uHorizon, col, smoothstep(0.0, 0.16, elev) * 0.75 + 0.25);
        gl_FragColor = vec4(col, t.a * uOpacity * smoothstep(-0.02, 0.05, elev));
      }`,
  });
  const quad = new THREE.PlaneGeometry(1, 0.5);
  const place = (tex, n, dist, height, size, opacity) => {
    const mat = make(tex, opacity);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(quad, mat);
      const a = rng() * Math.PI * 2;
      const r = rng.range(dist[0], dist[1]);
      const s = rng.range(size[0], size[1]);
      m.position.set(Math.cos(a) * r, rng.range(height[0], height[1]), Math.sin(a) * r);
      m.scale.set(s * rng.range(0.9, 1.25), s, 1);
      m.lookAt(0, m.position.y * 0.6, 0);
      m.userData.drift = { a, r, speed: rng.range(0.6, 1.2) };
      m.renderOrder = -5;
      m.frustumCulled = false;
      group.add(m);
    }
  };
  textures.forEach((t) => place(t, 3, [950, 1500], [150, 400], [380, 680], 1));
  wisps.forEach((t) => place(t, 3, [700, 1300], [300, 560], [180, 320], 0.8));

  group.update = () => {
    const t = G.uTime.value;
    for (const m of group.children) {
      const { a, r, speed } = m.userData.drift;
      const aa = a + t * 0.0009 * speed;
      m.position.x = Math.cos(aa) * r; m.position.z = Math.sin(aa) * r;
      m.lookAt(0, m.position.y * 0.6, 0);
    }
  };
  group.setPreset = (p) => {
    uniforms.uLit.value.set(p.cloudLit); uniforms.uShade.value.set(p.cloudShade); uniforms.uHorizon.value.set(p.horizon);
  };
  return group;
}
