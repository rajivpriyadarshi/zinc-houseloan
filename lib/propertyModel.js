import * as THREE from "three";
import { createHutModel } from "./hutModel.js";
import { createHomeModel } from "./homeModel.js";
import { furnitureKit } from "./homeFurniture.js";
import { createCar } from "./carModel.js";
import { createTerrace } from "./terraceModel.js";
import { createHomeResidents } from "./homeResidents.js";
import { createPoolSwimmers } from "./poolSwimmers.js";

export const HOME_STAGES = [
  {
    value: 100000,
    name: "A compact home",
    detail: "A place to begin.",
    features: ["Living space", "Furnished interiors"],
  },
  {
    value: 7500000,
    name: "Room to breathe",
    detail: "A little more space, inside and out.",
    features: ["Timber terrace", "Oak pergola"],
  },
  {
    value: 15000000,
    name: "An extra living wing",
    detail: "More room for the way you live.",
    features: ["Living wing", "Brick-by-brick walls"],
  },
  {
    value: 30000000,
    name: "A second storey",
    detail: "Your home grows upwards.",
    features: ["Upper floor", "Private garage"],
  },
  {
    value: 50000000,
    name: "A poolside home",
    detail: "Space to slow down.",
    features: ["Swimming pool", "Sun deck"],
  },
  {
    value: 75000000,
    name: "A private retreat",
    detail: "The outdoors becomes part of home.",
    features: ["Garden pavilion", "Landscaped grounds"],
  },
];
export const stageForValue = (value) =>
  Math.max(
    0,
    HOME_STAGES.findLastIndex((stage) => value >= stage.value),
  );

/** Builds on the original home with individually animated, reversible construction pieces. */
export function createPropertyModel(
  value = 10000000,
  { instant = false } = {},
) {
  const model = createHomeModel();
  const hut = createHutModel(model.materials);
  let isHut = value < 2500000;
  const body = model.root;
  const root = new THREE.Group();
  root.add(body, hut.root);
  const pieces = [];
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.65, ...extra });
  const {
    stone,
    wood: oak,
    plaster: masonry,
    dark,
    glass,
    cushion,
  } = model.materials;
  const furniture = furnitureKit(model.materials);
  const water = mat("#78aca8", {
    roughness: 0.16,
    metalness: 0.3,
    transparent: true,
    opacity: 0.86,
  });
  const foliage = mat("#6e855a");
  let level = stageForValue(value),
    clock = 0;

  function piece(
    w,
    h,
    d,
    x,
    y,
    z,
    material,
    tier,
    order = 0,
    style = "drop",
    parent = root,
  ) {
    const mesh = new THREE.Mesh(geo, material);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    mesh.castShadow = material !== glass && material !== water;
    mesh.receiveShadow = true;
    parent.add(mesh);
    const initial = instant && level >= tier ? 1 : 0;
    pieces.push({
      mesh,
      position: mesh.position.clone(),
      scale: mesh.scale.clone(),
      tier,
      order,
      style,
      p: initial,
      v: 0,
      target: level >= tier ? 1 : 0,
      delay: order * 0.035,
    });
    mesh.visible = initial > 0.001;
    return mesh;
  }
  const furnishingGroups = [];
  function addFurnishing(
    group,
    x,
    y,
    z,
    tier,
    order,
    parent = root,
    isFurnishing = true,
  ) {
    if (isFurnishing) furnishingGroups.push(group);
    group.position.set(x, y, z);
    parent.add(group);
    const initial = instant && level >= tier ? 1 : 0;
    pieces.push({
      mesh: group,
      position: group.position.clone(),
      scale: group.scale.clone(),
      tier,
      order,
      style: "drop",
      p: initial,
      v: 0,
      target: level >= tier ? 1 : 0,
      delay: order * 0.035,
    });
    group.visible = initial > 0;
    return group;
  }
  // The first upgrade adds usable outdoor space; furnishings and people retain
  // their authored dimensions at every price. Reuse the reversible build spring.
  for (const [index, mesh] of model.terraceParts.entries()) {
    const plant = mesh.userData.assemblyKind === "plant";
    const order = plant || mesh === model.outdoorFurnishings ? 29 : index * 0.6;
    const initial = instant && level >= 1 ? 1 : 0;
    pieces.push({
      mesh,
      position: mesh.position.clone(),
      scale: mesh.scale.clone(),
      tier: 1,
      order,
      style: plant ? "plant" : "drop",
      p: initial,
      v: 0,
      target: level >= 1 ? 1 : 0,
      delay: order * 0.035,
    });
    mesh.visible = initial > 0;
  }
  const residents = createHomeResidents(model.materials);
  model.furnishings.add(residents.main);
  addFurnishing(residents.wing, 0, 0, 0, 2, 31);
  addFurnishing(residents.upper, 0, 0, 0, 3, 34, body);
  let lifeTime = 0;
  // A low pavilion wing: walls arrive in staggered, bonded courses of masonry.
  piece(2.4, 0.22, 2.9, -3.35, -0.2, -0.25, stone, 2, 0, "rise");
  piece(2.26, 0.065, 2.68, -3.35, -0.045, -0.25, oak, 2, 1, "rise");
  for (let row = 0; row < 10; row++)
    for (let col = 0; col < 8; col++) {
      const x = -4.4 + col * 0.28 + (row % 2) * 0.08;
      piece(
        0.268,
        0.135,
        0.15,
        x,
        0.11 + row * 0.145,
        -1.5,
        masonry,
        2,
        3 + row * 1.7 + col * 0.15,
      );
    }
  for (let row = 0; row < 10; row++)
    for (let col = 0; col < 8; col++)
      piece(
        0.14,
        0.135,
        0.3,
        -4.49,
        0.11 + row * 0.145,
        -1.3 + col * 0.31,
        masonry,
        2,
        3 + row * 1.7 + col * 0.15,
      );
  for (let i = 0; i < 5; i++) {
    piece(0.42, 1.4, 0.025, -4.25 + i * 0.44, 0.75, 1.04, glass, 2, 20 + i);
    piece(0.025, 1.5, 0.04, -4.47 + i * 0.44, 0.75, 1.05, dark, 2, 20 + i);
  }
  piece(2.45, 0.14, 2.95, -3.35, 1.57, -0.25, dark, 2, 28);
  addFurnishing(furniture.sofa(), -3.25, 0.01, -0.5, 2, 17);
  const wingTable = new THREE.Group();
  furniture.round(wingTable, 0.29, 0.045, [0, 0.31, 0], stone);
  furniture.round(wingTable, 0.12, 0.28, [0, 0.15, 0], oak);
  furniture.block(
    wingTable,
    [0.18, 0.025, 0.14],
    [0, 0.35, 0],
    model.materials.ceramic,
  );
  addFurnishing(wingTable, -3.2, 0, 0.42, 2, 20);
  const terrace = createTerrace(model.materials);
  root.add(terrace.root);
  for (const { group, order } of terrace.parts)
    addFurnishing(group, 0, 0, 0, 3, order, terrace.root, order >= 40);
  let playTime = 0;
  // Second storey fits beneath the original roof, which is lifted first.
  piece(3.3, 0.13, 2.65, -0.48, 1.95, -0.25, stone, 3, 6, "drop", body);
  for (let row = 0; row < 9; row++)
    for (let col = 0; col < 11; col++)
      piece(
        0.282,
        0.14,
        0.12,
        -1.95 + col * 0.295,
        2.1 + row * 0.151,
        -1.53,
        masonry,
        3,
        9 + row * 1.5 + col * 0.15,
        "drop",
        body,
      );
  for (let i = 0; i < 6; i++) {
    piece(
      0.52,
      1.36,
      0.025,
      -1.8 + i * 0.53,
      2.7,
      1.025,
      glass,
      3,
      23 + i,
      "drop",
      body,
    );
    piece(
      0.035,
      1.48,
      0.05,
      -2.06 + i * 0.53,
      2.7,
      1.05,
      dark,
      3,
      24 + i,
      "drop",
      body,
    );
  }
  for (const x of [-2.07, 1.1]) {
    piece(0.1, 1.48, 2.58, x, 2.7, -0.24, stone, 3, 22, "drop", body);
    for (let i = 0; i < 13; i++)
      piece(
        0.015,
        1.4,
        0.04,
        x + (x < 0 ? -0.058 : 0.058),
        2.7,
        -1.45 + i * 0.2,
        oak,
        3,
        24 + i * 0.3,
        "drop",
        body,
      );
  }
  addFurnishing(furniture.bed(), -0.75, 2.03, -0.15, 3, 20, body);
  furnishingGroups.push(
    piece(
      2.5,
      0.018,
      2.2,
      -0.75,
      2.03,
      -0.1,
      model.materials.rug,
      3,
      18,
      "drop",
      body,
    ),
  );
  // Pool shell, coping, water and deck assemble as separate pieces.
  piece(3, 0.19, 4.2, 4.05, -0.2, 0, stone, 4, 0, "rise");
  piece(2.35, 0.08, 3.42, 4.05, -0.07, 0, dark, 4, 3, "rise");
  for (let i = 0; i < 14; i++)
    for (const x of [2.83, 5.27])
      piece(
        0.18,
        0.09,
        0.28,
        x,
        0.015,
        -1.84 + i * 0.28,
        stone,
        4,
        4 + i * 0.3,
      );
  for (let i = 0; i < 9; i++)
    for (const z of [-1.93, 1.93])
      piece(0.28, 0.09, 0.18, 2.93 + i * 0.28, 0.015, z, stone, 4, 6 + i * 0.3);
  const waterPlane = piece(
    2.25,
    0.025,
    3.5,
    4.05,
    -0.015,
    0,
    water,
    4,
    19,
    "rise",
  );
  const poolLife = createPoolSwimmers(model.materials);
  root.add(poolLife.root);
  const poolBuild = pieces.find((p) => p.mesh === waterPlane);
  let swimTime = 0;
  for (let i = 0; i < 5; i++) {
    const line = piece(
      1.8,
      0.002,
      0.012,
      4.05,
      0.004,
      -1.2 + i * 0.55,
      mat("#bad2c3", { transparent: true, opacity: 0.25 }),
      4,
      20 + i,
      "rise",
    );
    line.rotation.y = i % 2 ? 0.06 : -0.08;
  }
  for (const z of [-1.1, 0.5])
    addFurnishing(furniture.lounger(), 5.95, -0.08, z, 4, 26);
  const sideTable = new THREE.Group();
  furniture.round(sideTable, 0.16, 0.035, [0, 0.27, 0], stone);
  furniture.round(sideTable, 0.06, 0.25, [0, 0.13, 0], oak);
  furniture.round(
    sideTable,
    0.035,
    0.08,
    [0.04, 0.33, 0],
    model.materials.ceramic,
  );
  addFurnishing(sideTable, 5.95, -0.08, -0.3, 4, 28);
  piece(0.85, 0.16, 3.3, 5.95, -0.2, -0.15, stone, 4, 1, "rise");
  // A garden pavilion built one post and beam at a time.
  piece(4.5, 0.2, 2.25, -0.5, -0.2, -3.4, stone, 5, 0, "rise");
  for (let i = 0; i < 20; i++)
    piece(
      0.205,
      0.04,
      2.1,
      -2.62 + i * 0.22,
      -0.07,
      -3.4,
      oak,
      5,
      i * 0.2,
      "rise",
    );
  for (const x of [-2.5, 1.5])
    for (const z of [-4.3, -2.5])
      piece(0.09, 1.85, 0.09, x, 0.88, z, oak, 5, 5);
  for (let i = 0; i < 15; i++)
    piece(0.09, 0.1, 2.2, -2.6 + i * 0.3, 1.86, -3.4, oak, 5, 12 + i * 0.6);
  piece(2, 0.1, 0.75, -0.5, 0.45, -3.4, stone, 5, 18);
  for (const x of [-1.3, 0.3])
    for (const z of [-4.05, -2.75]) {
      const seat = furniture.chair();
      seat.rotation.y = z > -3.4 ? Math.PI : 0;
      addFurnishing(seat, x, -0.04, z, 5, 20);
    }
  for (const x of [-1.3, 0.3])
    piece(0.08, 0.52, 0.58, x, 0.19, -3.4, oak, 5, 17);
  for (const [x, z] of [
    [-4.65, 1.8],
    [5.35, -2.7],
    [-2.9, -4.3],
  ]) {
    piece(0.55, 0.2, 0.55, x, -0.02, z, dark, 5, 4);
    piece(0.09, 1.5, 0.09, x, 0.8, z, oak, 5, 9, "grow");
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.65, 2),
      foliage,
    );
    crown.position.set(x, 1.7, z);
    root.add(crown);
    pieces.push({
      mesh: crown,
      position: crown.position.clone(),
      scale: new THREE.Vector3(1, 1.35, 1),
      tier: 5,
      order: 24,
      style: "grow",
      p: instant && level >= 5 ? 1 : 0,
      v: 0,
      target: level >= 5 ? 1 : 0,
      delay: 24 * 0.035,
    });
    crown.visible = instant && level >= 5;
  }
  // A low garage beside the living wing, assembled with the higher-value home.
  const garageX = -5.55;
  piece(1.9, 0.22, 2.85, garageX, -0.2, -0.25, stone, 3, 0, "rise");
  piece(1.74, 0.05, 2.68, garageX, -0.065, -0.25, dark, 3, 1, "rise");
  for (let row = 0; row < 8; row++) {
    for (let i = 0; i < 7; i++)
      for (const x of [garageX - 0.87, garageX + 0.87])
        piece(
          0.12,
          0.142,
          0.36,
          x,
          0.03 + row * 0.15,
          -1.4 + i * 0.38,
          masonry,
          3,
          3 + row * 1.6 + i * 0.1,
        );
    for (let i = 0; i < 5; i++)
      piece(
        0.34,
        0.142,
        0.12,
        garageX - 0.7 + i * 0.35,
        0.03 + row * 0.15,
        -1.57,
        masonry,
        3,
        3 + row * 1.6 + i * 0.1,
      );
  }
  piece(1.96, 0.13, 2.94, garageX, 1.29, -0.25, dark, 3, 24);
  piece(1.92, 0.08, 0.1, garageX, 1.2, 1.22, oak, 3, 25);
  for (const x of [garageX - 0.84, garageX + 0.84])
    piece(0.08, 1.22, 0.1, x, 0.57, 1.12, oak, 3, 23);
  const doorCarrier = new THREE.Group(),
    door = new THREE.Group();
  doorCarrier.add(door);
  for (let i = 0; i < 8; i++)
    furniture.block(
      door,
      [1.57, 0.132, 0.055],
      [0, -0.07 - i * 0.137, 0],
      oak,
      0.008,
    );
  door.rotation.x = Math.PI / 2;
  addFurnishing(doorCarrier, garageX, 1.19, 1.12, 3, 26, root, false);
  const garageLight = mat("#e9d9af", {
    emissive: "#edc68d",
    emissiveIntensity: 0.6,
  });
  piece(1.42, 0.018, 0.025, garageX, 1.17, 1.16, garageLight, 3, 27);
  const parkedCar = createCar("#a35b47", { sport: true });
  parkedCar.root.scale.setScalar(1.2);
  parkedCar.root.position.set(garageX, -0.07, 0.35);
  parkedCar.root.rotation.y = 0;
  root.add(parkedCar.root);
  const garage = {
    x: garageX,
    z: 0.35,
    door,
    car: parkedCar.root,
    roll: parkedCar.roll,
    steer: parkedCar.steer,
  };
  // Threshold movement lifts the roof ahead of the new wall courses.
  let roofY = instant && level >= 3 ? 1.5 : 0,
    roofVelocity = 0;
  let roofRestY = roofY;
  function setValue(nextValue, snap = false) {
    isHut = nextValue < 2500000;
    const nextLevel = stageForValue(nextValue);
    if (nextLevel !== level || snap) {
      level = nextLevel;
      clock = 0;
      for (const p of pieces) {
        p.target = level >= p.tier ? 1 : 0;
        p.delay = p.target
          ? p.order * 0.035
          : Math.max(0, 30 - p.order) * 0.018;
        if (snap) {
          p.p = p.target;
          p.v = 0;
        }
      }
      if (snap) {
        roofY = level >= 3 ? 1.5 : 0;
        roofVelocity = 0;
      }
    }
  }
  function update(dt, reduced = false) {
    body.visible = !isHut;
    hut.root.visible = isHut;
    clock += dt;
    let moving = false;
    for (const p of pieces) {
      if (clock < p.delay && !reduced) {
        moving = true;
        continue;
      }
      if (reduced) {
        p.p = p.target;
        p.v = 0;
      } else {
        p.v += ((p.target - p.p) * 100 - p.v * 20) * dt;
        p.p += p.v * dt;
      }
      if (Math.abs(p.target - p.p) < 0.001 && Math.abs(p.v) < 0.005) {
        p.p = p.target;
        p.v = 0;
      } else moving = true;
      const v = THREE.MathUtils.clamp(p.p, 0, 1);
      p.mesh.visible = v > 0.002;
      p.mesh.scale.copy(p.scale).multiplyScalar(Math.max(0.001, v));
      p.mesh.position.copy(p.position);
      if (p.style === "grow")
        p.mesh.position.y = 0.05 + (p.position.y - 0.05) * v;
      else if (p.style !== "plant")
        p.mesh.position.y += (1 - v) * (p.style === "rise" ? -0.65 : 1.25);
    }
    const roofTarget = level >= 3 ? 1.5 : 0;
    // During a downgrade, the upper walls leave before the roof settles back down.
    if (roofTarget > roofY || clock > 0.75 || reduced) {
      roofVelocity += ((roofTarget - roofY) * 85 - roofVelocity * 19) * dt;
      roofY = reduced ? roofTarget : roofY + roofVelocity * dt;
    } else moving = true;
    model.roof.position.y = roofY;
    roofRestY = roofY;
    if (!reduced) {
      lifeTime += dt;
      residents.seek(lifeTime);
      moving = true;
    }
    // Swimmers stay at water level; they never drop in with the construction pieces.
    poolLife.root.visible = level >= 4 && poolBuild.p > 0.995;
    if (poolLife.root.visible && !reduced) {
      swimTime += dt;
      poolLife.seek(swimTime);
    }
    parkedCar.root.visible = level >= 3 && (reduced || clock > 2.1);
    if (level >= 3 && !reduced) {
      if (clock > 2.6) {
        playTime += dt;
        terrace.seek(playTime);
      }
      moving = true;
    }

    if (Math.abs(roofTarget - roofY) > 0.002) moving = true;
    return moving;
  }
  if (instant) update(1 / 60, true);
  else update(0);
  return {
    ...model,
    root,
    body,
    hut,
    get isHut() {
      return isHut;
    },
    pieces,
    furnishingGroups,
    waterPlane,
    garage,
    terrace,
    residents,
    poolLife,
    setValue,
    update,
    get level() {
      return level;
    },
    get roofRestY() {
      return roofRestY;
    },
    get viewWidth() {
      return isHut
        ? 6.5
        : level >= 4
          ? 15.2
          : level >= 3
            ? 12.4
            : level >= 2
              ? 10.4
              : 7.8;
    },
  };
}
