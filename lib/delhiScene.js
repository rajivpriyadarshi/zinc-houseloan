import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createDelhiModel } from "./delhiModel.js";

export function createDelhiScene(container, { onError = () => {} } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
  } catch (error) {
    onError(error);
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0x171c19, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  container.append(renderer.domElement);
  const scene = new THREE.Scene(),
    camera = new THREE.OrthographicCamera(-5, 5, 4, -4, 0.1, 60);
  const pmrem = new THREE.PMREMGenerator(renderer),
    room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  room.dispose();
  pmrem.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.45;
  scene.add(new THREE.HemisphereLight("#fff6e7", "#344436", 1));
  const key = new THREE.DirectionalLight("#ffe3bb", 2.6);
  key.position.set(-4, 8, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 8, bottom: -6 });
  key.shadow.normalBias = 0.025;
  scene.add(key);
  const fill = new THREE.DirectionalLight("#c3d4c5", 0.85);
  fill.position.set(4, 3, -3);
  scene.add(fill);
  const model = createDelhiModel();
  scene.add(model.root);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.ShadowMaterial({ opacity: 0.2 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.35;
  floor.receiveShadow = true;
  scene.add(floor);
  const pref = matchMedia("(prefers-reduced-motion: reduce)");
  let elapsed = 0,
    last = 0,
    frame = 0,
    disposed = false,
    visible = true,
    reduced = pref.matches;
  function render() {
    model.seek(elapsed, reduced);
    const settle = reduced ? 1 : Math.min(1, elapsed / model.duration);
    const theta = 0.48 - 0.15 * (1 - Math.pow(1 - settle, 3));
    const target = new THREE.Vector3(0, 2.4, 0);
    camera.position.copy(
      new THREE.Vector3()
        .setFromSpherical(new THREE.Spherical(15, 1.21, theta))
        .add(target),
    );
    camera.lookAt(target);
    renderer.render(scene, camera);
  }
  function draw(now) {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    if (!reduced) elapsed = Math.min(model.duration + 0.1, elapsed + dt);
    render();
    if (!reduced && elapsed < model.duration + 0.1) wake();
  }
  function wake() {
    if (!frame && !disposed && visible && !document.hidden)
      frame = requestAnimationFrame(draw);
  }
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height || disposed) return;
    const aspect = width / height,
      halfH = Math.max(3.85, 8.5 / (2 * aspect));
    camera.left = -halfH * aspect;
    camera.right = halfH * aspect;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    wake();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    last = 0;
    if (visible) wake();
  });
  io.observe(container);
  function visibility() {
    last = 0;
    if (!document.hidden) wake();
  }
  function preference(event) {
    reduced = event.matches;
    if (reduced) elapsed = model.duration;
    last = 0;
    wake();
  }
  function lost(event) {
    event.preventDefault();
    onError(new Error("Landmark renderer unavailable"));
  }
  document.addEventListener("visibilitychange", visibility);
  pref.addEventListener("change", preference);
  renderer.domElement.addEventListener("webglcontextlost", lost);
  resize();
  wake();
  return {
    replay() {
      elapsed = 0;
      last = 0;
      wake();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      pref.removeEventListener("change", preference);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      const geometries = new Set(),
        materials = new Set(),
        textures = new Set();
      scene.traverse((node) => {
        if (node.geometry) geometries.add(node.geometry);
        if (node.material)
          (Array.isArray(node.material)
            ? node.material
            : [node.material]
          ).forEach((m) => materials.add(m));
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => {
        for (const value of Object.values(m))
          if (value?.isTexture) textures.add(value);
        m.dispose();
      });
      textures.forEach((t) => t.dispose());
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
