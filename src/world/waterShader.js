// GLSL for the stylised river: depth colour, flow-mapped ripples, planar reflection,
// fresnel, sun glints, shore foam bands and rock foam rings + wakes.
import { GLSL_COMMON } from '../render/globals.js';
import { GLSL_WORLD } from './worldData.js';

export const WATER_VERT = /* glsl */ `
attribute vec2 aTan;
attribute float aAcross;
uniform mat4 uReflMatrix;
varying vec3 vWorld; varying vec2 vTan; varying float vAcross; varying vec4 vRefl;
#include <fog_pars_vertex>
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz; vTan = aTan; vAcross = aAcross;
  vRefl = uReflMatrix * w;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

export const WATER_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_WORLD}
uniform sampler2D uNormals, uReflTex;
uniform vec3 uShallow, uMid, uDeep, uFoam, uWaterLight, uSkyRefl;
uniform vec4 uRocks[8];
uniform float uReflStrength;
uniform float uDebug;
varying vec3 vWorld; varying vec2 vTan; varying float vAcross; varying vec4 vRefl;
#include <fog_pars_fragment>

vec3 sampleN(vec2 uv){ return texture2D(uNormals, uv).xzy * 2.0 - 1.0; } // xz = slope, y = up

void main(){
  vec2 xz = vWorld.xz;
  bool near = abs(xz.x) < 118.0 && abs(xz.y) < 118.0;
  vec4 wd = near ? worldData(xz) : vec4(50.0, -2.0, vTan * 0.7);
  float ground = wd.g;
  if (ground > 0.06) discard;
  float depth = max(-ground, 0.0);
  vec2 flow = wd.ba;
  float speed = length(flow);

  // --- flow-mapped ripples (two phases to hide the reset) ---
  float t = uTime * 0.35;
  float p0 = fract(t), p1 = fract(t + 0.5);
  float wgt = abs(1.0 - 2.0 * p0);
  vec2 f = flow * 1.6;
  vec3 a0 = sampleN(xz * 0.11 - f * p0);
  vec3 a1 = sampleN(xz * 0.11 - f * p1 + 0.37);
  vec3 b0 = sampleN(xz * 0.29 - f * p0 * 1.7 + 0.13);
  vec3 b1 = sampleN(xz * 0.29 - f * p1 * 1.7 + 0.71);
  vec3 nA = mix(a0, a1, wgt), nB = mix(b0, b1, wgt);
  vec3 drift = sampleN(xz * 0.05 + vec2(uTime * 0.008, -uTime * 0.006));
  float rough = 0.22 + 0.55 * clamp(speed, 0.0, 1.0);
  vec3 N = normalize(vec3((nA.x + nB.x * 0.6 + drift.x * 0.5) * rough, 1.0, (nA.z + nB.z * 0.6 + drift.z * 0.5) * rough));

  vec3 V = normalize(cameraPosition - vWorld);
  float ndv = max(dot(N, V), 0.0);
  // stylised fresnel: always some sky/tree reflection, mirror-like at grazing angles
  float fres = 0.2 + 0.8 * pow(1.0 - ndv, 3.0);

  // --- body colour by depth ---
  vec3 body = mix(uShallow, uMid, smoothstep(0.05, 0.7, depth));
  body = mix(body, uDeep, smoothstep(0.6, 1.9, depth));
  body *= uWaterLight * cloudShadow(xz);
  float alpha = mix(0.32, 0.9, smoothstep(0.0, 1.4, depth)) * smoothstep(0.0, 0.05, depth);

  // --- reflection ---
  vec2 rc = vRefl.xy / vRefl.w + N.xz * 0.022;
  vec3 refl = texture2D(uReflTex, rc).rgb;
  refl = mix(uSkyRefl, refl, uReflStrength);
  vec3 col = mix(body, refl, clamp(fres, 0.0, 1.0));
  alpha = max(alpha, fres * smoothstep(0.0, 0.08, depth));

  // --- sun specular + sparkly glints ---
  vec3 L = normalize(uSunDir);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 380.0) * 6.0;
  vec3 Ng = normalize(vec3(nB.x * 1.6, 1.0, nB.z * 1.6));
  float g = pow(max(dot(Ng, H), 0.0), 2200.0);
  float tw = step(0.6, hash12(floor(xz * 7.0) + floor(uTime * 3.0)));
  spec += g * 40.0 * tw;
  col += uSunColor * spec * cloudShadow(xz);
  alpha = max(alpha, clamp(spec, 0.0, 1.0));

  // --- foam ---
  vec2 fdir = speed > 0.001 ? flow / speed : vTan;
  vec2 fperp = vec2(-fdir.y, fdir.x);
  float fn = vnoise(xz * 2.2 - flow * uTime * 1.5);
  float fn2 = vnoise(xz * 5.0 + vec2(uTime * 0.3, 0.0));
  // crisp shore line + a second broken band that pulses outward
  float shore = (1.0 - smoothstep(0.1 + 0.08 * fn, 0.16 + 0.1 * fn, depth)) * smoothstep(0.0, 0.015, depth);
  float bandsT = fract(depth * 3.2 - uTime * 0.28 + fn * 0.7);
  float bands = smoothstep(0.4, 0.5, bandsT) * (1.0 - smoothstep(0.5, 0.62, bandsT)) * (1.0 - smoothstep(0.12, 0.5, depth));
  float foam = max(shore, bands * 0.8 * step(0.35, fn2));
  for (int i = 0; i < 8; i++) {
    vec4 r = uRocks[i];
    if (r.z <= 0.0) continue;
    vec2 d = xz - r.xy;
    float dist = length(d) - r.z;
    float ring = 1.0 - smoothstep(0.0, 0.16 + 0.32 * fn, dist);
    float along = dot(d, fdir), across = dot(d, fperp);
    float wakeW = r.z * (0.75 + along * 0.12);
    float streak = vnoise(vec2(across * 5.0 / max(r.z, 0.3), along * 0.9 - uTime * 2.4 * max(speed, 0.2)));
    float wake = smoothstep(0.0, 0.6, along) * exp(-along * 0.22 / max(r.z, 0.4))
      * (1.0 - smoothstep(wakeW * 0.4, wakeW, abs(across))) * smoothstep(0.45, 0.62, streak);
    foam = max(foam, max(ring, wake * 0.9));
  }
  // drifting foam flecks in faster water
  float fleck = smoothstep(0.78, 0.86, vnoise(xz * 1.3 - flow * uTime * 1.2)) * smoothstep(0.35, 0.8, speed) * 0.55;
  foam = max(foam, fleck * step(0.4, fn2));
  vec3 foamCol = uFoam * (uWaterLight * 0.75 + uSunColor * 0.35) * cloudShadow(xz);
  col = mix(col, foamCol, foam);
  alpha = max(alpha, foam);

  gl_FragColor = vec4(col, alpha);
  if (uDebug > 0.5) gl_FragColor = vec4(foam, depth, shore, 1.0);
  #include <fog_fragment>
}`;
