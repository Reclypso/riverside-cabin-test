// Log cabin assembly. Built in cabin-local space (see dims.js) then placed on the pad.
// The cabin uses its OWN material set (so the cutaway clipping never touches props).
// API (for the character controller / camera):
//   setDoor(t)            0 closed .. 1 open (~105 deg, swings inward)
//   setCutaway(on, now)   hide everything above ~2.4 m over the floor inside the footprint
//   userData.doorWorld / doorNormal / colliders / floorAt(x, z) / cutHeightWorld
//   userData.chimneyTop / lanternWorld (FX), update(t, dt), setPreset(p)
import * as THREE from 'three';
import { CABIN } from '../layout.js';
import { CABIN_PAD_H } from '../heightfield.js';
import { G } from '../../render/globals.js';
import { Builder } from './geom.js';
import { createMaterialSet, applyGlow } from './materials.js';
import { DIM } from './dims.js';
import { buildLogWalls } from './logWalls.js';
import { buildRoof } from './roof.js';
import { buildChimney, buildFoundation } from './chimney.js';
import { buildOpenings } from './openings.js';
import { buildPorch } from './porch.js';
import { buildInterior } from './interior/interior.js';
import { cabinColliders, floorAt, doorInfo } from './collision.js';
import { setupCutaway } from './cutaway.js';

export async function createCabin() {
  const group = new THREE.Group();
  group.name = 'Cabin';
  group.userData.export = 'cabin';
  group.position.set(CABIN.x, CABIN_PAD_H, CABIN.z);
  group.rotation.y = CABIN.rot;
  const M = createMaterialSet();

  const b = new Builder(), leaf = new Builder(), porchRoof = new Builder();
  buildFoundation(b);
  buildLogWalls(b);
  buildRoof(b);
  const smoke = buildChimney(b);
  buildOpenings(b, leaf);
  const { lanternPos } = buildPorch(b, porchRoof);
  const meshes = b.build(M, 'Cabin');
  meshes.name = 'Cabin_Meshes';
  for (const m of meshes.children) if (/glass|lanternGlass|petal|leaf/.test(m.name)) m.castShadow = false;
  group.add(meshes);
  // porch roof sits below the cut line: hidden while the cutaway is on so it can't block the doorway
  const porchRoofMeshes = porchRoof.build(M, 'Cabin_PorchRoof');
  porchRoofMeshes.name = 'Cabin_PorchRoof';
  group.add(porchRoofMeshes);

  // door leaf on its hinge (pivot = hinge line, leaf extends along +X)
  const door = new THREE.Group();
  door.name = 'Cabin_Door';
  door.position.set(DIM.hinge.x, 0, DIM.hinge.z);
  const leafMeshes = leaf.build(M, 'Cabin_DoorLeaf');
  door.add(...leafMeshes.children);
  group.add(door);

  const lamp = new THREE.PointLight(0xffa850, 0, 7.5, 1.6);
  lamp.name = 'Cabin_LanternLight';
  lamp.position.copy(lanternPos).add(new THREE.Vector3(0, 0, 0.12));
  group.add(lamp);

  const interior = buildInterior(M);
  group.add(interior);

  group.updateMatrixWorld(true);
  const W = group.matrixWorld;
  group.userData.chimneyTop = smoke.clone().applyMatrix4(W);
  group.userData.lanternWorld = lanternPos.clone().applyMatrix4(W);
  interior.userData.IM.fireUniforms.uFireBase.value = interior.userData.fireLocal.clone().applyMatrix4(W).y;

  // interior air volume (slightly past the inner wall faces, floor to just over the ceiling):
  // sky fill is cut inside it so the hearth and window light carry the room
  const boxM = W.clone().multiply(new THREE.Matrix4().makeTranslation(0, 1.75, 0));
  G.uInteriorInv.value.copy(boxM).invert();
  G.uInteriorHalf.value.set(DIM.inX + 0.2, 1.7, DIM.inZ + 0.25);
  G.uInteriorAmbient.value = 0.2; // a little less sky fill indoors: hearth vs window contrast

  const { doorWorld, doorNormal } = doorInfo();
  Object.assign(group.userData, { doorWorld, doorNormal, colliders: cabinColliders(), floorAt });

  const cut = setupCutaway(group);
  // debug / capture params lock the state: ?door=1 (open), ?cutaway=1 (roof cut away)
  const q = new URLSearchParams(location.search);
  const lockDoor = q.has('door'), lockCut = q.has('cutaway');
  const setDoorRaw = (t) => { door.rotation.y = THREE.MathUtils.degToRad(105) * THREE.MathUtils.clamp(t, 0, 1); };
  group.setDoor = (t) => { if (!lockDoor) setDoorRaw(t); };
  group.setCutaway = (on, immediate = false) => { if (!lockCut) cut.set(on, immediate); };
  if (lockDoor) setDoorRaw(+q.get('door') || 1);
  if (lockCut) cut.set(q.get('cutaway') !== '0', true);
  group.update = (t, dt = 1 / 60) => { interior.update(t); cut.update(dt); porchRoofMeshes.visible = !cut.on; };
  group.setPreset = (p) => {
    applyGlow(p, M);
    lamp.intensity = 7 * p.lanternGlow;
    interior.setPreset(p);
  };

  return group;
}
