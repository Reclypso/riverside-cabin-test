// Keyboard state for the player (WASD / arrows, Shift run, Space jump). A scripted source can
// replace it for deterministic captures (see autopilot.js).
const KEYS = {
  KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
  ShiftLeft: 'run', ShiftRight: 'run', Space: 'jump',
};

export function createKeyboard(target = window) {
  const down = new Set();
  const onDown = (e) => {
    const k = KEYS[e.code];
    if (!k) return;
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    down.add(k);
    if (k !== 'run') e.preventDefault();
  };
  const onUp = (e) => { const k = KEYS[e.code]; if (k) down.delete(k); };
  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  addEventListener('blur', () => down.clear());
  return {
    // x: right, y: forward (camera relative), run, jump
    read() {
      return {
        x: (down.has('r') ? 1 : 0) - (down.has('l') ? 1 : 0),
        y: (down.has('f') ? 1 : 0) - (down.has('b') ? 1 : 0),
        run: down.has('run'), jump: down.has('jump'),
      };
    },
    anyMove: () => down.has('f') || down.has('b') || down.has('l') || down.has('r'),
  };
}
