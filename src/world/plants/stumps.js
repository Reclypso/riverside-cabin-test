// Woodcutting dressing in the grove clearing: stumps with end-grain rings, a felled log and
// a few red-cap mushrooms.
import * as THREE from 'three';
import { barkTexture } from '../trees/barkTextures.js';
import { stylize } from '../../render/stylize.js';
import { groundY, pathDist } from '../heightfield.js';
import { GROVE } from '../layout.js';
import { makeRng } from '../../util/rng.js';

function endGrainTexture() {
  const s = 256, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#d9b27a'; ctx.fillRect(0, 0, s, s);
  for (let r = 6; r < s * 0.5; r += 7 + Math.sin(r) * 2) {
    ctx.strokeStyle = `rgba(150,100,55,${0.25 + 0.2 * Math.sin(r * 0.3)})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(s / 2 + 3, s / 2 - 2, r, r * 0.96, 0.2, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(110,70,40,0.55)'; ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) { const a = i * 1.7 + 0.4; ctx.beginPath(); ctx.moveTo(s / 2, s / 2); ctx.lineTo(s / 2 + Math.cos(a) * s * 0.4, s / 2 + Math.sin(a) * s * 0.4); ctx.stroke(); }
  const bark = ctx.createRadialGradient(s / 2, s / 2, s * 0.42, s / 2, s / 2, s * 0.5);
  bark.addColorStop(0, 'rgba(90,60,38,0)'); bark.addColorStop(0.3, 'rgba(90,60,38,1)');
  ctx.fillStyle = bark; ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function stumpGeometry(rng, r, h) {
  const g = new THREE.CylinderGeometry(r, r * 1.35, h, 14, 3, true);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const root = y < -h * 0.2 ? 1 + 0.18 * Math.max(0, Math.sin(a * 5 + 1)) : 1;
    pos.setXYZ(i, x * root, y + h / 2 + (y > 0 ? Math.sin(a) * 0.05 : 0), z * root);
  }
  g.computeVertexNormals();
  return g;
}

export function createStumps() {
  const rng = makeRng(4242);
  const group = new THREE.Group();
  group.name = 'GroveDressing';
  const barkMat = stylize(new THREE.MeshLambertMaterial({ map: barkTexture('oak'), color: 0xc2a58a }), { wrap: 0.35 });
  const grainMat = stylize(new THREE.MeshLambertMaterial({ map: endGrainTexture() }), { wrap: 0.3 });
  const spots = [[2.6, 1.8, 0.4], [-2.4, -1.4, 0.34], [0.6, -3.4, 0.3]];
  for (const [dx, dz, r] of spots) {
    const x = GROVE.x + dx, z = GROVE.z + dz;
    if (pathDist(x, z) < 0.4) continue;
    const h = 0.35 + rng() * 0.25, y = groundY(x, z) - 0.06;
    const side = new THREE.Mesh(stumpGeometry(rng, r, h), barkMat);
    const top = new THREE.Mesh(new THREE.CircleGeometry(r, 18).rotateX(-Math.PI / 2), grainMat);
    top.position.y = h + 0.0;
    top.rotation.z = 0.06;
    const stump = new THREE.Group();
    stump.name = 'TreeStump';
    stump.add(side, top);
    stump.position.set(x, y, z);
    stump.rotation.y = rng() * 6.28;
    group.add(stump);
  }
  // felled log with a branch stub, lying across the edge of the clearing
  const log = new THREE.Group();
  log.name = 'FelledLog';
  const L = 3.6, R = 0.3;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.92, R, L, 14, 1, true).rotateZ(Math.PI / 2), barkMat);
  const capA = new THREE.Mesh(new THREE.CircleGeometry(R * 0.92, 16).rotateY(Math.PI / 2), grainMat);
  capA.position.x = L / 2;
  const capB = new THREE.Mesh(new THREE.CircleGeometry(R, 16).rotateY(-Math.PI / 2), grainMat);
  capB.position.x = -L / 2;
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.6, 7).translate(0, 0.3, 0), barkMat);
  stub.position.set(0.4, R * 0.7, 0); stub.rotation.z = -0.6;
  log.add(body, capA, capB, stub);
  const lx = GROVE.x - 3.6, lz = GROVE.z + 3.2;
  log.position.set(lx, groundY(lx, lz) + R * 0.75, lz);
  log.rotation.y = 0.5;
  group.add(log);
  // mushrooms
  const capMat = stylize(new THREE.MeshLambertMaterial({ color: 0xd8432e }), { wrap: 0.4 });
  const stemMat = stylize(new THREE.MeshLambertMaterial({ color: 0xf1e6cf }), { wrap: 0.4 });
  const capGeo = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1);
  const stemGeo = new THREE.CylinderGeometry(0.35, 0.45, 1, 8).translate(0, 0.5, 0);
  for (let i = 0; i < 9; i++) {
    const a = rng() * 6.28, rr = rng.range(4.5, 7.5);
    const x = GROVE.x + Math.cos(a) * rr, z = GROVE.z + Math.sin(a) * rr;
    if (pathDist(x, z) < 0.5) continue;
    const s = rng.range(0.05, 0.1), y = groundY(x, z);
    const m = new THREE.Group();
    m.name = 'Mushroom';
    const st = new THREE.Mesh(stemGeo, stemMat); st.scale.set(s, s * 1.8, s);
    const cp = new THREE.Mesh(capGeo, capMat); cp.scale.setScalar(s * 1.5); cp.position.y = s * 1.75;
    m.add(st, cp);
    m.position.set(x, y - 0.02, z);
    m.rotation.set(rng.range(-0.15, 0.15), 0, rng.range(-0.15, 0.15));
    group.add(m);
  }
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return group;
}
