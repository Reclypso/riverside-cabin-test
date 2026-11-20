// Procedural tree skeleton: trunk -> main limbs -> sub-branches, plus leaf cluster spheres.
// Output is pure data (polylines with radii + clusters) consumed by limbMesh / canopy.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

function randUnit(rng) {
  const [x, y, z] = rng.inSphere();
  return new THREE.Vector3(x, y, z).normalize();
}

// grow a curved polyline from `start` along `dir`
function polyline(rng, start, dir, len, segs, { gnarl = 0.15, upward = 0.0, droop = 0.0 }) {
  const pts = [start.clone()];
  const d = dir.clone().normalize();
  for (let i = 1; i <= segs; i++) {
    d.addScaledVector(randUnit(rng), gnarl).addScaledVector(UP, upward - droop * (i / segs)).normalize();
    pts.push(pts[i - 1].clone().addScaledVector(d, len / segs));
  }
  return pts;
}

function dirFrom(axis, polar, azimuth) {
  // direction at `polar` radians from `axis`, rotated by azimuth around it
  const a = axis.clone().normalize();
  const ref = Math.abs(a.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0);
  const t = new THREE.Vector3().crossVectors(a, ref).normalize();
  const b = new THREE.Vector3().crossVectors(a, t);
  return a.multiplyScalar(Math.cos(polar))
    .addScaledVector(t, Math.sin(polar) * Math.cos(azimuth))
    .addScaledVector(b, Math.sin(polar) * Math.sin(azimuth)).normalize();
}

export function growTree(P, rng) {
  const limbs = []; // { pts, r0, r1, level }
  const clusters = []; // { c: Vector3, r }
  const lean = new THREE.Vector3(rng.range(-1, 1), 0, rng.range(-1, 1)).multiplyScalar(P.lean || 0.08);
  const trunkCount = P.multiTrunk ? rng.int(P.multiTrunk[0], P.multiTrunk[1]) : 1;
  const golden = 2.39996;
  let az0 = rng() * Math.PI * 2;

  for (let tIdx = 0; tIdx < trunkCount; tIdx++) {
    const tDir = trunkCount > 1
      ? dirFrom(UP, rng.range(0.08, 0.22), az0 + (tIdx / trunkCount) * Math.PI * 2).add(lean).normalize()
      : UP.clone().add(lean).normalize();
    const tScale = tIdx === 0 ? 1 : rng.range(0.7, 0.9);
    const trunkLen = P.trunkLen * tScale * rng.range(0.92, 1.08);
    const leaderLen = (P.leader || 0) * tScale;
    const tR = P.trunkR * (tIdx === 0 ? 1 : 0.75);
    const base = new THREE.Vector3(trunkCount > 1 ? Math.cos(az0 + tIdx * 2.1) * 0.12 : 0, 0, trunkCount > 1 ? Math.sin(az0 + tIdx * 2.1) * 0.12 : 0);
    const trunkPts = polyline(rng, base, tDir, trunkLen + leaderLen, P.trunkSegs || 6, { gnarl: P.trunkGnarl ?? 0.08, upward: 0.05 });
    limbs.push({ pts: trunkPts, r0: tR, r1: leaderLen > 0 ? tR * 0.18 : tR * 0.62, level: 0, flare: tIdx === 0 ? P.flare ?? 0.5 : 0.2 });
    const trunkTop = trunkPts[trunkPts.length - 1];
    if (leaderLen > 0) clusters.push({ c: trunkTop.clone().add(new THREE.Vector3(0, P.clusterR * 0.3, 0)), r: P.clusterR * 0.9 });

    // main limbs: from the fork zone of the trunk
    const nLimbs = rng.int(P.limbs[0], P.limbs[1]);
    for (let i = 0; i < nLimbs; i++) {
      const tAlong = P.limbStart + (1 - P.limbStart) * (nLimbs === 1 ? 1 : i / (nLimbs - 1)) * (P.limbSpread ?? 1);
      const along = Math.min(trunkPts.length - 1, tAlong * (trunkLen / (trunkLen + leaderLen)) * (trunkPts.length - 1));
      const k = Math.floor(along), f = along - k;
      const origin = trunkPts[k].clone().lerp(trunkPts[Math.min(k + 1, trunkPts.length - 1)], f);
      const az = az0 + i * golden + rng.range(-0.3, 0.3);
      const polar = rng.range(P.limbAngle[0], P.limbAngle[1]);
      const dir = dirFrom(UP, polar, az);
      const len = P.limbLen * rng.range(0.78, 1.15) * (1 - tAlong * (P.limbTaper ?? 0.3));
      const pts = polyline(rng, origin, dir, len, 4, { gnarl: P.gnarl ?? 0.18, upward: P.upward ?? 0.12, droop: P.droop ?? 0 });
      const rBase = tR * rng.range(0.42, 0.6) * (1 - tAlong * 0.3);
      limbs.push({ pts, r0: rBase, r1: rBase * 0.25, level: 1 });
      const tip = pts[pts.length - 1];
      clusters.push({ c: tip.clone(), r: P.clusterR * rng.range(0.85, 1.15) });
      if (P.midCluster) clusters.push({ c: pts[2].clone().addScaledVector(UP, P.clusterR * 0.25), r: P.clusterR * rng.range(0.6, 0.8) });

      // sub-branches
      const nSub = rng.int(P.subs[0], P.subs[1]);
      for (let s = 0; s < nSub; s++) {
        const st = rng.range(0.35, 0.8);
        const si = Math.min(pts.length - 2, Math.floor(st * (pts.length - 1)));
        const o = pts[si].clone().lerp(pts[si + 1], rng());
        const pdir = pts[si + 1].clone().sub(pts[si]).normalize();
        const sdir = dirFrom(pdir, rng.range(0.5, 0.95), rng() * Math.PI * 2).addScaledVector(UP, 0.25).normalize();
        const sl = len * rng.range(0.35, 0.55);
        const sp = polyline(rng, o, sdir, sl, 3, { gnarl: 0.2, upward: P.upward ?? 0.12, droop: P.droop ?? 0 });
        limbs.push({ pts: sp, r0: rBase * 0.45, r1: rBase * 0.12, level: 2 });
        clusters.push({ c: sp[sp.length - 1].clone(), r: P.clusterR * rng.range(0.65, 0.9) });
      }
    }
    az0 += 1.3;
  }
  // canopy centre/extent (used for spherical foliage normals and AO)
  const centre = new THREE.Vector3();
  for (const c of clusters) centre.add(c.c);
  centre.divideScalar(Math.max(1, clusters.length));
  centre.y -= P.clusterR * 0.25;
  let radius = 0, minY = Infinity, maxY = -Infinity;
  for (const c of clusters) {
    radius = Math.max(radius, c.c.distanceTo(centre) + c.r);
    minY = Math.min(minY, c.c.y - c.r); maxY = Math.max(maxY, c.c.y + c.r);
  }
  return { limbs, clusters, canopy: { centre, radius, minY, maxY }, height: maxY };
}
