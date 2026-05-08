import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const slider = document.getElementById('amount-slider');
const amountInput = document.getElementById('amount-input');
const amountDisplay = document.getElementById('amount-display');

function formatIndianNumber(num) {
  const str = num.toString();
  let result = '';
  let count = 0;

  for (let i = str.length - 1; i >= 0; i--) {
    count++;
    result = str[i] + result;

    if (count === 3 && i > 0) {
      result = ',' + result;
    } else if (count > 3 && (count - 3) % 2 === 0 && i > 0) {
      result = ',' + result;
    }
  }

  return result;
}

function parseIndianNumber(str) {
  return parseInt(str.replace(/,/g, ''), 10) || 0;
}

function updateDisplay(value) {
  const formatted = formatIndianNumber(value);
  amountDisplay.innerHTML = formatted.split('').map(char =>
    `<span class="char">${char}</span>`
  ).join('');
}

updateDisplay(10000000);

let lastHapticValue = 10000000;
const HAPTIC_STEP = 1000000;

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function triggerHaptic() {
  if (navigator.vibrate) {
    navigator.vibrate(10);
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = 1200;
  oscillator.type = 'sine';

  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.05);
}

const container = document.getElementById('canvas-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5f5dc);

const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  0.1,
  1000
);
camera.position.set(0, 3, 10);

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
scene.add(directionalLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

const loader = new GLTFLoader();
let mushroomModel = null;
let mediumModel = null;
let largeModel = null;
let currentModel = null;
let currentModelType = 'medium';
let isTransitioning = false;
let currentScale = 1;

const THRESHOLD_LOW = 10000000;
const THRESHOLD_HIGH = 30000000;

function loadModel(path, callback) {
  loader.load(path, (gltf) => {
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    model.position.sub(center);
    model.position.y += size.y * 0.1;

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 4 / maxDim;
    model.scale.setScalar(scale);
    model.userData.baseScale = scale;

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    callback(model);
  });
}

loadModel('/models/house.glb', (model) => {
  mushroomModel = model;
  mushroomModel.visible = false;
  scene.add(mushroomModel);
});

loadModel('/models/house_rodin.glb', (model) => {
  mediumModel = model;
  scene.add(mediumModel);
  currentModel = mediumModel;
  controls.target.set(0, 0, 0);
  controls.update();
});

loadModel('/models/house_large.glb', (model) => {
  largeModel = model;
  largeModel.visible = false;
  scene.add(largeModel);
});

function switchModel(newType) {
  if (isTransitioning) return;
  if (newType === currentModelType) return;

  let newModel;
  if (newType === 'mushroom') newModel = mushroomModel;
  else if (newType === 'medium') newModel = mediumModel;
  else if (newType === 'large') newModel = largeModel;

  if (!newModel) return;

  isTransitioning = true;

  const oldModel = currentModel;

  const zoomOut = () => {
    if (currentScale > 0.01) {
      currentScale -= 0.05;
      if (oldModel) {
        const baseScale = oldModel.userData.baseScale || 1;
        oldModel.scale.setScalar(baseScale * currentScale);
      }
      requestAnimationFrame(zoomOut);
    } else {
      if (oldModel) oldModel.visible = false;
      newModel.visible = true;
      currentModel = newModel;
      currentModelType = newType;
      currentScale = 0.01;
      zoomIn();
    }
  };

  const zoomIn = () => {
    if (currentScale < 1) {
      currentScale += 0.05;
      if (currentModel) {
        const baseScale = currentModel.userData.baseScale || 1;
        currentModel.scale.setScalar(baseScale * currentScale);
      }
      requestAnimationFrame(zoomIn);
    } else {
      currentScale = 1;
      if (currentModel) {
        const baseScale = currentModel.userData.baseScale || 1;
        currentModel.scale.setScalar(baseScale);
      }
      isTransitioning = false;
    }
  };

  zoomOut();
}

function checkAndSwitchModel(value) {
  if (value >= THRESHOLD_HIGH && currentModelType !== 'large') {
    switchModel('large');
  } else if (value >= THRESHOLD_LOW && value < THRESHOLD_HIGH && currentModelType !== 'medium') {
    switchModel('medium');
  } else if (value < THRESHOLD_LOW && currentModelType !== 'mushroom') {
    switchModel('mushroom');
  }
}

slider.addEventListener('input', () => {
  const value = parseInt(slider.value, 10);
  amountInput.value = formatIndianNumber(value);
  updateDisplay(value);
  checkAndSwitchModel(value);

  const crossedStep = Math.floor(value / HAPTIC_STEP) !== Math.floor(lastHapticValue / HAPTIC_STEP);
  if (crossedStep) {
    triggerHaptic();
  }
  lastHapticValue = value;
});

amountDisplay.addEventListener('click', () => {
  amountInput.style.display = 'block';
  amountInput.focus();
  amountDisplay.style.display = 'none';
});

amountInput.addEventListener('input', (e) => {
  const rawValue = e.target.value.replace(/[^0-9]/g, '');
  let numValue = parseInt(rawValue, 10) || 0;

  if (numValue > 100000000) numValue = 100000000;

  amountInput.value = formatIndianNumber(numValue);

  if (numValue >= 100000 && numValue <= 100000000) {
    slider.value = numValue;
    checkAndSwitchModel(numValue);
  }
});

amountInput.addEventListener('blur', () => {
  let value = parseIndianNumber(amountInput.value);
  if (value < 100000) value = 100000;
  if (value > 100000000) value = 100000000;
  amountInput.value = formatIndianNumber(value);
  slider.value = value;
  updateDisplay(value);
  amountInput.style.display = 'none';
  amountDisplay.style.display = 'inline';
  checkAndSwitchModel(value);
});

function animate() {
  requestAnimationFrame(animate);
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

// Proceed button - save house value and navigate
document.getElementById('proceed-btn').addEventListener('click', () => {
  const value = parseInt(slider.value, 10);
  localStorage.setItem('houseValue', value);
  window.location.href = 'location.html';
});
