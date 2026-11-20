// Small overlay UI: loading bar, shot buttons, time-of-day toggle, auto-orbit toggle, FPS.
import { SHOTS } from './render/shots.js';

export function setupUI({ capture = false } = {}) {
  const $ = (id) => document.getElementById(id);
  const loader = $('loader'), bar = $('loader-bar'), panel = $('panel'), fpsEl = $('fps');
  let steps = 0;
  const handlers = {};
  if (capture) { panel?.remove(); fpsEl?.remove(); }

  if (!capture) {
    const shots = $('shots');
    for (const [name, s] of Object.entries(SHOTS)) {
      const b = document.createElement('button');
      b.textContent = s.label; b.dataset.shot = name;
      b.onclick = () => handlers.shot?.(name);
      shots.appendChild(b);
    }
    const orbitBtn = $('orbit');
    orbitBtn.onclick = () => {
      const on = orbitBtn.getAttribute('aria-pressed') !== 'true';
      orbitBtn.setAttribute('aria-pressed', String(on));
      handlers.orbit?.(on);
    };
    for (const b of document.querySelectorAll('[data-tod]')) b.onclick = () => handlers.tod?.(b.dataset.tod);
    addEventListener('keydown', (e) => {
      if (e.key === 'o' || e.key === 'O') orbitBtn.click();
      if (e.key === 'h' || e.key === 'H') panel.classList.toggle('hidden');
      if (e.key === 't' || e.key === 'T') handlers.tod?.(document.querySelector('[data-tod][aria-pressed="true"]')?.dataset.tod === 'day' ? 'golden' : 'day');
    });
  }

  let acc = 0, frames = 0;
  return {
    on(h) { Object.assign(handlers, h); },
    progress(label) { steps++; if (bar) bar.style.width = `${Math.min(95, steps * 9)}%`; if ($('loader-label')) $('loader-label').textContent = `Building ${label.replace(/^.*\//, '').replace('.js', '')}…`; },
    done() {
      if (capture) { loader?.remove(); return; } // never let the fade leak into captures
      loader?.classList.add('gone'); setTimeout(() => loader?.remove(), 800);
    },
    setTod(name) { for (const b of document.querySelectorAll('[data-tod]')) b.setAttribute('aria-pressed', String(b.dataset.tod === name)); },
    tick(dt) {
      if (!fpsEl) return;
      acc += dt; frames++;
      if (acc > 0.5) { fpsEl.textContent = `${Math.round(frames / acc)} fps`; acc = 0; frames = 0; }
    },
  };
}
