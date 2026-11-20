// Stone chimney on the east gable (wide firebox base, shoulder, slim stack through the roof
// overhang, cap slab) and the stone foundation course under the log walls.
import * as THREE from 'three';
import { pillowGeo, mtx, boardGeo } from './geom.js';
import { DIM } from './dims.js';
import { rgb } from './logWalls.js';
import { makeRng } from '../../util/rng.js';

const STONE = pillowGeo(0.5, 2);

export function stoneTint(rng) {
  const k = rng.range(0.66, 1.0), warm = rng.range(-0.03, 0.07);
  return rgb([k * (1 + warm), k * (1 + warm * 0.3), k * (1 - warm) * rng.range(0.97, 1.03)]);
}

// Lay courses of stones along one face. face: origin (x,z), dir (unit along face), normal.
function layFace(builder, rng, { ox, oz, dx, dz, nx, nz, len, y0, y1 }) {
  let y = y0;
  let row = 0;
  while (y < y1 - 0.05) {
    const h = Math.min(rng.range(0.16, 0.3), y1 - y);
    let t = row % 2 ? -rng.range(0.05, 0.2) : -rng.range(0, 0.06);
    while (t < len) {
      const L = rng() < 0.2 ? rng.range(0.5, 0.7) : rng.range(0.2, 0.44);
      const c = Math.min(t + L / 2, len);
      const hh = h * rng.range(0.78, 1.0);
      const depth = rng.range(0.16, 0.26);
      const out = rng.range(-0.01, 0.05);
      const px = ox + dx * c + nx * (out - depth / 2 + 0.06), pz = oz + dz * c + nz * (out - depth / 2 + 0.06);
      const yaw = Math.atan2(-dz, dx);
      builder.add('stone', STONE, mtx(px, y + h / 2 + rng.range(-0.02, 0.02), pz, rng.range(-0.06, 0.06), yaw + rng.range(-0.07, 0.07), rng.range(-0.09, 0.09), L * 1.06, hh * 1.12, depth), stoneTint(rng));
      t += L + 0.01;
    }
    y += h + 0.008;
    row++;
  }
}

function box(builder, rng, x0, x1, y0, y1, z0, z1, faces) {
  // mortar core
  builder.add('mortar', new THREE.BoxGeometry(x1 - x0 - 0.06, y1 - y0, z1 - z0 - 0.06), mtx((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
  const F = {
    px: { ox: x1, oz: z1, dx: 0, dz: -1, nx: 1, nz: 0, len: z1 - z0 },
    nx: { ox: x0, oz: z0, dx: 0, dz: 1, nx: -1, nz: 0, len: z1 - z0 },
    pz: { ox: x0, oz: z1, dx: 1, dz: 0, nx: 0, nz: 1, len: x1 - x0 },
    nz: { ox: x1, oz: z0, dx: -1, dz: 0, nx: 0, nz: -1, len: x1 - x0 },
  };
  for (const f of faces) layFace(builder, rng, { ...F[f], y0, y1 });
}

export function buildChimney(builder) {
  const rng = makeRng(31);
  const x0 = DIM.w / 2 + 0.02;
  const topY = DIM.ridgeY + 0.95;
  // firebox base
  box(builder, rng, x0, x0 + 1.0, -0.25, 2.45, -0.78, 0.78, ['px', 'pz', 'nz']);
  // shoulder
  box(builder, rng, x0 + 0.06, x0 + 0.92, 2.45, 2.9, -0.6, 0.6, ['px', 'pz', 'nz']);
  // stack
  box(builder, rng, x0 + 0.14, x0 + 0.86, 2.9, topY, -0.4, 0.4, ['px', 'pz', 'nz', 'nx']);
  // cap slab + flue
  builder.add('stone', STONE, mtx(x0 + 0.5, topY + 0.06, 0, 0, 0.03, 0, 0.92, 0.12, 1.0), rgb([0.86, 0.86, 0.88]));
  builder.add('iron', new THREE.BoxGeometry(0.34, 0.06, 0.4), mtx(x0 + 0.5, topY + 0.1, 0), 0x111111);
  return new THREE.Vector3(x0 + 0.5, topY + 0.14, 0); // smoke origin (cabin local)
}

export function buildFoundation(builder) {
  const rng = makeRng(57);
  const { w, d, found } = DIM;
  const y0 = -0.2, y1 = found + 0.01;
  // one generous course under each wall, slightly proud of the logs
  const hw = w / 2 + 0.06, hd = d / 2 + 0.06;
  layFace(builder, rng, { ox: -hw, oz: hd, dx: 1, dz: 0, nx: 0, nz: 1, len: hw * 2, y0, y1 });
  layFace(builder, rng, { ox: hw, oz: -hd, dx: -1, dz: 0, nx: 0, nz: -1, len: hw * 2, y0, y1 });
  layFace(builder, rng, { ox: -hw, oz: -hd, dx: 0, dz: 1, nx: -1, nz: 0, len: hd * 2, y0, y1 });
  layFace(builder, rng, { ox: hw, oz: hd, dx: 0, dz: -1, nx: 1, nz: 0, len: hd * 2, y0, y1 });
  builder.add('mortar', new THREE.BoxGeometry(w, y1 - y0 - 0.02, d), mtx(0, (y0 + y1) / 2 - 0.01, 0));
  // hearth slab for the porch steps
  builder.add('stone', STONE, mtx(DIM.door.x, 0.0, d / 2 + DIM.porch + 0.95, 0, 0.05, 0, 1.15, 0.1, 0.55), stoneTint(rng));
  void boardGeo;
}
