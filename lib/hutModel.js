import * as THREE from "three";

/** A compact, hand-built starting home, at the same human scale as later homes. */
export function createHutModel(materials) {
  const root = new THREE.Group(),
    furnishings = new THREE.Group();
  root.add(furnishings);
  const parts = [];
  const material = (color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.94 });
  const earth = material("#88785d"),
    grass = material("#667756"),
    lime = materials.plaster.clone(),
    timber = materials.wood,
    straw = [material("#a6976d"), material("#ac9d73"), material("#b2a379")],
    shadow = material("#354137"),
    clay = material("#a67c60");
  lime.color.set("#d5c6a5");
  function part(geometry, mat, x, y, z, start, parent = root) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    parts.push({
      node: mesh,
      start,
      position: mesh.position.clone(),
      scale: mesh.scale.clone(),
    });
    return mesh;
  }
  function box(w, h, d, x, y, z, mat, start = 0, parent = root) {
    return part(new THREE.BoxGeometry(w, h, d), mat, x, y, z, start, parent);
  }
  box(3.5, 0.16, 3.25, 0, -0.25, 0, earth);
  box(3.44, 0.035, 3.19, 0, -0.15, 0, grass, 0.06);
  box(2.45, 0.18, 2.13, 0, -0.07, -0.15, materials.stone, 0.12);
  box(2.22, 0.07, 1.94, 0, 0.055, -0.15, timber, 0.2);
  // Side and rear walls, with a real opening for the front door and window.
  box(0.13, 1.45, 1.94, -1.05, 0.8, -0.15, lime, 0.45);
  box(0.13, 1.45, 1.94, 1.05, 0.8, -0.15, lime, 0.55);
  box(2.2, 1.45, 0.13, 0, 0.8, -1.08, lime, 0.65);
  box(0.44, 1.45, 0.13, -0.87, 0.8, 0.82, lime, 0.72);
  box(0.3, 1.45, 0.13, 0.12, 0.8, 0.82, lime, 0.8);
  box(0.27, 1.45, 0.13, 0.96, 0.8, 0.82, lime, 0.88);
  box(0.68, 0.32, 0.13, -0.31, 1.37, 0.82, lime, 0.95);
  box(0.58, 0.54, 0.13, 0.55, 0.345, 0.82, lime, 1.0);
  box(0.58, 0.32, 0.13, 0.55, 1.37, 0.82, lime, 1.06);
  box(0.64, 1.16, 0.04, -0.32, 0.66, 0.79, shadow, 1.1);
  for (const x of [-0.68, 0.04])
    box(0.075, 1.22, 0.12, x, 0.69, 0.91, timber, 1.2);
  box(0.8, 0.08, 0.12, -0.32, 1.3, 0.91, timber, 1.3);
  for (let i = 0; i < 6; i++)
    box(
      0.095,
      1.1,
      0.055,
      -0.6 + i * 0.1,
      0.66,
      0.88,
      timber,
      1.34 + i * 0.035,
    );
  box(0.04, 0.045, 0.045, -0.13, 0.66, 0.93, materials.brass, 1.6);
  box(0.57, 0.56, 0.03, 0.55, 0.89, 0.8, shadow, 1.2);
  for (const x of [0.24, 0.86])
    box(0.055, 0.65, 0.1, x, 0.89, 0.91, timber, 1.3);
  for (const y of [0.58, 1.2])
    box(0.67, 0.055, 0.13, 0.55, y, 0.91, timber, 1.4);
  box(0.03, 0.58, 0.07, 0.55, 0.89, 0.91, timber, 1.45);
  box(0.58, 0.035, 0.07, 0.55, 0.88, 0.91, timber, 1.5);
  // Triangular gables support a layered reed roof, rather than a scaled villa roof.
  const gable = new THREE.Shape();
  gable.moveTo(-1.1, 0);
  gable.lineTo(1.1, 0);
  gable.lineTo(0, 0.8);
  gable.closePath();
  for (const z of [-1.08, 0.82])
    part(
      new THREE.ExtrudeGeometry(gable, { depth: 0.08, bevelEnabled: false }),
      lime,
      0,
      1.5,
      z,
      1.5,
    );
  const pitch = Math.atan2(0.88, 1.37);
  for (const side of [-1, 1]) {
    const panel = box(
      1.64,
      0.12,
      2.5,
      side * 0.685,
      1.91,
      -0.15,
      straw[0],
      1.7,
    );
    panel.rotation.z = -side * pitch;
    for (let row = 0; row < 7; row++)
      for (let reed = 0; reed < 42; reed++) {
        const x = ((row + 0.45) * 1.37) / 7;
        const bundle = box(
          0.235,
          0.1,
          0.059,
          side * x,
          2.39 - x * Math.tan(pitch),
          -1.38 + reed * 0.06,
          straw[reed % 3],
          1.75 + row * 0.065 + reed * 0.005,
        );
        bundle.rotation.z = -side * pitch;
      }
  }
  box(0.18, 0.15, 2.55, 0, 2.42, -0.15, straw[1], 2.45);
  for (let i = 0; i < 3; i++)
    box(
      0.65,
      0.07,
      0.22,
      -0.32,
      -0.09 - i * 0.012,
      1.02 + i * 0.24,
      materials.stone,
      0.2 + i * 0.08,
    );
  // A simple garden bench and a clay pot keep the small scene lived-in.
  box(0.64, 0.07, 0.3, 1.4, 0.35, -0.2, timber, 2.55, furnishings);
  for (const z of [-0.3, -0.1])
    box(0.08, 0.44, 0.07, 1.4, 0.1, z, timber, 2.5, furnishings);
  part(
    new THREE.CylinderGeometry(0.14, 0.1, 0.22, 16),
    clay,
    -1.38,
    -0.02,
    0.97,
    2.6,
  );
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4;
    const leaf = part(
      new THREE.SphereGeometry(0.1, 10, 8),
      grass,
      -1.38 + Math.sin(a) * 0.07,
      0.19 + (i % 2) * 0.09,
      0.97 + Math.cos(a) * 0.07,
      2.7 + i * 0.05,
    );
    leaf.scale.set(0.65, 1.8, 0.7);
    parts.at(-1).scale.copy(leaf.scale);
  }
  return { root, furnishings, parts };
}
