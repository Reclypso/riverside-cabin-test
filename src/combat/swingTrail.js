// Axe swing trail: a ribbon swept by the two ends of the blade edge over the last ~0.16 s,
// additive warm-white HDR (so the bloom catches it) fading with age and toward the inner edge.
import * as THREE from 'three';

const N = 28;            // samples kept
const LIFE = 0.16;       // seconds a sample stays visible

export function createSwingTrail(model) {
  // blade edge of the hand-held axe (skinned to hand_r): extreme vertices of the iron along the
  // blade direction (-X in bind space), top/bottom along the handle (+Z in bind space)
  let iron = null;
  model.getObjectByName('MM_AxeHand')?.traverse((o) => { if (o.isSkinnedMesh && /Iron/i.test(o.material?.name || '') && !/_Outline/.test(o.name)) iron = o; });
  let top = -1, bot = -1;
  if (iron) {
    const p = iron.geometry.attributes.position;
    let minX = Infinity;
    for (let i = 0; i < p.count; i++) minX = Math.min(minX, p.getX(i));
    let zt = -Infinity, zb = Infinity;
    for (let i = 0; i < p.count; i++) {
      if (p.getX(i) > minX + 0.012) continue;
      if (p.getZ(i) > zt) { zt = p.getZ(i); top = i; }
      if (p.getZ(i) < zb) { zb = p.getZ(i); bot = i; }
    }
  }
  const pos = new Float32Array(N * 2 * 3), age = new Float32Array(N * 2), side = new Float32Array(N * 2);
  const idx = [];
  for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  for (let i = 0; i < N; i++) { side[i * 2] = 0; side[i * 2 + 1] = 1; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAge', new THREE.BufferAttribute(age, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: /* glsl */`
      attribute float aAge; attribute float aSide; varying float vAge; varying float vSide;
      void main(){ vAge = aAge; vSide = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity; varying float vAge; varying float vSide;
      void main(){
        float a = pow(clamp(1.0 - vAge, 0.0, 1.0), 1.6) * smoothstep(0.0, 0.85, vSide) * uOpacity;
        vec3 c = mix(vec3(1.0, 0.72, 0.35), vec3(1.0, 0.96, 0.85), vSide) * (1.0 + 1.6 * (1.0 - vAge));
        gl_FragColor = vec4(c * a, a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'Axe_SwingTrail'; mesh.frustumCulled = false; mesh.userData.noExport = true; mesh.renderOrder = 5;
  const samples = []; // {t, a: Vector3, b: Vector3}
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vh = new THREE.Vector3();
  const hand = model.getObjectByName('hand_r');
  let clock = 0;
  return {
    mesh,
    update(dt, attack) {
      clock += dt;
      const p = attack.progress();
      const active = iron && top >= 0 && attack.state.swinging && p > 0.16 && p < 0.58;
      if (active) {
        iron.getVertexPosition(top, va).applyMatrix4(iron.matrixWorld);
        iron.getVertexPosition(bot, vb).applyMatrix4(iron.matrixWorld);
        // widen the ribbon from the blade toward the fist so it reads as a swept arc, not a thin line
        const inner = vb.clone().lerp(hand ? hand.getWorldPosition(vh) : vb, 0.55);
        samples.unshift({ t: clock, a: va.clone(), b: inner });
        if (samples.length > N) samples.length = N;
      }
      while (samples.length && clock - samples[samples.length - 1].t > LIFE) samples.pop();
      mat.uniforms.uOpacity.value = samples.length > 1 ? 1 : 0;
      mesh.visible = samples.length > 1;
      if (!mesh.visible) return;
      for (let i = 0; i < N; i++) {
        const s = samples[Math.min(i, samples.length - 1)];
        pos.set([s.b.x, s.b.y, s.b.z], i * 6); pos.set([s.a.x, s.a.y, s.a.z], i * 6 + 3);
        const ag = i < samples.length ? (clock - s.t) / LIFE : 1;
        age[i * 2] = ag; age[i * 2 + 1] = ag;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.aAge.needsUpdate = true;
    },
  };
}
