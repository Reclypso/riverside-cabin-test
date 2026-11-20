// Fairy circles: rings of mushrooms and star flowers with a pulsing ground glow and rising
// sparkles. Walking into a ready circle triggers it: a burst of sparkles + flash + light pillar,
// then a 20 s cooldown during which the circle dims, then it brightens again. The game spawns a
// goblin SPAWN_DELAY seconds after a trigger (see userData API below).
//
// Everything is a closed-form function of world time t (no per-frame accumulation, no runtime
// randomness), so capture renders are deterministic and a time rewind resets cleanly.
//
// API on the returned group (name 'FairyCircles'):
//   userData.circles                [{ name, x, y, z, r }]
//   userData.check(pos, t)          -> index of the circle just triggered by pos (feet), or -1
//   userData.trigger(i, t)          force a trigger
//   userData.state(i, t)            -> { ready, cooldownLeft }
//   userData.burst(x, y, z, t, { color, scale, pillar, ring, life })  pooled sparkle poof
//   userData.SPAWN_DELAY, userData.COOLDOWN
import * as THREE from 'three';
import { groundY } from '../heightfield.js';
import { markReflective } from '../../render/reflection.js';
import { FAIRY_CIRCLES } from './layout.js';
import { createRingMeshes } from './ringMeshes.js';
import { createFairyVfx } from './fairyVfx.js';

export const COOLDOWN = 20;
export const SPAWN_DELAY = 0.45;
const PALETTES = [
  [0xffd77a, 0x9dffc8], // meadow: warm gold + mint
  [0xd9a6ff, 0x8fc3ff], // grove: lilac + periwinkle
  [0x7dfff0, 0xc6e4ff], // river: aqua + ice
  [0xffa8d4, 0xffe7a3], // upriver: rose + pale gold
];

// cooldown dimming, piecewise linear in a = t - triggerTime: 0 -> 1 over [0.5, 1.5],
// 1 until 18, back to 0 by 20 (so the circle is at full strength the moment it is ready)
function dim(a) {
  if (a < 0.5 || a >= COOLDOWN) return 0;
  if (a < 1.5) return a - 0.5;
  if (a < COOLDOWN - 2) return 1;
  return (COOLDOWN - a) / 2;
}
// closed-form integral of dim over [0, a] (drives the mote phase so motes slow without jumps)
function dimIntegral(a) {
  if (a <= 0.5) return 0;
  if (a <= 1.5) return (a - 0.5) ** 2 / 2;
  const s1 = 0.5;
  if (a <= COOLDOWN - 2) return s1 + (a - 1.5);
  const s2 = s1 + (COOLDOWN - 2 - 1.5);
  if (a <= COOLDOWN) { const u = a - (COOLDOWN - 2); return s2 + u - (u * u) / 4; }
  return s2 + 1;
}
function flash(a) {
  if (a < 0 || a > 2.5) return 0;
  return a < 0.1 ? a / 0.1 : Math.exp(-(a - 0.1) * 3.0);
}
const smooth = (x) => x * x * (3 - 2 * x);

export async function createFairyCircles({ renderer } = {}) {
  const group = new THREE.Group();
  group.name = 'FairyCircles';
  group.userData.reflect = false; // only the static rings go into the river reflection (below)

  const circles = FAIRY_CIRCLES.map((c) => ({ name: c.name, x: c.x, y: groundY(c.x, c.z), z: c.z, r: c.r, palette: c.palette }));
  const n = circles.length;
  const U = {
    uFairyCircle: { value: circles.map((c) => new THREE.Vector4(c.x, c.y, c.z, c.r)) },
    uFairyEnergy: { value: Array.from({ length: 4 }, () => new THREE.Vector4(1, 0, 0, 1)) },
    uFairyColA: { value: Array.from({ length: 4 }, (_, i) => new THREE.Color(PALETTES[circles[i]?.palette ?? 0][0])) },
    uFairyColB: { value: Array.from({ length: 4 }, (_, i) => new THREE.Color(PALETTES[circles[i]?.palette ?? 0][1])) },
    uFairyBoost: { value: 1 },
    uFTime: { value: 0 },
    uViewH: { value: 1080 },
  };
  while (U.uFairyCircle.value.length < 4) U.uFairyCircle.value.push(new THREE.Vector4(0, -1e4, 0, 1));

  const rings = createRingMeshes(circles, U);
  markReflective(rings);
  group.add(rings);
  const vfx = createFairyVfx(circles, U);
  group.add(vfx.group);

  const last = new Array(n).fill(-Infinity);
  const size = new THREE.Vector2();

  function state(i, t) {
    const left = Math.max(0, last[i] + COOLDOWN - t);
    return { ready: left <= 0, cooldownLeft: left };
  }
  function trigger(i, t) {
    const c = circles[i];
    last[i] = t;
    vfx.burst(c.x, c.y + 0.05, c.z, t, { color: PALETTES[c.palette][0], scale: 1.25, pillar: true, ring: true, life: 1.8 });
    return i;
  }
  function check(pos, t) {
    for (let i = 0; i < n; i++) {
      const c = circles[i];
      if (Math.hypot(pos.x - c.x, pos.z - c.z) > c.r * 0.82 || Math.abs(pos.y - c.y) > 2) continue;
      if (t < last[i]) last[i] = -Infinity; // rewound
      if (state(i, t).ready) return trigger(i, t);
    }
    return -1;
  }

  group.update = (t, dt, cam) => {
    U.uFTime.value = t;
    vfx.update(t);
    for (let i = 0; i < n; i++) {
      if (t < last[i] - 1e-4) last[i] = -Infinity; // time went backwards (capture restart)
      const a = t - last[i];
      const d = Number.isFinite(a) ? dim(a) : 0;
      const f = Number.isFinite(a) ? flash(a) : 0;
      const ds = smooth(Math.min(1, Math.max(0, d)));
      const phase = t - (Number.isFinite(a) ? 0.72 * dimIntegral(a) : 0);
      U.uFairyEnergy.value[i].set(1 - 0.8 * ds + 0.9 * f, phase, f, 1 - 0.78 * ds);
    }
    // sprites are sized in world units: needs the drawing-buffer height of the main view
    if (renderer) { renderer.getDrawingBufferSize(size); U.uViewH.value = size.y; }
  };
  group.setPreset = (p) => {
    // by day the additive glow sits on a bright meadow and needs more push; at golden hour less
    U.uFairyBoost.value = 1.25 - 0.5 * (p.lanternGlow ?? 0);
  };

  Object.assign(group.userData, {
    circles: circles.map(({ name, x, y, z, r }) => ({ name, x, y, z, r })),
    check, trigger, state,
    burst: (x, y, z, t, opts) => vfx.burst(x, y, z, t, opts),
    SPAWN_DELAY, COOLDOWN,
    counts: rings.userData.counts,
  });
  return group;
}
