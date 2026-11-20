// Cabin dimensions in cabin-local space (X = width, Z = depth, +Z = front/porch, y = 0 at pad).
import { CABIN } from '../layout.js';

const r = 0.165, course = 0.295, found = 0.32;
const frontCourses = 10;
export const DIM = {
  w: CABIN.w, d: CABIN.d, porch: CABIN.porch,
  r, course, found, overhang: 0.34,
  frontCourses,
  sideCourses: 9, // gable-end walls stop one course lower, gable boards above
  eaveY: found + r + (frontCourses - 1) * course + r, // top of eave-wall logs
  pitch: (38 * Math.PI) / 180,
  roofOverEave: 0.5, roofOverGable: 0.55,
  door: { x: -0.85, w: 0.96, y0: found, y1: 2.28 },
  winFront: { x: 1.7, w: 1.0, y0: 1.08, y1: 2.0 },
  winSide: { z: -0.35, w: 0.9, y0: 1.08, y1: 1.95 }, // west (-X) wall
  winBack: { x: -1.3, w: 0.8, y0: 1.15, y1: 1.9 },
  chimney: { z: 0.0 }, // on the east (+X) gable
};
DIM.frontZ = DIM.d / 2 - r; // log centre line of the front wall
DIM.sideX = DIM.w / 2 - r; // log centre line of the side walls
DIM.ridgeY = DIM.eaveY + (DIM.d / 2) * Math.tan(DIM.pitch);
// roof underside height above a given |z| (plane through the eave line and ridge)
DIM.roofY = (absZ) => DIM.ridgeY - absZ * Math.tan(DIM.pitch);
