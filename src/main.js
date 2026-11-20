// Entry point: renderer, world, post, camera, UI, and the capture hooks used by tools/.
import * as THREE from 'three';
import { G } from './render/globals.js';
import { PlanarReflection } from './render/reflection.js';
import { createLighting } from './render/lighting.js';
import { createPost } from './render/post.js';
import { createAO, markAO } from './render/ao.js';
import { createCameraRig } from './render/camera.js';
import { PRESETS } from './render/timeOfDay.js';
import { SHOTS, ORBIT } from './render/shots.js';
import { buildWorld } from './world/index.js';
import { setupUI } from './ui.js';
import { createPlayMode } from './character/playMode.js';
import { createCombat } from './combat/combat.js';
import { createCombatDirector } from './combat/director.js';
import { walkRoute } from './character/walkRoute.js';
import { createAutopilot } from './character/autopilot.js';

const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE, stencil: false });
renderer.setPixelRatio(CAPTURE ? 1 : Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.localClippingEnabled = true; // cabin roof/wall cutaway when the player is inside
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.name = 'IdleLookTest';
const { camera, controls, setShot: placeCamera } = createCameraRig(renderer);
const lighting = createLighting(scene);
const reflection = new PlanarReflection(renderer, { scale: 0.5 });
const post = createPost(renderer, scene, camera);
const ao = createAO(renderer, scene, camera);
const AO_STRENGTH = params.has('noao') ? 0 : 1;
const ui = setupUI({ capture: CAPTURE || params.get('ui') === '0' });

const world = await buildWorld(scene, { reflection, renderer, progress: (s) => ui.progress(s) });
ui.progress('character');
const play = params.has('noplayer') ? null
  : await createPlayMode({ scene, root: world.root, camera, controls, dom: renderer.domElement, ui, capture: CAPTURE });
if (play) markAO(play.player.model);
ui.progress('goblins');
const combat = play && !params.has('nocombat') ? await createCombat({ scene, root: world.root, play, camera }) : null;
let preset = 'day';
function applyPreset(name) {
  preset = name;
  const p = PRESETS[name];
  lighting.apply(p);
  post.apply(p);
  for (const o of world.presetTargets) o.setPreset(p);
  ui.setTod(name);
}

// name = key of SHOTS, or 'cam:label:x,y,z:tx,ty,tz:fov[:tod]' for ad-hoc views
function parseShot(name) {
  if (!name.startsWith('cam:')) return SHOTS[name];
  const [, , p, t, fov, tod, flags = ''] = name.split(':');
  return { pos: p.split(',').map(Number), target: t.split(',').map(Number), fov: +fov || 40, tod: tod || 'day',
    cutaway: flags.includes('cut'), door: flags.includes('door') ? 1 : 0 };
}
function setShot(name) {
  const s = parseShot(name);
  if (play) play.setPlaying(false);
  combat?.reset();
  if (play && s.char) play.player.place(...s.char);
  if (play) play.player.model.visible = s.char !== null;
  const cabin = world.root.getObjectByName('Cabin');
  cabin?.setCutaway?.(!!s.cutaway, true);
  cabin?.setDoor?.(s.door ?? 0);
  placeCamera(s);
  applyPreset(s.tod || preset);
  if (s.dof) post.setDof(true, ...s.dof); else post.setDof(false);
}

let time = 6.0; // world seconds (fixed start so captures are deterministic)
let camOverride = null, camOverrideUsed = false; // one-frame cinematic camera for capture stills (renderCombatFrame camFrames)
function frame(dt) {
  G.uTime.value = time;
  // hit-stop slows the player + goblins for a few frames; the world keeps running
  if (play) play.update(dt * (combat ? combat.timeScale() : 1), CAPTURE ? time : undefined);
  if (combat) combat.update(dt, time, play.playing);
  if (camOverride) { camOverride(); camOverride = null; }
  if (play?.playing && !camOverrideUsed) { G.uFocus.value.copy(play.player.state.pos).y += 1.4; G.uFocusOn.value = 1; } else G.uFocusOn.value = 0;
  camOverrideUsed = false;
  // the follow/orbit camera just moved: refresh its world matrix before the reflection and AO
  // passes read it (otherwise they lag the main view by one frame)
  camera.updateMatrixWorld();
  for (const u of world.updaters) u(time, dt, camera);
  renderer.shadowMap.needsUpdate = true;
  G.uAOParams.value.z = 0; // side passes don't sample screen-space AO
  const focusOn = G.uFocusOn.value; G.uFocusOn.value = 0; // no tunnel in the mirrored view
  reflection.update(scene, camera);
  G.uFocusOn.value = focusOn;
  if (AO_STRENGTH > 0) ao.update();
  G.uAOParams.value.z = AO_STRENGTH;
  if (params.has('aoDebug')) { ao.debugToScreen(); return; }
  if (params.has('nopost')) renderer.render(scene, camera); else post.render(dt);
}

function onResize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  post.setSize(w, h);
  ao.setSize(renderer.getDrawingBufferSize(new THREE.Vector2()).x, renderer.getDrawingBufferSize(new THREE.Vector2()).y);
  const db = renderer.getDrawingBufferSize(new THREE.Vector2());
  reflection.setSize(db.x, db.y);
}
addEventListener('resize', onResize);
onResize();
setShot(params.get('shot') || 'idle');
if (params.get('tod')) applyPreset(params.get('tod'));

renderer.compile(scene, camera);
// gameplay pre-warm (interactive only, behind the loader): render the follow-camera view once
// with a goblin, the hand axe, the swing trail and a fairy burst on screen, so entering play and
// the first fight don't hitch on shader compiles (measured: 150 ms / 370 ms / 35 ms before)
if (play && combat && !CAPTURE && !params.has('noprewarm')) {
  play.setPlaying(true);
  combat.prewarm(true);
  frame(0);
  combat.prewarm(false);
  play.setPlaying(false);
  setShot(params.get('shot') || 'idle');
  if (params.get('tod')) applyPreset(params.get('tod'));
  frame(0);
}

// ---- interactive loop ----
const timer = new THREE.Timer();
let autoOrbit = false;
ui.on({
  orbit: (on) => { autoOrbit = on; controls.autoRotate = on; },
  tod: (name) => applyPreset(name),
  shot: (name) => setShot(name),
});
if (!CAPTURE) {
  renderer.setAnimationLoop((ts) => {
    timer.update(ts);
    const dt = Math.min(timer.getDelta(), 0.1);
    time += dt;
    if (!play?.playing) controls.update(dt);
    frame(dt);
    ui.tick(dt);
  });
}

// ---- capture hooks (tools/shoot.mjs, tools/video.mjs) ----
window.__shotNames = Object.keys(SHOTS);
window.setShot = (n) => { setShot(n); };
window.renderStill = () => { frame(1 / 30); return true; };
window.renderStatic = () => { frame(0); return true; }; // re-render without advancing the simulation (GPU timing)
window.renderFrame = (i, fps = 30) => {
  const t = i / fps;
  time = 6.0 + t;
  const k = Math.min(t / ORBIT.seconds, 1);
  const e = k * k * (3 - 2 * k) * 0.35 + k * 0.65; // gentle ease
  const az = ORBIT.fromAz + (ORBIT.toAz - ORBIT.fromAz) * e;
  const [tx, ty, tz] = ORBIT.target;
  camera.position.set(tx + Math.sin(az) * ORBIT.radius, ty + ORBIT.height, tz + Math.cos(az) * ORBIT.radius);
  controls.target.set(tx, ty, tz);
  camera.fov = 36; camera.updateProjectionMatrix();
  camera.lookAt(tx, ty, tz);
  frame(1 / fps);
  return true;
};
// deterministic gameplay capture (tools/walk_video.mjs): autopilot walks the route into the cabin
let walk = null;
window.renderWalkFrame = (i, fps = 30) => {
  if (!play) return false;
  if (i === 0 || !walk) {
    applyPreset(params.get('tod') || 'day');
    const route = walkRoute(world.root);
    play.setPlaying(true);
    play.player.place(route.start.x, route.start.z, route.start.heading);
    play.player.follow.snapBehind(route.start.heading);
    walk = createAutopilot(route.points, () => play.player.follow.yaw, { faceAt: route.faceAt });
    play.player.setSource(walk);
    camera.fov = 45; camera.updateProjectionMatrix();
  }
  time = 6.0 + i / fps;
  frame(1 / fps);
  return walk.done;
};
// deterministic combat capture (tools/combat_video.mjs): walk into the meadow fairy circle, a
// goblin rises, chases, swings, and gets chopped down. Returns the director phase.
let fight = null;
window.renderCombatFrame = (i, fps = 30, opts = {}) => {
  if (!play || !combat) return 'done';
  const fairy = world.root.getObjectByName('FairyCircles');
  const circle = fairy.userData.circles[opts.circle ?? 0];
  if (i === 0 || !fight) {
    applyPreset(opts.tod || 'day');
    combat.reset();
    const sx = circle.x + (opts.dx ?? -8.2), sz = circle.z + (opts.dz ?? -4.8); // sun at his back
    const h = Math.atan2(circle.x - sx, circle.z - sz);
    time = (opts.t0 ?? 40) ; // circles are ready (cooldowns keyed on world time)
    play.setPlaying(true);
    play.player.place(sx, sz, h);
    play.player.follow.snapBehind(h);
    if (opts.dist) { play.player.follow.state.targetDist = opts.dist; play.player.follow.state.dist = opts.dist; }
    if (opts.pitch) play.player.follow.state.pitch = opts.pitch;
    fight = createCombatDirector({ circle, start: { x: sx + 6, z: sz - 5 }, getCamYaw: () => play.player.follow.yaw, combat, player: play.player });
    play.player.setSource(fight);
    camera.fov = opts.fov || 45; camera.updateProjectionMatrix();
  }
  time = (opts.t0 ?? 40) + i / fps;
  const co = opts.camFrames?.[i];
  camera.fov = co?.fov ?? (opts.fov || 45); camera.updateProjectionMatrix();
  if (co) { camOverride = () => placeCombatCam(co); camOverrideUsed = true; }
  frame(1 / fps);
  return fight.phase;
};
// side-on framing of the woodsman and the nearest goblin (or the spawn ring)
function placeCombatCam(co) {
  const p = play.player.state.pos;
  const g = combat.goblins.find((x) => x.state.state !== 'gone');
  const gp = g ? g.state.pos : p;
  const mid = p.clone().lerp(gp, co.focus ?? 0.5);
  let dx = gp.x - p.x, dz = gp.z - p.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  const side = co.side ?? 1, px = -dz * side, pz = dx * side;
  camera.position.set(mid.x + px * co.dist - dx * (co.back ?? 0), mid.y + co.h, mid.z + pz * co.dist - dz * (co.back ?? 0));
  camera.lookAt(mid.x, mid.y + (co.ty ?? 0.9), mid.z);
  combat.placeBars(camera);
}
window.__app = { renderer, scene, camera, world, applyPreset, post, lighting, play, ao, combat };
const gl = renderer.getContext();
const dbg = gl.getExtension('WEBGL_debug_renderer_info');
window.__gpuInfo = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown';
window.__ready = true;
ui.done();
