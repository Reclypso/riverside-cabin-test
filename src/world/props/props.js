// Props assembly: dock + fishing spot, woodcutting spot, rocks, fence, yard clutter.
// Exposes update() (bobber/ripples) and setPreset() (dock lantern glow).
import * as THREE from 'three';
import { buildDock } from './dock.js';
import { buildFishing } from './fishing.js';
import { buildWoodcutting } from './woodpile.js';
import { buildRocks } from './rocks.js';
import { buildFence } from './fence.js';
import { buildSmallProps } from './smallProps.js';
import { applyGlow } from '../cabin/materials.js';

export async function createProps() {
  const group = new THREE.Group();
  group.name = 'Props';
  group.userData.export = 'props';
  const dock = buildDock();
  const fishing = buildFishing();
  group.add(dock, fishing, buildWoodcutting(), buildRocks(), buildFence(), buildSmallProps());
  group.traverse((o) => { if (o.isMesh && o.castShadow === undefined) o.castShadow = true; });

  group.update = (t) => fishing.update(t);
  group.setPreset = (p) => {
    applyGlow(p);
    dock.userData.lanternLight.intensity = 6 * p.lanternGlow;
  };
  return group;
}
