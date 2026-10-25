import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createPropertyModel } from "./propertyModel.js";
import { visibleHomeCorners, fitHomeZoom } from "./homeFraming.js";
import { readPurchaseBudget } from "./purchaseBudget.js";
import { STORY, progress, mix, spring, interiorFocus } from "./costStory.js";

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
  const homeCorners = visibleHomeCorners(model.root);
  const people = [
    model.residents.viewer.root,
    model.residents.reader.root,
    model.residents.child.root,
    model.residents.lounger.root,
    ...model.terrace.kids.map((kid) => kid.body),
    model.terrace.ball,
  ];
  scene.add(model.root);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.ShadowMaterial({ opacity: 0.23 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.4;
  ground.receiveShadow = true;
  scene.add(ground);
  // Keep structural floors in place while individual furnishings settle into them.
  // Store rest poses once so skipping, replaying and resizing are deterministic.
  const furnishings = [
    ...model.furnishings.children,
    ...model.outdoorFurnishings.children,
    ...model.furnishingGroups,
    ...model.hut.furnishings.children,
    model.garage.car,
  ]
    .filter((node) => node.visible)
    .map((node, index, nodes) => ({
      node,
      position: node.position.clone(),
      scale: node.scale.clone(),
      delay: (index / Math.max(1, nodes.length - 1)) * 1.55,
    }));
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
    const enter = reduced ? 1 : progress(time, STORY.down + 0.05, 1.05);
    const opening = reduced ? 0 : interiorFocus(time);
    model.root.position.y = mix(-0.35, 0, enter);
    model.root.scale.setScalar(mix(0.94, 1, enter));
    model.shell.position.y = 0;
    model.roof.position.y = roofRestY + (1 - enter) * 0.65;
    model.roof.position.z = 0;
    model.roof.rotation.x = 0;
    model.residents.seek(reduced ? 0 : time);
    model.terrace.seek(reduced ? 0 : time);
    model.poolLife.seek(reduced ? 0 : time);
    for (const item of furnishings) {
      const p = reduced
        ? 1
        : spring(time, STORY.furniture + item.delay, 0.8, 0.82);
      item.node.visible = p > 0.001;
      item.node.position.copy(item.position);
      item.node.position.y += (1 - p) * 0.65;
      item.node.scale
        .copy(item.scale)
        .multiplyScalar(Math.max(0.001, mix(0.7, 1, p)));
    }
    // Furniture assembles on its own. Residents arrive only after the camera finishes turning back.
    const peopleReady = reduced || time >= STORY.duty + 0.35;
    people.forEach((person) => {
      person.visible = peopleReady;
    });
    model.poolLife.root.visible = peopleReady && model.level >= 4;
    model.materials.glass.opacity = mix(0.12, 0.025, opening);
    const theta = mix(0.66 + (1 - enter) * 0.17, 0.025, opening);
    const phi = mix(1.12, 1.42, opening);
    const focus = target.clone();
    focus.y = mix(target.y, model.level >= 3 ? 1.55 : 1, opening);
    const requestedZoom = mix(mix(0.88, 1, enter), 1.22, opening);
    camera.position.copy(
      new THREE.Vector3()
        .setFromSpherical(new THREE.Spherical(12, phi, theta))
        .add(focus),
    );
    camera.lookAt(focus);
    camera.zoom = fitHomeZoom(camera, homeCorners, requestedZoom);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height || disposed) return;
    const aspect = width / height,
      halfHeight = Math.max(
        model.level >= 3 ? 3.5 : 2.8,
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
