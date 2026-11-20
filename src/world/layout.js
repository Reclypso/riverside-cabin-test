// World layout: the single source of truth for where things are (1 unit = 1 metre).
// X = east, Z = south (toward the default camera), Y = up. Water surface is at y = 0.
import * as THREE from 'three';

export const WATER_LEVEL = 0;
export const TERRAIN_SIZE = 240; // metres, centred on origin
export const TERRAIN_RES = 481; // vertices per side (0.5 m spacing)

function spline(points, n) {
  const c = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  return c.getSpacedPoints(n).map((v) => [v.x, v.z]);
}

// River centreline, flowing from the far north valley, through the area, out to the south-east.
// It continues far into the backdrop mountains so it never just ends at the terrain edge.
const RIVER_CTRL = [[170, -1100], [120, -700], [70, -430], [52, -260], [40, -150], [33, -95], [26, -52], [19, -26], [16.5, -6],
  [19, 10], [25, 26], [34, 44], [46, 72], [60, 110], [80, 190], [128, 380], [190, 650], [240, 1100]];
const POOL = [18.6, 5.5];
export const RIVER = {
  pts: spline(RIVER_CTRL, 3600),
  // s = arc length from the upstream end, i = index of the closest polyline point
  halfWidthAt(s, i) {
    const p = RIVER.pts[Math.max(0, Math.min(RIVER.pts.length - 1, i | 0))];
    const base = 5.4 + 0.9 * Math.sin(s * 0.045) + 0.5 * Math.sin(s * 0.11 + 1.7);
    const pool = 1.7 * Math.exp(-((p[0] - POOL[0]) ** 2 + (p[1] - POOL[1]) ** 2) / (14 * 14));
    const far = Math.hypot(p[0], p[1]);
    return base + pool + 3.5 * Math.min(1, Math.max(0, (far - 140) / 300));
  },
};

// Dirt paths (polylines + half width).
export const PATHS = [
  { name: 'Path_Approach', hw: 1.05, pts: spline([[-14, 70], [-11, 40], [-7, 22], [-5.5, 10], [-5.2, 4.2]], 160) },
  { name: 'Path_Dock', hw: 0.85, pts: spline([[-4.6, 4.6], [0, 7.6], [5, 8.4], [7.5, 7.9], [9.6, 7.3]], 90) },
  { name: 'Path_Grove', hw: 0.95, pts: spline([[-7.5, 5.5], [-13, 4.5], [-19, -1], [-23.5, -9], [-25.5, -16]], 110) },
  { name: 'Path_Bank', hw: 0.6, pts: spline([[5, 8.4], [9, 13], [14, 21], [18, 30]], 70) },
];

// Cabin: centre of the log body, rotation about Y. Front (door/porch) faces +Z.
export const CABIN = { x: -5.5, z: -2.5, rot: 0.12, w: 6.6, d: 5.4, porch: 2.2 };

// Small dock on the west bank, pointing east into the river pool.
export const DOCK = { x: 9.8, z: 7.0, rot: 0.23, len: 6.2, w: 2.0, deck: 0.62 };

// Grove clearing (woodcutting spot).
export const GROVE = { x: -26, z: -18, r: 13 };

export const WOODPILE = { x: -9.5, z: -0.61, rot: 0.12 - Math.PI / 2 };
export const SAWHORSE = { x: -12.1, z: 1.2 };
export const YARD_PROPS = { x: -1.1, z: -0.66 };
export const CHOPPING = { x: -10.2, z: 3.3 };

// Rocks in the river (used for foam / wakes as well as geometry).
export const RIVER_ROCKS = [
  { x: 19.6, z: -9.5, r: 1.0, h: 0.7 },
  { x: 21.0, z: -8.0, r: 0.5, h: 0.35 },
  { x: 22.4, z: 15.5, r: 0.8, h: 0.55 },
  { x: 15.9, z: 1.2, r: 0.45, h: 0.3 },
  { x: 21.5, z: -25.0, r: 1.2, h: 0.9 },
  { x: 28.5, z: 31.0, r: 0.9, h: 0.6 },
  { x: 20.8, z: 4.3, r: 0.38, h: 0.18 },
];

// Hand-placed hero trees. Everything else is scattered procedurally in trees/forest.js.
export const HERO_TREES = [
  { species: 'oak', x: -15.5, z: -10.5, s: 1.15, v: 0 },
  { species: 'oak', x: 3.5, z: -15, s: 0.95, v: 1 },
  { species: 'maple', x: -2.5, z: -12.5, s: 0.95, v: 0 },
  { species: 'maple', x: -31, z: -6, s: 1.0, v: 1 },
  { species: 'maple', x: 4.5, z: 22.0, s: 0.85, v: 2 },
  { species: 'birch', x: 9.5, z: -10.5, s: 1.0, v: 0 },
  { species: 'birch', x: 7.5, z: -5.5, s: 0.85, v: 1 },
  { species: 'birch', x: 10.5, z: 17.0, s: 0.9, v: 2 },
  { species: 'pine', x: -6, z: -24, s: 1.0, v: 0 },
  { species: 'pine', x: 2, z: -28, s: 1.15, v: 1 },
  { species: 'oak', x: -24, z: 12, s: 0.9, v: 2 },
  { species: 'birch', x: -17.5, z: 9.5, s: 0.85, v: 0 },
];

// Areas where nothing else should be placed (grass, scatter trees, flowers ...).
export function inCabinFootprint(x, z, margin = 0) {
  const c = Math.cos(CABIN.rot), s = Math.sin(CABIN.rot);
  const dx = x - CABIN.x, dz = z - CABIN.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return Math.abs(lx) < CABIN.w / 2 + 0.6 + margin && lz > -CABIN.d / 2 - 0.6 - margin && lz < CABIN.d / 2 + CABIN.porch + margin;
}

export function cabinLocal(lx, lz) {
  const c = Math.cos(CABIN.rot), s = Math.sin(CABIN.rot);
  return [CABIN.x + lx * c + lz * s, CABIN.z - lx * s + lz * c];
}

export function dockLocal(along, across) {
  const c = Math.cos(DOCK.rot), s = Math.sin(DOCK.rot);
  // along = +X in dock space
  return [DOCK.x + along * c + across * s, DOCK.z - along * s + across * c];
}
