// Dense instanced meadow: clumps scattered over 10 m tiles (frustum-culled per tile),
// with a per-tile distance LOD that trims the (shuffled) instance count.
import * as THREE from 'three';
import { createClumpGeometry } from './grassGeometry.js';
import { createGrassMaterial } from './grassMaterial.js';
import { groundY, pathDist, riverAt, riverHalfWidth } from '../heightfield.js';
import { inCabinFootprint, DOCK, WOODPILE, CHOPPING, RIVER_ROCKS, SAWHORSE, YARD_PROPS } from '../layout.js';
import { makeRng } from '../../util/rng.js';
import { noise, smoothstep } from '../../util/noise.js';

const TILE = 10;
const AREA = { x0: -80, x1: 70, z0: -80, z1: 70 };
const DENSITY = 3.4; // clumps per m^2 at full density

// 0 = no grass, otherwise a height multiplier
export function grassHeightAt(x, z) {
  const h = groundY(x, z);
  if (h < 0.12) return 0;
  const pd = pathDist(x, z) + (noise.n2(x * 0.9, z * 0.9) * 0.22);
  if (pd < 0.05) return 0;
  if (inCabinFootprint(x, z, -0.2)) return 0;
  const dd = Math.hypot(x - (DOCK.x + 0.4), z - DOCK.z);
  if (dd < 0.9) return 0;
  if (Math.hypot(x - WOODPILE.x, z - WOODPILE.z) < 1.6 || Math.hypot(x - CHOPPING.x, z - CHOPPING.z) < 1.1) return 0;
  if (Math.hypot(x - SAWHORSE.x, z - SAWHORSE.z) < 1.0 || Math.hypot(x - YARD_PROPS.x, z - YARD_PROPS.z) < 1.2) return 0;
  if (Math.hypot(x - DOCK.x, z - DOCK.z) < 1.4) return 0;
  for (const r of RIVER_ROCKS) if (Math.hypot(x - r.x, z - r.z) < r.r) return 0;
  let k = 0.65 + 0.75 * (noise.fbm2(x * 0.07 + 40, z * 0.07, 3) * 0.5 + 0.5);
  k *= 0.45 + 0.55 * smoothstep(0.05, 1.6, pd); // trimmed along path edges
  k *= 0.4 + 0.6 * smoothstep(0.12, 0.55, h); // short on the wet bank
  if (inCabinFootprint(x, z, 1.2)) k *= 0.55;
  const [rd, s] = riverAt(x, z);
  const hw = riverHalfWidth(s);
  k *= 1 + 0.35 * (1 - smoothstep(hw + 0.5, hw + 4, rd)) * smoothstep(0.15, 0.5, h); // lush bank tufts
  return k;
}

export async function createGrass() {
  const group = new THREE.Group();
  group.name = 'Grass';
  group.userData.reflect = false;
  group.userData.noExport = true; // regenerated procedurally in the engine
  const geo = createClumpGeometry();
  const mat = createGrassMaterial();
  const rng = makeRng(77);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const tiles = [];
  let total = 0;
  for (let tz = AREA.z0; tz < AREA.z1; tz += TILE) {
    for (let tx = AREA.x0; tx < AREA.x1; tx += TILE) {
      const want = Math.round(TILE * TILE * DENSITY);
      const mats = [];
      for (let i = 0; i < want; i++) {
        const x = tx + rng() * TILE, z = tz + rng() * TILE;
        const k = grassHeightAt(x, z);
        if (k <= 0) continue;
        const s = 0.62 * k * (0.75 + rng() * 0.5);
        p.set(x, groundY(x, z) - 0.03, z);
        q.setFromAxisAngle(UP, rng() * Math.PI * 2);
        sc.set(0.85 + rng() * 0.4, s, 0.85 + rng() * 0.4);
        mats.push(m4.compose(p, q, sc).clone());
      }
      if (!mats.length) continue;
      // shuffle so any prefix is a uniform subset (distance LOD)
      for (let i = mats.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [mats[i], mats[j]] = [mats[j], mats[i]]; }
      const mesh = new THREE.InstancedMesh(geo, mat, mats.length);
      mats.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.name = `Grass_${tx}_${tz}`;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.computeBoundingSphere();
      mesh.userData.full = mats.length;
      mesh.userData.centre = new THREE.Vector3(tx + TILE / 2, groundY(tx + TILE / 2, tz + TILE / 2), tz + TILE / 2);
      group.add(mesh);
      tiles.push(mesh);
      total += mats.length;
    }
  }
  console.log('grass clumps', total, 'tiles', tiles.length);
  group.update = (t, dt, camera) => {
    const c = camera.position;
    for (const m of tiles) {
      const d = m.userData.centre.distanceTo(c);
      const f = d < 32 ? 1 : d < 75 ? 1 - 0.55 * (d - 32) / 43 : d < 120 ? 0.45 - 0.25 * (d - 75) / 45 : 0.2;
      m.count = Math.max(1, Math.floor(m.userData.full * f));
    }
  };
  return group;
}
