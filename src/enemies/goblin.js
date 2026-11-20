// Goblin enemy: Quaternius' CC0 "Ultimate Monsters" Orc restyled as a forest goblin
// (assets/goblin/goblin.glb, see assets/goblin/CREDITS.md). Same stylised Lambert + outline as the
// woodsman. Each goblin is a small state machine: spawn -> chase -> attack, hit react with
// knockback + white flash, death -> sparkle poof. Moves through the same collision world as the
// player (walls, trunks, props, water edge) and follows the terrain / deck / floor height.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { convertMaterial, outlineMaterial } from '../character/loadCharacter.js';
import { markReflective } from '../render/reflection.js';

const HEIGHT = 1.22;           // standing height (m): a head shorter than the woodsman
const RADIUS = 0.32;
const RUN_SPEED = 3.0, WALK_SPEED = 1.2;
const ATTACK_RANGE = 1.45, ATTACK_REACH = 1.85, ATTACK_ARC = Math.cos(THREE.MathUtils.degToRad(70));
const ATTACK_DAMAGE = 14;
export const GOBLIN_HP = 3;

let template = null;
export async function loadGoblinTemplate(url = './assets/goblin/goblin.glb') {
  if (template) return template;
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  const cache = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.material = cache.get(o.material) || cache.set(o.material, convertMaterial(o.material)).get(o.material);
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
  });
  // scale to the target height (bind pose bounds)
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root, true);
  const s = HEIGHT / Math.max(0.01, box.max.y - box.min.y);
  // the source rig is not in metres: express the outline width in the skinned meshes' local units
  let localExtent = 0;
  root.traverse((o) => { if (o.isSkinnedMesh) { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; localExtent = Math.max(localExtent, b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z); } });
  const worldExtent = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) * s;
  const outlineLocal = 0.0085 * (localExtent / Math.max(worldExtent, 1e-3));
  outline.onBeforeCompile = ((ob) => (sh) => { ob(sh); sh.uniforms.uOutline.value = outlineLocal; })(outline.onBeforeCompile);
  template = { root, clips: Object.fromEntries(gltf.animations.map((c) => [c.name, c])), scale: s, footY: -box.min.y * s, outlineLocal };
  return template;
}

const outline = outlineMaterial(0x1e2410, 0.012);

// tiny animator: Idle/Run loops blended by speed + one-shot overlay (attack, hit, death, land)
function createAnimator(root, clips) {
  const mixer = new THREE.AnimationMixer(root);
  const loop = (n) => { const a = mixer.clipAction(clips[n]); a.play(); a.setEffectiveWeight(0); return a; };
  const idle = loop('Idle'), run = loop('Run');
  run.timeScale = 1.15;
  const shots = {};
  let os = null, moveW = 0;
  return {
    mixer,
    play(name, { timeScale = 1, hold = false, fade = 0.08 } = {}) {
      const a = shots[name] || (shots[name] = mixer.clipAction(clips[name]));
      a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = 0; a.play();
      if (os && os.a !== a) os.a.setEffectiveWeight(0);
      os = { name, a, t: 0, dur: clips[name].duration, timeScale, hold, fade, w: os ? os.w : 0 };
      return os;
    },
    get current() { return os; },
    progress: () => (os ? Math.min(1, os.t / os.dur) : -1),
    update(dt, speed) {
      moveW += (THREE.MathUtils.smoothstep(speed, 0.2, 1.4) - moveW) * (1 - Math.exp(-dt * 10));
      let w = 0;
      if (os) {
        os.t += dt * os.timeScale;
        const done = os.t >= os.dur;
        const target = done && !os.hold ? 0 : 1;
        os.w += THREE.MathUtils.clamp(target - os.w, -dt / os.fade, dt / os.fade);
        os.a.time = Math.min(os.t, os.dur - 1e-4);
        os.a.setEffectiveWeight(os.w); w = os.w;
        if (done && !os.hold && os.w <= 0.001) { os.a.setEffectiveWeight(0); os = null; }
      }
      idle.setEffectiveWeight((1 - moveW) * (1 - w));
      run.setEffectiveWeight(moveW * (1 - w));
      mixer.update(dt);
    },
  };
}

const easeOutBack = (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);

/**
 * spawn a goblin at (x, z). hooks: { damagePlayer(amount, fromPos), poof(x, y, z, opts), bar } }
 */
export function spawnGoblin(tpl, scene, collision, x, z, heading, hooks = {}) {
  const model = SkeletonUtils.clone(tpl.root);
  model.name = 'Goblin';
  model.scale.setScalar(tpl.scale);
  const g = new THREE.Group();
  g.name = 'Goblin';
  g.add(model);
  model.position.y = tpl.footY;
  // per-instance outline hulls + an additive white flash overlay sharing the skinned geometry
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff0cc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthFunc: THREE.LessEqualDepth });
  const skinned = [];
  model.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
  for (const o of skinned) {
    for (const [mat, nm] of [[outline, '_Outline'], [flashMat, '_Flash']]) {
      const m = new THREE.SkinnedMesh(o.geometry, mat);
      m.name = o.name + nm; m.bind(o.skeleton, o.bindMatrix); m.frustumCulled = false;
      m.userData.noExport = true; m.renderOrder = nm === '_Flash' ? 2 : 0;
      o.parent.add(m); m.position.copy(o.position); m.quaternion.copy(o.quaternion); m.scale.copy(o.scale);
    }
  }
  markReflective(g);
  scene.add(g);
  const anim = createAnimator(model, tpl.clips);
  const st = {
    pos: new THREE.Vector3(x, collision.floorAt(x, z).y, z), heading, hp: GOBLIN_HP, state: 'spawn', t: 0,
    vel: new THREE.Vector2(), speed: 0, attackCd: 0.6, stun: 0, flash: 0, hitDone: false, lastHitSwing: -1, gone: false,
  };
  anim.play('Jump_Land', { timeScale: 0.8 });
  const bar = hooks.bar?.();
  const head = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function setState(s) { st.state = s; st.t = 0; }

  return {
    group: g, state: st,
    get alive() { return st.state !== 'dead' && st.state !== 'gone'; },
    /** struck by the axe: dir = unit XZ push direction */
    hit(dirX, dirZ, swingId) {
      if (!this.alive || st.state === 'spawn' && st.t < 0.35 || st.lastHitSwing === swingId) return false;
      st.lastHitSwing = swingId;
      st.hp -= 1; st.flash = 1; st.stun = 0.5;
      st.vel.set(dirX * 4.2, dirZ * 4.2);
      st.heading = Math.atan2(-dirX, -dirZ); // face the attacker
      if (st.hp <= 0) { setState('dead'); anim.play('Death', { hold: true, timeScale: 1.1 }); }
      else { setState('hit'); anim.play('HitReact', { timeScale: 1.3 }); }
      bar?.set(Math.max(0, st.hp) / GOBLIN_HP);
      return true;
    },
    /** flee + vanish (player died) */
    banish() { if (this.alive) { setState('dead'); st.hp = 0; st.banished = true; } },
    update(dt, playerPos, others, camera) {
      st.t += dt;
      st.attackCd -= dt; st.stun -= dt;
      st.flash = Math.max(0, st.flash - dt * 6);
      flashMat.opacity = st.flash * 0.72;
      let wantSpeed = 0, faceTo = null;
      const dx = playerPos.x - st.pos.x, dz = playerPos.z - st.pos.z, dist = Math.hypot(dx, dz);
      switch (st.state) {
        case 'spawn': {
          const k = Math.min(1, st.t / 0.55);
          model.scale.setScalar(tpl.scale * Math.max(0.05, easeOutBack(k)));
          faceTo = Math.atan2(dx, dz);
          if (st.t > 0.9) setState('chase');
          break;
        }
        case 'chase':
          faceTo = Math.atan2(dx, dz);
          if (dist > ATTACK_RANGE * 0.85) wantSpeed = THREE.MathUtils.lerp(WALK_SPEED, RUN_SPEED, THREE.MathUtils.smoothstep(dist, 1.5, 3.2));
          if (dist < ATTACK_RANGE && st.attackCd <= 0 && hooks.canAttack?.() !== false) {
            setState('attack'); st.hitDone = false; anim.play('Weapon', { timeScale: 1.1 });
          }
          break;
        case 'attack': {
          faceTo = st.t < 0.35 ? Math.atan2(dx, dz) : null; // commit to the swing after the wind-up
          const p = anim.progress();
          if (!st.hitDone && p >= 0.42) {
            st.hitDone = true;
            const fx = Math.sin(st.heading), fz = Math.cos(st.heading);
            if (dist < ATTACK_REACH && (dx * fx + dz * fz) / Math.max(dist, 1e-3) > ATTACK_ARC) hooks.damagePlayer?.(ATTACK_DAMAGE, st.pos);
          }
          if (p >= 1 || !anim.current) { st.attackCd = 1.3; setState('chase'); }
          break;
        }
        case 'hit':
          if (st.stun <= 0) { st.attackCd = Math.max(st.attackCd, 0.35); setState('chase'); }
          break;
        case 'dead':
          if (st.t > (st.banished ? 0.15 : 1.05) && !st.poofed) {
            st.poofed = true;
            hooks.poof?.(st.pos.x, st.pos.y + 0.55, st.pos.z, { color: 0x9dff7a, scale: 1.1 });
          }
          if (st.poofed) {
            const k = Math.min(1, (st.t - (st.banished ? 0.15 : 1.05)) / 0.22);
            model.scale.setScalar(tpl.scale * (1 - k) * (1 + 0.25 * Math.sin(k * Math.PI)));
            if (k >= 1) { setState('gone'); g.removeFromParent(); bar?.remove(); }
          }
          break;
        default: break;
      }
      // facing
      if (faceTo !== null) {
        const d = ((faceTo - st.heading + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        st.heading += d * (1 - Math.exp(-dt * 9));
      }
      // locomotion: steer toward the player, keep apart from other goblins, knockback slides
      st.speed += (wantSpeed - st.speed) * (1 - Math.exp(-dt * 6));
      let mx = Math.sin(st.heading) * st.speed * dt, mz = Math.cos(st.heading) * st.speed * dt;
      for (const o of others) {
        if (o.state === st || !o.alive) continue;
        const ox = st.pos.x - o.state.pos.x, oz = st.pos.z - o.state.pos.z, od = Math.hypot(ox, oz);
        if (od < 0.9 && od > 1e-3) { mx += (ox / od) * (0.9 - od) * dt * 4; mz += (oz / od) * (0.9 - od) * dt * 4; }
      }
      if (dist < 0.95 && dist > 1e-3 && st.state !== 'dead') { mx -= (dx / dist) * (0.95 - dist) * dt * 6; mz -= (dz / dist) * (0.95 - dist) * dt * 6; }
      mx += st.vel.x * dt; mz += st.vel.y * dt;
      st.vel.multiplyScalar(Math.exp(-dt * 6.5));
      if (st.state !== 'gone') collision.move(st.pos, mx, mz, RADIUS);
      const floor = collision.floorAt(st.pos.x, st.pos.z).y;
      st.pos.y += (floor - st.pos.y) * (1 - Math.exp(-dt * 18));
      if (st.state === 'spawn') st.pos.y = floor - 0.45 * (1 - Math.min(1, st.t / 0.4)); // rises out of the ring
      g.position.copy(st.pos);
      g.rotation.y = st.heading;
      anim.update(dt, st.speed);
      this.placeBar(camera);
    },
    /** health bar above the head, projected with the camera that renders this frame */
    placeBar(camera) {
      if (bar && camera) {
        head.set(st.pos.x, st.pos.y + HEIGHT + 0.28, st.pos.z);
        tmp.copy(head).project(camera);
        const vis = this.alive && tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1 && st.state !== 'spawn';
        bar.place((tmp.x * 0.5 + 0.5) * innerWidth, (-tmp.y * 0.5 + 0.5) * innerHeight, vis, camera.position.distanceTo(head));
      }
    },
  };
}
