// Canvas-painted textures for the cabin interior: patchwork quilt, plaid blanket, fur,
// bearskin-rug silhouette (fur + alpha) and a stretched beaver pelt on a hoop.
import * as THREE from 'three';
import { makeRng } from '../../../util/rng.js';

const cache = new Map();
const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function toTex(c, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// soft woven noise over everything (fabric feel)
function weave(ctx, w, h, rng, a = 0.06) {
  for (let i = 0; i < w * h / 90; i++) {
    ctx.fillStyle = rng() < 0.5 ? `rgba(255,250,240,${a})` : `rgba(40,25,15,${a})`;
    ctx.fillRect(rng() * w, rng() * h, rng.range(1, 3), 1);
  }
}

export const quiltTexture = () => memo('quilt', () => {
  const S = 512, N = 6, cell = S / N;
  const [c, ctx] = canvas(S, S);
  const rng = makeRng(1853);
  const cols = ['#8e2f25', '#c98a2f', '#2f4a7a', '#e8dcc0', '#7d9460', '#a5532b', '#6b4a32', '#5f7a8f', '#b84a3a', '#d8b878'];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = i * cell, y = j * cell, base = cols[(i * 7 + j * 3 + rng.int(0, 2)) % cols.length];
    ctx.fillStyle = base; ctx.fillRect(x, y, cell, cell);
    const kind = rng.int(0, 4);
    ctx.fillStyle = 'rgba(255,245,225,0.35)';
    if (kind === 0) for (let k = 0; k < 6; k++) ctx.fillRect(x, y + k * cell / 6, cell, cell / 14); // stripes
    if (kind === 1) for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if ((a + b) % 2) ctx.fillRect(x + a * cell / 4, y + b * cell / 4, cell / 4, cell / 4); // checks
    if (kind === 2) for (let k = 0; k < 18; k++) { ctx.beginPath(); ctx.arc(x + rng() * cell, y + rng() * cell, 2.5, 0, 6.28); ctx.fill(); } // calico dots
    if (kind === 3) { // half-square triangle
      ctx.fillStyle = cols[rng.int(0, cols.length - 1)];
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cell, y); ctx.lineTo(x, y + cell); ctx.fill();
    }
    // quilting stitches
    ctx.strokeStyle = 'rgba(250,240,220,0.75)'; ctx.lineWidth = 1.4; ctx.setLineDash([5, 4]);
    ctx.strokeRect(x + 5, y + 5, cell - 10, cell - 10);
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(30,20,12,0.35)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, cell, cell);
  }
  weave(ctx, S, S, rng, 0.07);
  return toTex(c);
});

export const plaidTexture = () => memo('plaid', () => {
  const S = 256;
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#9a2b22'; ctx.fillRect(0, 0, S, S);
  const band = (pos, wdt, col, vertical) => { ctx.fillStyle = col; if (vertical) ctx.fillRect(pos, 0, wdt, S); else ctx.fillRect(0, pos, S, wdt); };
  for (const v of [false, true]) {
    band(0, 64, 'rgba(25,20,18,0.55)', v); band(128, 64, 'rgba(25,20,18,0.55)', v);
    band(90, 6, 'rgba(240,210,150,0.5)', v); band(218, 6, 'rgba(240,210,150,0.5)', v);
  }
  weave(ctx, S, S, makeRng(7), 0.08);
  return toTex(c);
});

function furStrokes(ctx, w, h, rng, { base, dark, light, n = 2600, len = 14, flow = 0 }) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = rng() * w, y = rng() * h;
    const a = flow + rng.range(-0.5, 0.5) + Math.sin(x * 0.02) * 0.4;
    const L = len * rng.range(0.6, 1.3);
    ctx.strokeStyle = rng() < 0.55 ? dark : light;
    ctx.lineWidth = rng.range(1, 2.4);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + 2, y + Math.sin(a) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.stroke();
  }
}

export const furTexture = () => memo('fur', () => {
  const [c, ctx] = canvas(256, 256);
  furStrokes(ctx, 256, 256, makeRng(11), { base: '#5a3e2a', dark: 'rgba(30,20,14,0.35)', light: 'rgba(170,130,90,0.3)', flow: 1.4 });
  return toTex(c);
});

// Bearskin rug: fur colour in RGB, silhouette in A (head toward +U, legs splayed).
export const rugTexture = () => memo('rug', () => {
  const S = 512;
  const [c, ctx] = canvas(S, S);
  const [m, mx] = canvas(S, S);
  const rng = makeRng(99);
  furStrokes(ctx, S, S, rng, { base: '#6a4a33', dark: 'rgba(30,18,10,0.35)', light: 'rgba(200,160,115,0.28)', n: 7000, len: 18, flow: 0 });
  // lighter back stripe and darker extremities for form
  const g = ctx.createRadialGradient(S * 0.5, S / 2, S * 0.04, S * 0.5, S / 2, S * 0.5);
  g.addColorStop(0, 'rgba(255,215,170,0.16)'); g.addColorStop(0.7, 'rgba(0,0,0,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  mx.fillStyle = '#fff';
  mx.beginPath(); mx.ellipse(S * 0.47, S * 0.5, S * 0.3, S * 0.2, 0, 0, Math.PI * 2); mx.fill(); // body
  mx.beginPath(); mx.ellipse(S * 0.82, S * 0.5, S * 0.095, S * 0.085, 0, 0, Math.PI * 2); mx.fill(); // head
  mx.beginPath(); mx.ellipse(S * 0.92, S * 0.5, S * 0.045, S * 0.038, 0, 0, Math.PI * 2); mx.fill(); // snout
  for (const y of [0.42, 0.58]) { mx.beginPath(); mx.arc(S * 0.79, S * y + (y < 0.5 ? -18 : 18), 15, 0, Math.PI * 2); mx.fill(); } // ears
  // legs: thick rounded strokes rooted inside the body, splayed out, with three toes each
  mx.strokeStyle = '#fff'; mx.lineCap = 'round'; mx.lineWidth = S * 0.1;
  for (const [x0, y0, x1, y1] of [[0.63, 0.42, 0.75, 0.15], [0.63, 0.58, 0.75, 0.85], [0.3, 0.42, 0.17, 0.16], [0.3, 0.58, 0.17, 0.84]]) {
    mx.beginPath(); mx.moveTo(S * x0, S * y0); mx.lineTo(S * x1, S * y1); mx.stroke();
    const ang = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(ang), ny = Math.cos(ang);
    for (let k = -1; k <= 1; k++) {
      mx.beginPath(); mx.ellipse(S * x1 + Math.cos(ang) * 22 + nx * k * 14, S * y1 + Math.sin(ang) * 22 + ny * k * 14, 12, 7, ang, 0, Math.PI * 2); mx.fill();
    }
  }
  mx.beginPath(); mx.ellipse(S * 0.15, S * 0.5, S * 0.05, S * 0.03, 0, 0, Math.PI * 2); mx.fill(); // tail
  // ragged fur edge
  mx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 900; i++) { mx.fillStyle = 'rgba(0,0,0,0.5)'; mx.fillRect(rng() * S, rng() * S, 2, 6); }
  const col = ctx.getImageData(0, 0, S, S).data, al = mx.getImageData(0, 0, S, S).data;
  const out = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4, o = ((S - 1 - y) * S + x) * 4;
    out[o] = col[i]; out[o + 1] = col[i + 1]; out[o + 2] = col[i + 2]; out[o + 3] = al[i + 3] > 100 ? 255 : 0;
  }
  // eyes / nose painted last (in the output buffer, flipped space)
  const dot = (px, py, r, v) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) { const o = ((S - 1 - Math.round(py + y)) * S + Math.round(px + x)) * 4; out[o] = out[o + 1] = out[o + 2] = v; } };
  dot(S * 0.86, S * 0.465, 4, 12); dot(S * 0.86, S * 0.535, 4, 12); dot(S * 0.965, S * 0.5, 6, 18);
  const t = new THREE.DataTexture(out, S, S, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8; t.needsUpdate = true;
  return t;
});

// Beaver pelt stretched on a willow hoop: tan skin side with lacing toward the hoop edge.
export const peltTexture = () => memo('pelt', () => {
  const S = 256;
  const [c, ctx] = canvas(S, S);
  const rng = makeRng(321);
  ctx.clearRect(0, 0, S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S * 0.4);
  g.addColorStop(0, '#d7b07a'); g.addColorStop(0.8, '#b98a55'); g.addColorStop(1, '#7a5232');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(S / 2, S / 2, S * 0.36, S * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(120,80,45,${rng.range(0.05, 0.15)})`; ctx.beginPath(); ctx.ellipse(S / 2 + rng.range(-60, 60), S / 2 + rng.range(-70, 70), rng.range(5, 25), rng.range(3, 12), rng() * 3, 0, 6.28); ctx.fill(); }
  ctx.strokeStyle = 'rgba(70,45,25,0.85)'; ctx.lineWidth = 1.5;
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(S / 2 + Math.cos(a) * S * 0.35, S / 2 + Math.sin(a) * S * 0.39); ctx.lineTo(S / 2 + Math.cos(a) * S * 0.47, S / 2 + Math.sin(a) * S * 0.47); ctx.stroke();
  }
  return toTex(c, { repeat: false });
});
