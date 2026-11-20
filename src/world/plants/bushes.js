// Fluffy leaf-card bushes (same foliage technique as the trees), instanced in a few variants.
import * as THREE from 'three';
import { buildCanopyGeometry } from '../trees/canopy.js';
import { paintLeafClump } from '../trees/leafTextures.js';
import { leafMaterial } from '../trees/treeMaterials.js';
import { makeRng } from '../../util/rng.js';

const P = { cards: 46, clusterR: 0.62, cardSize: 0.72, squash: 0.85, tintVar: 0.14 };

function bushSkeleton(rng) {
  const clusters = [];
  const n = rng.int(3, 5);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, r = i === 0 ? 0 : rng.range(0.35, 0.65);
    clusters.push({ c: new THREE.Vector3(Math.cos(a) * r, rng.range(0.45, 0.75) + (i === 0 ? 0.15 : 0), Math.sin(a) * r), r: rng.range(0.5, 0.7) });
  }
  const centre = new THREE.Vector3(0, 0.35, 0);
  let radius = 0, minY = 0, maxY = 0;
  for (const c of clusters) { radius = Math.max(radius, c.c.distanceTo(centre) + c.r); maxY = Math.max(maxY, c.c.y + c.r); }
  return { clusters, canopy: { centre, radius, minY, maxY }, height: 2.5 };
}

export function createBushes(spots) {
  const group = new THREE.Group();
  group.name = 'Bushes';
  const tex = paintLeafClump('round', { seed: 71, count: 60, leafLen: 0.2 });
  const mat = leafMaterial(tex, new THREE.Color(0x5aa443));
  const tints = [0xffffff, 0xd9eebf, 0xbfe0c8, 0xf0f5c0];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (let v = 0; v < 3; v++) {
    const list = spots.filter((_, i) => i % 3 === v);
    if (!list.length) continue;
    const rng = makeRng(900 + v * 17);
    const geo = buildCanopyGeometry(bushSkeleton(rng), P, rng);
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((b, i) => {
      p.set(b.x, b.y - 0.1, b.z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rot);
      s.set(b.s, b.s * (0.85 + (i % 3) * 0.1), b.s);
      im.setMatrixAt(i, m4.compose(p, q, s));
      im.setColorAt(i, new THREE.Color(tints[(i + v) % tints.length]));
    });
    im.name = `Bush_v${v}`;
    im.castShadow = true; im.receiveShadow = true;
    im.customDepthMaterial = mat.userData.depth;
    im.computeBoundingSphere();
    group.add(im);
  }
  return group;
}
