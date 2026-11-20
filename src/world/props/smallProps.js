// Yard clutter: rain barrel and crates by the cabin, and a wooden signpost at the path fork
// with burnt-in icons pointing to the dock (fish) and the grove (tree).
import * as THREE from 'three';
import { cabinLocal, DOCK, GROVE } from '../layout.js';
import { groundY } from '../heightfield.js';
import { Builder, boardGeo, logGeo, mtx } from '../cabin/geom.js';
import { getMaterials } from '../cabin/materials.js';
import { rgb } from '../cabin/logWalls.js';
import { buildBarrel, buildCrate, buildBucket } from './furniture.js';
import { stylize } from '../../render/stylize.js';
import { makeRng } from '../../util/rng.js';

function iconTexture(kind) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  const draw = (color, lw) => {
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    if (kind === 'fish') {
      g.ellipse(58, 32, 30, 15, 0, 0, Math.PI * 2); g.moveTo(86, 32); g.lineTo(108, 18); g.lineTo(108, 46); g.closePath();
      g.stroke(); g.beginPath(); g.arc(42, 28, 3, 0, Math.PI * 2); g.fill();
    } else {
      g.arc(52, 26, 18, 0, Math.PI * 2); g.moveTo(52, 44); g.lineTo(52, 58); g.stroke();
      g.beginPath(); g.moveTo(82, 18); g.lineTo(104, 50); g.moveTo(78, 22); g.lineTo(92, 12); g.lineTo(98, 24); g.stroke();
    }
  };
  draw('rgba(255,236,200,0.55)', 9);
  draw('#3a2414', 5);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildSign(b, rng) {
  const g = logGeo(1.75, 0.06, rng, 7);
  const pm = mtx(0, 0.8, 0, 0, 0, Math.PI / 2);
  b.add('log', g.side, pm, rgb([0.8, 0.78, 0.75])); b.add('end', g.capA, pm); b.add('end', g.capB, pm);
  const decals = [];
  const tri = new THREE.Shape(); tri.moveTo(0, -0.1); tri.lineTo(0.14, 0); tri.lineTo(0, 0.1); tri.lineTo(0, -0.1);
  const tip = new THREE.ExtrudeGeometry(tri, { depth: 0.035, bevelEnabled: false });
  tip.translate(0, 0, -0.0175);
  const targets = [['fish', DOCK.x + 3, DOCK.z, 1.42], ['tree', GROVE.x, GROVE.z, 1.15]];
  return { targets, tip, decals };
}

export function buildSmallProps() {
  const rng = makeRng(3131);
  const mats = getMaterials();
  const group = new THREE.Group();
  group.name = 'YardProps';

  const yard = new Builder();
  const put = (lx, lz, yaw, fn, ...args) => {
    const [x, z] = cabinLocal(lx, lz);
    fn(yard, rng, mtx(x, groundY(x, z) - 0.02, z, 0, yaw, 0), ...args);
  };
  put(4.15, 2.35, 0.3, buildBarrel);
  put(4.75, 3.45, 0.25, buildCrate, 0.56);
  put(4.7, 3.4, 0.6, (bb, r, M) => buildCrate(bb, r, M.clone().multiply(mtx(0, 0.56, 0)), 0.42));
  put(3.6, 3.05, 0, (bb, r, M) => buildBucket(bb, r, M, { water: false }));
  const ym = yard.build(mats, 'Yard');
  group.add(...ym.children);

  // signpost at the fork of the approach / dock paths
  const sx = -3.55, sz = 8.35;
  const sb = new Builder();
  const { targets, tip } = buildSign(sb, rng);
  const signMats = {};
  targets.forEach(([kind, tx, tz, h], i) => {
    const yaw = Math.atan2(-(tz - sz), tx - sx);
    const M = mtx(0, h, 0, 0, yaw, rng.range(-0.04, 0.04));
    sb.add('plank', boardGeo(0.62, 0.2, 0.035, rng), M.clone().multiply(mtx(0.36, 0, 0)), rgb([0.92, 0.88, 0.82]));
    sb.add('plank', tip, M.clone().multiply(mtx(0.67, 0, 0)), rgb([0.92, 0.88, 0.82]));
    const key = `sign_${kind}`;
    signMats[key] = stylize(new THREE.MeshLambertMaterial({ map: iconTexture(kind), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }));
    for (const s of [1, -1]) {
      const plane = new THREE.PlaneGeometry(0.34, 0.17);
      sb.add(key, plane, M.clone().multiply(mtx(0.38, 0, s * 0.019, 0, s > 0 ? 0 : Math.PI, 0)));
    }
    void i;
  });
  const sg = sb.build({ ...mats, ...signMats }, 'Signpost');
  sg.name = 'Signpost';
  sg.position.set(sx, groundY(sx, sz) - 0.05, sz);
  for (const m of sg.children) if (/sign_/.test(m.name)) m.castShadow = false;
  group.add(sg);
  return group;
}
