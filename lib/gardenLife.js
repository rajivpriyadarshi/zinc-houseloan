import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export function createGardenLife(garage) {
  const root = new THREE.Group();
  const mat = (color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const skin = mat("#a77f62"),
    shirt = mat("#b9a889"),
    trousers = mat("#34483f"),
    shoes = mat("#c1b9a3"),
    hair = mat("#3e3932");
  const fur = mat("#c4a474"),
    ears = mat("#987449"),
    nose = mat("#39382e"),
    collar = mat("#596b53");
  function ball(parent, r, x, y, z, material, scale = [1, 1, 1]) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), material);
    mesh.position.set(x, y, z);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function box(parent, w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, 2, Math.min(0.035, w / 3, h / 3, d / 3)),
      material,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const person = new THREE.Group();
  root.add(person);
  box(person, 0.2, 0.25, 0.13, 0, 0.52, 0, shirt);
  box(person, 0.16, 0.09, 0.12, 0, 0.365, 0, trousers);
  ball(person, 0.08, 0, 0.746, 0, skin, [0.86, 1.08, 0.9]);
  ball(person, 0.077, 0, 0.78, -0.012, hair, [0.94, 0.65, 0.94]);
  ball(person, 0.018, 0, 0.744, 0.071, skin, [0.8, 0.8, 1]);
  const legs = [],
    arms = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.053, 0.35, 0);
    person.add(hip);
    box(hip, 0.067, 0.17, 0.075, 0, -0.085, 0, trousers);
    const knee = new THREE.Group();
    knee.position.y = -0.16;
    hip.add(knee);
    box(knee, 0.058, 0.15, 0.065, 0, -0.075, 0, trousers);
    box(knee, 0.075, 0.045, 0.12, 0, -0.165, 0.025, shoes);
    legs.push({ hip, knee, side });
    const arm = new THREE.Group();
    arm.position.set(side * 0.125, 0.62, 0);
    person.add(arm);
    box(arm, 0.065, 0.13, 0.075, 0, -0.05, 0, shirt);
    box(arm, 0.045, 0.17, 0.05, 0, -0.18, 0.015, skin);
    ball(arm, 0.028, 0, -0.27, 0.015, skin);
    arms.push({ arm, side });
  }
  const dog = new THREE.Group();
  root.add(dog);
  ball(dog, 0.12, 0, 0.24, 0, fur, [0.75, 0.85, 1.65]);
  ball(dog, 0.09, 0, 0.31, 0.17, fur, [0.9, 1, 1.05]);
  ball(dog, 0.054, 0, 0.285, 0.25, fur, [0.9, 0.7, 1.3]);
  ball(dog, 0.024, 0, 0.292, 0.3, nose);
  for (const side of [-1, 1]) {
    ball(dog, 0.052, side * 0.072, 0.3, 0.17, ears, [0.55, 1.6, 0.8]);
    ball(dog, 0.009, side * 0.045, 0.34, 0.233, nose);
  }
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.069, 0.013, 8, 16),
    collar,
  );
  band.position.set(0, 0.27, 0.137);
  dog.add(band);
  const paws = [];
  for (const side of [-1, 1])
    for (const front of [-1, 1]) {
      const joint = new THREE.Group();
      joint.position.set(side * 0.067, 0.225, front * 0.11);
      dog.add(joint);
      box(joint, 0.035, 0.17, 0.04, 0, -0.085, 0, fur);
      ball(joint, 0.027, 0, -0.18, 0.012, ears, [0.8, 0.7, 1.3]);
      paws.push({ joint, side, front });
    }
  const tail = new THREE.Group();
  tail.position.set(0, 0.26, -0.17);
  dog.add(tail);
  const tailMesh = ball(tail, 0.055, 0, 0.055, -0.08, fur, [0.7, 0.8, 2.5]);
  tailMesh.rotation.x = 0.55;
  const leashGeometry = new THREE.BufferGeometry();
  leashGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(27), 3),
  );
  const leash = new THREE.Line(
    leashGeometry,
    new THREE.LineBasicMaterial({ color: "#b5aa8b" }),
  );
  leash.frustumCulled = false;
  root.add(leash);
  const points = Array.from({ length: 32 }, (_, i) => {
    const a = (i / 32) * Math.PI * 2;
    return new THREE.Vector3(
      -2.4 + Math.cos(a) * 1.45,
      -0.3,
      2.48 + Math.sin(a) * 0.14,
    );
  });
  const walkingPath = new THREE.CatmullRomCurve3(points, true, "centripetal");
  // The driveway joins the street at grade, then gently rises to the garage slab.
  const drive = new THREE.Mesh(
    new THREE.BoxGeometry(1.72, 0.025, 2.25),
    mat("#8f9682"),
  );
  drive.position.set(garage.x, -0.17, 2.18);
  drive.rotation.x = 0.11;
  drive.receiveShadow = true;
  root.add(drive);
  const parkingPath = new THREE.CubicBezierCurve3(
    new THREE.Vector3(garage.x - 1.1, -0.29, 3.81),
    new THREE.Vector3(garage.x + 0.05, -0.29, 3.81),
    new THREE.Vector3(garage.x, -0.035, 2.1),
    new THREE.Vector3(garage.x, -0.035, garage.z),
  );
  let time = 0,
    parked = false;
  const smooth = (t) => t * t * (3 - 2 * t);
  function update(dt, reduced = false) {
    if (!reduced) time += dt;
    const travel =
      reduced || parked ? 1 : THREE.MathUtils.clamp((time - 2.4) / 9, 0, 1);
    const u = smooth(travel),
      p = parkingPath.getPointAt(u),
      tangent = parkingPath.getTangentAt(u);
    // Elevation follows the driveway only after leaving the road.
    p.y = -0.33 + 0.26 * THREE.MathUtils.clamp((3.3 - p.z) / 2.25, 0, 1);
    garage.car.position.copy(p);
    garage.car.rotation.y = Math.atan2(tangent.x, tangent.z);
    garage.car.visible = true;
    garage.roll(u * parkingPath.getLength());
    garage.door.rotation.x =
      (Math.PI / 2) *
      (reduced || parked
        ? 1
        : smooth(THREE.MathUtils.clamp((time - 2.1) / 1.1, 0, 1)));
    parked = travel === 1;
    const walkTime = time,
      walkU = (0.18 + walkTime / 30) % 1;
    const position = walkingPath.getPointAt(walkU),
      t = walkingPath.getTangentAt(walkU);
    person.position.copy(position);
    person.position.y += Math.abs(Math.sin(walkTime * 5)) * 0.006;
    person.rotation.y = Math.atan2(t.x, t.z);
    for (const { hip, knee, side } of legs) {
      const swing = Math.sin(walkTime * 5 + (side > 0 ? Math.PI : 0));
      hip.rotation.x = swing * 0.38;
      knee.rotation.x = Math.max(0, -swing) * 0.35;
    }
    for (const { arm, side } of arms)
      arm.rotation.x = side < 0 ? -0.2 : Math.sin(walkTime * 5) * 0.25;
    const dogU = (walkU + 0.04) % 1,
      dogP = walkingPath.getPointAt(dogU),
      dogT = walkingPath.getTangentAt(dogU);
    dog.position.set(dogP.x + dogT.z * 0.13, -0.3, dogP.z - dogT.x * 0.13);
    dog.rotation.y = Math.atan2(dogT.x, dogT.z);
    for (const { joint, side, front } of paws)
      joint.rotation.x =
        Math.sin(walkTime * 7 + (side === front ? 0 : Math.PI)) * 0.35;
    tail.rotation.y = Math.sin(walkTime * 6) * 0.35;
    root.updateMatrixWorld(true);
    const hand = arms[0].arm.localToWorld(new THREE.Vector3(0, -0.27, 0.015));
    const neck = dog.localToWorld(new THREE.Vector3(0, 0.28, 0.14));
    for (let i = 0; i < 9; i++) {
      const f = i / 8,
        point = hand.clone().lerp(neck, f);
      point.y -= Math.sin(f * Math.PI) * 0.08;
      leashGeometry.attributes.position.setXYZ(i, point.x, point.y, point.z);
    }
    leashGeometry.attributes.position.needsUpdate = true;
  }
  update(0);
  return {
    root,
    update,
    person,
    dog,
    parkingPath,
    walkingPath,
    get parked() {
      return parked;
    },
  };
}
