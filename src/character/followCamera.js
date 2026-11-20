// Third-person follow camera: mouse-drag orbit (yaw/pitch), wheel zoom, critically damped
// follow, gentle auto-trail behind the player while moving, terrain + cabin collision, and a
// steeper look-down when the player is inside the cut-away cabin.
import * as THREE from 'three';
import { groundY } from '../world/heightfield.js';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const dampAngle = (a, b, k, dt) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * (1 - Math.exp(-k * dt));
};

export function createFollowCamera(camera, dom, { cabinBox = null } = {}) {
  const st = { yaw: 0, pitch: 0.36, dist: 6.2, targetDist: 6.2, enabled: false, dragging: false, lastDrag: -10, time: 0 };
  const focus = new THREE.Vector3(), desired = new THREE.Vector3(), cur = new THREE.Vector3();
  let first = true;
  let px = 0, py = 0;
  dom.addEventListener('pointerdown', (e) => { if (!st.enabled) return; st.dragging = true; px = e.clientX; py = e.clientY; dom.setPointerCapture?.(e.pointerId); });
  dom.addEventListener('pointermove', (e) => {
    if (!st.enabled || !st.dragging) return;
    st.yaw -= (e.clientX - px) * 0.0055; st.pitch += (e.clientY - py) * 0.004;
    st.pitch = THREE.MathUtils.clamp(st.pitch, -0.15, 1.25);
    px = e.clientX; py = e.clientY; st.lastDrag = st.time;
  });
  const up = () => { st.dragging = false; };
  dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', up);
  dom.addEventListener('wheel', (e) => { if (!st.enabled) return; st.targetDist = THREE.MathUtils.clamp(st.targetDist * (1 + Math.sign(e.deltaY) * 0.1), 2.6, 16); }, { passive: true });

  // segment vs the cabin's oriented box (local AABB), returns hit fraction or 1
  const inv = new THREE.Matrix4(), a = new THREE.Vector3(), b = new THREE.Vector3(), ray = new THREE.Ray(), hit = new THREE.Vector3();
  function cabinHit(from, to) {
    if (!cabinBox) return 1;
    inv.copy(cabinBox.matrixWorldInverse);
    a.copy(from).applyMatrix4(inv); b.copy(to).applyMatrix4(inv);
    const len = a.distanceTo(b);
    ray.set(a, b.clone().sub(a).normalize());
    if (cabinBox.box.containsPoint(a)) return 1; // player inside: cutaway handles visibility
    const p = ray.intersectBox(cabinBox.box, hit);
    return p ? Math.max(0.15, (a.distanceTo(p) - 0.35) / len) : 1;
  }

  return {
    state: st,
    get yaw() { return st.yaw; },
    setEnabled(on, fromCamera) {
      st.enabled = on; first = true;
      if (on && fromCamera) {
        const d = new THREE.Vector3(); fromCamera.getWorldDirection(d);
        st.yaw = Math.atan2(-d.x, -d.z);
      }
    },
    snapBehind(heading) { st.yaw = heading + Math.PI; first = true; },
    update(dt, player, { inside = false, moving = false, heading = 0, cutTop = null } = {}) {
      st.time += dt;
      // auto-trail: drift behind the walking direction unless the user dragged recently
      if (moving && st.time - st.lastDrag > 1.6 && !st.dragging) st.yaw = dampAngle(st.yaw, heading + Math.PI, 1.6, dt);
      const pitch = inside ? Math.max(st.pitch, 0.95) : st.pitch;
      st.dist = damp(st.dist, inside ? Math.min(st.targetDist, 5.6) : st.targetDist, 6, dt);
      focus.set(player.x, player.y + 1.45, player.z);
      desired.set(
        focus.x + Math.sin(st.yaw) * Math.cos(pitch) * st.dist,
        focus.y + Math.sin(pitch) * st.dist,
        focus.z + Math.cos(st.yaw) * Math.cos(pitch) * st.dist,
      );
      // pull in if the cabin is between the player and the camera (when outside)
      if (!inside) {
        const f = cabinHit(focus, desired);
        if (f < 1) desired.lerpVectors(focus, desired, f);
      } else if (cutTop != null && desired.y < cutTop + 0.6) desired.y = cutTop + 0.6;
      const gy = groundY(desired.x, desired.z) + 0.45;
      if (desired.y < gy) desired.y = gy;
      if (first) { cur.copy(desired); first = false; } else cur.set(damp(cur.x, desired.x, 9, dt), damp(cur.y, desired.y, 9, dt), damp(cur.z, desired.z, 9, dt));
      camera.position.copy(cur);
      camera.lookAt(focus);
    },
  };
}
