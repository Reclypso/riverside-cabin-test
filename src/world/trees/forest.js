// Builds 3 variants per species and instances them at the planned spots.
// Two InstancedMeshes per variant (bark + foliage); far trees use a thinned foliage LOD.
import * as THREE from 'three';
import { SPECIES } from './species.js';
import { growTree } from './skeleton.js';
import { buildLimbGeometry } from './limbMesh.js';
import { buildCanopyGeometry } from './canopy.js';
import { buildPineCanopy } from './pineCanopy.js';
import { paintLeafClump, paintFirSpray } from './leafTextures.js';
import { barkTexture } from './barkTextures.js';
import { leafMaterial, barkMaterial } from './treeMaterials.js';
import { planTrees } from './placement.js';
import { createImpostorAtlas, createImpostorField } from './impostors.js';
import { planFarForest } from './farForest.js';
import { groundY } from '../heightfield.js';
import { makeRng } from '../../util/rng.js';

const VARIANTS = 3;

function buildVariant(name, P, v) {
  const rng = makeRng(1000 + v * 7919 + name.length * 131);
  if (name === 'pine') {
    const h = P.height * (0.9 + v * 0.1);
    const pts = [];
    for (let i = 0; i <= 6; i++) pts.push(new THREE.Vector3(rng.range(-0.05, 0.05) * i * 0.3, (h * i) / 6, rng.range(-0.05, 0.05) * i * 0.3));
    const skel = { limbs: [{ pts, r0: P.trunkR, r1: 0.04, level: 0, flare: P.flare }], height: h };
    return { trunk: buildLimbGeometry(skel), leaves: buildPineCanopy(P, rng, h), height: h };
  }
  const skel = growTree(P, rng);
  return { trunk: buildLimbGeometry(skel), leaves: buildCanopyGeometry(skel, P, rng), height: skel.height };
}

function leafTexture(P, v) {
  if (P.leaf === 'fir') return paintFirSpray({ seed: 3 + v });
  const t = paintLeafClump(P.leaf, { seed: 17 + v * 3 + P.leaf.length, ...P.leafTex });
  return t;
}

export async function createForest({ renderer } = {}) {
  const group = new THREE.Group();
  group.name = 'Trees';
  group.userData.export = 'trees';
  const plan = planTrees();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const stats = { trees: plan.length, draws: 0, leafVerts: 0 };
  const atlasVariants = [];

  for (const [name, P] of Object.entries(SPECIES)) {
    const tex = leafTexture(P, 0);
    tex.colorSpace = THREE.NoColorSpace;
    const leafMat = leafMaterial(tex, new THREE.Color(P.leafColor));
    const barkMat = barkMaterial(barkTexture(P.bark), new THREE.Color(P.barkColor), { moss: !!P.moss });
    for (let v = 0; v < VARIANTS; v++) {
      const spots = plan.filter((t) => t.species === name && (t.v ?? 0) % VARIANTS === v);
      const vb = buildVariant(name, P, v);
      atlasVariants.push({ trunk: vb.trunk, leaves: vb.leaves, barkMat, leafMat, species: name, tint: P.tints[v % P.tints.length] });
      for (const lod of spots.length ? [false, true] : []) {
        const list = spots.filter((t) => !!t.far === lod);
        if (!list.length) continue;
        let leafGeo = vb.leaves;
        if (lod && vb.leaves.userData.cards) {
          leafGeo = vb.leaves.clone();
          leafGeo.setDrawRange(0, Math.floor(vb.leaves.userData.cards * 0.6) * 6);
        }
        const trunk = new THREE.InstancedMesh(vb.trunk, barkMat, list.length);
        const leaves = new THREE.InstancedMesh(leafGeo, leafMat, list.length);
        trunk.name = `Tree_${name}_v${v}${lod ? '_far' : ''}_Bark`;
        leaves.name = `Tree_${name}_v${v}${lod ? '_far' : ''}_Leaves`;
        list.forEach((t, i) => {
          const s = t.s * (0.92 + ((i * 37) % 17) / 100);
          p.set(t.x, groundY(t.x, t.z) - 0.12 * s, t.z);
          q.setFromAxisAngle(UP, t.rot);
          sc.set(s, s * (0.95 + ((i * 13) % 11) / 100), s);
          m4.compose(p, q, sc);
          trunk.setMatrixAt(i, m4); leaves.setMatrixAt(i, m4);
          leaves.setColorAt(i, new THREE.Color(P.tints[t.tint % P.tints.length]));
        });
        for (const m of [trunk, leaves]) {
          m.castShadow = true; m.receiveShadow = true;
          m.customDepthMaterial = m.material.userData.depth;
          m.computeBoundingSphere();
          group.add(m);
          stats.draws++;
        }
        stats.leafVerts += leafGeo.attributes.position.count * list.length;
      }
    }
  }
  // far forest (beyond the real trees): impostor billboards baked from these variants
  if (renderer) {
    const atlas = createImpostorAtlas(renderer, atlasVariants);
    const far = planFarForest(atlasVariants.map((a) => a.species));
    group.add(createImpostorField(atlas, far));
    group.setPreset = (p) => atlas.bake(p);
    stats.impostors = far.length;
  }
  console.log('forest', JSON.stringify(stats));
  // trunk circles for character collision (play area only)
  const TRUNK_R = { oak: 0.42, maple: 0.32, birch: 0.3, pine: 0.36 };
  group.userData.trunks = plan.filter((t) => Math.abs(t.x) < 90 && Math.abs(t.z) < 90)
    .map((t) => ({ x: t.x, z: t.z, r: (TRUNK_R[t.species] || 0.35) * t.s }));
  return group;
}
