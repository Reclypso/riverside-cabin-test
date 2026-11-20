// Sun (shadow-casting directional light) + hemisphere sky fill + fog, driven by presets.
import * as THREE from 'three';
import { G } from './globals.js';
import { LAYER_REFLECT } from './reflection.js';

export function createLighting(scene) {
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.name = 'Sun';
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -62; sc.right = 62; sc.top = 62; sc.bottom = -62; sc.near = 1; sc.far = 320;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  sun.shadow.radius = 2.5;
  sun.shadow.intensity = 1.0;
  const focus = new THREE.Vector3(-2, 0, -2);
  sun.target.position.copy(focus);
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xa9d0ff, 0x6f8f4a, 1.5);
  hemi.name = 'SkyFill';
  scene.add(hemi);
  scene.fog = new THREE.FogExp2(0xcde8f6, 0.0017);

  for (const l of [sun, hemi]) l.layers.enable(LAYER_REFLECT);

  return {
    sun, hemi,
    apply(p) {
      G.uSunDir.value.copy(p.sunDir);
      G.uSunColor.value.set(p.sunColor);
      sun.color.set(p.sunColor);
      sun.intensity = p.sunIntensity;
      sun.position.copy(focus).addScaledVector(p.sunDir, 150);
      hemi.color.set(p.hemiSky); hemi.groundColor.set(p.hemiGround); hemi.intensity = p.hemiIntensity;
      scene.fog.color.set(p.fog); scene.fog.density = p.fogDensity;
      G.uShadowTint.value.set(...p.shadowTint); G.uLitTint.value.set(...p.litTint);
    },
  };
}
