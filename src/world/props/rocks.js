// Stylised boulders: displaced icosphere + a few planar cuts (chunky facets, soft normals),
// mossy tops from the shader. River rocks (layout.RIVER_ROCKS) sit on the bed and break the
// surface; bank clusters along the shore; a few meadow/path rocks and a big grove boulder.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RIVER, RIVER_ROCKS, DOCK, dockLocal, inCabinFootprint } from '../layout.js';
import { groundY, pathDist, riverAt, riverHalfWidth } from '../heightfield.js';
import { Builder, mtx } from '../cabin/geom.js';
import { getMaterials } from '../cabin/materials.js';
import { rgb } from '../cabin/logWalls.js';
import { makeRng } from '../../util/rng.js';
import { makeNoise } from '../../util/noise.js';

function rockGeo(seed) {
  const rng = makeRng(seed);
  const nz = makeNoise(seed);
  let g = new THREE.IcosahedronGeometry(1, 3);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g);
  const p = g.attributes.position, v = new THREE.Vector3();
  const cuts = [];
  for (let i = 0; i < 7; i++) {
    const n = new THREE.Vector3(rng.range(-1, 1), rng.range(-0.2, 1), rng.range(-1, 1)).normalize();
    cuts.push([n, rng.range(0.62, 0.86)]);
  }
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + 0.16 * nz.fbm3(v.x * 1.4, v.y * 1.4, v.z * 1.4, 3));
    for (const [n, d] of cuts) { const k = v.dot(n); if (k > d) v.addScaledVector(n, -(k - d) * 0.92); }
    if (v.y < -0.3) v.y = -0.3 + (v.y + 0.3) * 0.25;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g.computeBoundingBox();
  // uv from triplanar-ish projection for the stone texture
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) * 0.7 + p.getZ(i) * 0.3; uv[i * 2 + 1] = p.getY(i) * 0.7 + p.getZ(i) * 0.4; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

const tint = (rng) => { const k = rng.range(0.72, 1.0), w = rng.range(-0.03, 0.05); return rgb([k * (1 + w), k, k * (1 - w) * rng.range(0.98, 1.05)]); };

function okSpot(x, z, clear = 0.7) {
  if (pathDist(x, z) < clear) return false;
  if (inCabinFootprint(x, z, 2.0)) return false;
  // keep the dock and its approach clear
  for (let a = -1; a <= DOCK.len + 1; a += 0.5) {
    const [dx, dz] = dockLocal(a, 0);
    if (Math.hypot(x - dx, z - dz) < DOCK.w / 2 + 1.0) return false;
  }
  return true;
}

export function buildRocks() {
  const rng = makeRng(5150);
  const variants = Array.from({ length: 7 }, (_, i) => rockGeo(101 + i * 13));
  const b = new Builder();
  const place = (x, z, sx, sy, sz, { sink = 0.25, yaw = rng() * 6.28, y = null, v = rng.int(0, variants.length - 1) } = {}) => {
    const g = variants[v];
    const yb = y ?? groundY(x, z) - sink * sy;
    b.add('rock', g, mtx(x, yb + 0.3 * sy, z, rng.range(-0.12, 0.12), yaw, rng.range(-0.12, 0.12), sx, sy, sz), tint(rng));
  };

  // river rocks: base below the bed, crown h above the water, radius r at the waterline
  for (const r of RIVER_ROCKS) {
    const bed = groundY(r.x, r.z);
    const bottom = bed - 0.3, top = r.h;
    const sy = (top - bottom) / 1.3; // shape spans y in [-0.3, ~1]
    const cy = bottom + 0.3 * sy;
    const f = Math.min(0.9, Math.max(0, (0 - cy) / sy));
    const sx = (r.r * 1.05) / Math.sqrt(1 - f * f);
    b.add('rock', variants[(r.x * 7 | 0) % variants.length], mtx(r.x, cy, r.z, rng.range(-0.08, 0.08), rng() * 6.28, rng.range(-0.08, 0.08), sx, sy, sx * rng.range(0.8, 1.05)), tint(rng));
  }

  // bank clusters along the shore within the play area
  const pts = RIVER.pts;
  let placed = 0;
  for (let i = 0; i < pts.length && placed < 15; i += 7) {
    const [px, pz] = pts[i];
    if (Math.abs(px) > 42 || Math.abs(pz) > 40) continue;
    if (rng() > 0.42) continue;
    const s = riverAt(px, pz)[1];
    const hw = riverHalfWidth(s);
    const a = i + 1 < pts.length ? Math.atan2(pts[i + 1][1] - pz, pts[i + 1][0] - px) : 0;
    const side = rng.sign();
    const off = hw + rng.range(-0.4, 1.6);
    const cx = px - Math.sin(a) * off * side, cz = pz + Math.cos(a) * off * side;
    const gh = groundY(cx, cz);
    if (gh < -0.35 || gh > 0.7 || !okSpot(cx, cz)) continue;
    const n = rng.int(1, 3);
    for (let k = 0; k < n; k++) {
      const x = cx + rng.range(-0.9, 0.9), z = cz + rng.range(-0.9, 0.9);
      const sc = (k === 0 ? rng.range(0.35, 0.7) : rng.range(0.14, 0.35));
      if (!okSpot(x, z, 0.4)) continue;
      place(x, z, sc * rng.range(1.0, 1.4), sc * rng.range(0.6, 0.95), sc * rng.range(0.9, 1.25), { sink: 0.3 });
    }
    placed++;
  }

  // meadow / path-side rocks and the big mossy grove boulder
  const hand = [
    [-20, -22, 1.5, 1.15, 1.3], [-18.6, -21.2, 0.5, 0.4, 0.55], [-21.6, -23.6, 0.35, 0.28, 0.4],
    [-8.9, 17.5, 0.45, 0.32, 0.5], [-3.2, 27.5, 0.3, 0.22, 0.35], [-16.2, 6.2, 0.4, 0.3, 0.38],
    [4.4, 11.2, 0.42, 0.3, 0.5], [7.9, 4.2, 0.32, 0.24, 0.3], [-29, -12, 0.7, 0.55, 0.6],
    [2.5, -9, 0.45, 0.33, 0.4], [-12.5, -15, 0.35, 0.25, 0.32], [14, -18, 0.6, 0.45, 0.55],
  ];
  for (const [x, z, sx, sy, sz] of hand) if (okSpot(x, z, 0.3)) place(x, z, sx, sy, sz, { sink: 0.22 });

  const group = b.build(getMaterials(), 'Rocks');
  group.name = 'Rocks';
  return group;
}
