// Cutaway for interior play: every cabin material gets two world-space clipping planes used
// as an intersection (clip only where BOTH hold): "above the cut height" and "west of the
// outside chimney". Shadows are not clipped, so the roof still shades the room.
// The cut height eases between OFF (nothing clipped) and the target when toggled.
import * as THREE from 'three';
import { DIM } from './dims.js';

const OFF = 9.5; // cabin-local height above everything (ridge ~5.4, chimney excluded by the x plane)

export function setupCutaway(group) {
  group.updateMatrixWorld(true);
  const wm = group.matrixWorld;
  const origin = new THREE.Vector3().setFromMatrixPosition(wm);
  const xAxis = new THREE.Vector3(1, 0, 0).transformDirection(wm);
  const planeY = new THREE.Plane(new THREE.Vector3(0, -1, 0), origin.y + OFF);
  const planeX = new THREE.Plane(xAxis.clone(), -xAxis.dot(origin) - (DIM.w / 2 + 0.01));
  const mats = new Set();
  group.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && !m.isShaderMaterial) mats.add(m);
  });
  for (const m of mats) { m.clippingPlanes = [planeY, planeX]; m.clipIntersection = true; m.clipShadows = false; m.needsUpdate = true; }
  const state = { cur: OFF, target: OFF };
  const apply = () => { planeY.constant = origin.y + state.cur; group.userData.cutHeightWorld = origin.y + Math.min(state.cur, OFF); };
  apply();
  return {
    set(on, immediate = false) { state.target = on ? DIM.cutY : OFF; if (immediate) { state.cur = state.target; apply(); } },
    get on() { return state.target < OFF; },
    update(dt) {
      if (state.cur === state.target) return;
      const k = 1 - Math.exp(-dt * 6);
      state.cur += (state.target - state.cur) * k;
      if (Math.abs(state.cur - state.target) < 0.01) state.cur = state.target;
      apply();
    },
  };
}
