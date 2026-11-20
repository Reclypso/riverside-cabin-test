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

// painted anisotropic-ish sheen for hair: a soft highlight where the half vector meets the lock
const SHEEN = /* glsl */ `
{
  vec3 vV = normalize(vViewPosition);
  vec3 vL = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
  float sh = pow(clamp(dot(normal, normalize(vL - vV)), 0.0, 1.0), 10.0);
  outgoingLight += vec3(1.0, 0.84, 0.58) * diffuseColor.rgb * smoothstep(0.2, 0.75, sh) * 0.38 * cloudShadow(vStyWorld.xz);
}`;

export function convertMaterial(src) {
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
  // golden hair: softer wrap and a gentler cool-shadow hue shift so it stays honey-gold in shade
  // (the full shift pushes yellow toward olive/grey), plus a warm strand sheen
  const isHair = /Hair_Golden|Brow_Golden/i.test(src.name);
  if (isHair) m.normalMap = null;
  stylize(m, { wrap: isHair ? 0.62 : 0.5, ramp: 0.55, hue: isMetal ? 0.25 : isHair ? 0.35 : 0.9,
    postLight: isEye ? '' : RIM + (isMetal ? STEEL : '') + (isHair ? SHEEN : '') });
  return m;
}

export function outlineMaterial(color = 0x2a1a12, width = 0.0065) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uOutline = { value: width };
    shader.vertexShader = 'uniform float uOutline;\n' + shader.vertexShader.replace('#include <skinning_vertex>',
      '#include <skinning_vertex>\n transformed += normalize(objectNormal) * uOutline;');
  };
  m.customProgramCacheKey = () => 'mm-outline';
  m.name = 'Outline_' + color.toString(16);
  return m;
}

export async function loadCharacter(url = './assets/character/mountain_man.glb') {
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  root.name = 'MountainMan';
  const cache = new Map();
  const outline = outlineMaterial();
  const hairOutline = outlineMaterial(0x5a3812, 0.0035); // thin locks: warm brown, half width
  const faceOutline = outlineMaterial(0x3a2216, 0.0028);
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
    const hairy = /MM_Hair|MM_Beard/.test(o.name + o.parent.name);
    const face = /MM_Head/.test(o.name + o.parent.name); // thin on the face: no rings in the nostrils
    const hull = new THREE.SkinnedMesh(o.geometry, hairy ? hairOutline : face ? faceOutline : outline);
    hull.name = o.name + '_Outline';
    hull.bind(o.skeleton, o.bindMatrix);
    hull.frustumCulled = false;
    hull.userData.noExport = true;
    o.parent.add(hull);
    hull.position.copy(o.position); hull.quaternion.copy(o.quaternion); hull.scale.copy(o.scale);
  }
  // the axe lives on his back; a second copy is skinned to the right hand for attacks
  const axeBack = root.getObjectByName('MM_Axe'), axeHand = root.getObjectByName('MM_AxeHand');
  if (axeHand) axeHand.visible = false;
  root.userData.setAxeInHand = (on) => {
    if (axeHand) axeHand.visible = on;
    if (axeBack) axeBack.visible = !on || !axeHand;
  };
  const clips = Object.fromEntries(gltf.animations.map((c) => [c.name, c]));
  return { root, clips };
}
