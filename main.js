import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const container = document.getElementById('canvas-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5f5dc);

const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  0.1,
  1000
);
camera.position.set(0, 2, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableZoom = false;
controls.enablePan = false;
controls.minPolarAngle = Math.PI / 4;
controls.maxPolarAngle = Math.PI / 2;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

const loader = new GLTFLoader();
let model;
let bunny = null;
let bunnyArm = null;
const clock = new THREE.Clock();

loader.load(
  '/models/house.glb',
  (gltf) => {
    model = gltf.scene;

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    model.position.sub(center);
    model.position.y += size.y * 0.1;

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 4 / maxDim;
    model.scale.setScalar(scale);

    console.log('=== All objects in model ===');
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        console.log('Mesh:', child.name);
      }
      if (child.isObject3D && child.name) {
        console.log('Object3D:', child.name, child.type);
      }
    });
    console.log('=== End of objects ===');

    model.traverse((child) => {
      const nameLower = child.name.toLowerCase();
      if (nameLower.includes('rabbit') || nameLower.includes('bunny') || nameLower.includes('character') || nameLower.includes('animal')) {
        console.log('Found potential bunny:', child.name, child.type);
        if (!bunny && (child.isMesh || child.type === 'Group' || child.type === 'Object3D')) {
          bunny = child;
        }
      }
    });

    if (!bunny) {
      model.traverse((child) => {
        if (child.isMesh) {
          const material = child.material;
          if (material && material.color) {
            const color = material.color;
            if (color.r > 0.9 && color.g > 0.9 && color.b > 0.9) {
              console.log('White mesh (possible bunny):', child.name);
              if (!bunny) bunny = child;
            }
          }
        }
      });
    }

    if (bunny) {
      console.log('Using as bunny:', bunny.name);
      bunny.userData.originalPosition = bunny.position.clone();
      bunny.userData.originalRotation = bunny.rotation.clone();
    } else {
      console.log('No bunny found in model');
    }

    scene.add(model);

    controls.target.set(0, 0, 0);
    controls.update();
  },
  (progress) => {
    console.log('Loading:', (progress.loaded / progress.total * 100).toFixed(1) + '%');
  },
  (error) => {
    console.error('Error loading model:', error);
  }
);

function onWindowResize() {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

window.addEventListener('resize', onWindowResize);

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();

  if (bunny) {
    const wave = Math.sin(elapsed * 4) * 0.15;
    const bounce = Math.sin(elapsed * 2) * 0.02;

    bunny.rotation.z = wave;

    if (bunny.userData.originalPosition) {
      bunny.position.y = bunny.userData.originalPosition.y + bounce;
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();

container.addEventListener('mousedown', () => {
  controls.autoRotate = false;
});

container.addEventListener('mouseup', () => {
  setTimeout(() => {
    controls.autoRotate = true;
  }, 3000);
});
