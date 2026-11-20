// Named camera shots used by the viewer buttons, the screenshot tool and the video.
export const SHOTS = {
  idle: { pos: [-33.0, 19.0, 48.0], target: [0.0, 2.0, -4.0], fov: 42, tod: 'day', label: 'Idle view' },
  dock: { pos: [6.0, 3.1, 14.6], target: [14.2, 0.7, 6.4], fov: 40, tod: 'day', dof: [11.5, 14, 1.4], label: 'Dock' },
  grove: { pos: [-5.0, 12.5, 15.0], target: [-21.0, 1.5, -14.0], fov: 50, tod: 'day', label: 'Grove + cabin' },
  hero: { pos: [24.5, 1.25, 10.5], target: [-4.0, 2.2, -3.0], fov: 42, tod: 'golden', label: 'Golden hero' },
  overview: { pos: [38.0, 46.0, 52.0], target: [-2.0, 0.0, -4.0], fov: 38, tod: 'day', label: 'Overview' },
  idle_golden: { pos: [-33.0, 19.0, 48.0], target: [0.0, 2.0, -4.0], fov: 42, tod: 'golden', label: 'Idle (golden)' },
  // v2: cabin interior (cutaway + open door) and the playable mountain man
  interior_wide: { pos: [-5.87, 8.67, 2.78], target: [-5.24, 2.77, -2.83], fov: 50, tod: 'day', cutaway: true, door: 1, char: [-4.55, -2.2, 1.45], label: 'Interior' },
  interior_hearth: { pos: [-8.052, 3.79, -3.1995], target: [-0.561, 3.12, -2.471], fov: 55, tod: 'golden', door: 1, char: [-4.55, -2.2, 1.45], label: 'Hearth' },
  char_close: { pos: [-10.84, 3.39, 7.44], target: [-9.0, 3.2, 5.6], fov: 26, tod: 'day', char: [-9.0, 5.6, -1.397], dof: [2.6, 1.4, 1.6], label: 'Woodsman' },
  char_golden: { pos: [-11.2, 3.36, 4.95], target: [-9.0, 3.22, 5.6], fov: 26, tod: 'golden', char: [-9.0, 5.6, -1.62], dof: [2.3, 1.3, 1.8], label: 'Woodsman (golden)' },
  char_world: { pos: [-5.4, 4.1, 17.5], target: [-5.75, 2.6, 8.8], fov: 46, tod: 'day', char: [-5.6, 12.0, -3.105], label: 'Woodsman in world' },
  // v3: hair turnaround (woodsman facing the day sun so the face is lit)
  hair_front: { pos: [-9.861, 3.49, 5.198], target: [-9.0, 3.45, 5.6], fov: 28, tod: 'day', char: [-9.0, 5.6, -2.008], label: 'Hair: front' },
  hair_34: { pos: [-9.918, 3.49, 5.845], target: [-9.0, 3.45, 5.6], fov: 28, tod: 'day', char: [-9.0, 5.6, -2.008], label: 'Hair: 3/4' },
  hair_side: { pos: [-9.402, 3.49, 6.461], target: [-9.0, 3.45, 5.6], fov: 28, tod: 'day', char: [-9.0, 5.6, -2.008], label: 'Hair: side' },
  hair_back: { pos: [-8.273, 3.49, 6.211], target: [-9.0, 3.45, 5.6], fov: 28, tod: 'day', char: [-9.0, 5.6, -2.008], label: 'Hair: back' },
  // v3: fairy circles (meadow circle by day, river-bank circle in the cabin's golden-hour shade)
  fairy: { pos: [-17.6, 2.75, 25.6], target: [-14.3, 1.45, 21.2], fov: 40, tod: 'day', char: null, label: 'Fairy circle' },
  fairy_golden: { pos: [8.9, 3.3, 5.2], target: [4.9, 1.2, 0.6], fov: 42, tod: 'golden', char: null, label: 'Fairy circle (golden)' },
};

// Slow cinematic orbit for the video: arc around the idle target with gentle ease.
export const ORBIT = {
  target: [0.0, 2.0, -2.0], radius: 42, height: 16, fromAz: -1.05, toAz: 0.3, seconds: 13,
};
