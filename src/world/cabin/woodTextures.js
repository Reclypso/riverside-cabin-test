// Procedural painterly textures for wood and stone (canvas, no external files).
// Grain/bark/stone are near-neutral and tinted by material/vertex colour; end grain is coloured.
import * as THREE from 'three';
import { makeRng } from '../../util/rng.js';

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTex(c, srgb = true, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// soft blotch drawn with wrap-around so the texture tiles
function blotch(ctx, w, h, x, y, r, color) {
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
    const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
  }
}

// Long fibres along U (x). Tiles in both directions.
function drawGrain(ctx, w, h, rng, { streaks = 160, dark = 0.22, knots = 2 } = {}) {
  for (let i = 0; i < 18; i++) {
    const v = rng.range(-18, 18);
    blotch(ctx, w, h, rng() * w, rng() * h, rng.range(40, 120), `rgba(${v > 0 ? '255,240,220' : '70,50,35'},${Math.abs(v) / 100})`);
  }
  for (let i = 0; i < streaks; i++) {
    const y0 = rng() * h, k = rng.int(1, 3), amp = rng.range(1, 6), ph = rng() * 6.28;
    const lw = rng.range(0.6, 3.2);
    const lightS = rng() < 0.3;
    ctx.strokeStyle = lightS ? `rgba(255,246,232,${rng.range(0.05, 0.16)})` : `rgba(60,40,26,${rng.range(0.04, dark)})`;
    ctx.lineWidth = lw;
    for (const dy of [-h, 0, h]) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y = y0 + dy + amp * Math.sin((x / w) * Math.PI * 2 * k + ph);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  for (let i = 0; i < knots; i++) {
    const x = rng() * w * 0.8 + w * 0.1, y = rng() * h * 0.8 + h * 0.1, r = rng.range(5, 11);
    for (let k = 4; k >= 1; k--) {
      ctx.strokeStyle = `rgba(70,45,28,${0.12 + 0.1 * (4 - k)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, y, r * k * 0.9, r * k * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(60,38,22,0.55)';
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.8, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  }
}

export function grainTexture(seed = 1) {
  const key = 'grain' + seed;
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(512, 512);
  const rng = makeRng(seed);
  ctx.fillStyle = 'rgb(214,204,190)';
  ctx.fillRect(0, 0, 512, 512);
  drawGrain(ctx, 512, 512, rng);
  const t = toTex(c);
  cache.set(key, t);
  return t;
}

// Peeled-log look: grain plus darker strips of leftover bark and draw-knife marks.
export function logTexture(seed = 3) {
  const key = 'log' + seed;
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(512, 512);
  const rng = makeRng(seed);
  ctx.fillStyle = 'rgb(206,190,170)';
  ctx.fillRect(0, 0, 512, 512);
  drawGrain(ctx, 512, 512, rng, { streaks: 120, dark: 0.3, knots: 3 });
  for (let i = 0; i < 14; i++) {
    const x = rng() * 512, y = rng() * 512, len = rng.range(60, 220), th = rng.range(6, 22);
    ctx.fillStyle = `rgba(95,62,38,${rng.range(0.1, 0.22)})`;
    for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) {
      ctx.beginPath(); ctx.ellipse(x + dx, y + dy, len / 2, th / 2, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  const t = toTex(c);
  cache.set(key, t);
  return t;
}

export function endGrainTexture(seed = 5) {
  const key = 'end' + seed;
  if (cache.has(key)) return cache.get(key);
  const S = 256;
  const [c, ctx] = canvas(S, S);
  const rng = makeRng(seed);
  const cx = S / 2 + rng.range(-8, 8), cy = S / 2 + rng.range(-8, 8);
  ctx.fillStyle = '#5b3a22'; ctx.fillRect(0, 0, S, S); // bark rim
  const g = ctx.createRadialGradient(cx, cy, 4, S / 2, S / 2, S * 0.47);
  g.addColorStop(0, '#f0d29c'); g.addColorStop(0.7, '#dcb37a'); g.addColorStop(1, '#b98652');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.455, 0, Math.PI * 2); ctx.fill();
  for (let r = 7; r < S * 0.44; r += rng.range(5, 10)) {
    ctx.strokeStyle = `rgba(150,96,52,${rng.range(0.25, 0.5)})`;
    ctx.lineWidth = rng.range(1, 2.2);
    ctx.beginPath();
    for (let a = 0; a <= 64; a++) {
      const t = (a / 64) * Math.PI * 2;
      const rr = r * (1 + 0.04 * Math.sin(t * 3 + r) + 0.02 * Math.sin(t * 7));
      const x = cx + Math.cos(t) * rr, y = cy + Math.sin(t) * rr;
      if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // a couple of drying cracks
  ctx.strokeStyle = 'rgba(70,40,20,0.7)'; ctx.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    const a = rng() * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10);
    ctx.lineTo(cx + Math.cos(a + 0.05) * S * 0.42, cy + Math.sin(a + 0.05) * S * 0.42); ctx.stroke();
  }
  const t = toTex(c, true, false);
  cache.set(key, t);
  return t;
}

export function stoneTexture(seed = 9) {
  const key = 'stone' + seed;
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(256, 256);
  const rng = makeRng(seed);
  ctx.fillStyle = 'rgb(200,200,198)'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    const v = rng.range(-1, 1);
    blotch(ctx, 256, 256, rng() * 256, rng() * 256, rng.range(15, 60),
      v > 0 ? `rgba(255,255,250,${v * 0.18})` : `rgba(60,70,80,${-v * 0.2})`);
  }
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(40,45,55,0.12)';
    ctx.fillRect(rng() * 256, rng() * 256, rng.range(1, 3), rng.range(1, 3));
  }
  const t = toTex(c);
  cache.set(key, t);
  return t;
}
