// Time-of-day presets: one place that drives sun, sky, clouds, fog, water and grade.
import * as THREE from 'three';

const dir = (hx, hz, elevDeg) => {
  const e = THREE.MathUtils.degToRad(elevDeg);
  const h = new THREE.Vector2(hx, hz).normalize();
  return new THREE.Vector3(h.x * Math.cos(e), Math.sin(e), h.y * Math.cos(e)).normalize();
};

export const PRESETS = {
  day: {
    sunDir: dir(-0.9, -0.42, 40), sunColor: 0xfff0d8, sunIntensity: 3.6,
    hemiSky: 0xa9d0ff, hemiGround: 0x6f8f4a, hemiIntensity: 1.4,
    fog: 0xcde8f6, fogDensity: 0.0017,
    zenith: 0x2a6fd0, mid: 0x5aa8ec, horizon: 0xd4f0fb, ground: 0xa9d0de, haze: 0xfff1d0, sunDisc: 8,
    cloudLit: 0xffffff, cloudShade: 0xa8c6ea,
    waterLight: 0xeaf7ff, windowGlow: 0.25, lanternGlow: 0.0,
    grade: { saturation: 1.05, shadowTint: [0.92, 0.98, 1.08], highTint: [1.04, 1.0, 0.95], exposure: 1.0, contrast: 1.05 },
    bloom: 0.75, godRays: 0.25, shadowTint: [0.84, 0.95, 1.12], litTint: [1.07, 1.03, 0.9],
  },
  golden: {
    sunDir: dir(-0.95, -0.3, 12), sunColor: 0xffb26a, sunIntensity: 3.3,
    hemiSky: 0xb4b2e0, hemiGround: 0x8a6a48, hemiIntensity: 1.75,
    fog: 0xf0c4a0, fogDensity: 0.0021,
    zenith: 0x3c62b6, mid: 0x93a2d8, horizon: 0xffc794, ground: 0xc79a80, haze: 0xff9447, sunDisc: 4.5,
    cloudLit: 0xffcf9e, cloudShade: 0x8d84bd,
    waterLight: 0xffd6b4, windowGlow: 1.0, lanternGlow: 1.0,
    grade: { saturation: 1.08, shadowTint: [0.95, 0.94, 1.08], highTint: [1.07, 1.0, 0.9], exposure: 1.12, contrast: 1.04 },
    bloom: 0.9, godRays: 0.85, shadowTint: [0.88, 0.88, 1.1], litTint: [1.12, 1.0, 0.84],
  },
};
