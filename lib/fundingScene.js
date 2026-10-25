import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createHomeModel } from "./homeModel.js";

export function createFundingScene(container) {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene(),
    camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 50);
  camera.position.set(4.1, 5.1, 9);
  camera.lookAt(0, 0.6, 0);
  const pmrem = new THREE.PMREMGenerator(renderer),
    room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.5;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight("#fff5df", "#42533d", 1.8));
  const sun = new THREE.DirectionalLight("#fff0d7", 3);
  sun.position.set(-3, 8, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
  sun.shadow.normalBias = 0.025;
  scene.add(sun);
  const mat = (color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const dark = mat("#3e5142");
  function box(w, h, d, material, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, 2, 0.035),
      material,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const home = createHomeModel();
  home.root.scale.setScalar(0.62);
  home.root.position.set(1.2, 0.08, -0.15);
  scene.add(home.root);
  const portfolio = new THREE.Group();
  portfolio.position.set(-1.85, 0, 0.3);
  scene.add(portfolio);
  box(1.8, 0.16, 1.8, dark, 0, 0.05, 0, portfolio);
  const cards = [];
  const labels = ["STOCKS", "MUTUAL FUNDS", "RSUs"];
  labels.forEach((label, i) => {
    const card = new THREE.Group();
    card.position.set(-0.42 + i * 0.42, 0.72 - i * 0.27, -0.42 + i * 0.46);
    card.rotation.y = -0.12 + i * 0.06;
    box(1.4, 1.6, 0.085, mat(i === 1 ? "#bdcaa7" : "#e5e3d4"), 0, 0.8, 0, card);
    const canvas = document.createElement("canvas");
    canvas.width = 560;
    canvas.height = 640;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = i === 1 ? "#bdcaa7" : "#e5e3d4";
    ctx.fillRect(0, 0, 560, 640);
    ctx.fillStyle = "#374c38";
    ctx.font = "500 35px sans-serif";
    ctx.fillText(label, 45, 75);
    ctx.font = "20px sans-serif";
    ctx.fillStyle = "#6a7e5a";
    ctx.fillText("YOUR PORTFOLIO", 45, 115);
    ctx.fillStyle = "#789366";
    [100, 160, 135, 210, 260].forEach((h, j) =>
      ctx.fillRect(50 + j * 93, 480 - h, 56, h),
    );
    ctx.strokeStyle = "#a1ae90";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(45, 510);
    ctx.lineTo(515, 510);
    ctx.stroke();
    ctx.font = "500 24px sans-serif";
    ctx.fillStyle = "#536a49";
    ctx.fillText("STAY INVESTED", 45, 568);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(1.36, 1.56),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 }),
    );
    face.position.set(0, 0.8, 0.045);
    card.add(face);
    portfolio.add(card);
    cards.push({ node: card, rest: card.position.y });
  });
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.5, 0.2, 1.38),
    new THREE.Vector3(-0.6, 0.2, 1.8),
    new THREE.Vector3(0.5, 0.2, 1.65),
    new THREE.Vector3(1.3, 0.2, 1.1),
  ]);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(path, 64, 0.018, 6, false),
    mat("#92a77a"),
  );
  scene.add(tube);
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.045, 24),
    mat("#d1e4a8"),
  );
  coin.castShadow = true;
  scene.add(coin);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.ShadowMaterial({ opacity: 0.2 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.12;
  ground.receiveShadow = true;
  scene.add(ground);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let raf = 0,
    visible = true,
    disposed = false,
    start = performance.now();
  const ease = (t) => 1 - Math.pow(1 - THREE.MathUtils.clamp(t, 0, 1), 3);
  function draw(now) {
    raf = 0;
    if (disposed) return;
    const time = Math.max(0, (now - start) / 1000);
    cards.forEach(({ node, rest }, i) => {
      const p = reduced.matches ? 1 : ease((time - 0.15 - i * 0.15) / 1.2);
      node.position.y = rest - (1 - p) * 1.6;
      node.scale.setScalar(Math.max(0.001, p));
    });
    const p = reduced.matches ? 1 : ease((time - 0.4) / 1.5);
    home.root.position.y = 0.08 - (1 - p) * 0.7;
    home.root.scale.setScalar(0.62 * (0.85 + 0.15 * p));
    coin.position.copy(
      path.getPointAt(reduced.matches ? 0.55 : (time * 0.12) % 1),
    );
    coin.position.y += 0.07;
    coin.rotation.z = reduced.matches ? 0 : Math.sin(time) * 0.1;
    renderer.render(scene, camera);
    if (visible && !document.hidden && !reduced.matches)
      raf = requestAnimationFrame(draw);
  }
  function wake() {
    if (!raf && !disposed && visible && !document.hidden)
      raf = requestAnimationFrame(draw);
  }
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    const aspect = width / height,
      half = Math.max(2.55, 3.9 / aspect);
    camera.left = -half * aspect;
    camera.right = half * aspect;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();
    wake();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) wake();
    else {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  });
  io.observe(container);
  document.addEventListener("visibilitychange", wake);
  reduced.addEventListener("change", wake);
  resize();
  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", wake);
      reduced.removeEventListener("change", wake);
      const materials = new Set(),
        geometries = new Set(),
        textures = new Set();
      scene.traverse((node) => {
        if (node.geometry) geometries.add(node.geometry);
        for (const m of Array.isArray(node.material)
          ? node.material
          : node.material
            ? [node.material]
            : []) {
          materials.add(m);
          Object.values(m).forEach((v) => {
            if (v?.isTexture) textures.add(v);
          });
        }
      });
      textures.forEach((t) => t.dispose());
      materials.forEach((m) => m.dispose());
      geometries.forEach((g) => g.dispose());
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
