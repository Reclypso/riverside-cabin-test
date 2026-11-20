// The woodsman's axe: LMB / F starts a chop (UAL Sword_Attack retimed as a diagonal axe cut), the
// axe swaps from his back into his right hand, and a click during the recovery chains the next
// chop (a light combo). The axe goes back on his back after a few seconds without swinging.
const CLIP = 'AxeChop';
const SPEED = 1.35;               // the library clip is a slow sword slash; axe chops are snappier
export const HIT_WINDOW = [0.28, 0.43]; // normalised clip time when the blade is cutting
const CHAIN_FROM = 0.62, CHAIN_START = 0.06, SHEATH_AFTER = 3.0;

export function createAttack(loco, model) {
  const st = { swinging: false, swingId: 0, queued: false, idleT: 99, inHand: false, combo: 0 };
  const progress = () => {
    const os = loco.oneShot;
    return os && os.name === CLIP ? Math.min(1, os.t / os.dur) : -1;
  };
  const setHand = (on) => { if (st.inHand !== on) { st.inHand = on; model.userData.setAxeInHand?.(on); } };
  function start(chained) {
    if (!loco.playOneShot(CLIP, { timeScale: SPEED, fadeIn: chained ? 0.12 : 0.06, fadeOut: 0.28, start: chained ? CHAIN_START : 0 })) return;
    st.swinging = true; st.swingId++; st.queued = false; st.combo = chained ? st.combo + 1 : 0;
    setHand(true);
  }
  return {
    state: st,
    progress,
    request() {
      if (!st.swinging) start(false);
      else if (progress() > 0.3) st.queued = true;
    },
    hitWindow() { const p = progress(); return st.swinging && p >= HIT_WINDOW[0] && p <= HIT_WINDOW[1]; },
    update(dt) {
      if (st.swinging) {
        st.idleT = 0;
        const p = progress();
        if (p < 0) { st.swinging = false; st.queued = false; }
        else if (st.queued && p >= CHAIN_FROM) start(true);
        else if (p >= 0.92) st.swinging = false; // recovery tail fades out under locomotion
      } else {
        st.idleT += dt;
        if (st.idleT > SHEATH_AFTER) setHand(false);
      }
    },
    cancel() { st.swinging = false; st.queued = false; },
  };
}
