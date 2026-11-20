// Page-side glTF export (used by tools/export_gltf.mjs, or call window.exportArea() in devtools).
// Static meshes -> GLB per element; trees -> one prototype GLB per species variant + a JSON of
// instance transforms (map to Godot MultiMesh). Grass/flowers/FX are procedural in-engine.
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bakeTerrainColors } from './world/terrainBake.js';

const exporter = new GLTFExporter();
const toGLB = (obj) => exporter.parseAsync(obj, { binary: true, onlyVisible: true });

// Plain material copy: GLTFExporter writes standard PBR (no custom shader hooks).
function plainMaterial(m) {
  const out = new THREE.MeshStandardMaterial({
    name: m.name || m.type, color: m.color ? m.color.clone() : new THREE.Color(1, 1, 1), map: m.map || null,
    vertexColors: !!m.vertexColors, roughness: 0.9, metalness: 0, side: m.side,
    transparent: !!m.transparent, opacity: m.opacity ?? 1, alphaTest: m.alphaTest || 0,
    emissive: m.emissive ? m.emissive.clone() : new THREE.Color(0), emissiveMap: m.emissiveMap || null,
  });
  if (m.emissiveIntensity !== undefined) out.emissiveIntensity = m.emissiveIntensity;
  return out;
}

// Clone a subtree with plain materials; small instanced meshes are flattened to real geometry.
function cleanClone(src) {
  const root = new THREE.Group();
  root.name = src.name;
  src.updateMatrixWorld(true);
  const skip = new Set();
  src.traverse((o) => { if (o.userData.noExport) o.traverse((c) => skip.add(c)); });
  src.traverse((o) => {
    if (!o.isMesh || !o.visible || skip.has(o)) return;
    const mats = Array.isArray(o.material) ? o.material.map(plainMaterial) : plainMaterial(o.material);
    // optional per-instance vertex colouring hook (shader-driven looks baked to COLOR_0)
    const colorize = o.userData.exportColorize;
    if (colorize && !Array.isArray(mats)) { mats.vertexColors = true; mats.color.set(0xffffff); }
    if (o.isInstancedMesh) {
      const parts = [];
      for (let i = 0; i < o.count; i++) {
        const m = new THREE.Matrix4();
        o.getMatrixAt(i, m);
        const g = o.geometry.clone();
        if (colorize) colorize(g, i);
        parts.push(g.applyMatrix4(m.premultiply(o.matrixWorld)));
      }
      if (!parts.length) return;
      const g = mergeGeometries(parts.map(stripCustom), false);
      const mesh = new THREE.Mesh(g, mats);
      mesh.name = o.name;
      root.add(mesh);
    } else {
      const mesh = new THREE.Mesh(stripCustom(o.geometry.clone().applyMatrix4(o.matrixWorld)), mats);
      mesh.name = o.name;
      root.add(mesh);
    }
  });
  return root;
}

function stripCustom(g) {
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  if (g.attributes.color && g.attributes.color.itemSize === 4) {
    const c = g.attributes.color, a = new Float32Array(c.count * 3);
    for (let i = 0; i < c.count; i++) a.set([c.getX(i), c.getY(i), c.getZ(i)], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  }
  // glTF COLOR_0 must be in 0..1 (validator ACCESSOR_NON_CLAMPED); a few foliage tints run a touch
  // over 1 for brightness, so clamp on export (copy, the live geometry is untouched)
  if (g.attributes.color) {
    const c = g.attributes.color, a = Float32Array.from(c.array, (v) => Math.min(1, Math.max(0, v)));
    g.setAttribute('color', new THREE.BufferAttribute(a, c.itemSize, c.normalized));
  }
  return g;
}

function treeExport(trees) {
  const protos = {}, placements = [];
  for (const im of trees.children) {
    if (!im.isInstancedMesh) continue;
    const key = im.name.replace(/_far/, '').replace(/_(Bark|Leaves)$/, '');
    protos[key] = protos[key] || new THREE.Group();
    protos[key].name = key;
    const mesh = new THREE.Mesh(stripCustom(im.geometry.clone()), plainMaterial(im.material));
    mesh.geometry.setDrawRange(0, Infinity);
    mesh.name = im.name.endsWith('Bark') ? 'Bark' : 'Leaves';
    if (!protos[key].getObjectByName(mesh.name)) protos[key].add(mesh);
    if (mesh.name === 'Bark') {
      const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      for (let i = 0; i < im.count; i++) {
        im.getMatrixAt(i, m); m.decompose(p, q, s);
        placements.push({ prototype: key, position: p.toArray().map((v) => +v.toFixed(3)), quaternion: q.toArray().map((v) => +v.toFixed(5)), scale: s.toArray().map((v) => +v.toFixed(3)) });
      }
    }
  }
  return { protos, placements };
}

export async function exportArea(world) {
  const files = {};
  const root = world.root;
  const enc = (buf) => btoa(Array.from(new Uint8Array(buf), (b) => String.fromCharCode(b)).join(''));
  for (const name of ['Cabin', 'Props', 'Plants']) {
    const obj = root.getObjectByName(name);
    if (obj) files[`${name.toLowerCase()}.glb`] = enc(await toGLB(cleanClone(obj)));
  }
  // fairy circles: static rings only (mushrooms, flowers, stones); the VFX are flagged noExport
  const fairy = root.getObjectByName('FairyCircles');
  if (fairy) files['fairy_circles.glb'] = enc(await toGLB(cleanClone(fairy)));
  const terrain = cleanClone(root.getObjectByName('Terrain'));
  bakeTerrainColors(terrain.children[0].geometry);
  terrain.children[0].material.vertexColors = true;
  files['terrain.glb'] = enc(await toGLB(terrain));
  files['water.glb'] = enc(await toGLB(cleanClone(root.getObjectByName('River_Water'))));
  const trees = root.getObjectByName('Trees');
  if (trees) {
    const { protos, placements } = treeExport(trees);
    for (const [k, g] of Object.entries(protos)) files[`trees/${k}.glb`] = enc(await toGLB(g));
    files['trees/placements.json'] = btoa(JSON.stringify({ units: 'metres', up: 'Y', placements }, null, 1));
  }
  return files;
}
