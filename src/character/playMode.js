// Switches between the free orbit viewer and third-person play (C toggles; any WASD/arrow key
// press in the viewer jumps straight into play). Keeps OrbitControls and the follow camera
// from fighting over the camera.
import { createPlayer } from './player.js';

export async function createPlayMode({ scene, root, camera, controls, dom, ui, capture }) {
  const player = await createPlayer({ scene, root, camera, dom });
  let playing = false;
  function setPlaying(on) {
    if (on === playing) return;
    playing = on;
    controls.enabled = !on;
    if (on) {
      controls.autoRotate = false;
      player.follow.setEnabled(true, camera);
      player.follow.snapBehind(player.state.heading);
    } else {
      player.follow.setEnabled(false);
      // hand the camera back to the orbit viewer around the player
      controls.target.set(player.state.pos.x, player.state.pos.y + 1.2, player.state.pos.z);
      controls.update();
    }
    ui?.setPlaying?.(on);
  }
  if (!capture) {
    addEventListener('keydown', (e) => {
      if (e.code === 'KeyC') setPlaying(!playing);
      else if (!playing && /^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(e.code)) setPlaying(true);
    });
    ui?.on?.({ play: () => setPlaying(!playing) });
  }
  return {
    player,
    get playing() { return playing; },
    setPlaying,
    update(dt, absTime) { player.update(dt, playing, absTime); },
  };
}
