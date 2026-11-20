// Ambient life: chimney smoke, light motes / fireflies, a distant bird flock.
import * as THREE from 'three';
import { createSmoke } from './smoke.js';
import { createMotes } from './motes.js';
import { createBirds } from './birds.js';
import { cabinLocal, CABIN } from '../layout.js';
import { CABIN_PAD_H } from '../heightfield.js';

function chimneyTop(root) {
  // prefer the cabin module's chimney mesh; fall back to a sensible spot on the gable
  const cabin = root.getObjectByName('Cabin');
  if (cabin?.userData.chimneyTop) return cabin.userData.chimneyTop.clone().add(new THREE.Vector3(0, 0.1, 0));
  let best = null;
  root.traverse((o) => { if (!best && o.isMesh && /chimney/i.test(o.name)) best = o; });
  if (best) {
    const box = new THREE.Box3().setFromObject(best);
    return new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y + 0.15, (box.min.z + box.max.z) / 2);
  }
  const [x, z] = cabinLocal(CABIN.w / 2 + 0.3, 0);
  return new THREE.Vector3(x, CABIN_PAD_H + 6.2, z);
}

export async function createFx({ root }) {
  const group = new THREE.Group();
  group.name = 'FX';
  group.userData.reflect = false;
  group.userData.noExport = true;
  const smoke = createSmoke(chimneyTop(root));
  const motes = createMotes();
  const birds = createBirds();
  group.add(smoke, motes, birds);
  group.setPreset = (p) => motes.setPreset(p);
  return group;
}
