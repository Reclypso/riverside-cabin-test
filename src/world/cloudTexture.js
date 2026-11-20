// Paints stylised cumulus clouds (anime style). The silhouette is a blurred union of puffs;
// shading is the per-pixel MAX of light-offset puff gradients, so lobes merge smoothly with
// bright sun-facing tops and a flat, shaded base. Output: R = light (0..1), A = coverage.
import * as THREE from 'three';
import { makeRng } from '../util/rng.js';

function layout(rng, w, h, puffs, wispy) {
  const base = h * (wispy ? 0.6 : 0.8);
  const span = w * (wispy ? 0.4 : 0.34);
  const list = [];
  for (let i = 0; i < puffs; i++) {
    const t = rng.range(-1, 1);
    const shape = Math.pow(1 - t * t, 0.8);
    const r = (wispy ? h * 0.05 : h * 0.08) + rng() * h * (wispy ? 0.06 : 0.14) * (0.35 + shape);
    const x = w / 2 + t * span;
    const y = base - r * 0.5 - rng() * (wispy ? h * 0.05 : h * 0.36) * shape;
    list.push({ x, y, r });
  }
  // a few small bumps along the top contour for cauliflower detail
  const extra = [];
  for (const p of list) {
    if (rng() < 0.5) continue;
    const a = -Math.PI / 2 + rng.range(-1.1, 1.1);
    extra.push({ x: p.x + Math.cos(a) * p.r * 0.85, y: p.y + Math.sin(a) * p.r * 0.85, r: p.r * rng.range(0.25, 0.45) });
  }
  return { list: list.concat(extra), base };
}

export function paintCloud(seed, { w = 1024, h = 512, puffs = 24, wispy = false } = {}) {
  const rng = makeRng(seed);
  const { list, base } = layout(rng, w, h, puffs, wispy);

  // coverage mask
  const mask = document.createElement('canvas'); mask.width = w; mask.height = h;
  const m = mask.getContext('2d');
  m.filter = 'blur(1.2px)';
  m.fillStyle = '#fff';
  for (const p of list) { m.beginPath(); m.arc(p.x, p.y, p.r, 0, Math.PI * 2); m.fill(); }
  // flat bottom: erase below the base line with a soft edge
  m.filter = 'none';
  m.globalCompositeOperation = 'destination-out';
  const cut = m.createLinearGradient(0, base - 8, 0, base + 14);
  cut.addColorStop(0, 'rgba(0,0,0,0)'); cut.addColorStop(1, 'rgba(0,0,0,1)');
  m.fillStyle = cut; m.fillRect(0, base - 8, w, h);

  // light field: max of puff gradients offset toward the sun (upper left)
  const light = document.createElement('canvas'); light.width = w; light.height = h;
  const l = light.getContext('2d');
  l.fillStyle = '#000'; l.fillRect(0, 0, w, h);
  l.globalCompositeOperation = 'lighten';
  for (const p of list) {
    const g = l.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.55, p.r * 0.05, p.x, p.y, p.r * 1.05);
    const top = 1 - Math.max(0, Math.min(1, (p.y - (base - h * 0.5)) / (h * 0.5))) * 0.35;
    const v = Math.round(255 * top);
    g.addColorStop(0, `rgb(${v},${v},${v})`);
    g.addColorStop(0.6, `rgb(${v * 0.72 | 0},${v * 0.72 | 0},${v * 0.72 | 0})`);
    g.addColorStop(1, 'rgb(40,40,40)');
    l.fillStyle = g;
    l.beginPath(); l.arc(p.x, p.y, p.r * 1.05, 0, Math.PI * 2); l.fill();
  }
  // shade toward the flat base
  l.globalCompositeOperation = 'multiply';
  const gb = l.createLinearGradient(0, base - h * 0.32, 0, base);
  gb.addColorStop(0, 'rgb(255,255,255)'); gb.addColorStop(1, 'rgb(120,120,120)');
  l.fillStyle = gb; l.fillRect(0, 0, w, h);

  const md = m.getImageData(0, 0, w, h).data, ld = l.getImageData(0, 0, w, h).data;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const dst = (h - 1 - y) * w * 4, src = y * w * 4; // flip so canvas top = v 1
    for (let x = 0; x < w * 4; x += 4) {
      const v = ld[src + x];
      out[dst + x] = v; out[dst + x + 1] = v; out[dst + x + 2] = v;
      out[dst + x + 3] = md[src + x + 3];
    }
  }
  const tex = new THREE.DataTexture(out, w, h, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}
