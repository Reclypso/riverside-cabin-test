// Loads the mountain-man glTF (assets/character/mountain_man.glb), converts its PBR materials to
// the project's stylised shading (wrap light, hue shift, character rim light) and adds a thin
// inverted-hull outline so he reads clearly against foliage, Genshin-style.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { stylize } from '../render/stylize.js';

const RIM = /* glsl */ `
{
  vec3 vV = normalize(vViewPosition);
  vec3 vL = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
  float rim = pow(1.0 - clamp(dot(normal, vV), 0.0, 1.0), 3.0);
  float sunSide = clamp(dot(normal, vL) * 0.6 + 0.5, 0.0, 1.0);
  outgoingLight += diffuseColor.rgb * (uSunColor * 0.9 * sunSide + vec3(0.35, 0.45, 0.6) * 0.35) * rim * cloudShadow(vStyWorld.xz);
}`;

const STEEL = /* glsl */ `
{
  vec3 vV = normalize(vViewPosition);
  vec3 vL = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
  float spec = pow(clamp(dot(normal, normalize(vL - vV)), 0.0, 1.0), 40.0);
  outgoingLight += uSunColor * smoothstep(0.25, 0.6, spec) * 0.9 * cloudShadow(vStyWorld.xz);
}`;

function convertMaterial(src) {
  const m = new THREE.MeshLambertMaterial({
    name: src.name, color: src.color ? src.color.clone() : 0xffffff, map: src.map || null,
    normalMap: src.normalMap || null, side: src.side, transparent: src.transparent, alphaTest: src.alphaTest,
    emissive: src.emissive ? src.emissive.clone() : 0x000000, emissiveMap: src.emissiveMap || null,
  });
  if (m.normalMap) m.normalScale = new THREE.Vector2(0.8, 0.8);
  // eyes and metal get a touch more pop; fur and cloth stay soft
  const isEye = /Eye/i.test(src.name);
  // PBR metals keep their colour in the specular lobe, which Lambert doesn't have: lift the
  // albedo toward steel and add a painted sun highlight so the axe head doesn't read as a black slab
  const isMetal = (src.metalness ?? 0) > 0.5 && !m.map;
  if (isMetal) m.color.lerp(new THREE.Color(0x98a1aa), 0.5);
  stylize(m, { wrap: 0.5, ramp: 0.55, hue: isMetal ? 0.25 : 0.9, postLight: isEye ? '' : RIM + (isMetal ? STEEL : '') });
  return m;
}

function outlineMaterial() {
  const m = new THREE.MeshBasicMaterial({ color: 0x2a1a12, side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uOutline = { value: 0.0065 };
    shader.vertexShader = 'uniform float uOutline;\n' + shader.vertexShader.replace('#include <skinning_vertex>',
      '#include <skinning_vertex>\n transformed += normalize(objectNormal) * uOutline;');
  };
  m.customProgramCacheKey = () => 'mm-outline';
  return m;
}

export async function loadCharacter(url = './assets/character/mountain_man.glb') {
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  root.name = 'MountainMan';
  const cache = new Map();
  const outline = outlineMaterial();
  const outlines = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material)
      ? o.material.map((mm) => cache.get(mm) || cache.set(mm, convertMaterial(mm)).get(mm))
      : cache.get(o.material) || cache.set(o.material, convertMaterial(o.material)).get(o.material);
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false; // skinned bounds don't follow the animation
    if (o.isSkinnedMesh && !/Eye|Face\.001|Eyebrow/i.test(o.name + o.geometry.name)) outlines.push(o);
  });
  for (const o of outlines) {
    const hull = new THREE.SkinnedMesh(o.geometry, outline);
    hull.name = o.name + '_Outline';
    hull.bind(o.skeleton, o.bindMatrix);
    hull.frustumCulled = false;
    hull.userData.noExport = true;
    o.parent.add(hull);
    hull.position.copy(o.position); hull.quaternion.copy(o.quaternion); hull.scale.copy(o.scale);
  }
  const clips = Object.fromEntries(gltf.animations.map((c) => [c.name, c]));
  return { root, clips };
}
