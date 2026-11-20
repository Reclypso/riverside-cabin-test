// Locomotion blending: idle + a 1D blend space over walk / jog / sprint whose clips share one
// normalised gait phase (offsets align the left-foot plant), so blends never cross feet.
// Playback rate follows ground speed, so the planted foot roughly matches the ground.
import * as THREE from 'three';

// natural planted-foot speed (m/s) and left-foot-forward phase, measured in Blender
const GAITS = [
  { name: 'Walk', speed: 1.02, offset: 0.0 },
  { name: 'Jog', speed: 3.15, offset: 0.964 },
  { name: 'Sprint', speed: 4.7, offset: 0.85 },
];

export function createLocomotion(root, clips) {
  const mixer = new THREE.AnimationMixer(root);
  const act = (name, loop = THREE.LoopRepeat) => {
    const a = mixer.clipAction(clips[name]);
    a.setLoop(loop, Infinity); a.enabled = true; a.play(); a.setEffectiveWeight(0);
    return a;
  };
  const idle = act('Idle');
  const air = act('JumpLoop');
  const gaits = GAITS.map((g) => ({ ...g, action: act(g.name), dur: clips[g.name].duration }));
  for (const g of gaits) g.action.timeScale = 0; // we drive their time from the shared phase
  let phase = 0, moveW = 0, airW = 0;
  idle.setEffectiveWeight(1);
  // one-shot overlay (axe chop, hit react, death): weighted over the whole locomotion blend.
  // Its time is driven here (not by the mixer) so hit-stop can freeze it exactly.
  let os = null;
  const oneShots = {};
  const oneShot = (name) => {
    if (!oneShots[name] && clips[name]) {
      const a = mixer.clipAction(clips[name]);
      a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = 0; a.enabled = true;
      a.play(); a.setEffectiveWeight(0);
      oneShots[name] = a;
    }
    return oneShots[name];
  };

  return {
    mixer,
    gaitPhase: () => phase,
    /** play a clip once over the locomotion; hold = stay on the last frame until stopOneShot() */
    playOneShot(name, { timeScale = 1, fadeIn = 0.07, fadeOut = 0.18, hold = false, start = 0 } = {}) {
      const a = oneShot(name);
      if (!a) return null;
      if (os && os.action !== a) os.action.setEffectiveWeight(0);
      os = { name, action: a, t: start * a.getClip().duration, dur: a.getClip().duration, timeScale, fadeIn, fadeOut, hold, w: os?.w ?? 0 };
      return os;
    },
    stopOneShot() { if (os) os.release = true; },
    get oneShot() { return os; },
    /** normalised progress 0..1 of the current one-shot (or -1) */
    oneShotProgress: () => (os ? Math.min(1, os.t / os.dur) : -1),
    // absTime (capture mode, idle only): pose idle/air from absolute world time so a given frame
    // index always renders the same pose
    update(dt, speed, airborne, absTime) {
      // blend-space segment
      let a = 0, b = 0, t = 0;
      if (speed <= gaits[0].speed) { a = b = 0; t = 0; }
      else if (speed <= gaits[1].speed) { a = 0; b = 1; t = (speed - gaits[0].speed) / (gaits[1].speed - gaits[0].speed); }
      else { a = 1; b = 2; t = Math.min(1, (speed - gaits[1].speed) / (gaits[2].speed - gaits[1].speed)); }
      const vNat = THREE.MathUtils.lerp(gaits[a].speed, gaits[b].speed, t);
      const dur = THREE.MathUtils.lerp(gaits[a].dur, gaits[b].dur, t);
      const rate = Math.max(0.55, speed / vNat);
      phase = (phase + (dt * rate) / dur) % 1;
      // weights: idle <-> moving, ground <-> air
      const wantMove = THREE.MathUtils.smoothstep(speed, 0.08, 0.7);
      moveW += (wantMove - moveW) * (1 - Math.exp(-dt * 10));
      airW += ((airborne ? 1 : 0) - airW) * (1 - Math.exp(-dt * 12));
      const ground = 1 - airW;
      gaits.forEach((g, i) => {
        const w = i === a && i === b ? 1 : i === a ? 1 - t : i === b ? t : 0;
        g.action.setEffectiveWeight(w * moveW * ground);
        g.action.time = ((phase + g.offset) % 1) * g.dur;
      });
      // one-shot weight envelope; the base layers fill the rest
      let wOS = 0;
      if (os) {
        os.t += dt * os.timeScale;
        const end = os.t >= os.dur;
        let target = 1;
        if (os.release || (end && !os.hold)) target = 0;
        else if (!os.hold && os.dur - os.t < os.fadeOut) target = Math.max(0, (os.dur - os.t) / os.fadeOut);
        const k = target > os.w ? (os.fadeIn > 0 ? dt / os.fadeIn : 1) : dt / Math.max(0.05, os.fadeOut);
        os.w += THREE.MathUtils.clamp(target - os.w, -k, k);
        os.action.time = Math.min(os.t, os.dur - 1e-4);
        os.action.setEffectiveWeight(os.w);
        wOS = os.w;
        if ((end || os.release) && os.w <= 0.001 && !os.hold) { os.action.setEffectiveWeight(0); os = null; }
        else if (os.release && os.w <= 0.001) { os.action.setEffectiveWeight(0); os = null; }
      }
      const base = 1 - wOS;
      gaits.forEach((g) => g.action.setEffectiveWeight(g.action.getEffectiveWeight() * base));
      idle.setEffectiveWeight((1 - moveW) * ground * base);
      air.setEffectiveWeight(airW * base);
      if (absTime !== undefined) {
        idle.time = absTime % idle.getClip().duration; air.time = absTime % air.getClip().duration;
        mixer.update(0);
      } else mixer.update(dt);
    },
  };
}
