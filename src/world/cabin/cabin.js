// Log cabin assembly. Built in cabin-local space (see dims.js) then placed on the pad.
// Static parts are merged per material (one draw call each). Exposes userData.chimneyTop
// (world position for the smoke FX) and setPreset() for window/lantern glow.
import * as THREE from 'three';
import { CABIN } from '../layout.js';
import { CABIN_PAD_H } from '../heightfield.js';
import { Builder } from './geom.js';
import { getMaterials, applyGlow } from './materials.js';
import { buildLogWalls } from './logWalls.js';
import { buildRoof } from './roof.js';
import { buildChimney, buildFoundation } from './chimney.js';
import { buildOpenings } from './openings.js';
import { buildPorch } from './porch.js';

export async function createCabin() {
  const group = new THREE.Group();
  group.name = 'Cabin';
  group.userData.export = 'cabin';
  group.position.set(CABIN.x, CABIN_PAD_H, CABIN.z);
  group.rotation.y = CABIN.rot;

  const b = new Builder();
  buildFoundation(b);
  buildLogWalls(b);
  buildRoof(b);
  const smoke = buildChimney(b);
  buildOpenings(b);
  const { lanternPos } = buildPorch(b);
  const meshes = b.build(getMaterials(), 'Cabin');
  meshes.name = 'Cabin_Meshes';
  for (const m of meshes.children) {
    if (/glass|lanternGlass|petal|leaf/.test(m.name)) m.castShadow = false;
  }
  group.add(meshes);

  const lamp = new THREE.PointLight(0xffa850, 0, 7.5, 1.6);
  lamp.name = 'Cabin_LanternLight';
  lamp.position.copy(lanternPos).add(new THREE.Vector3(0, 0, 0.12));
  group.add(lamp);

  group.updateMatrixWorld(true);
  group.userData.chimneyTop = smoke.clone().applyMatrix4(group.matrixWorld);
  group.userData.lanternWorld = lanternPos.clone().applyMatrix4(group.matrixWorld);

  group.setPreset = (p) => {
    applyGlow(p);
    lamp.intensity = 7 * p.lanternGlow;
  };
  return group;
}
