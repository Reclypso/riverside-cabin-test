// Distant-forest impostors: every real tree variant is rendered once into an atlas (side view,
// soft front lighting from the current time-of-day preset), then thousands of far trees are drawn
// as camera-facing (cylindrical) billboards sampling that atlas. Re-baked on preset changes.
import * as THREE from 'three';
import { G } from '../../render/globals.js';

const CELL = 256;

export function createImpostorAtlas(renderer, variants) {
  // variants: [{ trunk: geo, leaves: geo, barkMat, leafMat, height }]
  const cols = 4, rows = Math.ceil(variants.length / cols);
  const target = new THREE.WebGLRenderTarget(cols * CELL, rows * CELL, { type: THREE.HalfFloatType, samples: 4 });
  target.texture.generateMipmaps = false;
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1.5);
  scene.add(sun, sun.target, hemi);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const cells = variants.map((v, i) => {
    const g = new THREE.Group();
    // instanced (count 1) so per-instance tint + instancing shader paths match the real trees
    const trunk = new THREE.InstancedMesh(v.trunk, v.barkMat, 1), leaves = new THREE.InstancedMesh(v.leaves, v.leafMat, 1);
    trunk.setMatrixAt(0, new THREE.Matrix4()); leaves.setMatrixAt(0, new THREE.Matrix4());
    leaves.setColorAt(0, new THREE.Color(v.tint ?? 0xffffff));
    g.add(trunk, leaves);
    const box = new THREE.Box3().setFromObject(g);
    const size = box.getSize(new THREE.Vector3());
    const half = Math.max(size.x, size.z, size.y) * 0.52;
    return { g, box, half, col: i % cols, row: Math.floor(i / cols), aspect: 1, h: size.y };
  });
  function bake(preset) {
    sun.color.set(preset.sunColor); sun.intensity = preset.sunIntensity * 0.95;
    hemi.color.set(preset.hemiSky); hemi.groundColor.set(preset.hemiGround); hemi.intensity = preset.hemiIntensity;
    const prevTarget = renderer.getRenderTarget(), prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
    const saved = [G.uTime.value, G.uWind.value.z, G.uAOParams.value.z, G.uCloudShadow.value];
    G.uTime.value = 0; G.uWind.value.z = 0; G.uAOParams.value.z = 0; G.uCloudShadow.value = 0; // neutral bake
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0); renderer.clear();
    for (const c of cells) {
      scene.add(c.g);
      const cy = (c.box.min.y + c.box.max.y) / 2;
      cam.left = -c.half; cam.right = c.half; cam.top = c.half; cam.bottom = -c.half; cam.updateProjectionMatrix();
      cam.position.set(0, cy + c.half * 0.15, 40); cam.lookAt(0, cy, 0);
      sun.position.set(-20, 30, 35); sun.target.position.set(0, cy, 0);
      // per-cell viewport on the render target itself (never touch the canvas viewport)
      target.viewport.set(c.col * CELL, c.row * CELL, CELL, CELL);
      target.scissor.set(c.col * CELL, c.row * CELL, CELL, CELL);
      target.scissorTest = true;
      renderer.setRenderTarget(target);
      renderer.render(scene, cam);
      scene.remove(c.g);
    }
    target.viewport.set(0, 0, cols * CELL, rows * CELL);
    target.scissor.set(0, 0, cols * CELL, rows * CELL);
    target.scissorTest = false;
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClear, prevAlpha);
    [G.uTime.value, G.uWind.value.z, G.uAOParams.value.z, G.uCloudShadow.value] = saved;
  }
  return { texture: target.texture, cells, cols, rows, bake };
}

// billboard field: instances = [{ x, y, z, cell, scale }]
export function createImpostorField(atlas, instances) {
  const quad = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const geo = new THREE.InstancedBufferGeometry().copy(quad);
  geo.instanceCount = instances.length;
  const off = new Float32Array(instances.length * 4), uvr = new Float32Array(instances.length * 4);
  instances.forEach((t, i) => {
    const c = atlas.cells[t.cell];
    const size = c.half * 2 * t.scale;
    // the cell is centred on the tree's bbox centre: quad bottom = tree-local (cy - half)
    const cy = (c.box.min.y + c.box.max.y) / 2;
    off.set([t.x, t.y + (cy - c.half) * t.scale, t.z, size], i * 4);
    uvr.set([c.col / atlas.cols, c.row / atlas.rows, 1 / atlas.cols, 1 / atlas.rows], i * 4);
  });
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
  geo.setAttribute('aUv', new THREE.InstancedBufferAttribute(uvr, 4));
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
  uniforms.uAtlas = { value: atlas.texture };
  const mat = new THREE.ShaderMaterial({
    uniforms, fog: true, alphaToCoverage: true, transparent: false,
    vertexShader: /* glsl */ `
      attribute vec4 aOff; attribute vec4 aUv;
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){
        vec3 toCam = cameraPosition - aOff.xyz; toCam.y = 0.0; toCam = normalize(toCam);
        vec3 right = vec3(toCam.z, 0.0, -toCam.x);
        vec3 w = aOff.xyz + right * position.x * aOff.w + vec3(0.0, position.y * aOff.w, 0.0);
        vUv = aUv.xy + uv * aUv.zw;
        vec4 mvPosition = viewMatrix * vec4(w, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;
      varying vec2 vUv;
      #include <fog_pars_fragment>
      void main(){
        vec4 c = texture2D(uAtlas, vUv);
        if (c.a < 0.35) discard;
        gl_FragColor = vec4(c.rgb / max(c.a, 0.001), 1.0);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'Forest_Impostors';
  mesh.frustumCulled = false;
  mesh.userData.noExport = true;
  return mesh;
}
