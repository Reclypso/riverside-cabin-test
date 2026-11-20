// The scripted route for the gameplay capture: start in the meadow south of the fences, run up
// the approach path, slow to a walk, climb the porch steps, go through the door and stop by the
// hearth. Uses the cabin's doorway data when the cabin module provides it.
import { cabinLocal } from '../world/layout.js';

const P = ([x, z], run = false) => ({ x, z, run });

export function walkRoute(root) {
  const cabin = root.getObjectByName('Cabin');
  const door = cabin?.userData.doorWorld, out = cabin?.userData.doorNormal;
  const porch = door && out ? [door.x + out.x * 1.7, door.z + out.z * 1.7] : cabinLocal(-0.85, 3.4);
  const steps = door && out ? [door.x + out.x * 3.3, door.z + out.z * 3.3] : cabinLocal(-0.85, 5.6);
  const inside = door && out ? [door.x - out.x * 1.1, door.z - out.z * 1.1] : cabinLocal(-0.85, 1.6);
  const points = [
    P([-9.6, 30.5], true), P([-7.2, 22.0], true), P([-5.8, 13.5], true), P([-5.4, 8.6], true),
    P(steps), P(porch), P(inside), P(cabinLocal(0.9, 0.25)),
  ];
  return {
    start: { x: -13.5, z: 33.5, heading: Math.atan2(-9.6 + 13.5, 30.5 - 33.5) },
    points,
    faceAt: (() => { const [x, z] = cabinLocal(2.9, 0); return { x, z }; })(),
  };
}
