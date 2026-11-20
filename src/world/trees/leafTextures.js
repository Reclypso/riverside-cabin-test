// Canvas-painted leaf clump textures (greyscale value painting + alpha cut-out).
// Species colour comes from the material/vertex colours so variants can be tinted.
import * as THREE from 'three';
import { makeRng } from '../../util/rng.js';

const SHAPES = {
  // returns a Path2D for a leaf pointing up (+y = tip), length 1
  oak() {
    const p = new Path2D();
    p.moveTo(0, 0);
    const lobes = 4;
    for (let side = -1; side <= 1; side += 2) {
      p.moveTo(0, 0);
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const w = 0.32 * Math.sin(Math.PI * t) * (0.75 + 0.25 * Math.abs(Math.sin(t * Math.PI * lobes)));
        p.lineTo(side * w, t);
      }
    }
    return p;
  },
  maple() {
    const p = new Path2D();
    const pts = 5, outer = [1, 0.62, 0.78, 0.62, 1];
    const angs = [-1.25, -0.62, 0, 0.62, 1.25];
    p.moveTo(0, 0.05);
    for (let i = 0; i < pts; i++) {
      const a = angs[i], r = outer[i] * 0.55;
      const ax = Math.sin(a) * r, ay = 0.38 + Math.cos(a) * r;
      const notchA = a + 0.31;
      p.lineTo(ax * 0.55 + Math.sin(a - 0.25) * 0.08, 0.38 + (ay - 0.38) * 0.55);
      p.lineTo(ax, ay);
      if (i < pts - 1) p.lineTo(Math.sin(notchA) * 0.2, 0.38 + Math.cos(notchA) * 0.2);
    }
    p.closePath();
    return p;
  },
  oval() {
    const p = new Path2D();
    p.moveTo(0, 0);
    p.bezierCurveTo(0.34, 0.2, 0.3, 0.7, 0, 1);
    p.bezierCurveTo(-0.3, 0.7, -0.34, 0.2, 0, 0);
    return p;
  },
  round() {
    const p = new Path2D();
    p.moveTo(0, 0);
    p.bezierCurveTo(0.5, 0.15, 0.45, 0.85, 0, 0.95);
    p.bezierCurveTo(-0.45, 0.85, -0.5, 0.15, 0, 0);
    return p;
  },
};

function drawLeaf(ctx, shape, x, y, len, ang, v) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(len, -len); // tip toward -y canvas = outward after rotate
  const g = ctx.createLinearGradient(0, 0, 0, 1);
  g.addColorStop(0, `rgb(${v * 0.8 | 0},${v * 0.8 | 0},${v * 0.8 | 0})`);
  g.addColorStop(0.75, `rgb(${v | 0},${v | 0},${v | 0})`);
  g.addColorStop(1, `rgb(${Math.min(255, v * 1.08) | 0},${Math.min(255, v * 1.08) | 0},${Math.min(255, v * 1.08) | 0})`);
  ctx.fillStyle = g;
  ctx.fill(SHAPES[shape]());
  // midrib
  ctx.strokeStyle = `rgba(0,0,0,0.07)`;
  ctx.lineWidth = 0.025;
  ctx.beginPath(); ctx.moveTo(0, 0.05); ctx.lineTo(0, 0.85); ctx.stroke();
  ctx.restore();
}

// A roughly round clump of leaves radiating from the centre.
export function paintLeafClump(shape, { seed = 1, count = 90, leafLen = 0.2, size = 512 } = {}) {
  const rng = makeRng(seed);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const c = size / 2;
  const leaves = [];
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * size * 0.3;
    const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
    const len = size * leafLen * (0.75 + rng() * 0.45) * (1 - (r / (size * 0.3)) * 0.25);
    const ang = Math.atan2(y - c, x - c) + Math.PI / 2 + (rng() - 0.5) * 0.9;
    leaves.push({ x, y, len, ang, v: 185 + rng() * 70, r });
  }
  // solid painted core so the card interior has no see-through gaps; leaves make the edge
  const core = ctx.createRadialGradient(c, c, 0, c, c, size * 0.27);
  core.addColorStop(0, 'rgb(150,150,150)'); core.addColorStop(1, 'rgb(175,175,175)');
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.arc(c, c, size * 0.25, 0, Math.PI * 2); ctx.fill();
  // inner leaves first (darker), outer leaves on top
  leaves.sort((p, q) => p.r - q.r);
  for (const l of leaves) drawLeaf(ctx, shape, l.x, l.y, l.len, l.ang, l.v * (0.86 + 0.14 * (l.r / (size * 0.3))));
  return finish(cv, 150);
}

// Elongated fir spray for pine branch cards (tip at the top of the texture): a solid dark
// core shape (so cards read as dense needle mass) fringed with brighter needles.
export function paintFirSpray({ seed = 3, w = 256, h = 512 } = {}) {
  const rng = makeRng(seed);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.lineCap = 'round';
  // core silhouette: wide at the base, tapering to the tip, slightly ragged
  ctx.fillStyle = 'rgb(118,118,118)';
  ctx.beginPath();
  ctx.moveTo(w / 2, h * 0.02);
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, y = h * (0.04 + t * 0.92);
    ctx.lineTo(w / 2 + w * 0.36 * Math.sin(Math.PI * Math.min(1, t * 0.8 + 0.08)) * (0.85 + 0.15 * rng()), y);
  }
  for (let i = 24; i >= 0; i--) {
    const t = i / 24, y = h * (0.04 + t * 0.92);
    ctx.lineTo(w / 2 - w * 0.36 * Math.sin(Math.PI * Math.min(1, t * 0.8 + 0.08)) * (0.85 + 0.15 * rng()), y);
  }
  ctx.closePath(); ctx.fill();
  // needles: many short strokes angled toward the tip, brighter toward the outside/top
  for (let i = 0; i < 900; i++) {
    const t = rng();
    const y = h * (0.05 + t * 0.9);
    const half = w * 0.4 * Math.sin(Math.PI * Math.min(1, t * 0.8 + 0.08));
    const side = rng() < 0.5 ? -1 : 1;
    const off = Math.pow(rng(), 0.6) * half;
    const x = w / 2 + side * off;
    const a = -Math.PI / 2 + side * (0.6 + rng() * 0.5);
    const L = w * (0.07 + rng() * 0.07);
    const v = 130 + (off / Math.max(half, 1)) * 90 + rng() * 35;
    ctx.strokeStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
    ctx.lineWidth = 3 + rng() * 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.stroke();
  }
  ctx.strokeStyle = 'rgb(90,80,70)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(w / 2, h * 0.98); ctx.lineTo(w / 2, h * 0.1); ctx.stroke();
  return finish(cv, 140);
}

// Build an RGBA texture whose transparent texels still carry leaf colour (no dark/bright
// fringes when filtered or alpha-tested): colour = painted canvas over a dilated base,
// alpha = coverage of the painted canvas.
function finish(cv, fillValue = 175) {
  const w = cv.width, h = cv.height;
  const src = cv.getContext('2d').getImageData(0, 0, w, h).data;
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const a = src[i * 4 + 3];
    const k = a / 255;
    // canvas returns un-premultiplied colour; blend toward the fill where coverage is thin
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(src[i * 4 + c] * k + fillValue * (1 - k));
    out[i * 4 + 3] = a > 110 ? 255 : 0; // binary coverage: no half-transparent gaps between leaves
  }
  // flip rows so canvas top = v 1 (match CanvasTexture convention)
  const flipped = new Uint8Array(out.length);
  for (let y = 0; y < h; y++) flipped.set(out.subarray(y * w * 4, (y + 1) * w * 4), (h - 1 - y) * w * 4);
  const tex = new THREE.DataTexture(flipped, w, h, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
