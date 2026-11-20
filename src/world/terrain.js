// Terrain mesh: heightfield grid with a painterly procedural ground shader
// (meadow patches, dirt paths with pebbles, sandy banks, pebbly riverbed with caustics).
import * as THREE from 'three';
import { heightField } from './heightfield.js';
import { TERRAIN_SIZE, TERRAIN_RES } from './layout.js';
import { worldDataUniforms, GLSL_WORLD } from './worldData.js';
import { stylize } from '../render/stylize.js';
import { PALETTE } from '../render/palette.js';

const FRAG_PARS = /* glsl */ `
${GLSL_WORLD}
uniform vec3 uGrassA, uGrassB, uGrassC, uDirt, uDirtEdge, uSand, uSandWet, uBed, uBedDeep, uRock, uMoss;
varying vec3 vWN;
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float pebbles(vec2 p, out float cid){
  vec2 i = floor(p), f = fract(p); float md = 8.0; cid = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)); vec2 o = hash22(i + g);
    vec2 r = g + o * 0.8 + 0.1 - f; float d = dot(r, r);
    if (d < md) { md = d; cid = hash12(i + g); }
  }
  return sqrt(md);
}
float caustic(vec2 uv, float t){
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
  vec2 i = p; float c = 1.0; float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0; c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}
`;

const ALBEDO = /* glsl */ `
{
  vec2 xz = vStyWorld.xz; float h = vStyWorld.y;
  vec4 wd = worldData(xz);
  float pd = wd.r;
  float n1 = fbm2(xz * 0.05);
  float n2 = vnoise(xz * 0.31);
  float n3 = fbm2(xz * 0.018 + 7.0);
  vec3 col = mix(uGrassA, uGrassB, smoothstep(0.32, 0.68, n1));
  col = mix(col, uGrassC, smoothstep(0.5, 0.72, n3) * 0.75);
  col *= 0.9 + 0.2 * n2;
  // steep ground shows earth / rock
  float slope = 1.0 - clamp(vWN.y, 0.0, 1.0);
  float rockM = smoothstep(0.3, 0.5, slope + (n2 - 0.5) * 0.2);
  col = mix(col, mix(uRock, uMoss, smoothstep(0.75, 0.95, vWN.y + n2 * 0.2)), rockM);
  // mountains: rocky above the tree line, snow on gentle high ground
  float alp = smoothstep(70.0, 170.0, h + (n1 - 0.5) * 50.0);
  col = mix(col, mix(uRock * 1.05, uRock * 0.78, n2), alp * 0.75);
  float snow = smoothstep(235.0, 290.0, h + (n1 - 0.5) * 70.0) * smoothstep(0.45, 0.8, vWN.y);
  col = mix(col, vec3(0.93, 0.96, 1.0), snow);
  // banks: grass runs to the water, with occasional sandy/pebbly beaches
  float beach = smoothstep(0.42, 0.68, fbm2(xz * 0.035 + 3.0));
  float sandM = 1.0 - smoothstep(0.05, 0.12 + 0.45 * beach, h + (n2 - 0.5) * 0.12);
  vec3 sand = mix(uSandWet, uSand, smoothstep(0.0, 0.2, h));
  float sc; float sp = pebbles(xz * 3.0, sc);
  sand = mix(sand, sand * (0.8 + 0.3 * sc), (1.0 - smoothstep(0.2, 0.3, sp)) * step(0.6, sc));
  col = mix(col, sand, sandM);
  // dirt paths with ragged edges and pebbles
  float en = (fbm2(xz * 0.9) - 0.5) * 0.55 + (n2 - 0.5) * 0.25;
  float pm = 1.0 - smoothstep(-0.12, 0.16, pd + en);
  float pc = smoothstep(0.1, -0.7, pd + en * 0.5);
  vec3 dirt = mix(uDirtEdge, uDirt, pc);
  dirt *= 0.9 + 0.18 * vnoise(xz * 2.3) + 0.08 * vnoise(xz * 9.0);
  float cid; float pdist = pebbles(xz * 2.6, cid);
  float peb = (1.0 - smoothstep(0.16, 0.24, pdist)) * step(0.62, cid);
  dirt = mix(dirt, mix(uDirt * 1.3, vec3(0.55, 0.52, 0.48), 0.45) * (0.85 + 0.3 * cid), peb * 0.75);
  col = mix(col, dirt, pm);
  // wet band at the waterline
  col *= mix(0.72, 1.0, smoothstep(0.0, 0.14, h));
  // riverbed
  float d = clamp(-h / 1.8, 0.0, 1.0);
  float cid2; float pb = pebbles(xz * 1.7, cid2);
  vec3 bed = mix(uSandWet * 1.08, uBed, smoothstep(0.03, 0.45, d));
  float pebM = (1.0 - smoothstep(0.22, 0.36, pb)) * smoothstep(0.02, 0.3, d);
  bed = mix(bed, mix(uBed * 0.75, uRock * 0.85, cid2) * (0.8 + 0.4 * cid2), pebM * 0.8);
  bed = mix(bed, uBedDeep, smoothstep(0.45, 1.0, d) * 0.8);
  // light passing through the water: absorb red first (turquoise tint), deeper = darker teal
  vec3 absorb = mix(vec3(0.9, 1.0, 0.97), vec3(0.18, 0.62, 0.68), smoothstep(0.0, 1.1, d * 1.8));
  bed *= absorb;
  col = mix(col, bed, smoothstep(0.02, -0.08, h));
  diffuseColor.rgb = col;
}
`;

const POST = /* glsl */ `
if (vStyWorld.y < 0.0) {
  float depth = -vStyWorld.y;
  float c = caustic(vStyWorld.xz * 0.16 + vec2(0.0, uTime * 0.01), uTime * 0.55);
  float k = smoothstep(0.0, 0.35, depth) * (1.0 - smoothstep(1.2, 2.4, depth));
  outgoingLight += uSunColor * min(c, 1.2) * 0.45 * k * (diffuseColor.rgb + 0.1) * cloudShadow(vStyWorld.xz);
}
`;

export function createTerrain() {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_RES - 1, TERRAIN_RES - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let k = 0; k < pos.count; k++) pos.setY(k, heightField.sample(pos.getX(k), pos.getZ(k)));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const P = PALETTE.ground;
  const uniforms = { ...worldDataUniforms };
  for (const [k, v] of Object.entries(P)) uniforms[k] = { value: new THREE.Color(v) };
  const mat = stylize(new THREE.MeshLambertMaterial({ color: 0xffffff }), {
    wrap: 0.25, ramp: 0.3, uniforms,
    vertexPars: 'varying vec3 vWN;',
    worldVertex: 'vWN = normalize(mat3(modelMatrix) * objectNormal);',
    fragmentPars: FRAG_PARS, albedo: ALBEDO, postLight: POST,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'Terrain';
  mesh.receiveShadow = true;
  mesh.userData.export = 'terrain';
  return mesh;
}
