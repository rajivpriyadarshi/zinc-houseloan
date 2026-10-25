import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createLotusTempleModel } from "./lotusTempleModel.js";
import { createBangaloreModel } from "./bangaloreModel.js";
import { createMumbaiModel } from "./mumbaiModel.js";
import { createCityLife } from "./cityLife.js";
import { createPerspectiveGrid } from "./perspectiveGrid.js";
import { visibleHomeCorners, fitHomeZoom } from "./homeFraming.js";
// Accelerate assembly only; camera interaction and street life keep their natural pace.
const BUILD_SPEED = 2.2;
const factories = {
  Bangalore: createBangaloreModel,
  Mumbai: createMumbaiModel,
  Delhi: createLotusTempleModel,
};

export function createCityScene(
  container,
  { city = "Delhi", onError = () => {} } = {},
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
  scene.environmentIntensity = 0.38;
  scene.add(new THREE.HemisphereLight("#fff6e7", "#344436", 1));
  const key = new THREE.DirectionalLight("#fff0dc", 2.4);
  key.position.set(-4, 8, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -8 });
  key.shadow.normalBias = 0.025;
  scene.add(key);
  const fill = new THREE.DirectionalLight("#c3d4c5", 0.85);
  fill.position.set(4, 3, -3);
  scene.add(fill);
  const model = (factories[city] ?? factories.Delhi)();
  const view = model.view ?? {
    width: 8.5,
    halfHeight: 3.85,
    targetY: 2.4,
    polar: 1.21,
    angle: 0.33,
  };
  scene.add(model.root);
  model.seek(model.duration, true);
  const bounds = visibleHomeCorners(model.root);
  const life = createCityLife(city);
  scene.add(life.root);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.ShadowMaterial({ opacity: 0.2 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.35;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = createPerspectiveGrid({
    size: 24,
    divisions: 24,
    opacity: 0.18,
  });
  grid.position.y = -0.34;
  scene.add(grid);
  const pref = matchMedia("(prefers-reduced-motion: reduce)");
  let elapsed = pref.matches ? model.duration : 0,
    last = 0,
    frame = 0,
    disposed = false,
    visible = true,
    reduced = pref.matches,
    lifeTime = 0,
    lifePaused = false,
    renderedBuildTime = -1,
    renderedReduced = null,
    angle = view.angle,
    polar = view.polar,
    targetAngle = angle,
    targetPolar = polar,
    drag = null,
    hoverAfter = 0;
  const target = new THREE.Vector3(0, view.targetY, 0);
  const orbit = new THREE.Spherical(15, polar, angle);
  function returnHome() {
    const pointerId = drag?.id;
    drag = null;
    container.classList.remove("is-dragging");
    if (pointerId != null && container.hasPointerCapture(pointerId))
      container.releasePointerCapture(pointerId);
    angle =
      view.angle +
      Math.atan2(Math.sin(angle - view.angle), Math.cos(angle - view.angle));
    targetAngle = view.angle;
    targetPolar = view.polar;
    if (reduced) {
      angle = targetAngle;
      polar = targetPolar;
    }
    hoverAfter = performance.now() + 1000;
    wake();
  }
  function pointerDown(event) {
    if (event.button !== 0 || drag) return;
    event.preventDefault();
    container.focus({ preventScroll: true });
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      angle,
      polar,
    };
    container.setPointerCapture(event.pointerId);
    container.classList.add("is-dragging");
    wake();
  }
  function pointerMove(event) {
    if (drag) {
      if (event.pointerId !== drag.id) return;
      targetAngle = drag.angle - (event.clientX - drag.x) * 0.007;
      targetPolar = THREE.MathUtils.clamp(
        drag.polar - (event.clientY - drag.y) * 0.004,
        0.32,
        1.42,
      );
      angle = targetAngle;
      polar = targetPolar;
      wake();
    } else if (
      !reduced &&
      event.pointerType === "mouse" &&
      !event.buttons &&
      performance.now() > hoverAfter
    ) {
      const rect = container.getBoundingClientRect();
      targetAngle =
        view.angle +
        (((event.clientX - rect.left) / rect.width) * 2 - 1) * 0.12;
      targetPolar =
        view.polar +
        (((event.clientY - rect.top) / rect.height) * 2 - 1) * 0.065;
      wake();
    }
  }
  function pointerUp(event) {
    if (drag?.id === event.pointerId) returnHome();
  }
  function pointerLeave() {
    if (!drag) returnHome();
  }
  function keyDown(event) {
    if (!event.key.startsWith("Arrow") || drag) return;
    event.preventDefault();
    if (event.key === "ArrowLeft") targetAngle -= 0.15;
    if (event.key === "ArrowRight") targetAngle += 0.15;
    if (event.key === "ArrowUp") targetPolar -= 0.1;
    if (event.key === "ArrowDown") targetPolar += 0.1;
    targetPolar = THREE.MathUtils.clamp(targetPolar, 0.32, 1.42);
    if (reduced) {
      angle = targetAngle;
      polar = targetPolar;
    }
    wake();
  }
  function keyUp(event) {
    if (event.key.startsWith("Arrow")) returnHome();
  }
  const listeners = {
    pointerdown: pointerDown,
    pointermove: pointerMove,
    pointerup: pointerUp,
    pointercancel: pointerUp,
    lostpointercapture: pointerUp,
    pointerleave: pointerLeave,
    keydown: keyDown,
    keyup: keyUp,
    blur: returnHome,
  };
  for (const [type, handler] of Object.entries(listeners))
    container.addEventListener(type, handler);
  window.addEventListener("blur", returnHome);
  function render() {
    if (elapsed !== renderedBuildTime || reduced !== renderedReduced) {
      model.seek(elapsed, reduced);
      renderedBuildTime = elapsed;
      renderedReduced = reduced;
    }
    const settle = reduced ? 1 : Math.min(1, elapsed / model.duration);
    const theta = angle + (drag ? 0 : 0.15 * Math.pow(1 - settle, 3));
    life.seek(lifeTime, elapsed - model.duration + 0.2, reduced);
    orbit.phi = polar;
    orbit.theta = theta;
    camera.position.copy(
      new THREE.Vector3().setFromSpherical(orbit).add(target),
    );
    camera.lookAt(target);
    camera.zoom = fitHomeZoom(camera, bounds, 1, {
      horizontal: 0.94,
      vertical: 0.93,
    });
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  function draw(now) {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    if (!reduced) {
      elapsed = Math.min(model.duration + 1.2, elapsed + dt * BUILD_SPEED);
      if (!lifePaused && elapsed >= model.duration) lifeTime += dt;
    }
    if (!drag) {
      const follow = reduced ? 1 : 1 - Math.exp(-dt * 9);
      angle += (targetAngle - angle) * follow;
      polar += (targetPolar - polar) * follow;
    }
    render();
    const returning =
      Math.abs(targetAngle - angle) + Math.abs(targetPolar - polar) > 0.0001;
    if (
      (!reduced && (!lifePaused || elapsed < model.duration + 1.2)) ||
      returning
    )
      wake();
    else last = 0;
  }
  function wake() {
    if (!frame && !disposed && visible && !document.hidden)
      frame = requestAnimationFrame(draw);
  }
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height || disposed) return;
    const aspect = width / height,
      halfH = Math.max(view.halfHeight, view.width / (2 * aspect));
    camera.left = -halfH * aspect;
    camera.right = halfH * aspect;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    renderer.getDrawingBufferSize(grid.material.uniforms.resolution.value);
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
    returnHome();
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
    setLifePaused(value) {
      lifePaused = value;
      last = 0;
      wake();
    },
    replay() {
      lifeTime = 0;
      returnHome();
      elapsed = reduced ? model.duration : 0;
      last = 0;
      wake();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      for (const [type, handler] of Object.entries(listeners))
        container.removeEventListener(type, handler);
      window.removeEventListener("blur", returnHome);
      container.classList.remove("is-dragging");
      if (drag && container.hasPointerCapture(drag.id))
        container.releasePointerCapture(drag.id);
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
