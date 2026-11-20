// Rustic split-rail fence following the east side of the approach path, with a couple of
// leaning posts and one fallen rail; plus a short section by the cabin yard.
import * as THREE from 'three';
import { PATHS } from '../layout.js';
import { groundY, pathDist } from '../heightfield.js';
import { Builder, logGeo } from '../cabin/geom.js';
import { getMaterials } from '../cabin/materials.js';
import { rgb } from '../cabin/logWalls.js';
import { makeRng } from '../../util/rng.js';

const tint = (rng) => { const k = rng.range(0.7, 0.95); return rgb([k, k * 0.97, k * 0.92]); };

function logBetween(b, rng, A, B, r, segs = 6, key = 'weathered') {
  const d = new THREE.Vector3().subVectors(B, A);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
  const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rng() * 6.28);
  const m = new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q.multiply(roll), new THREE.Vector3(1, 1, 1));
  const g = logGeo(len, r, rng, segs);
  b.add(key, g.side, m, tint(rng));
  b.add('end', g.capA, m, tint(rng)); b.add('end', g.capB, m, tint(rng));
}

// posts along a polyline [[x,z]...], every `step` metres
function fenceRun(b, rng, line, step, { leanIdx = [], brokenIdx = -1 } = {}) {
  const posts = [];
  let acc = step;
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1], [bx, bz] = line[i];
    const seg = Math.hypot(bx - ax, bz - az);
    let t = 0;
    while (acc + (seg - t) >= step) {
      t += step - acc; acc = 0;
      const k = t / seg;
      posts.push([ax + (bx - ax) * k, az + (bz - az) * k]);
    }
    acc += seg - t;
  }
  const tops = posts.map(([x, z], i) => {
    const y = groundY(x, z);
    const lean = leanIdx.includes(i) ? 0.2 : 0.05;
    const dir = new THREE.Vector3(rng.range(-1, 1), 0, rng.range(-1, 1)).normalize().multiplyScalar(lean);
    const top = new THREE.Vector3(x + dir.x * 1.1, y + 1.08, z + dir.z * 1.1);
    logBetween(b, rng, new THREE.Vector3(x, y - 0.25, z), top, 0.075, 7, 'log');
    return { x, z, y, top };
  });
  for (let i = 1; i < tops.length; i++) {
    const A = tops[i - 1], B = tops[i];
    for (const [h, sag] of [[0.42, 0.03], [0.86, 0.05]]) {
      if (i === brokenIdx && h > 0.5) continue;
      const pa = new THREE.Vector3().lerpVectors(new THREE.Vector3(A.x, A.y, A.z), A.top, h / 1.08);
      const pb = new THREE.Vector3().lerpVectors(new THREE.Vector3(B.x, B.y, B.z), B.top, h / 1.08);
      pa.y -= rng.range(0, sag); pb.y -= rng.range(0, sag);
      logBetween(b, rng, pa, pb, rng.range(0.045, 0.06), 5);
    }
    if (i === brokenIdx) { // fallen rail resting against the post
      const mid = new THREE.Vector3((A.x + B.x) / 2, 0, (A.z + B.z) / 2);
      const pa = new THREE.Vector3(A.x + 0.3, A.y + 0.55, A.z), pb = new THREE.Vector3(mid.x + 0.5, groundY(mid.x + 0.5, mid.z + 0.3) + 0.05, mid.z + 0.3);
      logBetween(b, rng, pa, pb, 0.05, 5);
    }
  }
}

export function buildFence() {
  const rng = makeRng(6006);
  const b = new Builder();
  // offset path 0 (approach) to its east (+1) or west (-1) side between zMin and zMax
  const pts = PATHS[0].pts;
  const offsetLine = (zMin, zMax, side) => {
    const line = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x, z] = pts[i], [nx, nz] = pts[i + 1];
      if (z < zMin || z > zMax) continue;
      const l = Math.hypot(nx - x, nz - z);
      let ex = -(nz - z) / l, ez = (nx - x) / l;
      if (ex < 0) { ex = -ex; ez = -ez; }
      const px = x + ex * 1.95 * side, pz = z + ez * 1.95 * side;
      if (pathDist(px, pz) > 0.3) line.push([px, pz]);
    }
    return line.reverse();
  };
  fenceRun(b, rng, offsetLine(11, 35, 1), 2.6, { leanIdx: [3, 7], brokenIdx: 5 });
  // a shorter run on the west side so the approach reads as a lane
  fenceRun(b, rng, offsetLine(17, 30, -1), 2.6, { leanIdx: [2] });
  const group = b.build(getMaterials(), 'Fence');
  group.name = 'Fence';
  return group;
}
