import * as THREE from "three";
import { furnitureKit } from "./homeFurniture.js";

/** A roof garden assembled with the upper floor; play stays inside the railings. */
export function createTerrace(materials) {
  const root = new THREE.Group();
  root.position.set(-3.35, 1.64, -0.25);
  const kit = furnitureKit(materials);
  const parts = [];
  const matte = (color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const foliage = matte("#697e59"),
    skin = matte("#b58b6c"),
    hair = matte("#40372f");
  const shirts = [matte("#b97e63"), matte("#8faaa0")];
  const railGlass = new THREE.MeshStandardMaterial({
    color: "#b5c8ba",
    transparent: true,
    opacity: 0.18,
    roughness: 0.2,
    metalness: 0.05,
    depthWrite: false,
  });
  function part(order) {
    const group = new THREE.Group();
    root.add(group);
    parts.push({ group, order });
    return group;
  }
  function sphere(parent, radius, position, material, scale = [1, 1, 1]) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 16, 12),
      material,
    );
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  // Quiet timber decking, followed by a complete glass balustrade.
  for (let i = 0; i < 12; i++)
    kit.block(
      part(30 + i * 0.35),
      [0.19, 0.045, 2.78],
      [-1.045 + i * 0.19, 0.023, 0],
      materials.wood,
      0.007,
    );
  for (const z of [-1.39, 1.39]) {
    const rail = part(36);
    kit.block(rail, [2.3, 0.43, 0.018], [0, 0.28, z], railGlass, 0.003);
    kit.block(rail, [2.36, 0.035, 0.045], [0, 0.52, z], materials.dark, 0.008);
    for (const x of [-1.15, 0, 1.15])
      kit.block(
        rail,
        [0.027, 0.49, 0.027],
        [x, 0.29, z],
        materials.dark,
        0.005,
      );
  }
  const side = part(37);
  kit.block(side, [0.018, 0.43, 2.78], [-1.15, 0.28, 0], railGlass, 0.003);
  kit.block(
    side,
    [0.045, 0.035, 2.82],
    [-1.15, 0.52, 0],
    materials.dark,
    0.008,
  );
  kit.block(
    side,
    [0.027, 0.49, 0.027],
    [-1.15, 0.29, 0],
    materials.dark,
    0.005,
  );
  // The fourth side meets the upper-storey wall; a timber bench leaves the centre free.
  const bench = part(40);
  kit.block(bench, [1.1, 0.09, 0.38], [-0.1, 0.22, -1.04], materials.wood);
  kit.block(bench, [1.1, 0.29, 0.06], [-0.1, 0.4, -1.2], materials.wood);
  for (const x of [-0.5, 0.3])
    kit.block(bench, [0.07, 0.2, 0.3], [x, 0.13, -1.04], materials.dark);
  for (const x of [-0.37, 0.17])
    kit.block(bench, [0.5, 0.075, 0.31], [x, 0.3, -1.03], materials.cushion);
  kit.block(bench, [0.23, 0.2, 0.09], [-0.43, 0.43, -1.12], materials.accent);
  const table = part(42);
  kit.round(table, 0.18, 0.035, [0.74, 0.3, -0.85], materials.stone);
  kit.round(table, 0.065, 0.25, [0.74, 0.16, -0.85], materials.wood);
  kit.block(
    table,
    [0.13, 0.023, 0.1],
    [0.74, 0.33, -0.85],
    materials.accent,
    0.005,
  );
  for (const [x, z] of [
    [-0.91, -1.05],
    [0.85, 1.08],
  ]) {
    const planter = part(41);
    kit.round(planter, 0.135, 0.23, [x, 0.16, z], materials.ceramic, 0.1);
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      const leaf = sphere(
        planter,
        0.105,
        [x + Math.cos(a) * 0.07, 0.35, z + Math.sin(a) * 0.07],
        foliage,
        [0.55, 1.4, 0.65],
      );
      leaf.rotation.z = Math.cos(a) * 0.35;
    }
  }
  function child(index, x) {
    const carrier = part(46 + index),
      body = new THREE.Group();
    carrier.add(body);
    body.position.set(x, 0.055, 0.32);
    body.rotation.y = index ? -Math.PI / 2 : Math.PI / 2;
    kit.block(body, [0.16, 0.19, 0.11], [0, 0.31, 0], shirts[index]);
    kit.block(body, [0.145, 0.07, 0.1], [0, 0.2, 0], materials.dark);
    sphere(body, 0.077, [0, 0.49, 0], skin, [0.95, 1.05, 0.95]);
    // A full crown and back stay outside the skin and read at the hero's scale.
    sphere(body, 0.086, [0, 0.548, -0.014], hair, [1.04, 0.73, 1.02]);
    sphere(body, 0.076, [0, 0.507, -0.046], hair, [
      1.03,
      index ? 1.04 : 0.72,
      0.72,
    ]);
    const fringe = sphere(
      body,
      0.05,
      [-0.026, 0.56, 0.036],
      hair,
      [1.12, 0.57, 0.72],
    );
    fringe.rotation.z = -0.25;
    sphere(body, 0.015, [0, 0.49, 0.069], skin);
    if (index) {
      sphere(body, 0.043, [0, 0.544, -0.103], hair, [0.85, 1, 1.1]);
      sphere(body, 0.045, [0, 0.49, -0.12], hair, [0.72, 1.2, 0.78]);
    }
    const arms = [],
      legs = [];
    for (const sign of [-1, 1]) {
      const arm = new THREE.Group();
      body.add(arm);
      arm.position.set(sign * 0.1, 0.39, 0);
      kit.block(arm, [0.045, 0.075, 0.05], [0, -0.028, 0], shirts[index]);
      kit.block(arm, [0.035, 0.1, 0.04], [0, -0.11, 0], skin);
      sphere(arm, 0.025, [0, -0.17, 0], skin);
      arms.push(arm);
      const leg = new THREE.Group();
      body.add(leg);
      leg.position.set(sign * 0.044, 0.19, 0);
      kit.block(leg, [0.052, 0.07, 0.06], [0, -0.025, 0], materials.dark);
      kit.block(leg, [0.04, 0.105, 0.045], [0, -0.11, 0], skin);
      kit.block(
        leg,
        [0.06, 0.035, 0.095],
        [0, -0.175, 0.015],
        materials.ceramic,
      );
      legs.push(leg);
    }
    return { body, arms, legs };
  }
  const kids = [child(0, -0.61), child(1, 0.61)];
  const play = part(48);
  const ball = sphere(play, 0.065, [0, 0.5, 0.32], materials.accent);
  const stripe = new THREE.Mesh(
    new THREE.TorusGeometry(0.065, 0.008, 8, 24),
    materials.ceramic,
  );
  ball.add(stripe);
  function seek(time) {
    // Four-second catch / throw cycle: a brief hold at each end, then a soft arc.
    const phase = ((time % 4) + 4) % 4;
    const leg = phase % 2,
      from = phase < 2 ? 0 : 1;
    const u = THREE.MathUtils.clamp((leg - 0.45) / 1.1, 0, 1);
    const direction = from === 0 ? 1 : -1;
    ball.position.set(
      direction * (-0.42 + 0.84 * u),
      0.43 + Math.sin(Math.PI * u) * 0.31,
      0.32,
    );
    ball.rotation.z = time * 1.5;
    kids.forEach((kid, i) => {
      const thrower = i === from;
      const effort = Math.sin(Math.PI * u);
      kid.body.position.y = 0.055 + (thrower ? 0.012 : 0.006) * effort;
      kid.body.rotation.x = (thrower ? -1 : 1) * effort * 0.045;
      kid.arms.forEach((arm, j) => {
        arm.rotation.x = -1.12 - (thrower ? 0.4 : -0.15) * effort;
        arm.rotation.z = (j ? 1 : -1) * 0.12;
      });
      kid.legs.forEach((joint, j) => {
        joint.rotation.x = (j ? -1 : 1) * effort * 0.045;
      });
    });
  }
  seek(0);
  return { root, parts, kids, ball, seek };
}
