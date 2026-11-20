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

  return {
    mixer,
    gaitPhase: () => phase,
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
      idle.setEffectiveWeight((1 - moveW) * ground);
      air.setEffectiveWeight(airW);
      if (absTime !== undefined) {
        idle.time = absTime % idle.getClip().duration; air.time = absTime % air.getClip().duration;
        mixer.update(0);
      } else mixer.update(dt);
    },
  };
}
