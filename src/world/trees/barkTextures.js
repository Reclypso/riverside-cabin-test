// Canvas-painted bark textures (tileable vertically and around the trunk).
import * as THREE from 'three';
import { makeRng } from '../../util/rng.js';

const W = 256, H = 512;

function base(fill) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = fill; ctx.fillRect(0, 0, W, H);
  return [cv, ctx];
}

// draw with horizontal wrap so the texture tiles around the trunk
function wrapDraw(ctx, x, fn) { fn(x); fn(x - W); fn(x + W); }

function furrowed(rng, { fill, dark, light, n = 26, wav = 6 }) {
  const [cv, ctx] = base(fill);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x0 = rng() * W, w = 4 + rng() * 9;
    const draw = (x) => {
      ctx.strokeStyle = dark; ctx.lineWidth = w;
      ctx.beginPath();
      for (let y = -20; y <= H + 20; y += 16) ctx.lineTo(x + Math.sin(y * 0.02 + i) * wav + (rng() - 0.5) * 3, y);
      ctx.stroke();
      ctx.strokeStyle = light; ctx.lineWidth = w * 0.35;
      ctx.beginPath();
      for (let y = -20; y <= H + 20; y += 16) ctx.lineTo(x + w * 0.9 + Math.sin(y * 0.02 + i) * wav, y);
      ctx.stroke();
    };
    wrapDraw(ctx, x0, draw);
  }
  // soft blotches for painterly value variation
  for (let i = 0; i < 40; i++) {
    const x = rng() * W, y = rng() * H, r = 10 + rng() * 30;
    ctx.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
    wrapDraw(ctx, x, (xx) => { ctx.beginPath(); ctx.ellipse(xx, y, r, r * 2, 0, 0, Math.PI * 2); ctx.fill(); });
  }
  return cv;
}

function birch(rng) {
  const [cv, ctx] = base('#ece6da');
  for (let i = 0; i < 30; i++) {
    const x = rng() * W, y = rng() * H, r = 15 + rng() * 40;
    ctx.fillStyle = rng() < 0.5 ? 'rgba(200,190,170,0.25)' : 'rgba(255,255,250,0.3)';
    wrapDraw(ctx, x, (xx) => { ctx.beginPath(); ctx.ellipse(xx, y, r * 1.5, r * 0.5, 0, 0, Math.PI * 2); ctx.fill(); });
  }
  // lenticels: thin horizontal dark dashes
  for (let i = 0; i < 70; i++) {
    const x = rng() * W, y = rng() * H, w = 8 + rng() * 34, h = 1.5 + rng() * 3.5;
    ctx.fillStyle = `rgba(40,35,32,${0.5 + rng() * 0.4})`;
    wrapDraw(ctx, x, (xx) => { ctx.beginPath(); ctx.ellipse(xx, y, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill(); });
  }
  // a few big dark patches
  for (let i = 0; i < 7; i++) {
    const x = rng() * W, y = rng() * H, w = 20 + rng() * 50, h = 8 + rng() * 16;
    ctx.fillStyle = 'rgba(45,40,36,0.85)';
    wrapDraw(ctx, x, (xx) => {
      ctx.beginPath(); ctx.moveTo(xx - w / 2, y);
      ctx.quadraticCurveTo(xx, y - h, xx + w / 2, y); ctx.quadraticCurveTo(xx, y + h * 0.6, xx - w / 2, y); ctx.fill();
    });
  }
  return cv;
}

function plated(rng) {
  const [cv, ctx] = base('#7a4a34');
  for (let y = -10; y < H + 20; y += 14 + rng() * 10) {
    for (let x = 0; x < W; x += 18 + rng() * 14) {
      const w = 16 + rng() * 14, h = 10 + rng() * 12;
      const v = 0.85 + rng() * 0.35;
      ctx.fillStyle = `rgb(${150 * v | 0},${92 * v | 0},${62 * v | 0})`;
      wrapDraw(ctx, x, (xx) => { ctx.beginPath(); ctx.ellipse(xx, y, w / 2, h / 2, (rng() - 0.5) * 0.3, 0, Math.PI * 2); ctx.fill(); });
    }
  }
  ctx.strokeStyle = 'rgba(40,20,12,0.5)'; ctx.lineWidth = 2;
  for (let i = 0; i < 24; i++) {
    const x = rng() * W;
    wrapDraw(ctx, x, (xx) => { ctx.beginPath(); ctx.moveTo(xx, 0); for (let y = 0; y <= H; y += 24) ctx.lineTo(xx + (rng() - 0.5) * 8, y); ctx.stroke(); });
  }
  return cv;
}

const cache = {};
export function barkTexture(kind) {
  if (cache[kind]) return cache[kind];
  const rng = makeRng(kind.length * 31 + 7);
  let cv;
  if (kind === 'birch') cv = birch(rng);
  else if (kind === 'pine') cv = plated(rng);
  else if (kind === 'maple') cv = furrowed(rng, { fill: '#7d6a58', dark: 'rgba(50,40,32,0.55)', light: 'rgba(200,185,165,0.35)', n: 18, wav: 3 });
  else cv = furrowed(rng, { fill: '#6e5038', dark: 'rgba(38,26,18,0.7)', light: 'rgba(170,140,105,0.45)', n: 28, wav: 7 });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  cache[kind] = tex;
  return tex;
}
