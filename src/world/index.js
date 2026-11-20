// Assembles the area. Each element lives in its own module and returns a named Object3D.
// Returned `updaters` are called every frame with (time, dt, camera).
import * as THREE from 'three';
import { createTerrain } from './terrain.js';
import { createWater } from './water.js';
import { createSky } from './sky.js';
import { createClouds } from './clouds.js';
import { markReflective } from '../render/reflection.js';

const optional = async (path) => { try { return await import(path); } catch (e) { console.warn('skip', path, e.message); return null; } };

export async function buildWorld(scene, { reflection, progress = () => {} }) {
  const updaters = [];
  const presetTargets = [];
  const root = new THREE.Group();
  root.name = 'World';
  scene.add(root);

  const sky = createSky();
  scene.add(markReflective(sky));
  presetTargets.push(sky);
  const clouds = createClouds();
  scene.add(markReflective(clouds));
  presetTargets.push(clouds);
  updaters.push(() => clouds.update());
  progress('sky');

  const terrain = createTerrain();
  root.add(markReflective(terrain));
  progress('terrain');

  const water = createWater(reflection);
  root.add(water);
  reflection.hidden.push(water);
  presetTargets.push(water);
  progress('water');

  // Elements that are built in later steps; each is optional so the viewer still runs
  // while a module is being worked on.
  const steps = [
    ['./backdrop.js', 'createBackdrop'],
    ['./trees/forest.js', 'createForest'],
    ['./grass/grass.js', 'createGrass'],
    ['./grass/flowers.js', 'createFlowers'],
    ['./plants/plants.js', 'createPlants'],
    ['./cabin/cabin.js', 'createCabin'],
    ['./props/props.js', 'createProps'],
    ['./fx/fx.js', 'createFx'],
  ];
  // ?only=cabin,props builds just those optional steps (faster iteration)
  const only = new URLSearchParams(location.search).get('only');
  for (const [path, fn] of steps) {
    if (only && !only.split(',').some((k) => path.includes(k))) continue;
    const mod = await optional(path);
    if (!mod || !mod[fn]) continue;
    let obj = null;
    try { obj = await mod[fn]({ scene, root }); } catch (e) { console.error('build failed', path, e.stack || e.message); }
    if (!obj) continue;
    root.add(obj);
    if (obj.userData.reflect !== false) markReflective(obj);
    if (obj.update) updaters.push((t, dt, cam) => obj.update(t, dt, cam));
    if (obj.setPreset) presetTargets.push(obj);
    progress(path);
  }
  return { root, updaters, presetTargets, water, terrain };
}
