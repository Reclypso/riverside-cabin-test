// Combat HUD in an 1800s frontier style: a walnut-and-brass health bar (top left), small
// goblin health bars that float above their heads, a red damage vignette and the "wake by the
// hearth" respawn overlay. Plain DOM + CSS so it's captured by the screenshot tools too.
const CSS = `
#hud { position: fixed; inset: 0; pointer-events: none; z-index: 6; font-family: Georgia, 'Palatino Linotype', 'Book Antiqua', serif; }
#hud.off { opacity: 0.004; } /* never fully hidden: a DOM layer first appearing over the WebGL canvas makes the compositor drop its overlay path (one ~120 ms stall) */
#hud .vigor { position: absolute; left: 22px; top: 20px; display: flex; align-items: center; gap: 10px; }
#hud .medal { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center;
  background: radial-gradient(circle at 35% 30%, #f4d58a, #b8862f 45%, #6d4b16 100%);
  box-shadow: inset 0 0 0 2px #4a300c, inset 0 0 0 4px #e9c46a, 0 0 0 2px #2a1a08, 0 3px 8px rgba(0,0,0,.45); }
#hud .medal span { color: #7a1410; font-size: 22px; line-height: 1; text-shadow: 0 1px 0 #f7e2a8; transform: translateY(1px); }
#hud .frame { width: 260px; padding: 5px 7px 6px; border-radius: 4px;
  background: linear-gradient(#4a2f17, #2a190b); border: 2px solid #9a7638;
  box-shadow: inset 0 1px 0 rgba(255,230,170,.25), inset 0 -2px 4px rgba(0,0,0,.5), 0 3px 8px rgba(0,0,0,.45); position: relative; }
#hud .frame::before, #hud .frame::after { content: ''; position: absolute; top: 50%; width: 7px; height: 7px; margin-top: -3.5px;
  border-radius: 50%; background: radial-gradient(circle at 35% 35%, #f6dc96, #8a6424); box-shadow: 0 0 0 1px #2a1a08; }
#hud .frame::before { left: -5px; } #hud .frame::after { right: -5px; }
#hud .label { display: flex; justify-content: space-between; color: #f1dfb6; font-size: 12px; letter-spacing: .12em;
  font-variant: small-caps; text-shadow: 0 1px 1px #000; margin-bottom: 3px; }
#hud .track { height: 12px; border-radius: 2px; background: #1a0f07; box-shadow: inset 0 1px 3px #000; overflow: hidden; position: relative; }
#hud .fill { position: absolute; inset: 0 auto 0 0; width: 100%; transition: width .18s ease-out;
  background: linear-gradient(#d0543a, #9a2216 60%, #6e140c); box-shadow: inset 0 1px 0 rgba(255,200,170,.45); }
#hud .ghost { position: absolute; inset: 0 auto 0 0; width: 100%; background: #e8c27a; opacity: .55; transition: width .6s ease-in .25s; }
#hud .enemy { position: absolute; width: 74px; margin-left: -37px; margin-top: -14px; transform-origin: 50% 100%; }
#hud .enemy .name { text-align: center; color: #e8f0c8; font-size: 10px; letter-spacing: .14em; font-variant: small-caps;
  text-shadow: 0 1px 2px #000, 0 0 3px #000; margin-bottom: 2px; }
#hud .enemy .etrack { height: 7px; background: #120c05; border: 1.5px solid #6b5228; border-radius: 2px; position: relative; overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,.6); }
#hud .enemy .efill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(#b9d65a, #6f8f22); transition: width .15s ease-out; }
#hud .enemy .tick { position: absolute; top: 0; bottom: 0; width: 1.5px; background: #120c05; }
#hud .hurt { position: absolute; inset: 0; opacity: 0; transition: opacity .35s ease-out;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(140,10,6,.55) 100%); }
#hud .fall { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; transition: opacity 1.1s ease;
  background: radial-gradient(ellipse at center, rgba(40,22,8,.55), rgba(12,6,2,.92)); }
#hud .fall.on { opacity: 1; }
#hud .fall p { color: #f0dcae; font-size: 26px; font-style: italic; text-align: center; text-shadow: 0 2px 6px #000; margin: 0; }
#hud .fall small { display: block; font-size: 15px; letter-spacing: .1em; margin-top: 10px; color: #cbb382; font-style: normal; font-variant: small-caps; }
`;

export function createHUD() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const hud = document.createElement('div');
  hud.id = 'hud'; // visible at first so it gets painted once behind the loader
  hud.innerHTML = `
    <div class="hurt"></div>
    <div class="vigor"><div class="medal"><span>&#9829;</span></div>
      <div class="frame"><div class="label"><span>Woodsman</span><span class="num">100 / 100</span></div>
        <div class="track"><div class="ghost"></div><div class="fill"></div></div></div></div>
    <div class="fall"><p>Overpowered by goblins…<small>you wake by the hearth</small></p></div>`;
  document.body.appendChild(hud);
  const fill = hud.querySelector('.fill'), ghost = hud.querySelector('.ghost'), num = hud.querySelector('.num');
  const hurt = hud.querySelector('.hurt'), fall = hud.querySelector('.fall');
  let lastHp = -1;
  return {
    setVisible(on) { hud.classList.toggle('off', !on); },
    setPlayer(hp, max) {
      const v = Math.round(Math.max(0, hp));
      if (v === lastHp) return;
      lastHp = v;
      const w = `${(100 * Math.max(0, hp)) / max}%`;
      fill.style.width = w; ghost.style.width = w;
      num.textContent = `${v} / ${max}`;
    },
    damageFlash() { hurt.style.transition = 'none'; hurt.style.opacity = '1'; void hurt.offsetWidth; hurt.style.transition = ''; hurt.style.opacity = '0'; },
    showFall(on) { fall.classList.toggle('on', on); },
    enemyBar(segments = 3) {
      const el = document.createElement('div');
      el.className = 'enemy';
      el.innerHTML = `<div class="name">Goblin</div><div class="etrack"><div class="efill" style="width:100%"></div>${
        Array.from({ length: segments - 1 }, (_, i) => `<div class="tick" style="left:${((i + 1) * 100) / segments}%"></div>`).join('')}</div>`;
      hud.appendChild(el);
      const f = el.querySelector('.efill');
      return {
        set(frac) { f.style.width = `${Math.max(0, frac) * 100}%`; },
        place(x, y, visible, dist) {
          el.style.display = visible ? '' : 'none';
          if (!visible) return;
          const s = Math.max(0.55, Math.min(1.15, 7 / Math.max(dist, 0.1)));
          el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.transform = `scale(${s.toFixed(3)})`;
        },
        remove() { el.remove(); },
      };
    },
  };
}
