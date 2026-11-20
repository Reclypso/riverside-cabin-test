// Player movement: camera-relative input, acceleration, facing with turn damping, sliding
// collision, terrain/deck/floor following with smooth steps, a simple jump, and the cabin
// door + cutaway triggers.
import * as THREE from 'three';

const WALK = 1.55, RUN = 4.6, RADIUS = 0.3;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const dampAngle = (a, b, k, dt) => {
  const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * (1 - Math.exp(-k * dt));
};

export function createController(collision, cabin) {
  const s = {
    pos: new THREE.Vector3(), heading: 0, speed: 0, vy: 0, grounded: true, inside: false,
    door: 0, moving: false, dir: new THREE.Vector2(0, 1),
  };
  const local = new THREE.Vector3(), inv = new THREE.Matrix4();
  const doorWorld = cabin?.userData.doorWorld;

  function insideCabin(p) {
    if (!cabin) return false;
    inv.copy(cabin.matrixWorld).invert();
    local.copy(p).applyMatrix4(inv);
    return Math.abs(local.x) < 2.95 && Math.abs(local.z) < 2.35 && local.y > -0.5 && local.y < 3.2;
  }

  // doorway assist: heading at the front wall close to the doorway steers the player sideways
  // into the opening (both ways), so a door 1.06 m wide never needs pixel-precise steering
  const doorN = cabin?.userData.doorNormal;
  let wx = 0, wz = 0;
  function doorAssist() {
    if (!doorWorld || !doorN) return;
    const dx = s.pos.x - doorWorld.x, dz = s.pos.z - doorWorld.z;
    const sd = dx * doorN.x + dz * doorN.z;            // signed distance from the wall plane (+ outside)
    const lat = dx * doorN.z - dz * doorN.x;           // offset along the wall from the door axis
    const toward = -(wx * doorN.x + wz * doorN.z) * Math.sign(sd || 1); // >0 when heading at the wall
    if (Math.abs(sd) > 2.2 || Math.abs(lat) > 1.35 || Math.abs(lat) < 0.08 || toward < 0.35) return;
    const k = 2.2 * THREE.MathUtils.smoothstep(2.2 - Math.abs(sd), 0, 1.6) * Math.min(1, Math.abs(lat) / 0.3);
    const tx = doorN.z, tz = -doorN.x, sg = -Math.sign(lat);
    wx += tx * sg * k; wz += tz * sg * k;
    const l = Math.hypot(wx, wz); wx /= l; wz /= l;
  }

  return {
    state: s,
    place(x, z, heading = 0) {
      s.pos.set(x, collision.floorAt(x, z).y, z); s.heading = heading; s.speed = 0; s.vy = 0; s.grounded = true;
    },
    update(dt, input, camYaw, playing = true) {
      // camera-relative wish direction
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
      wx = fx * input.y + -fz * input.x; wz = fz * input.y + fx * input.x;
      const len = Math.hypot(wx, wz);
      const want = len > 0.01 ? (input.run ? RUN : WALK) * Math.min(1, len) : 0; // analog-friendly
      if (len > 0.01) { wx /= len; wz /= len; doorAssist(); s.dir.set(wx, wz); }
      s.speed = damp(s.speed, want, want > s.speed ? 5.5 : 9, dt);
      if (s.speed < 0.02 && want === 0) s.speed = 0;
      s.moving = s.speed > 0.05;
      if (len > 0.01) s.heading = dampAngle(s.heading, Math.atan2(wx, wz), 11, dt);
      // move along the wish direction (responsive), but no faster than the facing allows in tight turns
      const facingDot = Math.max(0.35, Math.cos(Math.atan2(s.dir.x, s.dir.y) - s.heading));
      const step = s.speed * dt * facingDot;
      if (step > 0) {
        const res = collision.move(s.pos, s.dir.x * step, s.dir.y * step, RADIUS);
        if (res === 'stuck') s.speed *= 0.6;
      }
      // vertical: follow walkable floor, or fly a jump arc
      const floor = collision.floorAt(s.pos.x, s.pos.z).y;
      if (s.grounded && input.jump && !s.jumpHeld) { s.vy = 4.3; s.grounded = false; }
      s.jumpHeld = input.jump;
      if (!s.grounded) {
        s.vy -= 12.5 * dt; s.pos.y += s.vy * dt;
        if (s.pos.y <= floor) { s.pos.y = floor; s.grounded = true; s.vy = 0; }
      } else {
        const k = floor > s.pos.y ? 22 : 14; // step up quickly, settle down softly
        s.pos.y = damp(s.pos.y, floor, k, dt);
        if (s.pos.y - floor > 0.5) s.grounded = false; // walked off a ledge (dock end)
      }
      // cabin interactions (only while playing; shots set the cabin state themselves)
      s.inside = insideCabin(s.pos);
      if (!playing) return s;
      if (doorWorld && cabin.setDoor) {
        const near = Math.hypot(s.pos.x - doorWorld.x, s.pos.z - doorWorld.z) < 2.8 || s.inside;
        s.door = damp(s.door, near ? 1 : 0, near ? 3.2 : 1.8, dt);
        cabin.setDoor(THREE.MathUtils.smoothstep(s.door, 0, 1));
      }
      // roof + porch roof cut away while inside or under the porch roof (the follow camera sits
      // above the eaves there, so the porch roof would otherwise hide the player)
      s.underRoof = s.inside || collision.floorAt(s.pos.x, s.pos.z).kind === 'cabin';
      if (cabin?.setCutaway) cabin.setCutaway(s.underRoof);
      return s;
    },
  };
}
