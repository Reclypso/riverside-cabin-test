// Fairy circle placement: plain data, no imports, so grass/flower scatter can read it without
// circular dependencies. Spots were picked by a search over the live world: flat open grass,
// >= 3 m from paths, clear of trunks, bushes, props, the cabin and the river (all on the
// reachable west bank). Units: metres, world space.
export const FAIRY_CIRCLES = [
  // open meadow west of the approach path, ~14.5 m from the player spawn (combat staging spot)
  { name: 'Fairy_Meadow', x: -14.5, z: 21.5, r: 1.7, palette: 0 },
  // east edge of the woodcutting grove clearing, under the trees
  { name: 'Fairy_Grove', x: -19.0, z: -17.5, r: 1.5, palette: 1 },
  // river bank between the cabin yard and the water
  { name: 'Fairy_River', x: 5.0, z: 0.5, r: 1.45, palette: 2 },
  // quiet upstream bank north of the forest edge
  { name: 'Fairy_Upriver', x: 9.5, z: -29.5, r: 1.4, palette: 3 },
];

// grass height multiplier around the rings: the mushroom band is kept clear, the inside is a
// short lawn, and the grass just outside is trimmed so the ring reads from a distance
export function fairyGrassFactor(x, z) {
  for (const c of FAIRY_CIRCLES) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d > c.r + 1.0) continue;
    if (Math.abs(d - c.r) < 0.32) return 0;
    if (d < c.r) return 0.28;
    return 0.5 + 0.5 * Math.min(1, (d - c.r - 0.32) / 0.68);
  }
  return 1;
}

export function inFairyCircle(x, z, margin = 0) {
  for (const c of FAIRY_CIRCLES) if (Math.hypot(x - c.x, z - c.z) < c.r + margin) return true;
  return false;
}
