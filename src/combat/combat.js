// Combat layer: fairy circles summon goblins, the woodsman chops them down.
//  - walking into a ready fairy circle triggers it (burst) and a goblin rises from the ring
//    at the burst peak (FairyCircles.userData.SPAWN_DELAY); at most 3 goblins at once
//  - axe hits: short arc in front of the player during the blade's cutting frames; each swing
//    hits each goblin once -> hit-stop, white flash, knockback, spark poof, camera kick
//  - goblin swings damage the player (red vignette, hit react, push back); 0 HP -> fall, fade,
//    goblins vanish, and he wakes by the cabin hearth with full health. Slow regen out of combat.
import * as THREE from 'three';
import { loadGoblinTemplate, spawnGoblin } from '../enemies/goblin.js';
import { createHUD } from './hud.js';
import { createSwingTrail } from './swingTrail.js';
import { cabinLocal } from '../world/layout.js';

const MAX_GOBLINS = 3;
const PLAYER_HP = 100;
const SWING_REACH = 2.2, SWING_ARC = Math.cos(THREE.MathUtils.degToRad(80));
const HITSTOP = 0.075;

export async function createCombat({ scene, root, play, camera }) {
  const tpl = await loadGoblinTemplate();
  const fairy = root.getObjectByName('FairyCircles');
  const player = play.player;
  const hud = createHUD();
  const trail = createSwingTrail(player.model);
  scene.add(trail.mesh);
  const goblins = [];
  const pending = [];
  const P = { hp: PLAYER_HP, max: PLAYER_HP, lastDamage: -99, invuln: 0, dead: false, deadT: 0, kills: 0 };
  let hitstop = 0, shake = 0, kick = new THREE.Vector3(), time = 0;
  const [hx, hz] = cabinLocal(0.9, 0.25), [fx, fz] = cabinLocal(2.9, 0);
  const HEARTH = { x: hx, z: hz, heading: Math.atan2(fx - hx, fz - hz) };

  const poof = (x, y, z, opts) => fairy?.userData.burst?.(x, y, z, time, opts);

  // aim assist: the nearest live goblin within reach, inside a wide cone of the stick/facing
  player.ctl.aim = (s) => {
    let best = null, bd = 3.4;
    for (const g of goblins) {
      if (!g.alive || g.state.state === 'spawn') continue;
      const dx = g.state.pos.x - s.pos.x, dz = g.state.pos.z - s.pos.z, d = Math.hypot(dx, dz);
      const cos = (dx * Math.sin(s.heading) + dz * Math.cos(s.heading)) / Math.max(d, 1e-3);
      if (d < bd && cos > -0.2) { bd = d; best = Math.atan2(dx, dz); }
    }
    return best;
  };

  function damagePlayer(amount, from) {
    if (P.dead || P.invuln > 0) return;
    P.hp -= amount; P.lastDamage = time; P.invuln = 0.45;
    hud.damageFlash();
    shake = Math.max(shake, 0.22);
    const s = player.state;
    const dx = s.pos.x - from.x, dz = s.pos.z - from.z, d = Math.hypot(dx, dz) || 1;
    player.ctrl.push((dx / d) * 3.2, (dz / d) * 3.2);
    if (!player.attack.state.swinging && P.hp > 0) { player.loco.playOneShot('Hit', { timeScale: 1.15, fadeIn: 0.05, fadeOut: 0.2 }); player.ctl.stun = 0.32; }
  }

  function spawn(x, z) {
    const s = player.state;
    const g = spawnGoblin(tpl, scene, player.collision, x, z, Math.atan2(s.pos.x - x, s.pos.z - z), {
      damagePlayer, poof, bar: () => hud.enemyBar(3), canAttack: () => !P.dead,
    });
    goblins.push(g);
    return g;
  }

  function die() {
    P.dead = true; P.deadT = 0;
    player.ctl.locked = true; player.attack.cancel();
    player.loco.playOneShot('Death', { hold: true, fadeIn: 0.1 });
  }
  function respawn() {
    player.loco.stopOneShot();
    player.place(HEARTH.x, HEARTH.z, HEARTH.heading);
    player.follow.snapBehind(HEARTH.heading);
    P.hp = P.max; P.dead = false; P.lastDamage = -99; player.ctl.locked = false;
    hud.showFall(false);
  }

  return {
    goblins, P, hud, spawn, HEARTH,
    /** shader pre-warm: put every combat material on screen once (goblin + outline + flash, hand
     *  axe, swing trail, fairy burst) so the first fight doesn't stall on program compiles */
    prewarm(on) {
      if (on) {
        const s = player.state;
        const g = spawn(s.pos.x + Math.sin(s.heading) * 2.5, s.pos.z + Math.cos(s.heading) * 2.5);
        g.state.state = 'chase'; g.group.children[0].scale.setScalar(tpl.scale);
        player.model.userData.setAxeInHand?.(true);
        trail.mesh.visible = true;
        poof(s.pos.x, s.pos.y - 40, s.pos.z, { scale: 0.2, life: 0.05 });
      } else {
        this.reset();
        player.model.userData.setAxeInHand?.(false);
        trail.mesh.visible = false;
      }
    },
    /** re-project the goblin health bars (after a capture script moved the camera) */
    placeBars(cam) { cam.updateMatrixWorld(); for (const g of goblins) if (g.alive) g.placeBar(cam); },
    /** world-time scale for hit-stop (player + goblin animation and movement) */
    timeScale: () => (hitstop > 0 ? 0.03 : 1),
    reset() {
      for (const g of goblins) { g.group.removeFromParent(); g.state.state = 'gone'; }
      goblins.length = 0; pending.length = 0;
      Object.assign(P, { hp: P.max, lastDamage: -99, invuln: 0, dead: false, deadT: 0 });
      player.ctl.locked = false; hud.showFall(false); hitstop = 0; shake = 0;
    },
    update(dt, t, playing) {
      time = t;
      hud.setVisible(playing);
      hitstop = Math.max(0, hitstop - dt);
      const ts = hitstop > 0 ? 0.03 : 1, gdt = dt * ts;
      P.invuln = Math.max(0, P.invuln - dt);
      const s = player.state;
      // fairy circles summon goblins
      if (playing && !P.dead && fairy?.userData.check) {
        const i = fairy.userData.check(s.pos, t);
        if (i >= 0) {
          const c = fairy.userData.circles[i];
          pending.push({ at: t + (fairy.userData.SPAWN_DELAY ?? 0.45), x: c.x, z: c.z });
        }
      }
      for (let i = pending.length - 1; i >= 0; i--) {
        if (t < pending[i].at) continue;
        const p = pending.splice(i, 1)[0];
        if (goblins.filter((g) => g.alive).length < MAX_GOBLINS) {
          // rise just inside the ring on the far side from the player, so he sees it climb out
          const dx = p.x - s.pos.x, dz = p.z - s.pos.z, d = Math.hypot(dx, dz) || 1;
          spawn(p.x + (dx / d) * 0.35, p.z + (dz / d) * 0.35);
        }
      }
      // axe hits
      if (player.attack.hitWindow()) {
        const fwdX = Math.sin(s.heading), fwdZ = Math.cos(s.heading);
        for (const g of goblins) {
          if (!g.alive) continue;
          const dx = g.state.pos.x - s.pos.x, dz = g.state.pos.z - s.pos.z, d = Math.hypot(dx, dz);
          if (d > SWING_REACH || (dx * fwdX + dz * fwdZ) / Math.max(d, 1e-3) < SWING_ARC) continue;
          if (g.hit(dx / Math.max(d, 1e-3), dz / Math.max(d, 1e-3), player.attack.state.swingId)) {
            hitstop = HITSTOP; shake = Math.max(shake, 0.32);
            poof(g.state.pos.x - (dx / d) * 0.25, g.state.pos.y + 0.75, g.state.pos.z - (dz / d) * 0.25, { color: 0xfff1c8, scale: 0.42, ring: false, life: 0.7 });
            if (!g.alive) P.kills++;
          }
        }
      }
      // goblins
      for (const g of goblins) g.update(gdt, s.pos, goblins, camera);
      for (let i = goblins.length - 1; i >= 0; i--) if (goblins[i].state.state === 'gone') goblins.splice(i, 1);
      // health: regen out of combat, fall at 0, wake by the hearth
      if (!P.dead && P.hp <= 0) die();
      if (P.dead) {
        P.deadT += dt;
        if (P.deadT > 1.0) { hud.showFall(true); for (const g of goblins) g.banish(); }
        if (P.deadT > 3.4) respawn();
      } else if (t - P.lastDamage > 6) P.hp = Math.min(P.max, P.hp + 6 * dt);
      hud.setPlayer(P.hp, P.max);
      trail.update(dt, player.attack);
      // camera kick (after the follow camera placed it this frame)
      if (playing && shake > 0) {
        const k = shake * shake * 0.12;
        kick.set(Math.sin(t * 71.3) * k, Math.sin(t * 57.1 + 1.3) * k * 0.7, Math.sin(t * 63.7 + 2.1) * k);
        camera.position.add(kick);
        shake = Math.max(0, shake - dt * 1.6);
      }
    },
  };
}
