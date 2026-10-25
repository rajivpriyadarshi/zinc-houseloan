import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export function createCar(color = "#b9b6a5", { sport = false } = {}) {
  const root = new THREE.Group(),
    wheels = [];
  const mat = (color, roughness = 0.5, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const body = mat(color, 0.3, 0.3),
    glass = mat("#293e3e", 0.18, 0.5),
    tire = mat("#202725"),
    chrome = mat("#9eaaa4", 0.3, 0.8);
  const lamp = new THREE.MeshStandardMaterial({
    color: "#e8d9a9",
    emissive: "#ebc788",
    emissiveIntensity: 0.5,
  });
  const tail = new THREE.MeshStandardMaterial({
    color: "#a94f3b",
    emissive: "#9c3020",
    emissiveIntensity: 0.3,
  });
  function box(w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, 2, Math.min(0.06, h / 3)),
      material,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }
  if (sport) {
    box(0.54, 0.11, 1.12, 0, 0.185, 0, body);
    box(0.49, 0.075, 0.42, 0, 0.255, 0.33, body);
    box(0.5, 0.075, 0.28, 0, 0.255, -0.4, body);
    box(0.55, 0.035, 1.04, 0, 0.115, 0, tire);
    const cabinGeometry = new THREE.BufferGeometry();
    cabinGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          -0.21, 0.24, -0.33, 0.21, 0.24, -0.33, 0.21, 0.24, 0.18, -0.21, 0.24,
          0.18, -0.16, 0.385, -0.23, 0.16, 0.385, -0.23, 0.16, 0.385, 0.015,
          -0.16, 0.385, 0.015,
        ],
        3,
      ),
    );
    cabinGeometry.setIndex([
      0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0, 4,
      7, 6, 4, 6, 5,
    ]);
    cabinGeometry.computeVertexNormals();
    const cabin = new THREE.Mesh(cabinGeometry, glass);
    root.add(cabin);
    box(0.34, 0.025, 0.26, 0, 0.39, -0.105, body);
    box(0.47, 0.025, 0.09, 0, 0.34, -0.48, body);
    for (const side of [-1, 1]) {
      box(0.025, 0.085, 0.035, side * 0.17, 0.295, -0.48, tire);
      box(0.07, 0.025, 0.06, side * 0.26, 0.285, 0.12, body);
      box(0.15, 0.022, 0.02, side * 0.17, 0.245, 0.56, lamp);
      box(0.16, 0.02, 0.02, side * 0.17, 0.245, -0.56, tail);
      box(0.015, 0.045, 0.16, side * 0.273, 0.205, -0.1, tire);
    }
    box(0.32, 0.045, 0.02, 0, 0.175, 0.565, tire);
  } else {
    box(0.48, 0.16, 0.98, 0, 0.21, 0, body);
    box(0.43, 0.12, 0.7, 0, 0.29, -0.06, body);
    box(0.385, 0.19, 0.48, 0, 0.39, -0.09, glass);
    box(0.4, 0.045, 0.34, 0, 0.5, -0.1, body);
  }
  for (const side of [-1, 1]) {
    if (!sport) {
      box(0.016, 0.19, 0.025, side * 0.198, 0.39, -0.06, body);
      box(0.065, 0.04, 0.065, side * 0.25, 0.33, 0.1, body);
    }
    for (const z of sport ? [-0.36, 0.36] : [-0.3, 0.3]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * (sport ? 0.265 : 0.245), 0.13, z);
      root.add(pivot);
      for (const [radius, width, material] of [
        [0.105, 0.065, tire],
        [0.052, 0.07, chrome],
      ]) {
        const mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(radius, radius, width, 20),
          material,
        );
        mesh.rotation.z = Math.PI / 2;
        mesh.castShadow = true;
        pivot.add(mesh);
      }
      for (let i = 0; i < 5; i++) {
        const spoke = new THREE.Mesh(
          new THREE.BoxGeometry(0.008, 0.009, 0.09),
          tire,
        );
        spoke.position.x = side * 0.037;
        spoke.rotation.x = (i * Math.PI) / 5;
        pivot.add(spoke);
      }
      wheels.push(pivot);
    }
    if (!sport) {
      box(0.11, 0.045, 0.012, side * 0.15, 0.24, 0.495, lamp);
      box(0.1, 0.035, 0.012, side * 0.15, 0.24, -0.495, tail);
    }
  }
  if (!sport) box(0.2, 0.04, 0.015, 0, 0.17, 0.5, tire);
  function roll(distance) {
    wheels.forEach((w) => (w.rotation.x = distance / 0.105));
  }
  root.userData.roll = roll;
  function steer(angle) {
    wheels.forEach((w) => {
      if (w.position.z > 0) w.rotation.y = angle;
    });
  }
  return { root, roll, steer };
}
