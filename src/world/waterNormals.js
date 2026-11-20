// Tileable ripple normal map generated from periodic value noise (no external textures).
import * as THREE from 'three';
import { makeRng } from '../util/rng.js';

function periodicNoise(size, cells, rng) {
  const lat = new Float32Array(cells * cells).map(() => rng());
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells, fy = (y / size) * cells;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      let tx = fx - ix, ty = fy - iy;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const a = lat[(iy % cells) * cells + (ix % cells)], b = lat[(iy % cells) * cells + ((ix + 1) % cells)];
      const c = lat[((iy + 1) % cells) * cells + (ix % cells)], d = lat[((iy + 1) % cells) * cells + ((ix + 1) % cells)];
      out[y * size + x] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    }
  }
  return out;
}

export function makeWaterNormals(size = 256, seed = 5) {
  const rng = makeRng(seed);
  const h = new Float32Array(size * size);
  const octaves = [[4, 1.0], [8, 0.5], [16, 0.28], [32, 0.12]];
  for (const [cells, amp] of octaves) {
    const n = periodicNoise(size, cells, rng);
    // ridged-ish ripples read as little wavelets
    for (let k = 0; k < h.length; k++) h[k] += amp * (1 - Math.abs(n[k] * 2 - 1));
  }
  const data = new Uint8Array(size * size * 4);
  const strength = 2.2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
      const u = h[((y - 1 + size) % size) * size + x], d = h[((y + 1) % size) * size + x];
      let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const k = (y * size + x) * 4;
      data[k] = (nx * 0.5 + 0.5) * 255; data[k + 1] = (ny * 0.5 + 0.5) * 255; data[k + 2] = (nz * 0.5 + 0.5) * 255; data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}
