import * as THREE from "three";
import { createHomeMaterials } from "./homeMaterials.js";
import { furnitureKit } from "./homeFurniture.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/** A small, purpose-built architectural model; no external textures or model downloads. */
export function createHomeModel() {
  const root = new THREE.Group();
  const foundation = new THREE.Group();
  const shell = new THREE.Group();
  const interior = new THREE.Group();
  const roof = new THREE.Group();
  root.add(foundation, shell, interior, roof);

  const material = (color, roughness = 0.65, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const materials = createHomeMaterials();
  const {
    stone,
    plaster,
    concrete,
    wood,
    woodLight,
    dark,
    roofMetal,
    brass,
    glass,
    cushion,
    rug,
    ceramic,
  } = materials;
  const furniture = furnitureKit(materials);
  const soil = material("#3b3c2b");
  const leaf = material("#59704a", 0.92);
  const leafLight = material("#849260", 0.92);
  const lamp = material("#f2d7a0", 0.5, {
    emissive: "#e8c082",
    emissiveIntensity: 0.4,
  });

  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  function box(parent, w, h, d, x, y, z, mat, rounded = false) {
    const geometry = rounded
      ? new RoundedBoxGeometry(w, h, d, 2, Math.min(0.06, h / 4, w / 4, d / 4))
      : boxGeometry;
    const mesh = new THREE.Mesh(geometry, mat);
    if (!rounded) mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    mesh.castShadow = mat !== glass;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function cylinder(parent, top, bottom, height, x, y, z, mat, segments = 16) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(top, bottom, height, segments),
      mat,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function sphere(parent, radius, x, y, z, mat, scale = [1, 1, 1]) {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 2), mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    if (parent === foundation && (mat === leaf || mat === leafLight))
      mesh.userData.assemblyKind = "shrub";
    parent.add(mesh);
    return mesh;
  }
  function plant(parent, x, y, z, size = 1) {
    const planted = new THREE.Group();
    planted.position.set(x, y, z);
    planted.userData.assemblyKind = "plant";
    parent.add(planted);
    parent = planted;
    x = y = z = 0;
    cylinder(
      parent,
      0.17 * size,
      0.12 * size,
      0.29 * size,
      x,
      y + 0.145 * size,
      z,
      stone,
    );
    cylinder(
      parent,
      0.151 * size,
      0.151 * size,
      0.015,
      x,
      y + 0.29 * size,
      z,
      soil,
    );
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      const foliage = sphere(
        parent,
        0.15 * size,
        x + Math.sin(a) * 0.1 * size,
        y + (0.46 + (i % 3) * 0.06) * size,
        z + Math.cos(a) * 0.1 * size,
        i % 2 ? leaf : leafLight,
        [0.6, 1.7, 0.6],
      );
      foliage.rotation.z = Math.sin(a) * 0.5;
      foliage.rotation.x = Math.cos(a) * 0.5;
    }
  }
  function chair(parent, x, y, z, angle = 0) {
    const g = furniture.chair();
    g.position.set(x, y, z);
    g.rotation.y = angle;
    parent.add(g);
  }

  const terraceParts = [];
  // Floating architectural plinth and finely spaced terrace decking.
  box(foundation, 4.1, 0.22, 4.2, -0.7, -0.2, 0, concrete, true);
  terraceParts.push(
    box(foundation, 1.4, 0.22, 4.2, 2.05, -0.2, 0, concrete, true),
  );
  box(foundation, 4.06, 0.075, 4.12, -0.68, -0.055, 0, stone, true);
  terraceParts.push(
    box(foundation, 1.36, 0.075, 4.12, 2.03, -0.055, 0, stone, true),
  );
  box(foundation, 3.35, 0.18, 2.7, -0.48, 0.065, -0.25, plaster);
  const deckStart = foundation.children.length;
  for (let i = 0; i < 26; i++)
    box(
      foundation,
      1.12,
      0.08,
      2.68 / 26 - 0.008,
      1.79,
      0.025,
      -1.59 + ((i + 0.5) * 2.68) / 26,
      i % 4 === 0 ? woodLight : wood,
    );
  terraceParts.push(...foundation.children.slice(deckStart));
  for (let i = 0; i < 7; i++)
    box(
      foundation,
      2.9,
      0.07,
      0.56 / 7 - 0.006,
      -0.5,
      0.015,
      1.14 + ((i + 0.5) * 0.56) / 7,
      i % 3 === 0 ? woodLight : wood,
    );
  for (let i = 0; i < 3; i++)
    box(
      foundation,
      0.98,
      0.07,
      0.28,
      -0.48,
      -0.04 - i * 0.04,
      1.66 + i * 0.14,
      plaster,
      true,
    );
  // Raised beds, stone path and a small ornamental tree.
  box(foundation, 0.36, 0.12, 2.6, -2.36, 0.02, -0.2, dark, true);
  for (let i = 0; i < 11; i++)
    sphere(
      foundation,
      0.19,
      -2.36,
      0.18,
      -1.4 + i * 0.23,
      i % 2 ? leaf : leafLight,
      [0.8, 0.85, 1],
    );
  terraceParts.push(
    box(foundation, 0.85, 0.12, 0.65, 2.05, 0.025, 1.43, dark, true),
  );
  const tree = new THREE.Group();
  tree.position.set(2.06, 0.06, 1.44);
  tree.userData.assemblyKind = "plant";
  foundation.add(tree);
  terraceParts.push(tree);
  cylinder(tree, 0.045, 0.065, 0.9, 0, 0.45, 0, wood);
  sphere(tree, 0.42, 0, 1.05, 0, leaf, [1, 1.2, 0.9]);
  sphere(tree, 0.26, -0.23, 0.92, 0.03, leafLight);
  plant(foundation, -1.8, 0.05, 1.45, 0.9);
  plant(foundation, 2.12, 0.08, -1.28, 1.1);
  terraceParts.push(foundation.children.at(-1));

  // Warm interior, with planked flooring and recognisable furniture.
  for (let i = 0; i < 23; i++)
    box(
      interior,
      3.15 / 23 - 0.006,
      0.035,
      2.5,
      -2.055 + ((i + 0.5) * 3.15) / 23,
      0.17,
      -0.25,
      i % 5 === 0 ? wood : woodLight,
    );
  const furnishings = new THREE.Group();
  interior.add(furnishings);
  box(furnishings, 1.4, 0.018, 1.35, -0.85, 0.2, 0.03, rug, true);
  const sofa = furniture.sofa();
  sofa.position.set(-1.65, 0.2, -0.11);
  sofa.rotation.y = Math.PI / 2;
  furnishings.add(sofa);
  const coffee = cylinder(
    furnishings,
    0.34,
    0.34,
    0.07,
    -0.66,
    0.5,
    0.05,
    stone,
    32,
  );
  coffee.scale.z = 1.35;
  cylinder(furnishings, 0.17, 0.2, 0.29, -0.66, 0.32, 0.05, wood);
  for (let i = 0; i < 18; i++) {
    const a = (i * Math.PI * 2) / 18;
    cylinder(
      furnishings,
      0.012,
      0.012,
      0.26,
      -0.66 + Math.cos(a) * 0.18,
      0.32,
      0.05 + Math.sin(a) * 0.18,
      woodLight,
      6,
    );
  }
  box(furnishings, 0.21, 0.022, 0.15, -0.7, 0.55, 0.07, plaster);
  cylinder(furnishings, 0.045, 0.035, 0.11, -0.55, 0.59, -0.08, stone);
  sphere(furnishings, 0.085, -0.55, 0.71, -0.08, leaf, [0.8, 1.4, 0.8]);
  box(furnishings, 1.23, 0.61, 0.36, 0.36, 0.49, -1.28, wood);
  box(furnishings, 1.28, 0.055, 0.41, 0.36, 0.82, -1.28, plaster);
  for (let i = 0; i < 4; i++)
    box(furnishings, 0.012, 0.48, 0.009, -0.1 + i * 0.3, 0.49, -1.092, brass);
  box(furnishings, 0.48, 0.025, 0.25, 0.05, 0.86, -1.28, dark, true);
  cylinder(furnishings, 0.14, 0.14, 0.54, 0.45, 0.48, 0.27, wood);
  cylinder(furnishings, 0.41, 0.41, 0.06, 0.45, 0.77, 0.27, stone, 32);
  chair(furnishings, 0.45, 0.19, 0.88, Math.PI);
  chair(furnishings, 0.45, 0.19, -0.35);
  // Ceramic place settings and a low vase on the dining table.
  for (const z of [0.06, 0.48]) {
    cylinder(furnishings, 0.105, 0.105, 0.012, 0.45, 0.81, z, ceramic, 32);
    cylinder(furnishings, 0.037, 0.03, 0.09, 0.67, 0.85, z, ceramic, 24);
  }
  cylinder(furnishings, 0.035, 0.06, 0.12, 0.32, 0.85, 0.27, stone, 24);
  // A fluted oak sideboard and soft architectural cove lighting.
  for (let i = 0; i < 26; i++)
    box(
      furnishings,
      0.018,
      0.5,
      0.02,
      -0.22 + i * 0.046,
      0.5,
      -1.087,
      woodLight,
    );
  box(shell, 3.1, 0.018, 0.035, -0.48, 1.77, -1.44, lamp);
  box(shell, 0.025, 1.3, 0.025, 1.02, 1.0, -1.44, lamp);

  plant(furnishings, -1.79, 0.19, -1.27, 0.8);
  // Framed artwork and pendant lighting, visible when the roof opens.
  box(furnishings, 0.52, 0.63, 0.035, -1.17, 1.25, -1.47, wood);
  box(furnishings, 0.45, 0.56, 0.015, -1.17, 1.25, -1.445, cushion);
  const art = sphere(
    furnishings,
    0.16,
    -1.17,
    1.26,
    -1.427,
    leafLight,
    [1, 1.3, 0.035],
  );
  art.rotation.z = -0.4;

  // Solid rear wall, gable ends and floor-to-ceiling glazing across the front.
  box(shell, 3.3, 1.72, 0.12, -0.48, 1.04, -1.53, plaster);
  box(shell, 0.12, 1.72, 2.55, -2.07, 1.04, -0.24, plaster);
  box(shell, 0.11, 1.72, 2.55, 1.1, 1.04, -0.24, plaster);
  box(shell, 3.3, 0.13, 0.12, -0.48, 1.84, 1.02, plaster);
  const glazing = [];
  for (let i = 0; i < 5; i++) {
    const x = -1.73 + i * 0.625;
    glazing.push(box(shell, 0.6, 1.52, 0.025, x, 1.0, 1.025, glass));
    box(shell, 0.035, 1.63, 0.05, x - 0.31, 1.0, 1.04, dark);
  }
  box(shell, 0.035, 1.63, 0.05, 1.08, 1.0, 1.04, dark);
  box(shell, 3.2, 0.035, 0.055, -0.48, 0.2, 1.04, dark);
  box(shell, 0.025, 0.23, 0.045, 0.17, 0.98, 1.08, brass);
  // An open terrace with an oak pergola.
  const pergolaStart = shell.children.length;
  for (const z of [-1.5, 1.02])
    box(shell, 0.075, 1.78, 0.075, 2.24, 0.96, z, wood);
  box(shell, 0.1, 0.11, 2.67, 2.24, 1.88, -0.24, wood);
  for (let i = 0; i < 9; i++)
    box(shell, 1.15, 0.09, 0.065, 1.67, 1.91, -1.49 + i * 0.31, woodLight);
  terraceParts.push(...shell.children.slice(pergolaStart));
  const outdoorFurnishings = new THREE.Group();
  terraceParts.push(outdoorFurnishings);
  foundation.add(outdoorFurnishings);
  chair(outdoorFurnishings, 1.69, 0.07, 0.14, -0.3);
  cylinder(outdoorFurnishings, 0.21, 0.21, 0.045, 1.7, 0.47, -0.55, plaster);
  cylinder(outdoorFurnishings, 0.06, 0.1, 0.37, 1.7, 0.26, -0.55, dark);

  // The roof is its own mesh assembly so it can physically lift off the home.
  const slope = Math.atan2(0.82, 1.8);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 17; i++) {
      const panel = box(
        roof,
        1.98,
        0.1,
        2.95 / 17,
        -0.48 + side * 0.88,
        2.32,
        -1.725 + ((i + 0.5) * 2.95) / 17,
        roofMetal,
      );
      panel.rotation.z = -side * slope;
    }
    for (let i = 0; i < 17; i++) {
      const seam = box(
        roof,
        1.99,
        0.026,
        0.018,
        -0.48 + side * 0.88,
        2.382,
        -1.68 + i * 0.18,
        dark,
      );
      seam.rotation.z = -side * slope;
    }
    const fascia = box(
      roof,
      2.0,
      0.11,
      0.075,
      -0.48 + side * 0.88,
      2.29,
      1.24,
      woodLight,
    );
    fascia.rotation.z = -side * slope;
    const backFascia = fascia.clone();
    backFascia.position.z = -1.73;
    roof.add(backFascia);
  }
  box(roof, 0.09, 0.07, 2.99, -0.48, 2.76, -0.25, dark);
  // Front triangular gable: a glass transom rather than an opaque facade.
  const shape = new THREE.Shape();
  shape.moveTo(-2.11, 1.9);
  shape.lineTo(1.15, 1.9);
  shape.lineTo(-0.48, 2.67);
  shape.closePath();
  const transom = new THREE.Mesh(new THREE.ShapeGeometry(shape), glass);
  transom.position.z = 1.05;
  roof.add(transom);
  box(roof, 0.035, 0.7, 0.04, -0.48, 2.25, 1.07, dark);
  cylinder(roof, 0.009, 0.009, 0.44, 0.4, 1.95, 0.25, dark);
  cylinder(roof, 0.13, 0.21, 0.14, 0.4, 1.67, 0.25, lamp);
  // A little roof vent creates a readable silhouette.
  box(roof, 0.25, 0.5, 0.32, 0.35, 2.54, -0.9, dark);
  box(roof, 0.31, 0.055, 0.38, 0.35, 2.81, -0.9, roofMetal);

  return {
    root,
    foundation,
    shell,
    interior,
    furnishings,
    outdoorFurnishings,
    terraceParts,
    roof,
    materials,
    glazing,
  };
}
