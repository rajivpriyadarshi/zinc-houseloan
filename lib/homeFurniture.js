import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export function furnitureKit(m) {
  function block(parent, dimensions, position, material, radius = 0.045) {
    const [w, h, d] = dimensions;
    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 3, h / 3, d / 3)),
      material,
    );
    mesh.position.set(...position);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function round(parent, radius, height, position, material, bottom = radius) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, bottom, height, 32),
      material,
    );
    mesh.position.set(...position);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function sofa() {
    const g = new THREE.Group();
    block(g, [1.38, 0.1, 0.65], [0, 0.13, 0], m.wood);
    for (const x of [-0.55, 0.55])
      for (const z of [-0.22, 0.22])
        block(g, [0.045, 0.14, 0.045], [x, 0.07, z], m.dark, 0.01);
    block(g, [1.4, 0.36, 0.16], [0, 0.39, -0.25], m.cushion, 0.07);
    for (const x of [-0.67, 0.67])
      block(g, [0.16, 0.34, 0.65], [x, 0.32, 0], m.cushion, 0.07);
    for (const x of [-0.3, 0.3]) {
      block(g, [0.57, 0.16, 0.51], [x, 0.25, 0.045], m.cushion, 0.055);
      const back = block(
        g,
        [0.55, 0.32, 0.13],
        [x, 0.44, -0.15],
        m.cushion,
        0.055,
      );
      back.rotation.x = -0.12;
    }
    for (const [x, mat, angle] of [
      [-0.45, m.accent, 0.17],
      [0.4, m.leather, -0.16],
    ]) {
      const pillow = block(g, [0.25, 0.25, 0.11], [x, 0.43, 0.005], mat, 0.055);
      pillow.rotation.set(-0.25, angle, angle);
    }
    block(g, [0.26, 0.025, 0.5], [0.19, 0.34, 0.1], m.rug, 0.01);
    block(g, [0.26, 0.18, 0.025], [0.19, 0.25, 0.35], m.rug, 0.01);
    return g;
  }
  function chair() {
    const g = new THREE.Group();
    for (const x of [-0.2, 0.2])
      for (const z of [-0.19, 0.19]) {
        const leg = block(g, [0.032, 0.34, 0.032], [x, 0.17, z], m.wood, 0.01);
        leg.rotation.z = x > 0 ? -0.06 : 0.06;
      }
    block(g, [0.48, 0.07, 0.47], [0, 0.31, 0], m.wood, 0.03);
    block(g, [0.43, 0.1, 0.43], [0, 0.37, 0.02], m.cushion, 0.045);
    const back = block(g, [0.48, 0.3, 0.09], [0, 0.56, -0.21], m.wood, 0.04);
    back.rotation.x = -0.12;
    block(g, [0.4, 0.24, 0.07], [0, 0.55, -0.15], m.cushion, 0.035);
    for (const x of [-0.23, 0.23]) {
      block(g, [0.035, 0.19, 0.035], [x, 0.42, 0.14], m.wood, 0.012);
      block(g, [0.055, 0.045, 0.42], [x, 0.51, -0.015], m.wood, 0.02);
    }
    return g;
  }
  function bed() {
    const g = new THREE.Group();
    block(g, [1.25, 0.16, 1.65], [0, 0.1, 0], m.wood, 0.05);
    block(g, [1.2, 0.2, 1.57], [0, 0.27, 0], m.cushion, 0.07);
    block(g, [1.35, 0.75, 0.12], [0, 0.4, -0.82], m.cushion, 0.05);
    for (const x of [-0.31, 0.31]) {
      const p = block(g, [0.49, 0.12, 0.34], [x, 0.42, -0.52], m.ceramic, 0.07);
      p.rotation.x = -0.12;
      block(g, [0.32, 0.2, 0.09], [x, 0.5, -0.64], m.accent, 0.045);
    }
    block(g, [1.23, 0.055, 0.68], [0, 0.39, 0.4], m.accent, 0.02);
    block(g, [1.23, 0.22, 0.045], [0, 0.28, 0.8], m.accent, 0.02);
    for (const x of [-0.92, 0.92]) {
      block(g, [0.38, 0.35, 0.38], [x, 0.19, -0.58], m.wood, 0.035);
      round(g, 0.09, 0.025, [x, 0.38, -0.58], m.brass);
      round(g, 0.015, 0.17, [x, 0.47, -0.58], m.brass);
      round(g, 0.12, 0.13, [x, 0.59, -0.58], m.ceramic, 0.15);
    }
    return g;
  }
  function lounger() {
    const g = new THREE.Group();
    for (const x of [-0.21, 0.21]) {
      block(g, [0.045, 0.07, 1.2], [x, 0.12, 0], m.wood, 0.015);
      for (const z of [-0.43, 0.43])
        block(g, [0.045, 0.15, 0.045], [x, 0.065, z], m.wood, 0.01);
    }
    block(g, [0.43, 0.09, 0.77], [0, 0.18, 0.19], m.cushion, 0.035);
    const back = block(g, [0.43, 0.09, 0.5], [0, 0.3, -0.38], m.cushion, 0.035);
    back.rotation.x = 0.47;
    const pillow = block(
      g,
      [0.33, 0.08, 0.16],
      [0, 0.43, -0.51],
      m.accent,
      0.035,
    );
    pillow.rotation.x = 0.47;
    block(g, [0.45, 0.018, 0.22], [0, 0.235, 0.37], m.rug, 0.006);
    return g;
  }
  return { block, round, sofa, chair, bed, lounger };
}
