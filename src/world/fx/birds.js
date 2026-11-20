// A small flock gliding in slow loops high above the valley (flapping V shapes).
import * as THREE from 'three';
import { G } from '../../render/globals.js';

export function createBirds(count = 7) {
  // one bird = two wing triangles hinged on the body axis (x = 0)
  const pos = [0, 0, 0.12, 0, 0, -0.1, -0.55, 0, -0.05, 0, 0, 0.12, 0.55, 0, -0.05, 0, 0, -0.1];
  const wing = [0, 0, 1, 0, 0, 1, 0, 0, 1].concat([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const base = new THREE.BufferGeometry();
  base.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  base.setAttribute('aWing', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 1));
  void wing;
  const geo = new THREE.InstancedBufferGeometry().copy(base);
  geo.instanceCount = count;
  const off = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
    off.set([side * row * 1.6, Math.sin(i * 3.1) * 0.6, -row * 1.4], i * 3);
  }
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 3));
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
  Object.assign(uniforms, { uTime: G.uTime, uCol: { value: new THREE.Color(0x2c3440) } });
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide, fog: true,
    vertexShader: /* glsl */ `
      uniform float uTime; attribute float aWing; attribute vec3 aOff;
      #include <fog_pars_vertex>
      void main(){
        float t = uTime * 0.075;
        vec3 centre = vec3(-6.0 + cos(t) * 46.0, 34.0 + sin(t * 2.0) * 3.0, -10.0 + sin(t) * 34.0);
        vec3 fwd = normalize(vec3(-sin(t) * 46.0, 0.0, cos(t) * 34.0));
        vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
        float flap = sin(uTime * 7.0 + aOff.x * 2.0 + aOff.z) ;
        float glide = smoothstep(-0.2, 0.6, sin(uTime * 0.6 + aOff.z));
        vec3 p = position * 1.4;
        p.y += aWing * abs(p.x) * flap * 0.9 * (1.0 - glide * 0.85) + aWing * abs(p.x) * 0.25;
        vec3 w = centre + right * (p.x + aOff.x) + vec3(0.0, p.y + aOff.y, 0.0) + fwd * (p.z * -1.0 + aOff.z);
        vec4 mvPosition = viewMatrix * vec4(w, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol;
      #include <fog_pars_fragment>
      void main(){ gl_FragColor = vec4(uCol, 1.0);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'Birds';
  mesh.frustumCulled = false;
  return mesh;
}
