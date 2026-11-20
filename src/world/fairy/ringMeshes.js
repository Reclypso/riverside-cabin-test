// Static fairy-ring dressing: stylised mushrooms (one instanced mesh, cap colour per instance,
// procedural spots, emissive glow on the magic ones), tiny star flowers on stems, and a few pale
// mossy stones. Shading goes through the project's stylise() Lambert so they sit in the scene.
// Per-circle energy (cooldown dimming / trigger flash) arrives through the shared uniforms.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { stylize } from '../../render/stylize.js';
import { groundY } from '../heightfield.js';
import { makeRng } from '../../util/rng.js';

// cap / spot palettes: [cap, spot, glow]
const CAPS = [
  { cap: 0xd2402c, spot: 0xfff4e2, glow: 0.0 }, // fly agaric red, white spots
  { cap: 0xf1e3c4, spot: 0xc9a77a, glow: 0.0 }, // cream button
  { cap: 0x8a4fc4, spot: 0xe9c8ff, glow: 1.0 }, // magic violet, glowing spots
  { cap: 0x3fa6b8, spot: 0xc8fff4, glow: 1.0 }, // magic teal, glowing spots
  { cap: 0xe4925a, spot: 0xffe8c0, glow: 0.35 }, // amber
];
// circle palettes pick which caps dominate (meadow gold, grove lilac, river teal, upriver rose)
const CIRCLE_CAPS = [[0, 0, 1, 4, 2, 0, 3], [2, 2, 1, 0, 2, 4, 1], [3, 3, 1, 0, 3, 2, 1], [0, 2, 1, 4, 0, 2, 3]];
const FLOWER_COLS = [[0xbfe3ff, 0x8fc7ff, 0xffffff], [0xe8c9ff, 0xffffff, 0xd6a8ff], [0xb8fff0, 0xffffff, 0x9fe8ff], [0xffd6ec, 0xffffff, 0xffb8d8]];

function lathe(profile, segs) {
  return new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), segs);
}
// all parts indexed (smooth normals, compact export); polyhedra are welded first
function tag(geo, part) {
  if (!geo.index) geo = mergeVertices(geo);
  const n = geo.attributes.position.count;
  geo.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(part), 1));
  return geo;
}

// unit mushroom: total height 1, cap radius ~0.55 (instances scale x/z and y independently)
function mushroomGeometry() {
  const stem = lathe([[0.0, 0.0], [0.13, 0.0], [0.15, 0.03], [0.125, 0.25], [0.1, 0.62], [0.0, 0.62]], 9);
  const cap = lathe([[0.0, 1.0], [0.24, 0.98], [0.4, 0.92], [0.52, 0.8], [0.57, 0.67], [0.555, 0.6],
    [0.42, 0.585], [0.16, 0.59], [0.0, 0.61]], 14);
  // the cap profile runs top -> down, so Lathe's analytic normals face inward: flip them
  const cn = cap.attributes.normal;
  for (let i = 0; i < cn.count; i++) cn.setXYZ(i, -cn.getX(i), -cn.getY(i), -cn.getZ(i));
  // lathe normals are analytic and seam-free: keep them (no recompute after the merge)
  return mergeGeometries([tag(stem, 0), tag(cap, 1)], false);
}

// star flower: thin stem + 5-petal head facing up, total height 1
function flowerGeometry() {
  const stem = new THREE.CylinderGeometry(0.012, 0.016, 1, 4, 1, true).translate(0, 0.5, 0);
  const shape = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 === 0 ? 0.1 : 0.042;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const head = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).translate(0, 1.0, 0);
  // cup the petals a little
  const p = head.attributes.position;
  for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getZ(i)); p.setY(i, 1.0 + r * r * 3.0); }
  const centre = new THREE.IcosahedronGeometry(0.03, 0).translate(0, 1.015, 0);
  const g = mergeGeometries([tag(stem, 0), tag(head, 1), tag(centre, 2)], false);
  g.computeVertexNormals();
  return g;
}

function stoneGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position, rng = makeRng(31);
  for (let i = 0; i < p.count; i++) {
    const k = 0.82 + 0.25 * rng();
    p.setXYZ(i, p.getX(i) * k, Math.max(-0.2, p.getY(i)) * k * 0.55, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

const COMMON_VERT = /* glsl */ `
attribute float aPart;
attribute float aCircle;
attribute vec4 aSpot;
varying float vPart;
varying vec3 vLocal;
varying vec4 vSpot;
varying float vCircle;
`;
const COMMON_LOCAL = /* glsl */ `
vPart = aPart; vLocal = position; vSpot = aSpot; vCircle = aCircle;
`;
const ENERGY_PARS = /* glsl */ `
uniform vec4 uFairyEnergy[4]; // x = glow energy (dims in cooldown, spikes on trigger)
uniform float uFairyBoost;
float fairyEnergy(float c){
  int i = int(c + 0.5);
  return i == 0 ? uFairyEnergy[0].x : i == 1 ? uFairyEnergy[1].x : i == 2 ? uFairyEnergy[2].x : uFairyEnergy[3].x;
}
vec2 fHash2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
`;

function mushroomMaterial(uniforms) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  return stylize(m, {
    wrap: 0.55, ramp: 0.5, hue: 0.8, ao: 0, uniforms,
    vertexPars: COMMON_VERT, localVertex: COMMON_LOCAL,
    fragmentPars: /* glsl */ `
      varying float vPart; varying vec3 vLocal; varying vec4 vSpot; varying float vCircle;
      ${ENERGY_PARS}
      float fSpots(vec3 l){
        // voronoi spots on the cap dome (cylindrical coords)
        vec2 uv = vec2(atan(l.z, l.x) * 1.9, l.y * 7.0);
        vec2 ip = floor(uv), fp = fract(uv); float d = 9.0;
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
          vec2 o = vec2(float(x), float(y)); vec2 h = fHash2(ip + o);
          vec2 r = o + 0.2 + 0.6 * h - fp; d = min(d, dot(r, r) / (0.35 + 0.65 * h.x));
        }
        return 1.0 - smoothstep(0.05, 0.11, d);
      }`,
    albedo: /* glsl */ `
      {
        float cap = step(0.5, vPart);
        float top = smoothstep(0.585, 0.64, vLocal.y);      // cap dome vs gill underside
        vec3 stemC = vec3(0.93, 0.89, 0.80);
        vec3 gill = vec3(0.86, 0.80, 0.70);
        vec3 c = mix(gill, diffuseColor.rgb, top);
        float sp = fSpots(vLocal) * top * smoothstep(0.66, 0.74, vLocal.y);
        c = mix(c, vSpot.rgb, sp);
        diffuseColor.rgb = mix(stemC * (0.85 + 0.15 * smoothstep(0.0, 0.3, vLocal.y)), c, cap);
      }`,
    postLight: /* glsl */ `
      {
        float cap = step(0.5, vPart);
        float top = smoothstep(0.585, 0.64, vLocal.y);
        float e = fairyEnergy(vCircle) * uFairyBoost;
        float sp = fSpots(vLocal) * top * smoothstep(0.66, 0.74, vLocal.y);
        // glowing spots + a soft magic rim under the cap on the magic species
        float gillGlow = (1.0 - top) * cap * 0.5;
        outgoingLight += vSpot.rgb * vSpot.a * e * (sp * 0.85 + gillGlow * 0.7);
        // bounce light from the lit meadow into the downward-facing gills (they read as cream,
        // not as a dark olive disc)
        outgoingLight += vec3(0.86, 0.80, 0.70) * (1.0 - top) * cap * 0.28;
      }`,
  });
}

function flowerMaterial(uniforms) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  return stylize(m, {
    wrap: 0.6, ramp: 0.4, hue: 0.8, ao: 0, uniforms,
    vertexPars: COMMON_VERT, localVertex: COMMON_LOCAL,
    fragmentPars: /* glsl */ `varying float vPart; varying vec3 vLocal; varying vec4 vSpot; varying float vCircle;\n${ENERGY_PARS}`,
    albedo: /* glsl */ `
      {
        vec3 stem = vec3(0.30, 0.55, 0.22);
        float head = step(0.5, vPart), ctr = step(1.5, vPart);
        diffuseColor.rgb = mix(stem, mix(diffuseColor.rgb, vec3(1.0, 0.93, 0.6), ctr), head);
      }`,
    postLight: /* glsl */ `
      {
        float ctr = step(1.5, vPart);
        float e = fairyEnergy(vCircle) * uFairyBoost;
        outgoingLight += vSpot.rgb * ctr * vSpot.a * e * 1.4;
      }`,
  });
}

// instance attribute helpers
function instAttr(mesh, name, size, data) { mesh.geometry.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(data), size)); }

export function createRingMeshes(circles, uniforms) {
  const group = new THREE.Group();
  group.name = 'FairyRings';
  const rng = makeRng(4242);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
  const up = new THREE.Vector3(0, 1, 0);
  const mush = [], flw = [], stn = [];
  circles.forEach((c, ci) => {
    const pal = CIRCLE_CAPS[c.palette % CIRCLE_CAPS.length];
    // mushrooms: clusters around the ring, a couple of hero toadstools
    const n = Math.round(c.r * 19);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.range(-0.08, 0.08);
      const cluster = 0.5 + 0.5 * Math.sin(a * 3 + ci * 1.7); // bunching
      const count = 1 + (rng() < cluster * 0.7 ? 1 : 0) + (rng() < 0.15 ? 1 : 0);
      for (let k = 0; k < count; k++) {
        const rr = c.r + rng.range(-0.16, 0.16);
        const aa = a + rng.range(-0.06, 0.06) * k;
        const x = c.x + Math.cos(aa) * rr, z = c.z + Math.sin(aa) * rr;
        const hero = rng() < 0.08;
        const size = hero ? rng.range(0.3, 0.4) : rng.range(0.11, 0.24) * (0.75 + 0.5 * cluster);
        const squat = rng.range(0.75, 1.35);
        const capI = pal[Math.floor(rng() * pal.length)];
        const cap = CAPS[capI];
        p.set(x, groundY(x, z) - 0.015, z);
        e.set(rng.range(-0.22, 0.22), rng() * 6.28, rng.range(-0.22, 0.22));
        q.setFromEuler(e);
        s.set(size, size * squat, size);
        mush.push({ m: m4.compose(p, q, s).clone(), col: new THREE.Color(cap.cap).offsetHSL(rng.range(-0.015, 0.015), 0, rng.range(-0.05, 0.05)), spot: new THREE.Color(cap.spot), glow: cap.glow, ci });
      }
    }
    // little star flowers between the mushrooms and scattered just inside the ring
    const fc = FLOWER_COLS[c.palette % FLOWER_COLS.length];
    const nf = Math.round(c.r * 16);
    for (let i = 0; i < nf; i++) {
      const a = rng() * Math.PI * 2, rr = c.r + rng.range(-0.45, 0.3);
      const x = c.x + Math.cos(a) * rr, z = c.z + Math.sin(a) * rr;
      p.set(x, groundY(x, z) - 0.01, z);
      e.set(rng.range(-0.25, 0.25), rng() * 6.28, rng.range(-0.25, 0.25));
      q.setFromEuler(e);
      const h = rng.range(0.12, 0.26), hs = rng.range(0.8, 1.25);
      s.set(hs * h * 2.2, h, hs * h * 2.2);
      flw.push({ m: m4.compose(p, q, s).clone(), col: new THREE.Color(fc[Math.floor(rng() * fc.length)]), glow: rng() < 0.6 ? 1 : 0.3, ci });
    }
    // a few pale mossy stones
    const ns = 4 + Math.floor(rng() * 3);
    for (let i = 0; i < ns; i++) {
      const a = (i / ns) * Math.PI * 2 + rng.range(0, 0.5), rr = c.r + rng.range(-0.1, 0.25);
      const x = c.x + Math.cos(a) * rr, z = c.z + Math.sin(a) * rr;
      p.set(x, groundY(x, z) - 0.02, z);
      q.setFromAxisAngle(up, rng() * 6.28);
      const r0 = rng.range(0.07, 0.14);
      s.set(r0 * rng.range(1, 1.5), r0, r0);
      stn.push({ m: m4.compose(p, q, s).clone(), ci });
    }
  });

  const uni = { ...uniforms };
  const mushMesh = new THREE.InstancedMesh(mushroomGeometry(), mushroomMaterial(uni), mush.length);
  mushMesh.name = 'Fairy_Mushrooms';
  mush.forEach((o, i) => { mushMesh.setMatrixAt(i, o.m); mushMesh.setColorAt(i, o.col); });
  instAttr(mushMesh, 'aCircle', 1, mush.map((o) => o.ci));
  instAttr(mushMesh, 'aSpot', 4, mush.flatMap((o) => [o.spot.r, o.spot.g, o.spot.b, o.glow]));

  const flwMesh = new THREE.InstancedMesh(flowerGeometry(), flowerMaterial(uni), flw.length);
  flwMesh.name = 'Fairy_Flowers';
  flw.forEach((o, i) => { flwMesh.setMatrixAt(i, o.m); flwMesh.setColorAt(i, o.col); });
  instAttr(flwMesh, 'aCircle', 1, flw.map((o) => o.ci));
  instAttr(flwMesh, 'aSpot', 4, flw.flatMap((o) => [o.col.r, o.col.g, o.col.b, o.glow]));

  const stoneMat = stylize(new THREE.MeshLambertMaterial({ color: 0xffffff }), {
    wrap: 0.4, ramp: 0.5, ao: 0,
    vertexPars: 'varying vec3 vObjN;', localVertex: 'vObjN = normal;',
    fragmentPars: 'varying vec3 vObjN;',
    albedo: 'diffuseColor.rgb = mix(vec3(0.78, 0.77, 0.72), vec3(0.42, 0.56, 0.26), smoothstep(0.35, 0.8, vObjN.y));',
  });
  const stnMesh = new THREE.InstancedMesh(stoneGeometry(), stoneMat, stn.length);
  stnMesh.name = 'Fairy_Stones';
  stn.forEach((o, i) => stnMesh.setMatrixAt(i, o.m));

  // glTF export: bake the shader looks into vertex colours (per instance, local space)
  const paint = (g, fn) => {
    const pos = g.attributes.position, part = g.attributes.aPart, nrm = g.attributes.normal, n = pos.count;
    const col = new Float32Array(n * 3), c = new THREE.Color();
    for (let k = 0; k < n; k++) { fn(c, pos.getY(k), part ? part.getX(k) : 0, nrm ? nrm.getY(k) : 1); col.set([c.r, c.g, c.b], k * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  };
  const STEM = new THREE.Color(0.93, 0.89, 0.8), GILL = new THREE.Color(0.86, 0.8, 0.7), FSTEM = new THREE.Color(0.3, 0.55, 0.22);
  const FCTR = new THREE.Color(1.0, 0.93, 0.6), ROCK = new THREE.Color(0.78, 0.77, 0.72), MOSS = new THREE.Color(0.42, 0.56, 0.26);
  mushMesh.userData.exportColorize = (g, i) => paint(g, (c, y, part) => {
    if (part < 0.5) return c.copy(STEM);
    c.copy(GILL).lerp(mush[i].col, THREE.MathUtils.smoothstep(y, 0.585, 0.64));
  });
  flwMesh.userData.exportColorize = (g, i) => paint(g, (c, y, part) => c.copy(part < 0.5 ? FSTEM : part < 1.5 ? flw[i].col : FCTR));
  stnMesh.userData.exportColorize = (g) => paint(g, (c, y, part, ny) => c.copy(ROCK).lerp(MOSS, THREE.MathUtils.smoothstep(ny, 0.35, 0.8)));
  for (const mesh of [mushMesh, flwMesh, stnMesh]) {
    mesh.castShadow = mesh !== flwMesh;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  group.userData.counts = { mushrooms: mush.length, flowers: flw.length, stones: stn.length };
  return group;
}
