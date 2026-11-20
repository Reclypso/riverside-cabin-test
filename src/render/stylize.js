// Patches a built-in Lambert/Standard/Depth material with the project's stylised shading:
// - world-space vertex hook (wind etc.) that also feeds shadows and fog
// - albedo hook after color_fragment, post-lighting hook before output
// - soft wrapped diffuse ramp + travelling cloud shadows on the sun term
import * as THREE from 'three';
import { G, GLSL_COMMON } from './globals.js';

const WRAP_DIRECT = /* glsl */ `
  float styNdl = dot( geometryNormal, directLight.direction );
  float dotNL = smoothstep( -STY_WRAP, 1.0, styNdl );
  dotNL = mix( dotNL, smoothstep(0.0, 1.0, dotNL), STY_RAMP );
  vec3 irradiance = dotNL * directLight.color * cloudShadow( vStyWorld.xz );
`;

// painterly hue shift: sunlit areas warm, sky-lit (shadowed) areas cool
const AO_APPLY = /* glsl */ `
#if STY_AO > 0
if (uAOParams.z > 0.0) {
  vec2 suv = gl_FragCoord.xy * uAOParams.xy;
  float ao = texture2D(uAOTex, suv).r;
  // only where this fragment is the surface the AO pre-pass saw (no halos on foliage in front)
  float dn = texture2D(uAODepth, suv).r * 2.0 - 1.0;
  float zAO = 2.0 * uAOProj.x * uAOProj.y / (uAOProj.y + uAOProj.x - dn * (uAOProj.y - uAOProj.x));
  float zF = vViewPosition.z;
  float match = 1.0 - smoothstep(0.05, 0.14, abs(zAO - zF) / max(zF, 0.01));
  ao = mix(1.0, ao, uAOParams.z * match * float(STY_AO) * 0.01);
  vec3 lostAO = reflectedLight.indirectDiffuse * (1.0 - ao);
  reflectedLight.indirectDiffuse -= lostAO;
  outgoingLight -= lostAO;
}
#endif
`;

const HUE_SHIFT = /* glsl */ `
{
  // inside the cabin: the sky fill is mostly blocked by walls and roof
  float inK = interiorK(vStyWorld);
  if (inK > 0.0) {
    vec3 lost = reflectedLight.indirectDiffuse * (1.0 - uInteriorAmbient) * inK;
    reflectedLight.indirectDiffuse -= lost;
    outgoingLight -= lost;
  }
}
{
  float dL = dot(reflectedLight.directDiffuse, vec3(0.333));
  float aL = dot(reflectedLight.indirectDiffuse, vec3(0.333));
  float sunK = dL / max(dL + aL, 1e-4);
  outgoingLight *= mix(vec3(1.0), mix(uShadowTint, uLitTint, smoothstep(0.12, 0.75, sunK)), STY_HUE);
}`;

export function stylize(material, opts = {}) {
  const {
    wrap = 0.3, ramp = 0.4, hue = 1.0, ao = 1.0,
    uniforms = {}, defines = {},
    vertexPars = '', worldVertex = '', localVertex = '',
    fragmentPars = '', albedo = '', postLight = '', normalHook = '',
  } = opts;
  material.defines = { ...(material.defines || {}), STY_WRAP: wrap.toFixed(3), STY_RAMP: ramp.toFixed(3), STY_HUE: hue.toFixed(3), STY_AO: Math.round(ao * 100), ...defines };
  const key = [wrap, ramp, hue, ao, vertexPars, worldVertex, localVertex, fragmentPars, albedo, postLight, normalHook].join('|');
  material.customProgramCacheKey = () => key;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, G, uniforms);
    let vs = shader.vertexShader;
    vs = vs.replace('void main() {', `${GLSL_COMMON}\nvarying vec3 vStyWorld;\n${vertexPars}\nvoid main() {`);
    vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>\n${localVertex}`);
    vs = vs.replace('#include <project_vertex>', /* glsl */ `
      vec4 wPos = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        wPos = instanceMatrix * wPos;
      #endif
      wPos = modelMatrix * wPos;
      ${worldVertex}
      vStyWorld = wPos.xyz;
      vec4 mvPosition = viewMatrix * wPos;
      gl_Position = projectionMatrix * mvPosition;`);
    vs = vs.replace('#include <worldpos_vertex>', 'vec4 worldPosition = wPos;');
    shader.vertexShader = vs;

    let fs = shader.fragmentShader;
    // common code goes at the very top: RE_Direct (in the lambert pars) uses it
    fs = `${GLSL_COMMON}\nvarying vec3 vStyWorld;\n` + fs.replace('void main() {', `${fragmentPars}\nvoid main() {`);
    fs = fs.replace('#include <color_fragment>', `#include <color_fragment>\n${albedo}`);
    fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${normalHook}`);
    // interior lights (fire, oil lamp) only light fragments inside the cabin volume: no leaks
    fs = fs.replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace(
      'getPointLightInfo( pointLight, geometryPosition, directLight );',
      `getPointLightInfo( pointLight, geometryPosition, directLight );
      { vec3 lw = (pointLight.position - viewMatrix[3].xyz) * mat3(viewMatrix);
        directLight.color *= mix(1.0, interiorK(vStyWorld), step(0.5, interiorK(lw))); }`));
    fs = fs.replace('#include <lights_lambert_pars_fragment>', THREE.ShaderChunk.lights_lambert_pars_fragment.replace(
      /float dotNL = saturate\( dot\( geometryNormal, directLight\.direction \) \);\s*vec3 irradiance = dotNL \* directLight\.color;/, WRAP_DIRECT));
    fs = fs.replace('#include <opaque_fragment>', `${postLight}\n#include <opaque_fragment>`);
    shader.fragmentShader = fs;
    material.userData.shader = shader;
  };
  return material;
}

// Depth material for shadow casting that runs the same world-space vertex hook (so swaying
// leaves cast swaying shadows) and alpha-tests the same leaf texture.
export function stylizedDepth(opts = {}) {
  const { map = null, alphaTest = 0, worldVertex = '', localVertex = '', vertexPars = '', uniforms = {} } = opts;
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest });
  const key = 'depth|' + worldVertex + localVertex + vertexPars;
  m.customProgramCacheKey = () => key;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, G, uniforms);
    let vs = shader.vertexShader;
    vs = vs.replace('void main() {', `${GLSL_COMMON}\n${vertexPars}\nvoid main() {`);
    vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>\n${localVertex}`);
    vs = vs.replace('#include <project_vertex>', /* glsl */ `
      vec4 wPos = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        wPos = instanceMatrix * wPos;
      #endif
      wPos = modelMatrix * wPos;
      ${worldVertex}
      vec4 mvPosition = viewMatrix * wPos;
      gl_Position = projectionMatrix * mvPosition;`);
    shader.vertexShader = vs;
  };
  return m;
}
