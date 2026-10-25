import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createPropertyModel } from "./propertyModel.js";
import { readPurchaseBudget } from "./purchaseBudget.js";
const clamp = THREE.MathUtils.clamp;
const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const progress = (time, start, duration) =>
  ease(clamp((time - start) / duration, 0, 1));
const mix = THREE.MathUtils.lerp;

/** A seekable film scene. The page owns the only animation clock. */
export function createHomeScene(container, { onError }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
  } catch (error) {
    onError(error);
    return null;
  }
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4, 4, 3.2, -3.2, 0.1, 60);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  container.appendChild(renderer.domElement);
  const pmrem = new THREE.PMREMGenerator(renderer),
    room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.65;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight("#fff7eb", "#333c35", 0.9));
  const sun = new THREE.DirectionalLight("#fff0d9", 2.3);
  sun.position.set(-3, 8, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 7, bottom: -5 });
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.0002;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#a9c5b1", 0.8);
  fill.position.set(5, 3, -4);
  scene.add(fill);
  const model = createPropertyModel(readPurchaseBudget().price, {
    instant: true,
  });
  const roofRestY = model.roofRestY;
  scene.add(model.root);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.ShadowMaterial({ opacity: 0.23 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.4;
  ground.receiveShadow = true;
  scene.add(ground);
  const originalStone = model.materials.stone.color.clone();
  const loanColor = new THREE.Color("#829d73"),
    downColor = new THREE.Color("#c5a676");
  const target = new THREE.Vector3(
    model.level >= 4
      ? 0.1
      : model.level >= 3
        ? -1.5
        : model.level >= 2
          ? -0.7
          : 0,
    model.level >= 3 ? 1.7 : 1.3,
    0,
  );
  let lastTime = 0,
    lastReduced = false,
    disposed = false;

  function seek(time, reduced = false) {
    if (disposed) return;
    lastTime = time;
    lastReduced = reduced;
    const enter = reduced ? 1 : progress(time, 0.15, 1.8);
    const furnishing = reduced ? 1 : progress(time, 9.65, 1.5);
    const opening = reduced
      ? 0
      : progress(time, 9.4, 1.5) * (1 - progress(time, 12.65, 1.6));
    const key = reduced ? 1 : progress(time, 12.9, 1.25);
    const loan = reduced
      ? 0
      : progress(time, 3.4, 1.3) * (1 - progress(time, 6.25, 1.1));
    const down = reduced
      ? 0
      : progress(time, 6.4, 1.2) * (1 - progress(time, 9.3, 1.2));
    const settled = progress(time, 15.5, 1.8);
    model.root.position.y = mix(-1.2, 0, enter);
    model.root.scale.setScalar(mix(0.87, 1, enter));
    model.shell.position.y = mix(0.65, 0, enter);
    model.roof.position.y = roofRestY + mix(1.5, 0, enter) + opening * 1.6;
    model.roof.position.z = opening * -1.0;
    model.roof.rotation.x = opening * -0.06;
    model.interior.visible = furnishing > 0.001;
    model.interior.scale.y = Math.max(0.001, furnishing);
    model.interior.position.y = (1 - furnishing) * 0.6;
    model.materials.glass.opacity = mix(0.16, 0.055, opening);
    model.ownership.visible = key > 0.001;
    model.ownership.scale.setScalar(
      Math.max(0.001, key * mix(1.15, 0.85, settled)),
    );
    model.ownership.position.y = 2.05 + (1 - key) * 0.9;
    model.ownership.rotation.y = (1 - key) * -1.3;
    model.materials.stone.color
      .copy(originalStone)
      .lerp(loanColor, loan * 0.7)
      .lerp(downColor, down * 0.65);
    const theta = reduced ? 0.66 : mix(0.84, 0.66, enter) - opening * 0.28;
    const phi = reduced ? 1.16 : mix(1.08, 1.16, enter) - opening * 0.4;
    camera.position.copy(
      new THREE.Vector3()
        .setFromSpherical(new THREE.Spherical(12, phi, theta))
        .add(target),
    );
    camera.lookAt(target);
    renderer.render(scene, camera);
  }
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height || disposed) return;
    const aspect = width / height,
      halfHeight = Math.max(
        model.level >= 3 ? 4 : 3.3,
        model.viewWidth / (2 * aspect),
      );
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    seek(lastTime, lastReduced);
  }
  function contextLost(event) {
    event.preventDefault();
    onError(new Error("WebGL context lost"));
  }
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  return {
    seek,
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      const geometries = new Set(),
        materials = new Set();
      scene.traverse((node) => {
        if (node.geometry) geometries.add(node.geometry);
        if (node.material)
          (Array.isArray(node.material)
            ? node.material
            : [node.material]
          ).forEach((mat) => materials.add(mat));
      });
      geometries.forEach((g) => g.dispose());
      const textures = new Set();
      materials.forEach((m) => {
        for (const value of Object.values(m))
          if (value?.isTexture) textures.add(value);
        m.dispose();
      });
      textures.forEach((texture) => texture.dispose());
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
