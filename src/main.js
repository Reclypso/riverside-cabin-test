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
function frame(dt) {
  G.uTime.value = time;
  if (play) play.update(dt, CAPTURE ? time : undefined);
  // the follow/orbit camera just moved: refresh its world matrix before the reflection and AO
  // passes read it (otherwise they lag the main view by one frame)
  camera.updateMatrixWorld();
  for (const u of world.updaters) u(time, dt, camera);
  renderer.shadowMap.needsUpdate = true;
  G.uAOParams.value.z = 0; // side passes don't sample screen-space AO
  reflection.update(scene, camera);
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
window.__app = { renderer, scene, camera, world, applyPreset, post, lighting, play, ao };
const gl = renderer.getContext();
const dbg = gl.getExtension('WEBGL_debug_renderer_info');
window.__gpuInfo = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown';
window.__ready = true;
ui.done();
