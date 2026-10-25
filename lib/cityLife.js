import * as THREE from "three";

/** Small, deterministic street-life vignettes on safe paths outside the monuments. */
export function createCityLife(city) {
  const root = new THREE.Group();
  const mat = (color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const skin = [mat("#ba9070"), mat("#8c624d")],
    hair = mat("#38332d"),
    pants = mat("#3b514a"),
    shoe = mat("#d2c6ab");
  const shirts = ["#b5b99a", "#b08168", "#7d9798", "#d1c6a9"].map(mat);
  const sphere = new THREE.SphereGeometry(1, 12, 8),
    cube = new THREE.BoxGeometry(1, 1, 1);
  function mesh(parent, geometry, material, position, scale) {
    const node = new THREE.Mesh(geometry, material);
    node.position.set(...position);
    node.scale.set(...scale);
    node.castShadow = true;
    node.receiveShadow = true;
    parent.add(node);
    return node;
  }
  const oval = (p, m, pos, scale) => mesh(p, sphere, m, pos, scale);
  const box = (p, m, pos, scale) => mesh(p, cube, m, pos, scale);
  function person(index) {
    const body = new THREE.Group(),
      legs = [],
      arms = [];
    box(body, shirts[index], [0, 0.5, 0], [0.2, 0.26, 0.13]);
    box(body, pants, [0, 0.35, 0], [0.16, 0.09, 0.12]);
    const head = new THREE.Group();
    head.position.y = 0.73;
    body.add(head);
    oval(head, skin[index % 2], [0, 0, 0], [0.073, 0.088, 0.074]);
    oval(head, hair, [0, 0.055, -0.014], [0.08, 0.06, 0.079]);
    oval(head, hair, [0, 0.018, -0.045], [0.075, 0.065, 0.05]);
    if (index === 1) oval(head, hair, [0, 0.07, -0.09], [0.05, 0.05, 0.05]);
    oval(head, skin[index % 2], [0, -0.007, 0.07], [0.016, 0.018, 0.018]);
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.05, 0.34, 0);
      body.add(leg);
      box(leg, pants, [0, -0.08, 0], [0.06, 0.16, 0.07]);
      const knee = new THREE.Group();
      knee.position.y = -0.16;
      leg.add(knee);
      box(knee, pants, [0, -0.065, 0], [0.052, 0.13, 0.06]);
      box(knee, shoe, [0, -0.15, 0.02], [0.07, 0.05, 0.115]);
      legs.push({ leg, knee, side });
      const arm = new THREE.Group();
      arm.position.set(side * 0.12, 0.6, 0);
      body.add(arm);
      box(arm, shirts[index], [0, -0.055, 0], [0.06, 0.12, 0.07]);
      box(arm, skin[index % 2], [0, -0.19, 0.015], [0.045, 0.16, 0.05]);
      arms.push({ arm, side });
    }
    return {
      body,
      animate(t, moving) {
        const phase = t * 5.3;
        legs.forEach(({ leg, knee, side }) => {
          const swing = Math.sin(phase + (side > 0 ? Math.PI : 0)) * moving;
          leg.rotation.x = swing * 0.37;
          knee.rotation.x = Math.max(0, -swing) * 0.45;
        });
        arms.forEach(
          ({ arm, side }) =>
            (arm.rotation.x =
              -Math.sin(phase + (side > 0 ? Math.PI : 0)) * 0.28 * moving),
        );
        head.rotation.y = Math.sin(t * 0.55 + index) * 0.12;
        body.position.y = Math.abs(Math.sin(phase)) * 0.009 * moving;
      },
    };
  }
  function animal(cat, index) {
    const body = new THREE.Group(),
      legs = [];
    const fur = mat(
        cat ? (index ? "#787c70" : "#b28b61") : index ? "#b1a28a" : "#c5a16f",
      ),
      dark = mat("#373930");
    oval(
      body,
      fur,
      [0, 0.22, 0],
      cat ? [0.068, 0.075, 0.16] : [0.085, 0.1, 0.19],
    );
    const head = new THREE.Group();
    head.position.set(0, cat ? 0.27 : 0.32, cat ? 0.17 : 0.2);
    body.add(head);
    oval(
      head,
      fur,
      [0, 0, 0],
      cat ? [0.073, 0.067, 0.065] : [0.078, 0.086, 0.08],
    );
    oval(
      head,
      fur,
      [0, -0.025, 0.07],
      cat ? [0.034, 0.025, 0.035] : [0.05, 0.04, 0.065],
    );
    oval(head, dark, [0, -0.013, cat ? 0.098 : 0.122], [0.018, 0.013, 0.013]);
    for (const side of [-1, 1]) {
      if (cat) {
        const ear = new THREE.Mesh(
          new THREE.ConeGeometry(0.036, 0.085, 3),
          fur,
        );
        ear.position.set(side * 0.045, 0.073, -0.01);
        ear.rotation.z = -side * 0.17;
        head.add(ear);
      } else oval(head, fur, [side * 0.07, -0.02, -0.01], [0.027, 0.08, 0.045]);
      oval(head, dark, [side * 0.039, 0.018, 0.055], [0.009, 0.011, 0.008]);
      for (const front of [-1, 1]) {
        const joint = new THREE.Group();
        joint.position.set(side * 0.06, 0.21, front * 0.11);
        body.add(joint);
        box(joint, fur, [0, -0.085, 0], [0.035, 0.17, 0.035]);
        oval(joint, fur, [0, -0.176, 0.016], [0.027, 0.023, 0.038]);
        legs.push({ joint, offset: side * front > 0 ? Math.PI : 0 });
      }
    }
    const tail = new THREE.Group();
    tail.position.set(0, 0.25, -0.16);
    body.add(tail);
    const curve = new THREE.CatmullRomCurve3(
      cat
        ? [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0.19, -0.06),
            new THREE.Vector3(0.04, 0.28, -0.04),
          ]
        : [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0.06, -0.12),
            new THREE.Vector3(0, 0.16, -0.18),
          ],
    );
    tail.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(curve, 10, cat ? 0.017 : 0.027, 6, false),
        fur,
      ),
    );
    return {
      body,
      animate(t, moving) {
        legs.forEach(
          ({ joint, offset }) =>
            (joint.rotation.x =
              Math.sin(t * (cat ? 7 : 6) + offset) * 0.4 * moving),
        );
        tail.rotation.y = Math.sin(t * (cat ? 1.8 : 5)) * (cat ? 0.18 : 0.4);
        head.rotation.x = moving ? 0.03 : Math.sin(t * 1.8) * 0.13 + 0.15;
        head.rotation.y = moving ? 0 : Math.sin(t * 0.8) * 0.25;
      },
    };
  }
  const loop = (points) =>
    new THREE.CatmullRomCurve3(
      points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      true,
      "centripetal",
    );
  const ellipse = (rx, rz, x = 0, z = 0) =>
    loop(
      Array.from({ length: 16 }, (_, i) => [
        x + Math.sin((i * Math.PI) / 8) * rx,
        z + Math.cos((i * Math.PI) / 8) * rz,
      ]),
    );
  let promenade, animalPaths, ground;
  if (city === "Delhi") {
    promenade = ellipse(4.51, 4.51);
    animalPaths = [
      ellipse(4.48, 4.48),
      ellipse(0.4, 0.44, -4.2, 0.05),
      ellipse(0.4, 0.44, 4.2, 0.05),
    ];
    ground = -0.005;
  } else {
    const span = city === "Mumbai" ? 3.2 : 4.3;
    promenade = ellipse(span, 0.1, 0, 2.76);
    animalPaths = [
      promenade,
      ellipse(
        0.46,
        0.22,
        -(city === "Mumbai" ? 3.7 : 3.35),
        city === "Mumbai" ? 0.4 : 1.92,
      ),
      ellipse(
        0.46,
        0.22,
        city === "Mumbai" ? 3.7 : 3.35,
        city === "Mumbai" ? 0.4 : 1.92,
      ),
    ];
    ground = -0.122;
  }
  const actors = [];
  function add(rig, path, phase, speed, scale, kind, index, y = ground) {
    const carrier = new THREE.Group();
    carrier.add(rig.body);
    carrier.scale.setScalar(scale);
    root.add(carrier);
    actors.push({
      carrier,
      rig,
      path,
      phase,
      speed,
      scale,
      kind,
      index,
      y,
      length: path.getLength(),
    });
  }
  for (let i = 0; i < 4; i++)
    add(
      person(i),
      promenade,
      [0.04, 0.3, 0.56, 0.8][i],
      0.3,
      0.57,
      "person",
      i,
    );
  add(animal(false, 0), animalPaths[0], 0.16, 0.34, 0.75, "dog", 4);
  add(animal(false, 1), animalPaths[0], 0.69, 0.29, 0.66, "dog", 5);
  add(
    animal(true, 0),
    animalPaths[1],
    0.1,
    0.12,
    0.7,
    "cat",
    6,
    city === "Delhi" ? -0.005 : city === "Mumbai" ? -0.122 : -0.087,
  );
  add(
    animal(true, 1),
    animalPaths[2],
    0.6,
    0.1,
    0.68,
    "cat",
    7,
    city === "Delhi" ? -0.005 : city === "Mumbai" ? -0.122 : -0.087,
  );
  // Keep Delhi's cats on the dry outer promenade, outside the reflecting pools.
  if (city === "Delhi") {
    actors[6].path = ellipse(0.025, 0.2, -4.51, 0);
    actors[7].path = ellipse(0.025, 0.2, 4.51, 0);
    for (const actor of actors.slice(6)) actor.length = actor.path.getLength();
  }
  function seek(time, reveal = 1, reduced = false) {
    for (const actor of actors) {
      const local = reduced ? 0 : time + actor.index * 2.7;
      const cycle = local % 20,
        animal = actor.kind !== "person";
      const walking = animal
        ? Math.floor(local / 20) * 16 + Math.min(cycle, 16)
        : local;
      const moving = reduced ? 0 : animal && cycle >= 16 ? 0 : 1;
      const u = (actor.phase + (walking * actor.speed) / actor.length) % 1;
      const point = actor.path.getPointAt(u),
        tangent = actor.path.getTangentAt(u);
      actor.carrier.position.set(point.x, actor.y, point.z);
      actor.carrier.rotation.y = Math.atan2(tangent.x, tangent.z);
      const appear = reduced
        ? 1
        : THREE.MathUtils.smoothstep(reveal - actor.index * 0.055, 0, 0.5);
      actor.carrier.visible = appear > 0;
      actor.carrier.scale.setScalar(actor.scale * (0.85 + 0.15 * appear));
      actor.rig.animate(local, moving);
    }
  }
  seek(0, 0);
  return { root, actors, seek };
}
