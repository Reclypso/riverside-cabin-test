// Cabin interior assembly (cabin-local space): shell, fireplace + fire, furniture, decor,
// window light, two warm point lights (hearth fire + oil lamp). Static parts merge per material.
import * as THREE from 'three';
import { Builder } from '../geom.js';
import { buildFloorAndCeiling, buildFireplace } from './structure.js';
import { buildFire, buildSmallFlames } from './fire.js';
import { buildFurniture } from './furniture.js';
import { buildDecor } from './decor.js';
import { buildWindowLight } from './windowLight.js';
import { interiorMaterials } from './materials.js';

export function buildInterior(M) {
  const IM = interiorMaterials();
  const mats = { ...M, ...IM };
  const group = new THREE.Group();
  group.name = 'Interior';
  group.userData.export = 'cabin';

  const shell = new Builder();
  buildFloorAndCeiling(shell);
  const { fireAt } = buildFireplace(shell);
  const fire = buildFire(shell, fireAt, IM);
  const shellMeshes = shell.build(mats, 'Interior_Shell');
  shellMeshes.name = 'Interior_Shell';

  const furn = new Builder();
  buildFurniture(furn, IM);
  const furnMeshes = furn.build(mats, 'Interior_Furniture');
  furnMeshes.name = 'Interior_Furniture';

  const deco = new Builder();
  const { lamp, flames } = buildDecor(deco);
  const decoMeshes = deco.build(mats, 'Interior_Decor');
  decoMeshes.name = 'Interior_Decor';
  for (const m of decoMeshes.children) if (/herb|rug|pelt/.test(m.name)) m.castShadow = false;

  const lampLight = new THREE.PointLight(0xffb060, 2.4, 4.2, 1.8);
  lampLight.name = 'Interior_OilLampLight';
  lampLight.position.copy(lamp);
  const small = buildSmallFlames(flames);
  const windowLight = buildWindowLight();

  group.add(shellMeshes, furnMeshes, decoMeshes, fire, small, lampLight, windowLight);
  group.userData.fireLocal = fireAt.clone();
  group.update = (t) => {
    fire.update(t);
    lampLight.intensity = group.userData.lampBase * (0.94 + 0.04 * Math.sin(t * 9.0) + 0.02 * Math.sin(t * 23.0));
  };
  group.userData.lampBase = 2.4;
  group.setPreset = (p) => {
    windowLight.setPreset(p);
    const golden = p.windowGlow > 0.6;
    fire.userData.baseIntensity = golden ? 8.0 : 8.5;
    group.userData.lampBase = golden ? 2.2 : 2.0;
  };
  group.userData.fire = fire;
  group.userData.IM = IM;
  return group;
}
