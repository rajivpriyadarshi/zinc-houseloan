import * as THREE from "three";

/** Low garden enclosure and driveway share the home's assembly clock. */
export function createGardenBoundary(garage) {
  const root = new THREE.Group(),
    driveway = new THREE.Group(),
    pieces = [];
  root.add(driveway);
  const material = (color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.88 });
  const stone = material("#74806d"),
    coping = material("#929b86"),
    paving = material("#8f9682");
  const cube = new THREE.BoxGeometry(1, 1, 1);
  function register(mesh, parent, delay, lift = 0.25) {
    parent.add(mesh);
    mesh.castShadow = mesh.receiveShadow = true;
    pieces.push({
      mesh,
      position: mesh.position.clone(),
      scale: mesh.scale.clone(),
      delay,
      lift,
    });
    mesh.visible = false;
  }
  function block(w, h, d, x, y, z, mat, delay) {
    const mesh = new THREE.Mesh(cube, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    register(mesh, root, delay, 0.18);
  }
  // Openings provide generous turning clearance and keep the front path accessible.
  const bounds = { left: -6.75, right: 2.95, back: -2.35, front: 2.76 };
  const drivewayOpening = [garage.x - 1.05, garage.x + 1.4];
  const pathOpening = [-1.05, 0.05];
  let order = 0;
  function wall(x1, z1, x2, z2) {
    const length = Math.hypot(x2 - x1, z2 - z1),
      count = Math.ceil(length / 0.85);
    const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count,
        x = THREE.MathUtils.lerp(x1, x2, t),
        z = THREE.MathUtils.lerp(z1, z2, t);
      const width = length / count - 0.008,
        delay = 0.6 + order++ * 0.026;
      block(
        alongX ? width : 0.095,
        0.25,
        alongX ? 0.095 : width,
        x,
        -0.185,
        z,
        stone,
        delay,
      );
      block(
        alongX ? width + 0.004 : 0.125,
        0.035,
        alongX ? 0.125 : width + 0.004,
        x,
        -0.0425,
        z,
        coping,
        delay + 0.09,
      );
    }
  }
  wall(bounds.left, bounds.front, bounds.left, bounds.back);
  wall(bounds.left, bounds.back, bounds.right, bounds.back);
  wall(bounds.right, bounds.back, bounds.right, bounds.front);
  for (const [a, b] of [
    [bounds.left, drivewayOpening[0]],
    [drivewayOpening[1], pathOpening[0]],
    [pathOpening[1], bounds.right],
  ])
    wall(a, bounds.front, b, bounds.front);
  for (const [x, z] of [
    [bounds.left, bounds.back],
    [bounds.right, bounds.back],
    [bounds.left, bounds.front],
    [bounds.right, bounds.front],
    ...drivewayOpening.map((x) => [x, bounds.front]),
    ...pathOpening.map((x) => [x, bounds.front]),
  ]) {
    block(0.15, 0.36, 0.15, x, -0.13, z, stone, 1.45);
    block(0.17, 0.035, 0.17, x, 0.0675, z, coping, 1.6);
  }
  // Six separate sloping slabs land from garage to kerb, before the car departs.
  const start = 1.1,
    end = 2.84,
    halfWidth = 0.68,
    count = 6;
  for (let i = 0; i < count; i++) {
    const a = start + ((end - start) * i) / count + (i ? 0.003 : 0);
    const b =
      start + ((end - start) * (i + 1)) / count - (i < count - 1 ? 0.003 : 0);
    const positions = [];
    for (const z of [a, b]) {
      const y = -0.04 - (0.26 * (z - start)) / (end - start);
      for (const dy of [0, -0.035])
        for (const x of [-halfWidth, halfWidth])
          positions.push(garage.x + x, y + dy, z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex([
      0, 4, 5, 0, 5, 1, 2, 3, 7, 2, 7, 6, 0, 1, 3, 0, 3, 2, 4, 6, 7, 4, 7, 5, 0,
      2, 6, 0, 6, 4, 1, 5, 7, 1, 7, 3,
    ]);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    const center = geometry.boundingBox.getCenter(new THREE.Vector3());
    geometry.translate(-center.x, -center.y, -center.z);
    const slab = new THREE.Mesh(geometry, paving);
    slab.position.copy(center);
    register(slab, driveway, 0.55 + i * 0.14, 0.32);
  }
  const duration = Math.max(...pieces.map((p) => p.delay)) + 0.65;
  let complete = false;
  function seek(time, reduced = false) {
    complete ||= reduced || time >= duration;
    for (const p of pieces) {
      const t = complete
          ? 1
          : THREE.MathUtils.clamp((time - p.delay) / 0.65, 0, 1),
        ease = 1 - Math.pow(1 - t, 3);
      p.mesh.visible = t > 0;
      p.mesh.position.copy(p.position);
      p.mesh.position.y += (1 - ease) * p.lift;
      p.mesh.scale
        .copy(p.scale)
        .multiply(
          new THREE.Vector3(
            Math.max(0.001, ease),
            0.8 + 0.2 * ease,
            Math.max(0.001, ease),
          ),
        );
    }
  }
  seek(0);
  return {
    root,
    driveway,
    pieces,
    duration,
    bounds,
    drivewayOpening,
    pathOpening,
    seek,
  };
}
