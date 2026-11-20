// Meadow flowers: instanced stem + cupped petal ring + centre disc, in clustered patches.
// Petal colour per instance (daisy white, buttercup yellow, lilac, poppy orange); sways
// with the same rooted wind as the grass.
import * as THREE from 'three';
import { grassHeightAt } from './grass.js';
import { groundY, pathDist } from '../heightfield.js';
import { CABIN } from '../layout.js';
import { makeRng } from '../../util/rng.js';
import { noise } from '../../util/noise.js';
import { stylize } from '../../render/stylize.js';

function flowerGeometry(petals = 7) {
  const pos = [], col = [], part = [], uv = [], idx = [];
  const add = (x, y, z, p, t) => { pos.push(x, y, z); part.push(p); uv.push(0.5, t); return pos.length / 3 - 1; };
  // stem: two crossed thin quads, height 1 (scaled per instance)
  for (const a of [0, Math.PI / 2]) {
    const dx = Math.cos(a) * 0.012, dz = Math.sin(a) * 0.012;
    const v0 = add(-dx, 0, -dz, 0, 0), v1 = add(dx, 0, dz, 0, 0), v2 = add(-dx, 1, -dz, 0, 1), v3 = add(dx, 1, dz, 0, 1);
    idx.push(v0, v1, v2, v1, v3, v2);
  }
  // petals: cupped quads radiating from the head (head radius ~0.08 at scale 1)
  const R = 0.085;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a), w = 0.024;
    const b0 = add(c * 0.012 - s * w, 1.0, s * 0.012 + c * w, 1, 1);
    const b1 = add(c * 0.012 + s * w, 1.0, s * 0.012 - c * w, 1, 1);
    const t0 = add(c * R - s * w * 1.2, 1.018, s * R + c * w * 1.2, 1, 1);
    const t1 = add(c * R + s * w * 1.2, 1.018, s * R - c * w * 1.2, 1, 1);
    const tip = add(c * R * 1.15, 1.012, s * R * 1.15, 1, 1);
    idx.push(b0, t0, b1, b1, t0, t1, t0, tip, t1);
  }
  // centre disc
  const cIdx = add(0, 1.028, 0, 2, 1);
  const ring = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ring.push(add(Math.cos(a) * 0.024, 1.022, Math.sin(a) * 0.024, 2, 1)); }
  for (let i = 0; i < 8; i++) idx.push(cIdx, ring[(i + 1) % 8], ring[i]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const n = new Float32Array(pos.length); for (let k = 1; k < n.length; k += 3) n[k] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  g.setIndex(idx);
  return g;
}

const SPECIES = [
  { w: 6, petal: 0xfbfbf6, centre: 0xf2c531 }, // daisy
  { w: 2.2, petal: 0xf7d232, centre: 0xe0a21b }, // buttercup
  { w: 1.4, petal: 0xb79ae8, centre: 0xf5e6a0 }, // lilac
  { w: 0.9, petal: 0xf2783a, centre: 0x5a2a12 }, // poppy
  { w: 0.8, petal: 0x8fb8f5, centre: 0xfaf1c0 }, // forget-me-not blue
];

export async function createFlowers() {
  const rng = makeRng(555);
  const geo = flowerGeometry();
  const tint = [], centre = [], mats = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), e = new THREE.Euler();
  const total = SPECIES.reduce((a, s) => a + s.w, 0);
  for (let i = 0; i < 90000 && mats.length < 9000; i++) {
    const x = rng.range(-60, 55), z = rng.range(-60, 55);
    const k = grassHeightAt(x, z);
    if (k <= 0) continue;
    // patches: meadow noise + extra near the cabin and along path edges
    const meadow = noise.fbm2(x * 0.045 + 9, z * 0.045 - 3, 3) * 0.5 + 0.5;
    const nearCabin = Math.exp(-((x - CABIN.x) ** 2 + (z - CABIN.z - 4) ** 2) / 120);
    const edge = Math.exp(-((pathDist(x, z) - 0.9) ** 2) / 0.6);
    const want = Math.max(0, meadow - 0.55) * 2.6 + nearCabin * 0.7 + edge * 0.35;
    if (rng() > want) continue;
    let r = rng() * total, sp = SPECIES[0];
    for (const s of SPECIES) { r -= s.w; if (r <= 0) { sp = s; break; } }
    // species clump together: bias by a second noise
    if (sp !== SPECIES[0] && noise.n2(x * 0.15, z * 0.15) < -0.1) sp = SPECIES[0];
    const stem = 0.62 * k * (0.75 + rng() * 0.45) + 0.06;
    const hs = 0.85 + rng() * 0.6;
    p.set(x, groundY(x, z) - 0.02, z);
    e.set(rng.range(-0.3, 0.3), rng() * 6.28, rng.range(-0.3, 0.3));
    q.setFromEuler(e);
    sc.set(hs, stem, hs);
    mats.push(m4.compose(p, q, sc).clone());
    const c = new THREE.Color(sp.petal).multiplyScalar(0.92 + rng() * 0.12);
    tint.push(c.r, c.g, c.b);
    const cc = new THREE.Color(sp.centre);
    centre.push(cc.r, cc.g, cc.b);
  }
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(tint), 3));
  geo.setAttribute('aCentre', new THREE.InstancedBufferAttribute(new Float32Array(centre), 3));
  const mat = stylize(new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), {
    wrap: 0.5, ramp: 0.2, hue: 0.8,
    vertexPars: 'attribute float aPart; attribute vec3 aTint; attribute vec3 aCentre; varying vec3 vFCol; varying float vPart;',
    worldVertex: /* glsl */ `
      vPart = aPart;
      vFCol = aPart < 0.5 ? vec3(0.22, 0.48, 0.16) : (aPart < 1.5 ? aTint : aCentre);
      #ifdef USE_INSTANCING
        vec3 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      #else
        vec3 root = modelMatrix[3].xyz;
      #endif
      float g = windGust(root.xz);
      float ph = hash12(root.xz * 3.1) * 6.28;
      float h = wPos.y - root.y;
      float a = uWind.z * (0.12 + 0.6 * g + 0.1 * sin(uTime * 2.4 + ph)) * clamp(h / 0.6, 0.0, 1.0);
      wPos.xz += uWind.xy * h * sin(a);
      wPos.y -= h * (1.0 - cos(a));
      vNormal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);`,
    fragmentPars: 'varying vec3 vFCol; varying float vPart;',
    albedo: 'diffuseColor.rgb = vFCol;',
    normalHook: 'normal = normalize(vNormal);',
    postLight: 'if (vPart > 0.5) outgoingLight += diffuseColor.rgb * 0.08; // petals glow a touch',
  });
  const mesh = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.name = 'Flowers';
  mesh.computeBoundingSphere();
  mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.name = 'Flowers';
  group.userData.reflect = false;
  group.userData.noExport = true;
  group.add(mesh);
  console.log('flowers', mats.length);
  return group;
}
