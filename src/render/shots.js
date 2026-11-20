// Named camera shots used by the viewer buttons, the screenshot tool and the video.
export const SHOTS = {
  idle: { pos: [-33.0, 19.0, 48.0], target: [0.0, 2.0, -4.0], fov: 42, tod: 'day', label: 'Idle view' },
  dock: { pos: [6.0, 3.1, 14.6], target: [14.2, 0.7, 6.4], fov: 40, tod: 'day', dof: [11.5, 14, 1.4], label: 'Dock' },
  grove: { pos: [-5.0, 12.5, 15.0], target: [-21.0, 1.5, -14.0], fov: 50, tod: 'day', label: 'Grove + cabin' },
  hero: { pos: [24.5, 1.25, 10.5], target: [-4.0, 2.2, -3.0], fov: 42, tod: 'golden', label: 'Golden hero' },
  overview: { pos: [38.0, 46.0, 52.0], target: [-2.0, 0.0, -4.0], fov: 38, tod: 'day', label: 'Overview' },
  idle_golden: { pos: [-33.0, 19.0, 48.0], target: [0.0, 2.0, -4.0], fov: 42, tod: 'golden', label: 'Idle (golden)' },
};

// Slow cinematic orbit for the video: arc around the idle target with gentle ease.
export const ORBIT = {
  target: [0.0, 2.0, -2.0], radius: 42, height: 16, fromAz: -1.05, toAz: 0.3, seconds: 13,
};
