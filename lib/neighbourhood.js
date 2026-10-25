import * as THREE from "three";
import { createCar } from "./carModel.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// A closed road keeps cars circulating without visible respawns.
export function createNeighbourhood(level = 1) {
  const root = new THREE.Group();
  const mat = (color, roughness = 0.8, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const asphalt = mat("#414b45"),
    curb = mat("#74806e"),
    grass = mat("#3e513e"),
    earth = mat("#303e33");
  const trunk = mat("#80654b"),
    foliage = [mat("#405b42"), mat("#526b4a"), mat("#637955")];
  const metal = mat("#36443d", 0.45, { metalness: 0.5 });
  const glow = mat("#e8d9a9", 0.4, {
    emissive: "#ebc788",
    emissiveIntensity: 0.7,
  });
  const left = level >= 3 ? -7.7 : level >= 2 ? -5.7 : -4.0,
    right = level >= 4 ? 7.2 : 3.9;
  const back = level >= 5 ? -5.5 : -3.3,
    front = 3.5;
  const centerX = (left + right) / 2,
    centerZ = (back + front) / 2;
  const width = right - left + 2.6,
    depth = front - back + 2.6;
  const cube = new THREE.BoxGeometry(1, 1, 1);
  function box(parent, w, h, d, x, y, z, material, rounded = false) {
    const mesh = new THREE.Mesh(
      rounded
        ? new RoundedBoxGeometry(w, h, d, 2, Math.min(0.12, h / 3))
        : cube,
      material,
    );
    if (!rounded) mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function cylinder(parent, top, bottom, h, x, y, z, material, segments = 12) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(top, bottom, h, segments),
      material,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  box(root, width, 0.13, depth, centerX, -0.435, centerZ, earth, true);
  box(
    root,
    width - 0.08,
    0.055,
    depth - 0.08,
    centerX,
    -0.355,
    centerZ,
    grass,
    true,
  );

  const path = new THREE.CurvePath(),
    radius = 1.2;
  const v = (x, z) => new THREE.Vector3(x, -0.28, z);
  const line = (a, b) => path.add(new THREE.LineCurve3(v(...a), v(...b)));
  const turn = (a, b, c) =>
    path.add(new THREE.QuadraticBezierCurve3(v(...a), v(...b), v(...c)));
  line([left + radius, front], [right - radius, front]);
  turn([right - radius, front], [right, front], [right, front - radius]);
  line([right, front - radius], [right, back + radius]);
  turn([right, back + radius], [right, back], [right - radius, back]);
  line([right - radius, back], [left + radius, back]);
  turn([left + radius, back], [left, back], [left, back + radius]);
  line([left, back + radius], [left, front - radius]);
  turn([left, front - radius], [left, front], [left + radius, front]);
  const length = path.getLength();
  function roadRibbon(halfWidth, y, material) {
    const positions = [],
      indices = [],
      segments = 240;
    for (let i = 0; i <= segments; i++) {
      const p = path.getPointAt(i / segments),
        t = path.getTangentAt(i / segments);
      for (const side of [-1, 1])
        positions.push(
          p.x + t.z * halfWidth * side,
          y,
          p.z - t.x * halfWidth * side,
        );
      if (i < segments) {
        const n = i * 2;
        indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  // A quiet residential lane; narrow edging avoids a racetrack-like outline.
  roadRibbon(0.69, -0.309, curb);
  roadRibbon(0.64, -0.3, asphalt);
  const paving = mat("#a8aa96");
  for (let i = 0; i < 4; i++)
    box(root, 0.7, 0.018, 0.2, -0.5, -0.31, 2.18 + i * 0.22, paving, true);

  const crownGeometry = new THREE.IcosahedronGeometry(1, 2);
  const plantings = [];
  function planting(node, delay) {
    plantings.push({
      node,
      delay,
      position: node.position.clone(),
      scale: node.scale.clone(),
    });
  }
  function tree(x, z, size, index) {
    const group = new THREE.Group();
    group.position.set(x, -0.31, z);
    root.add(group);
    planting(group, 2.2 + ((index * 7) % 6) * 0.14);
    cylinder(
      group,
      0.045 * size,
      0.075 * size,
      1.05 * size,
      0,
      0.04 + 0.5 * size,
      0,
      trunk,
    );
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4 + index,
        mesh = new THREE.Mesh(crownGeometry, foliage[(i + index) % 3]);
      mesh.position.set(
        Math.sin(a) * 0.22 * size,
        0.06 + (1.02 + (i % 2) * 0.18) * size,
        Math.cos(a) * 0.22 * size,
      );
      mesh.scale.set(0.38 * size, 0.5 * size, 0.37 * size);
      mesh.castShadow = true;
      group.add(mesh);
    }
    cylinder(group, 0.32 * size, 0.32 * size, 0.025, 0, 0, 0, earth, 20);
  }
  // A few asymmetric planting groups leave clear views and open lawn.
  const trees = [
    [left + 0.35, back - 0.95, 0.86],
    [left + 1.35, back - 0.98, 0.65],
    [right - 0.35, back - 0.98, 0.92],
    [right - 1.45, back - 0.94, 0.7],
    [left - 0.98, back + 2.15, 0.72],
    [right + 0.98, back + 2.35, 0.78],
  ];
  trees.forEach(([x, z, size], i) => tree(x, z, size, i));
  for (const [x, z] of [
    [left + 0.25, back - 1],
    [right - 0.4, back - 1],
    [left - 1, back + 2.1],
  ]) {
    for (let i = 0; i < 4; i++) {
      const shrub = new THREE.Mesh(crownGeometry, foliage[i % 3]);
      shrub.position.set(
        x + Math.sin(i * 2.4) * 0.34,
        -0.19,
        z + Math.cos(i * 2.4) * 0.24,
      );
      shrub.scale.set(0.26, 0.15, 0.24);
      shrub.castShadow = true;
      root.add(shrub);
      planting(shrub, 2.3 + ((plantings.length * 7) % 9) * 0.07);
    }
  }
  // Low entry bollards replace the busy perimeter of benches and streetlights.
  for (const x of [-1.02, 0.02]) {
    box(root, 0.065, 0.32, 0.065, x, -0.16, 2.52, metal, true);
    box(root, 0.07, 0.025, 0.07, x, 0.005, 2.52, glow, true);
  }

  function car(color) {
    const model = createCar(color);
    root.add(model.root);
    return model.root;
  }
  const cars = [
    { mesh: car("#50655d"), phase: 0.58, direction: 1, speed: 0.68 },
  ];
  let time = 0,
    constructionTime = 0;
  function update(dt, reduced = false, building = false) {
    if (!reduced) {
      constructionTime = Math.min(4, constructionTime + dt);
      if (!building) time += dt;
    }
    for (const p of plantings) {
      const u = THREE.MathUtils.clamp((constructionTime - p.delay) / 0.9, 0, 1);
      const grow = reduced ? 1 : 1 - (1 - u) ** 3;
      p.node.visible = grow > 0;
      p.node.scale.copy(p.scale).multiplyScalar(Math.max(0.001, grow));
      p.node.position.copy(p.position);
      p.node.position.y = -0.31 + (p.position.y + 0.31) * grow;
    }
    for (const item of cars) {
      item.mesh.visible = !building;
      const u =
        (((item.phase + (time * item.speed * item.direction) / length) % 1) +
          1) %
        1;
      const p = path.getPointAt(u),
        t = path.getTangentAt(u);
      const lane = 0.31 * item.direction;
      item.mesh.position.set(p.x + t.z * lane, -0.325, p.z - t.x * lane);
      item.mesh.rotation.y = Math.atan2(
        t.x * item.direction,
        t.z * item.direction,
      );
    }
    for (const car of cars) car.mesh.userData.roll(time * car.speed);
  }
  update(0, true);
  return {
    root,
    update,
    cars,
    path,
    centerX,
    centerZ,
    viewWidth: width + depth * 0.4,
  };
}
