// Scripted input for deterministic gameplay captures: steers the real controller through world
// waypoints ({x, z, run}) by converting the wish direction to camera-relative input, then stops
// and turns to face `faceAt` at the end.
export function createAutopilot(waypoints, getCamYaw, { arrive = 0.6, faceAt = null } = {}) {
  let k = 0, done = false, settle = 0;
  return {
    get done() { return done; },
    read(state, dt) {
      if (done) return { x: 0, y: 0, run: false, jump: false };
      let wp = waypoints[k];
      let dx = wp.x - state.pos.x, dz = wp.z - state.pos.z;
      while (Math.hypot(dx, dz) < arrive && k < waypoints.length - 1) {
        k++; wp = waypoints[k]; dx = wp.x - state.pos.x; dz = wp.z - state.pos.z;
      }
      const dist = Math.hypot(dx, dz);
      if (k === waypoints.length - 1 && dist < arrive * 0.5) {
        // final: nudge toward facing target, then stop
        if (faceAt && settle < 0.6) {
          settle += dt;
          const fx = faceAt.x - state.pos.x, fz = faceAt.z - state.pos.z, l = Math.hypot(fx, fz) || 1;
          return this.toInput(fx / l * 0.05, fz / l * 0.05, false, getCamYaw());
        }
        done = true;
        return { x: 0, y: 0, run: false, jump: false };
      }
      return this.toInput(dx / dist, dz / dist, !!wp.run, getCamYaw());
    },
    toInput(wx, wz, run, yaw) {
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw); // camera forward on XZ
      const rx = -fz, rz = fx;                         // camera right
      return { x: wx * rx + wz * rz, y: wx * fx + wz * fz, run, jump: false };
    },
  };
}
