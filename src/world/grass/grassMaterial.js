// Grass material: stylised Lambert (receives shadows) + rooted bending wind with rolling gusts,
// tip flutter, ground-coherent colour patches, root-to-tip gradient, translucency and rim.
import * as THREE from 'three';
import { stylize } from '../../render/stylize.js';
import { PALETTE } from '../../render/palette.js';

const VERT_PARS = /* glsl */ `
attribute float aBlade;
varying float vGT; varying float vGSeed;
`;

const WORLD = /* glsl */ `
{
  float t = uv.y;
  vGT = t; vGSeed = aBlade;
  #ifdef USE_INSTANCING
    vec3 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #else
    vec3 root = modelMatrix[3].xyz;
  #endif
  vec2 wd = uWind.xy;
  float g = windGust(root.xz);
  float ph = hash12(root.xz * 1.7 + aBlade * 13.0) * 6.2831;
  float chop = sin(uTime * 2.2 + dot(root.xz, wd) * 0.45 + ph) * 0.5 + 0.5;
  float phi = uWind.z * (0.16 + 0.85 * g + 0.16 * chop);
  float a = clamp(phi, 0.0, 1.25) * pow(t, 1.4);
  vec3 rel = wPos.xyz - root;
  float h = rel.y;
  // rotate the blade about its root toward the wind (keeps length -> circular arc)
  vec2 side = vec2(-wd.y, wd.x);
  float along = dot(rel.xz, wd);
  float newAlong = along * cos(a) + h * sin(a);
  float newH = h * cos(a) - along * sin(a) * 0.3;
  float flutter = sin(uTime * 7.5 + ph * 3.0 + root.x * 0.7) * 0.035 * t * t * (0.4 + g);
  vec2 xz = rel.xz + wd * (newAlong - along) + side * flutter;
  wPos.xyz = root + vec3(xz.x, newH, xz.y);
  // shade like the ground: mostly-up normals, slight blade facing
  vec3 bn = normalize(mat3(modelMatrix) * objectNormal);
  vec3 gn = normalize(mix(bn, vec3(0.0, 1.0, 0.0), 0.72));
  vNormal = normalize((viewMatrix * vec4(gn, 0.0)).xyz);
}`;

const FRAG_PARS = /* glsl */ `
varying float vGT; varying float vGSeed;
uniform vec3 uRoot, uMidA, uMidB, uTipA, uTipB, uDry;
`;

const ALBEDO = /* glsl */ `
{
  vec2 xz = vStyWorld.xz;
  float patchK = smoothstep(0.32, 0.68, fbm2(xz * 0.05));
  float sunny = smoothstep(0.5, 0.72, fbm2(xz * 0.018 + 7.0));
  vec3 mid = mix(uMidA, uMidB, patchK);
  vec3 tip = mix(uTipA, uTipB, patchK);
  tip = mix(tip, uDry, sunny * 0.45 + step(0.93, vGSeed) * 0.35);
  vec3 col = mix(uRoot, mid, smoothstep(0.0, 0.55, vGT));
  col = mix(col, tip, smoothstep(0.5, 1.0, vGT));
  col *= 0.88 + 0.24 * vGSeed;
  diffuseColor.rgb = col;
}`;

const POST = /* glsl */ `
{
  vec3 vV = normalize(vViewPosition);
  vec3 vL = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
  float back = pow(clamp(dot(-vV, vL), 0.0, 1.0), 3.0);
  float tt = pow(clamp(vGT, 0.0, 1.0), 1.5); // clamp: MSAA can extrapolate varyings
  outgoingLight += diffuseColor.rgb * uSunColor * back * tt * 0.9 * cloudShadow(vStyWorld.xz);
}`;

export function createGrassMaterial(palette = PALETTE.grass) {
  const P = palette;
  const c = (h) => ({ value: new THREE.Color(h) });
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  stylize(m, {
    wrap: 0.35, ramp: 0.25, hue: 1.2, ao: 0.7,
    uniforms: { uRoot: c(P.base), uMidA: c(P.midA), uMidB: c(P.midB), uTipA: c(P.tipA), uTipB: c(P.tipB), uDry: c(P.dry) },
    vertexPars: VERT_PARS, worldVertex: WORLD,
    fragmentPars: FRAG_PARS, albedo: ALBEDO, postLight: POST,
    normalHook: 'normal = normalize(vNormal);',
  });
  return m;
}
