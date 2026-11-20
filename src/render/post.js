// Post stack (pmndrs postprocessing): MSAA scene pass -> bloom -> colour grade ->
// tone mapping -> vignette. Optional depth of field for close hero shots.
import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode,
  VignetteEffect, DepthOfFieldEffect, Effect, BlendFunction, GodRaysEffect, KernelSize,
} from 'postprocessing';
import { G } from './globals.js';

class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', /* glsl */ `
      uniform float uSat, uExposure, uContrast;
      uniform vec3 uShadowTint, uHighTint;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
        vec3 c = inputColor.rgb * uExposure;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, uSat);
        // highlight desaturation: HDR glows roll toward white (no saturated halo rings)
        float peak = max(c.r, max(c.g, c.b));
        c = mix(c, vec3(max(l, peak * 0.85)), smoothstep(0.9, 2.4, peak) * 0.85);
        c *= mix(uShadowTint, uHighTint, smoothstep(0.02, 0.9, l));
        // gentle contrast around mid grey in log space
        c = max(c, 0.0);
        c = pow(c / 0.18, vec3(uContrast)) * 0.18;
        outputColor = vec4(c, inputColor.a);
      }`, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ['uSat', new THREE.Uniform(1.1)], ['uExposure', new THREE.Uniform(1)], ['uContrast', new THREE.Uniform(1.03)],
        ['uShadowTint', new THREE.Uniform(new THREE.Vector3(1, 1, 1))], ['uHighTint', new THREE.Uniform(new THREE.Vector3(1, 1, 1))],
      ]),
    });
  }
}

export function createPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new BloomEffect({ intensity: 0.8, luminanceThreshold: 1.05, luminanceSmoothing: 0.6, mipmapBlur: true, radius: 0.72 });
  const grade = new GradeEffect();
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
  const vignette = new VignetteEffect({ offset: 0.3, darkness: 0.42 });
  const dof = new DepthOfFieldEffect(camera, { focusDistance: 12, focusRange: 30, bokehScale: 2.5 });
  const dofPass = new EffectPass(camera, dof);
  dofPass.enabled = false;
  composer.addPass(dofPass);
  // god rays from an occluded sun proxy (not in the scene; the sky draws the visible disc)
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshBasicMaterial({ color: 0xffe2b8, fog: false }));
  sunMesh.name = 'SunProxy';
  const godRays = new GodRaysEffect(camera, sunMesh, {
    samples: 60, density: 0.95, decay: 0.92, weight: 0.42, exposure: 0.55, clampMax: 0.9,
    resolutionScale: 0.5, kernelSize: KernelSize.SMALL, blur: true,
  });
  composer.addPass(new EffectPass(camera, godRays, bloom, grade, tone, vignette));

  return {
    composer, bloom, grade, dof, dofPass, godRays,
    apply(p) {
      const g = p.grade;
      const u = grade.uniforms;
      u.get('uSat').value = g.saturation; u.get('uExposure').value = g.exposure; u.get('uContrast').value = g.contrast;
      u.get('uShadowTint').value.set(...g.shadowTint); u.get('uHighTint').value.set(...g.highTint);
      bloom.intensity = p.bloom;
      godRays.blendMode.opacity.value = p.godRays ?? 0.3;
      sunMesh.material.color.set(p.sunColor).lerp(new THREE.Color(1, 1, 1), 0.3);
    },
    setDof(on, focus = 12, range = 30, bokeh = 2.5) {
      dofPass.enabled = on;
      dof.cocMaterial.focusDistance = focus;
      dof.cocMaterial.focusRange = range;
      dof.bokehScale = bokeh;
    },
    setSize(w, h) { composer.setSize(w, h); },
    render(dt) {
      sunMesh.position.copy(camera.position).addScaledVector(G.uSunDir.value, 1500);
      sunMesh.scale.setScalar(42);
      sunMesh.updateMatrixWorld();
      composer.render(dt);
    },
  };
}
