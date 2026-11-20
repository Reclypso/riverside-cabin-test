// Fishing rod resting in a forked stick at the dock end: bent tapered blank, cork grip,
// reel, guides, a sagging line down to a red/white bobber that bobs with ripple rings.
import * as THREE from 'three';
import { Builder, logGeo, mtx } from '../cabin/geom.js';
import { getMaterials } from '../cabin/materials.js';
import { DOCK } from '../layout.js';
import { DECK_TOP } from './dock.js';
import { makeRng } from '../../util/rng.js';
import { stylize } from '../../render/stylize.js';

function taperedTube(curve, n, radial, r0, r1) {
  const frames = curve.computeFrenetFrames(n, false);
  const pos = [], nor = [], uv = [], idx = [];
  const len = curve.getLength();
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = curve.getPointAt(t), N = frames.normals[i], B = frames.binormals[i];
    const r = r0 + (r1 - r0) * t;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const d = N.clone().multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
      pos.push(p.x + d.x * r, p.y + d.y * r, p.z + d.z * r); nor.push(d.x, d.y, d.z); uv.push(t * len, j / radial);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

const gloss = (color) => stylize(new THREE.MeshLambertMaterial({ color, vertexColors: true }), {
  postLight: `{ vec3 Vd = normalize(vViewPosition); vec3 H = normalize(Vd + normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz));
    outgoingLight += uSunColor * pow(max(dot(normalize(normal), H), 0.0), 60.0) * 0.8; }`,
});

export function buildFishing() {
  const rng = makeRng(4242);
  const g = new THREE.Group();
  g.name = 'FishingRod';
  g.position.set(DOCK.x, 0, DOCK.z);
  g.rotation.y = DOCK.rot;
  const L = DOCK.len, top = DECK_TOP;
  const mats = { ...getMaterials(), blank: gloss(0x7a2c22), line: stylize(new THREE.MeshLambertMaterial({ color: 0xf4f4ee, vertexColors: true }), { wrap: 1 }) };
  const b = new Builder();

  // forked holder stick nailed to the end beam
  const F = new THREE.Vector3(L - 0.1, top + 0.52, 0.02);
  const fork = logGeo(0.62, 0.022, rng, 6);
  const fm = mtx(F.x, top + 0.2, F.z, 0, 0, Math.PI / 2);
  b.add('plankDark', fork.side, fm); b.add('end', fork.capA, fm); b.add('end', fork.capB, fm);
  for (const s of [-1, 1]) {
    const tine = logGeo(0.16, 0.014, rng, 6);
    const tm = mtx(F.x, F.y - 0.02, F.z + s * 0.035, s * 0.45, 0, Math.PI / 2);
    b.add('plankDark', tine.side, tm); b.add('end', tine.capA, tm); b.add('end', tine.capB, tm);
  }

  // rod: butt on the deck beside the chair, through the fork, tip drooping over the water
  const B = new THREE.Vector3(L - 1.2, top + 0.04, 0.22);
  const d = F.clone().sub(B).normalize();
  const P = (k, droop) => B.clone().addScaledVector(d, k).add(new THREE.Vector3(0, -droop, 0));
  const rodLen = 3.2;
  const curve = new THREE.CatmullRomCurve3([P(0, 0), P(1.2, 0), P(2.2, 0.05), P(2.8, 0.14), P(rodLen, 0.32)]);
  b.add('blank', taperedTube(curve, 48, 8, 0.012, 0.0035));
  const grip = new THREE.LineCurve3(P(0.02, 0), P(0.42, 0));
  b.add('cork', taperedTube(grip, 4, 10, 0.021, 0.018));
  b.add('iron', taperedTube(new THREE.LineCurve3(P(-0.01, 0), P(0.03, 0)), 1, 10, 0.024, 0.024));
  // reel hanging under the rod
  const R = P(0.55, 0.075), side = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
  const reelM = new THREE.Matrix4().lookAt(new THREE.Vector3(), side, new THREE.Vector3(0, 1, 0)).setPosition(R);
  b.add('steel', new THREE.CylinderGeometry(0.042, 0.042, 0.04, 16), reelM.clone().multiply(mtx(0, 0, 0, Math.PI / 2, 0, 0)));
  b.add('iron', new THREE.CylinderGeometry(0.03, 0.03, 0.045, 12), reelM.clone().multiply(mtx(0, 0, 0, Math.PI / 2, 0, 0)));
  b.add('iron', new THREE.BoxGeometry(0.012, 0.07, 0.012), mtx(R.x, R.y + 0.04, R.z));
  b.add('iron', new THREE.BoxGeometry(0.06, 0.008, 0.01), reelM.clone().multiply(mtx(0.025, 0, 0.03)));
  b.add('cork', new THREE.CylinderGeometry(0.008, 0.008, 0.03, 6), reelM.clone().multiply(mtx(0.05, 0, 0.045, Math.PI / 2, 0, 0)));
  // guides
  for (const k of [0.32, 0.5, 0.66, 0.8, 0.92]) {
    const t = curve.getPointAt(k), tan = curve.getTangentAt(k);
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), tan, new THREE.Vector3(0, 1, 0)).setPosition(t.x, t.y - 0.012, t.z);
    b.add('iron', new THREE.TorusGeometry(0.009 * (1.3 - k * 0.6), 0.0022, 4, 10), m);
  }
  // line: tip -> sag -> bobber on the water
  const tip = curve.getPointAt(1);
  const bob = new THREE.Vector3(L + 3.1, 0.0, 0.95);
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const p = tip.clone().lerp(bob, t);
    p.y += 0.04 - 0.35 * Math.sin(Math.PI * t) * (1 - t * 0.6) + 0.05 * t;
    pts.push(p);
  }
  b.add('line', taperedTube(new THREE.CatmullRomCurve3(pts), 48, 4, 0.006, 0.006));

  const meshes = b.build(mats, 'FishingRod');
  for (const m of meshes.children) if (/line/.test(m.name)) m.castShadow = false;
  g.add(...meshes.children);

  // bobber + ripple rings (animated)
  const bobber = new THREE.Group();
  bobber.name = 'FishingRod_Bobber';
  const top_ = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.bobberRed);
  const bot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mats.bobberWhite);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 6), mats.bobberWhite);
  stem.position.y = 0.075;
  bobber.add(top_, bot, stem);
  bobber.position.copy(bob);
  g.add(bobber);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false });
  const rings = [0, 1].map((i) => {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 48), ringMat.clone());
    r.rotation.x = -Math.PI / 2;
    r.position.set(bob.x, 0.015, bob.z);
    r.renderOrder = 3;
    r.name = `FishingRod_Ripple${i}`;
    r.userData.noExport = true;
    g.add(r);
    return r;
  });
  g.update = (t) => {
    bobber.position.y = bob.y + 0.012 * Math.sin(t * 2.1) + 0.006 * Math.sin(t * 3.7 + 1);
    bobber.rotation.z = 0.12 * Math.sin(t * 1.7);
    bobber.rotation.x = 0.08 * Math.sin(t * 2.3 + 0.5);
    rings.forEach((r, i) => {
      const ph = ((t * 0.38 + i * 0.5) % 1 + 1) % 1;
      const s = 0.07 + 0.55 * ph;
      r.scale.set(s, s, s);
      r.material.opacity = 0.42 * (1 - ph) * Math.min(1, ph * 6);
      r.layers.disable(1);
    });
  };
  return g;
}
