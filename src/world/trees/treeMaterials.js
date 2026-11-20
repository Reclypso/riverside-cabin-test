// Bark and foliage materials: stylised Lambert + hierarchical wind (whole-tree sway driven by
// the per-vertex aSway weight, gusts per instance) + leaf flutter, translucency and rim light.
import * as THREE from 'three';
import { stylize, stylizedDepth } from '../../render/stylize.js';

const WIND_PARS = /* glsl */ `attribute float aSway;`;

const WIND = (leaf) => /* glsl */ `
{
  #ifdef USE_INSTANCING
    vec3 tOrigin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #else
    vec3 tOrigin = modelMatrix[3].xyz;
  #endif
  float ph = hash12(tOrigin.xz) * 6.2831;
  float g = windGust(tOrigin.xz);
  vec2 wd = uWind.xy;
  float bend = (0.2 + 0.8 * g) * uWind.z;
  float osc = sin(uTime * 1.05 + ph) * 0.6 + sin(uTime * 1.85 + ph * 1.7) * 0.3;
  vec3 off = vec3(wd.x, 0.0, wd.y) * (bend * 0.32 + osc * 0.1 * (0.5 + g))
           + vec3(-wd.y, 0.0, wd.x) * sin(uTime * 0.75 + ph * 2.3) * 0.05;
  wPos.xyz += off * aSway;
  wPos.y -= dot(off.xz, off.xz) * aSway * 0.2;
  ${leaf ? `
  float fl = sin(uTime * 6.5 + dot(wPos.xyz, vec3(1.3, 1.7, 1.1))) * (0.025 + 0.05 * g);
  wPos.xyz += vec3(fl, fl * 0.7, -fl * 0.8) * min(aSway, 1.0);` : ''}
}`;

const LEAF_POST = /* glsl */ `
{
  vec3 vV = normalize(vViewPosition);
  vec3 vL = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
  float back = pow(clamp(dot(-vV, vL), 0.0, 1.0), 4.0);
  float rim = pow(1.0 - clamp(dot(normal, vV), 0.0, 1.0), 3.0) * clamp(dot(normal, vL) + 0.35, 0.0, 1.0);
  float lit = cloudShadow(vStyWorld.xz);
  outgoingLight += diffuseColor.rgb * uSunColor * (back * 1.1 + rim * 0.55) * lit * vLeafOuter;
}`;

const _cache = new Map();

export function leafMaterial(map, color) {
  const m = new THREE.MeshLambertMaterial({
    color, map, vertexColors: true, alphaTest: 0.42, side: THREE.DoubleSide,
  });
  stylize(m, {
    wrap: 0.42, ramp: 0.2, hue: 1.3, ao: 0,
    vertexPars: WIND_PARS + '\nvarying float vLeafOuter;',
    worldVertex: WIND(true) + '\nvLeafOuter = clamp(color.r * 1.2 - 0.25, 0.0, 1.0);',
    fragmentPars: 'varying float vLeafOuter;',
    normalHook: 'normal = normalize(vNormal);',
    postLight: LEAF_POST,
    // leaves within ~2.8 m of the camera dissolve (screen-door dither), so the follow camera
    // pushed into a canopy sees through it instead of a wall of leaf cards; shadows unaffected
    // ...and while playing, leaves inside a ~1.6 m tunnel between the lens and the woodsman too
    albedo: /* glsl */ `
      { float camFade = smoothstep(1.0, 2.8, distance(vStyWorld, cameraPosition));
        vec3 seg = uFocus - cameraPosition;
        float tt = clamp(dot(vStyWorld - cameraPosition, seg) / max(dot(seg, seg), 1e-4), 0.0, 1.0);
        float dSeg = distance(vStyWorld, cameraPosition + seg * tt);
        float tunnel = mix(1.0, smoothstep(0.9, 2.1, dSeg), uFocusOn * step(tt, 0.96));
        if (hash12(floor(gl_FragCoord.xy)) > min(camFade, tunnel)) discard; }`,
  });
  m.userData.depth = stylizedDepth({ map, alphaTest: 0.42, vertexPars: WIND_PARS, worldVertex: WIND(true) });
  return m;
}

export function barkMaterial(map, color, { moss = false } = {}) {
  const key = map.uuid + color + moss;
  if (_cache.has(key)) return _cache.get(key);
  const m = new THREE.MeshLambertMaterial({ color, map, vertexColors: true });
  stylize(m, {
    wrap: 0.35, ramp: 0.3,
    vertexPars: WIND_PARS + '\nvarying vec3 vWN;',
    worldVertex: WIND(false) + '\nvWN = normalize(mat3(modelMatrix) * objectNormal);',
    fragmentPars: 'varying vec3 vWN; uniform vec3 uMoss;',
    uniforms: { uMoss: { value: new THREE.Color(0x5f8f34) } },
    albedo: moss ? /* glsl */ `
      float mossK = smoothstep(0.35, 0.8, vWN.y + (vnoise(vStyWorld.xz * 3.0 + vStyWorld.y * 2.0) - 0.5) * 0.5);
      diffuseColor.rgb = mix(diffuseColor.rgb, uMoss * (0.8 + 0.4 * vnoise(vStyWorld.xz * 9.0)), mossK * 0.85);` : '',
  });
  m.userData.depth = stylizedDepth({ vertexPars: WIND_PARS, worldVertex: WIND(false) });
  _cache.set(key, m);
  return m;
}
