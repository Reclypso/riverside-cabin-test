// Scripted input for the deterministic combat capture (tools/combat_video.mjs): walk from the
// meadow into the fairy circle, hold ground while the goblin rises, take its first swing, then
// chop it down with chained axe swings; finally shoulder the axe and walk off a few steps.
export function createCombatDirector({ circle, start, getCamYaw, combat, player }) {
  let phase = 'approach', tPhase = 0, triggerT = -1, lastClick = -9, clock = 0, hurtAt = -1, baseYaw = null;
  const toInput = (wx, wz, run, yaw) => {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;
    return { x: wx * rx + wz * rz, y: wx * fx + wz * fz, run, jump: false, attack: false };
  };
  const idle = () => ({ x: 0, y: 0, run: false, jump: false, attack: false });
  return {
    get phase() { return phase; },
    get done() { return phase === 'done'; },
    read(s, dt) {
      clock += dt; tPhase += dt;
      const goblin = combat.goblins.find((g) => g.alive);
      // camera direction for the capture: no auto-trail once the ring fires (he runs back toward
      // the lens with the goblin rising behind him), then ease into a 3/4 view of the fight
      const cam = player.follow.state;
      if (phase !== 'approach') {
        cam.lastDrag = cam.time;
        if (baseYaw === null) baseYaw = cam.yaw;
        if (phase === 'face' || phase === 'fight' || phase === 'after') cam.yaw += (baseYaw + 0.55 - cam.yaw) * (1 - Math.exp(-dt * 1.1));
      }
      switch (phase) {
        case 'approach': {
          // walk to 1.15 m short of the circle centre (inside the trigger radius)
          const dx = circle.x - s.pos.x, dz = circle.z - s.pos.z, d = Math.hypot(dx, dz);
          if (combat.goblins.length || d < 1.15) { phase = 'brace'; tPhase = 0; triggerT = clock; return idle(); }
          return toInput(dx / d, dz / d, false, getCamYaw());
        }
        case 'brace':
          // the ring flares: back off a few steps while the goblin climbs out behind him
          if (tPhase > 0.35) { phase = 'retreat'; tPhase = 0; }
          return idle();
        case 'retreat': {
          if (tPhase > 1.5) { phase = 'face'; tPhase = 0; return idle(); }
          const dx = s.pos.x - circle.x, dz = s.pos.z - circle.z, d = Math.hypot(dx, dz) || 1;
          return toInput(dx / d, dz / d, true, getCamYaw());
        }
        case 'face': {
          // turn to face it and stand ground; let it land the first blow for the drama
          const inp = idle();
          if (goblin) inp.face = Math.atan2(goblin.state.pos.x - s.pos.x, goblin.state.pos.z - s.pos.z);
          if (hurtAt < 0 && combat.P.hp < combat.P.max - 0.5) hurtAt = clock;
          if ((hurtAt >= 0 && clock - hurtAt > 0.3) || tPhase > 5) { phase = 'fight'; tPhase = 0; }
          return inp;
        }
        case 'fight': {
          if (!goblin) { phase = 'after'; tPhase = 0; return idle(); }
          const gs = goblin.state, dx = gs.pos.x - s.pos.x, dz = gs.pos.z - s.pos.z, d = Math.hypot(dx, dz);
          const inp = idle();
          inp.face = Math.atan2(dx, dz);
          if (d > 2.0 && !player.attack.state.swinging && player.ctl.stun <= 0) {
            Object.assign(inp, toInput((dx / d) * 0.55, (dz / d) * 0.55, false, getCamYaw())); // close in, walking
          } else if (gs.state !== 'spawn' && clock - lastClick > 0.42) {
            inp.attack = true; lastClick = clock; // re-click during recovery chains the next chop
          }
          return inp;
        }
        case 'after':
          // catch his breath, then stroll back toward the cabin path
          if (tPhase > 3.2) phase = 'done';
          if (tPhase > 1.6) { const dx = start.x - s.pos.x, dz = start.z - s.pos.z, d = Math.hypot(dx, dz) || 1; return toInput(dx / d, dz / d, false, getCamYaw()); }
          return idle();
        default:
          return idle();
      }
    },
  };
}
