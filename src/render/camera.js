// Camera + OrbitControls with idle-game friendly limits and a cinematic auto-orbit.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { groundY } from '../world/heightfield.js';

const BOUNDS = 42; // target stays within the area

export function createCameraRig(renderer) {
  const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.3, 4000);
  camera.name = 'MainCamera';
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 7;
  controls.maxDistance = 105;
  controls.minPolarAngle = THREE.MathUtils.degToRad(18);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(93); // allow low hero shots looking slightly up
  controls.screenSpacePanning = false;
  controls.panSpeed = 0.8;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.9;
  controls.autoRotateSpeed = -0.35;

  controls.addEventListener('change', () => {
    const t = controls.target;
    const cx = THREE.MathUtils.clamp(t.x, -BOUNDS, BOUNDS), cz = THREE.MathUtils.clamp(t.z, -BOUNDS, BOUNDS);
    if (cx !== t.x || cz !== t.z) {
      camera.position.x += cx - t.x; camera.position.z += cz - t.z;
      t.x = cx; t.z = cz;
    }
    const minY = groundY(camera.position.x, camera.position.z) + 1.0;
    if (camera.position.y < minY) camera.position.y = minY;
  });

  function setShot(shot) {
    camera.position.set(...shot.pos);
    controls.target.set(...shot.target);
    camera.fov = shot.fov;
    camera.updateProjectionMatrix();
    controls.update();
  }

  return { camera, controls, setShot };
}
