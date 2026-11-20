// Field2D: a square grid of floats over world XZ with bilinear sampling.
// Used to bake terrain height, river/path distance etc. once and query them cheaply.
export class Field2D {
  constructor(size, res, channels = 1) {
    this.size = size; // world extent (centered on origin)
    this.res = res; // samples per side
    this.ch = channels;
    this.data = new Float32Array(res * res * channels);
    this.cell = size / (res - 1);
    this.half = size / 2;
  }
  index(i, j) { return (j * this.res + i) * this.ch; }
  worldX(i) { return -this.half + i * this.cell; }
  set(i, j, v, c = 0) { this.data[(j * this.res + i) * this.ch + c] = v; }
  get(i, j, c = 0) { return this.data[(j * this.res + i) * this.ch + c]; }
  fill(fn) {
    for (let j = 0; j < this.res; j++) {
      const z = this.worldX(j);
      for (let i = 0; i < this.res; i++) fn(this.worldX(i), z, i, j);
    }
  }
  sample(x, z, c = 0) {
    const r = this.res - 1;
    let fx = (x + this.half) / this.cell, fz = (z + this.half) / this.cell;
    fx = fx < 0 ? 0 : fx > r ? r : fx;
    fz = fz < 0 ? 0 : fz > r ? r : fz;
    const i = Math.min(Math.floor(fx), r - 1), j = Math.min(Math.floor(fz), r - 1);
    const tx = fx - i, tz = fz - j, ch = this.ch, d = this.data, R = this.res;
    const a = d[(j * R + i) * ch + c], b = d[(j * R + i + 1) * ch + c];
    const e = d[((j + 1) * R + i) * ch + c], f = d[((j + 1) * R + i + 1) * ch + c];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (e * (1 - tx) + f * tx) * tz;
  }
  // central-difference gradient (world units)
  grad(x, z, c = 0) {
    const h = this.cell;
    return [(this.sample(x + h, z, c) - this.sample(x - h, z, c)) / (2 * h),
      (this.sample(x, z + h, c) - this.sample(x, z - h, c)) / (2 * h)];
  }
}

// Bake the distance to a polyline (array of [x,z]) into a field. Optionally stores the
// arc-length parameter of the closest point in channel 1. Each segment only touches cells
// within maxDist, so this stays fast for long curves.
export function bakePolylineDistance(field, pts, maxDist, { storeParam = false, initial = 1e9 } = {}) {
  const { res, cell, half, data, ch } = field;
  for (let k = 0; k < res * res; k++) data[k * ch] = initial;
  let acc = 0;
  for (let s = 0; s < pts.length - 1; s++) {
    const [ax, az] = pts[s], [bx, bz] = pts[s + 1];
    const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz, len = Math.sqrt(len2);
    const minX = Math.min(ax, bx) - maxDist, maxX = Math.max(ax, bx) + maxDist;
    const minZ = Math.min(az, bz) - maxDist, maxZ = Math.max(az, bz) + maxDist;
    const i0 = Math.max(0, Math.floor((minX + half) / cell)), i1 = Math.min(res - 1, Math.ceil((maxX + half) / cell));
    const j0 = Math.max(0, Math.floor((minZ + half) / cell)), j1 = Math.min(res - 1, Math.ceil((maxZ + half) / cell));
    for (let j = j0; j <= j1; j++) {
      const z = -half + j * cell;
      for (let i = i0; i <= i1; i++) {
        const x = -half + i * cell;
        let t = len2 > 0 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = ax + dx * t - x, pz = az + dz * t - z;
        const d = Math.sqrt(px * px + pz * pz);
        const idx = (j * res + i) * ch;
        if (d < data[idx]) {
          data[idx] = d;
          if (storeParam) data[idx + 1] = acc + t * len;
        }
      }
    }
    acc += len;
  }
  return acc; // total length
}
