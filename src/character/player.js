// The playable mountain man: model + locomotion + controller + follow camera. One object the
// app updates each frame; `mode` switches between the free orbit viewer and play.
import * as THREE from 'three';
import { loadCharacter } from './loadCharacter.js';
import { createLocomotion } from './locomotion.js';
import { createController } from './controller.js';
import { createFollowCamera } from './followCamera.js';
import { createCollision } from './collision.js';
import { createKeyboard } from './input.js';
import { createAttack } from './attack.js';
import { markReflective } from '../render/reflection.js';
import { cabinLocal, CABIN } from '../world/layout.js';

export const SPAWN = { x: -6.8, z: 9.2, heading: Math.PI * 0.95 }; // on the approach path, facing the cabin

export async function createPlayer({ scene, root, camera, dom }) {
  const { root: model, clips } = await loadCharacter();
  markReflective(model);
  scene.add(model);
  const loco = createLocomotion(model, clips);
  const cabin = root.getObjectByName('Cabin');
  const collision = createCollision(root);
  const ctrl = createController(collision, cabin);
  // cabin box (walls + roof) for camera collision, in cabin-local space
  let cabinBox = null;
  if (cabin) {
    const o = new THREE.Object3D();
    o.position.copy(cabin.position); o.rotation.copy(cabin.rotation); o.updateMatrixWorld(true);
    cabinBox = { box: new THREE.Box3(new THREE.Vector3(-3.6, 0, -3.1), new THREE.Vector3(3.6, 5.6, 3.1)), matrixWorldInverse: o.matrixWorld.clone().invert() };
  }
  const follow = createFollowCamera(camera, dom, { cabinBox });
  const keyboard = createKeyboard(window, dom);
  const attack = createAttack(loco, model);
  // combat hooks: locked (dead / respawning), stunned seconds, aim(): heading toward a target
  const ctl = { locked: false, stun: 0, aim: null };
  ctrl.place(SPAWN.x, SPAWN.z, SPAWN.heading);
  let source = keyboard; // can be swapped for an autopilot

  function sync() {
    const s = ctrl.state;
    model.position.copy(s.pos);
    model.rotation.y = s.heading;
  }
  sync();
  return {
    model, ctrl, follow, collision, keyboard, attack, loco, ctl,
    get state() { return ctrl.state; },
    setSource(src) { source = src || keyboard; },
    place(x, z, h) { ctrl.place(x, z, h); sync(); },
    // simulate + animate; camera only when playing
    update(dt, playing, absTime) {
      const input = playing && !ctl.locked ? source.read(ctrl.state, dt) : { x: 0, y: 0, run: false, jump: false };
      ctl.stun = Math.max(0, ctl.stun - dt);
      if (input.attack && ctl.stun <= 0) {
        attack.request();
        const aim = ctl.aim?.(ctrl.state);
        if (aim !== null && aim !== undefined) ctl.aimHeading = aim;
      }
      if (attack.state.swinging) {
        input.moveScale = 0.12;
        if (ctl.aimHeading !== undefined && attack.progress() < 0.3) input.face = ctl.aimHeading;
      } else ctl.aimHeading = undefined;
      if (ctl.stun > 0 || ctl.locked) input.moveScale = 0;
      attack.update(dt);
      const s = ctrl.update(dt, input, follow.yaw, playing);
      loco.update(dt, s.speed, !s.grounded, playing ? undefined : absTime);
      sync();
      if (playing) {
        const cut = cabin?.userData.cutHeightWorld ?? (cabin ? cabin.position.y + 2.7 : null);
        follow.update(dt, s.pos, { inside: s.inside, moving: s.moving, heading: s.heading, cutTop: cut });
      }
    },
    cabinLocal, CABIN,
  };
}
