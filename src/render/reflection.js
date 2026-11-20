// Planar reflection for the river (adapted from three's Reflector): renders objects on the
// REFLECT layer from a mirrored camera into a half-res target with an oblique clip plane.
import * as THREE from 'three';

export const LAYER_REFLECT = 1;

export function markReflective(obj) {
  obj.traverse((o) => o.layers.enable(LAYER_REFLECT));
  return obj;
}

export class PlanarReflection {
  constructor(renderer, { scale = 0.5, height = 0, clipBias = 0.02 } = {}) {
    this.renderer = renderer;
    this.scale = scale;
    this.height = height;
    this.clipBias = clipBias;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.target = new THREE.WebGLRenderTarget(Math.round(size.x * scale), Math.round(size.y * scale), {
      type: THREE.HalfFloatType, samples: 4,
    });
    this.target.texture.generateMipmaps = false;
    this.textureMatrix = new THREE.Matrix4();
    this.virtualCamera = new THREE.PerspectiveCamera();
    this.virtualCamera.layers.set(LAYER_REFLECT);
    this.hidden = []; // objects to hide while rendering (the water itself)
    this._n = new THREE.Vector3(0, 1, 0);
    this._p = new THREE.Vector3();
    this._cam = new THREE.Vector3();
    this._rot = new THREE.Matrix4();
    this._look = new THREE.Vector3();
    this._view = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._plane = new THREE.Plane();
    this._clip = new THREE.Vector4();
    this._q = new THREE.Vector4();
  }

  setSize(w, h) { this.target.setSize(Math.round(w * this.scale), Math.round(h * this.scale)); }

  update(scene, camera) {
    const { _n: normal, _p: P, _cam: C, _rot: R, _look: L, _view: V, _target: T, virtualCamera: vc } = this;
    P.set(0, this.height, 0);
    C.setFromMatrixPosition(camera.matrixWorld);
    R.extractRotation(camera.matrixWorld);
    V.subVectors(P, C);
    if (V.dot(normal) > 0) return; // camera under the water plane
    V.reflect(normal).negate().add(P);
    L.set(0, 0, -1).applyMatrix4(R).add(C);
    T.subVectors(P, L).reflect(normal).negate().add(P);
    vc.position.copy(V);
    vc.up.set(0, 1, 0).applyMatrix4(R).reflect(normal);
    vc.lookAt(T);
    vc.far = camera.far;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);

    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);

    // oblique near plane = water plane (Lengyel)
    this._plane.setFromNormalAndCoplanarPoint(normal, P).applyMatrix4(vc.matrixWorldInverse);
    const cp = this._clip.set(this._plane.normal.x, this._plane.normal.y, this._plane.normal.z, this._plane.constant);
    const pm = vc.projectionMatrix.elements, q = this._q;
    q.x = (Math.sign(cp.x) + pm[8]) / pm[0];
    q.y = (Math.sign(cp.y) + pm[9]) / pm[5];
    q.z = -1.0;
    q.w = (1.0 + pm[10]) / pm[14];
    cp.multiplyScalar(2.0 / cp.dot(q));
    pm[2] = cp.x; pm[6] = cp.y; pm[10] = cp.z + 1.0 - this.clipBias; pm[14] = cp.w;
    vc.projectionMatrixInverse.copy(vc.projectionMatrix).invert();

    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    const prevXr = r.xr.enabled;
    r.xr.enabled = false;
    for (const o of this.hidden) o.visible = false;
    r.setRenderTarget(this.target);
    r.clear();
    r.render(scene, vc);
    for (const o of this.hidden) o.visible = true;
    r.xr.enabled = prevXr;
    r.setRenderTarget(prevTarget);
  }
}
