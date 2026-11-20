// Distant backdrop: a polar ring of terrain (same height function and ground shader as the
// play area, continuing into mountains and the river valley). Distant forests are tree
// impostors placed by trees/farForest.js.
import * as THREE from 'three';
import { computeHeight } from './heightfield.js';
import { TERRAIN_SIZE } from './layout.js';

const HALF = TERRAIN_SIZE / 2;

function ringGeometry() {
  const segA = 420, rows = 90, r0 = 108, r1 = 1700;
  const pos = [], idx = [];
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    const r = r0 * Math.pow(r1 / r0, Math.pow(t, 0.85));
    for (let i = 0; i < segA; i++) {
      const a = (i / segA) * Math.PI * 2;
      const x = -2 + Math.cos(a) * r, z = -6 + Math.sin(a) * r;
      let y = computeHeight(x, z);
      // hide under the play terrain where they overlap (avoids z-fighting)
      if (Math.abs(x) < HALF - 0.5 && Math.abs(z) < HALF - 0.5) y -= 0.8;
      pos.push(x, y, z);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < segA; i++) {
      const a = j * segA + i, b = j * segA + ((i + 1) % segA), c = a + segA, d = b + segA;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export async function createBackdrop({ root }) {
  const group = new THREE.Group();
  group.name = 'Backdrop';
  group.userData.noExport = true;
  const terrain = root.getObjectByName('Terrain');
  const ring = new THREE.Mesh(ringGeometry(), terrain.material);
  ring.name = 'Backdrop_Terrain';
  ring.receiveShadow = false;
  group.add(ring); // distant trees are impostors now (trees/impostors.js)
  return group;
}
