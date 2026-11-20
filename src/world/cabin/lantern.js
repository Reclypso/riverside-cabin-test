// Small iron lantern (frame, glowing glass core, pyramid cap, ring). Built around its own
// origin at the bottom centre; `m` places it. Returns the glow centre in the same space.
import * as THREE from 'three';
import { mtx } from './geom.js';

const cone = new THREE.ConeGeometry(0.12, 0.1, 4, 1);
cone.rotateY(Math.PI / 4);

export function buildLantern(builder, m, scale = 1) {
  const S = (x, y, z, rx = 0, ry = 0, rz = 0) => m.clone().multiply(mtx(x * scale, y * scale, z * scale, rx, ry, rz, scale, scale, scale));
  builder.add('iron', new THREE.BoxGeometry(0.17, 0.03, 0.17), S(0, 0.015, 0));
  for (const [x, z] of [[-0.07, -0.07], [0.07, -0.07], [-0.07, 0.07], [0.07, 0.07]]) {
    builder.add('iron', new THREE.BoxGeometry(0.018, 0.2, 0.018), S(x, 0.13, z));
  }
  builder.add('lanternGlass', new THREE.BoxGeometry(0.125, 0.19, 0.125), S(0, 0.125, 0));
  builder.add('iron', new THREE.BoxGeometry(0.17, 0.025, 0.17), S(0, 0.24, 0));
  builder.add('iron', cone, S(0, 0.3, 0));
  builder.add('iron', new THREE.TorusGeometry(0.03, 0.007, 6, 12), S(0, 0.37, 0));
  return new THREE.Vector3(0, 0.125 * scale, 0).applyMatrix4(m);
}
