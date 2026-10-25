import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createPropertyModel } from "./propertyModel.js";
import { createNeighbourhood } from "./neighbourhood.js";
import { createGardenLife } from "./gardenLife.js";

export function createPropertyScene(
  container,
  {
    value = 10000000,
    interactive = false,
    neighbourhood = false,
    onError = () => {},
    onReady = () => {},
  } = {},
) {
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
  const scene = new THREE.Scene(),
    camera = new THREE.OrthographicCamera(-5, 5, 4, -4, 0.1, 60);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.setClearColor(0x171c19, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  container.appendChild(renderer.domElement);
  const generator = new THREE.PMREMGenerator(renderer),
    room = new RoomEnvironment(),
    environment = generator.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.65;
  room.dispose();
  generator.dispose();
  scene.add(new THREE.HemisphereLight("#fff7eb", "#333c35", 0.9));
  const sun = new THREE.DirectionalLight("#fff0d9", 2.3);
  sun.position.set(-4, 9, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 });
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#b7c9ae", 0.8);
  fill.position.set(5, 4, -4);
  scene.add(fill);
  const model = createPropertyModel(value);
  scene.add(model.root);
  const surroundings = neighbourhood ? createNeighbourhood(model.level) : null;
  if (surroundings) scene.add(surroundings.root);
  const gardenLife = neighbourhood ? createGardenLife(model.garage) : null;
  if (gardenLife) scene.add(gardenLife.root);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.ShadowMaterial({ opacity: 0.2 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = surroundings ? -0.63 : -0.38;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(16, 32, "#708164", "#708164");
  grid.position.y = -0.37;
  grid.material.transparent = true;
  grid.material.opacity = 0.045;
  scene.add(grid);
  grid.visible = !surroundings;
  const pref = matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = pref.matches,
    frame = 0,
    last = 0,
    disposed = false,
    visible = true,
    viewWidth = surroundings?.viewWidth ?? 8.5,
    targetWidth = surroundings?.viewWidth ?? model.viewWidth,
    lookX = surroundings?.centerX ?? 0,
    angle = 0.62,
    targetAngle = 0.62,
    polar = 1.03,
    targetPolar = 1.03,
    lastInput = 0;
  let drag = null;
  let size = { width: 1, height: 1 };
  function draw(now) {
    frame = 0;
    if (disposed || document.hidden || !visible) return;
    const dt = Math.min(last ? (now - last) / 1000 : 1 / 60, 0.032);
    last = now;
    const moving = model.update(dt, reduced);
    surroundings?.update(dt, reduced);
    gardenLife?.update(dt, reduced);
    viewWidth = reduced
      ? targetWidth
      : THREE.MathUtils.lerp(viewWidth, targetWidth, 1 - Math.exp(-3.2 * dt));
    const targetX =
      surroundings?.centerX ??
      (model.level >= 4
        ? 0.1
        : model.level >= 3
          ? -1.5
          : model.level >= 2
            ? -0.7
            : 0);
    lookX = reduced
      ? targetX
      : THREE.MathUtils.lerp(lookX, targetX, 1 - Math.exp(-3.2 * dt));
    angle = reduced
      ? targetAngle
      : THREE.MathUtils.lerp(angle, targetAngle, 1 - Math.exp(-4 * dt));
    polar = reduced
      ? targetPolar
      : THREE.MathUtils.lerp(
          polar,
          targetPolar,
          1 - Math.exp(-(drag ? 18 : 5) * dt),
        );
    const look = new THREE.Vector3(
      lookX,
      surroundings ? 0.55 : model.level >= 3 ? 1.45 : 1,
      surroundings?.centerZ ?? 0,
    );
    camera.position.copy(
      new THREE.Vector3()
        .setFromSpherical(new THREE.Spherical(16, polar, angle))
        .add(look),
    );
    camera.lookAt(look);
    const aspect = size.width / size.height,
      halfH = Math.max(3.2, viewWidth / (2 * aspect));
    camera.left = -halfH * aspect;
    camera.right = halfH * aspect;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    if (
      moving ||
      (surroundings && !reduced) ||
      Math.abs(viewWidth - targetWidth) > 0.003 ||
      Math.abs(angle - targetAngle) > 0.001 ||
      Math.abs(polar - targetPolar) > 0.001 ||
      now - lastInput < 1200
    )
      wake();
  }
  function wake() {
    if (!frame && !disposed && !document.hidden && visible)
      frame = requestAnimationFrame(draw);
  }
  function returnHome() {
    const pointerId = drag?.id;
    drag = null;
    container.classList.remove("is-dragging");
    if (pointerId !== undefined && container.hasPointerCapture(pointerId))
      container.releasePointerCapture(pointerId);
    targetAngle = 0.62;
    targetPolar = 1.03;
    lastInput = performance.now();
    wake();
  }
  function pointerDown(event) {
    if (event.button !== 0 || drag) return;
    event.preventDefault();
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      angle,
      polar,
    };
    targetAngle = angle;
    targetPolar = polar;
    container.setPointerCapture(event.pointerId);
    container.classList.add("is-dragging");
  }
  function pointerMove(event) {
    if (!drag || event.pointerId !== drag.id) return;
    targetAngle = THREE.MathUtils.clamp(
      drag.angle - (event.clientX - drag.x) * 0.006,
      -0.95,
      2.2,
    );
    targetPolar = THREE.MathUtils.clamp(
      drag.polar - (event.clientY - drag.y) * 0.004,
      0.45,
      1.4,
    );
    // Follow the hand directly; the release settles back with damping.
    angle = targetAngle;
    polar = targetPolar;
    wake();
  }
  function pointerEnd(event) {
    if (drag && event.pointerId === drag.id) returnHome();
  }
  function keyDown(event) {
    if (!event.key.startsWith("Arrow")) return;
    event.preventDefault();
    targetAngle = THREE.MathUtils.clamp(
      targetAngle +
        (event.key === "ArrowLeft"
          ? -0.15
          : event.key === "ArrowRight"
            ? 0.15
            : 0),
      -0.95,
      2.2,
    );
    targetPolar = THREE.MathUtils.clamp(
      targetPolar +
        (event.key === "ArrowUp" ? -0.1 : event.key === "ArrowDown" ? 0.1 : 0),
      0.45,
      1.4,
    );
    wake();
  }
  function keyUp(event) {
    if (event.key.startsWith("Arrow")) returnHome();
  }
  const interactionEvents = {
    pointerdown: pointerDown,
    pointermove: pointerMove,
    pointerup: pointerEnd,
    pointercancel: pointerEnd,
    lostpointercapture: pointerEnd,
    keydown: keyDown,
    keyup: keyUp,
    blur: returnHome,
  };
  if (interactive) {
    Object.entries(interactionEvents).forEach(([name, handler]) =>
      container.addEventListener(name, handler),
    );
    window.addEventListener("blur", returnHome);
  }
  function resize() {
    size = container.getBoundingClientRect();
    if (size.width && size.height) {
      renderer.setSize(size.width, size.height, false);
      wake();
    }
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
    if (document.hidden && interactive) returnHome();
    last = 0;
    if (!document.hidden) wake();
  }
  function preference(event) {
    reduced = event.matches;
    wake();
  }
  function context(event) {
    event.preventDefault();
    onError(new Error("3D context unavailable"));
  }
  document.addEventListener("visibilitychange", visibility);
  pref.addEventListener("change", preference);
  renderer.domElement.addEventListener("webglcontextlost", context);
  resize();
  wake();
  onReady();
  return {
    setValue(next) {
      model.setValue(next);
      targetWidth = surroundings?.viewWidth ?? model.viewWidth;
      lastInput = performance.now();
      wake();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (interactive) {
        returnHome();
        Object.entries(interactionEvents).forEach(([name, handler]) =>
          container.removeEventListener(name, handler),
        );
        window.removeEventListener("blur", returnHome);
      }
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      pref.removeEventListener("change", preference);
      const geometries = new Set(),
        materials = new Set();
      scene.traverse((n) => {
        if (n.geometry) geometries.add(n.geometry);
        if (n.material)
          (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) =>
            materials.add(m),
          );
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
