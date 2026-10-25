import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export function createCar(color = "#b9b6a5") {
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
  box(0.48, 0.16, 0.98, 0, 0.21, 0, body);
  box(0.43, 0.12, 0.7, 0, 0.29, -0.06, body);
  box(0.385, 0.19, 0.48, 0, 0.39, -0.09, glass);
  box(0.4, 0.045, 0.34, 0, 0.5, -0.1, body);
  for (const side of [-1, 1]) {
    box(0.016, 0.19, 0.025, side * 0.198, 0.39, -0.06, body);
    box(0.065, 0.04, 0.065, side * 0.25, 0.33, 0.1, body);
    for (const z of [-0.3, 0.3]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.245, 0.13, z);
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
      // Small dark spoke makes wheel rotation legible at close range.
      box(0.01, 0.05, 0.025, side * 0.285, 0.13, z, chrome);
      wheels.push(pivot);
    }
    box(0.11, 0.045, 0.012, side * 0.15, 0.24, 0.495, lamp);
    box(0.1, 0.035, 0.012, side * 0.15, 0.24, -0.495, tail);
  }
  box(0.2, 0.04, 0.015, 0, 0.17, 0.5, tire);
  function roll(distance) {
    wheels.forEach((w) => (w.rotation.x = distance / 0.105));
  }
  root.userData.roll = roll;
  return { root, roll };
}
