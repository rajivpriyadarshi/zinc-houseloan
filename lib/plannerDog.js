import * as THREE from "three";

/** A small looping stroll on the ground in front of the house, clear of the driveway. */
export function createPlannerDog() {
  const root = new THREE.Group(),
    dog = new THREE.Group();
  root.add(dog);
  const mat = (color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.88 });
  const fur = mat("#c9aa7e"),
    cream = mat("#e1c79e"),
    ear = mat("#956c49"),
    dark = mat("#302f29"),
    collar = mat("#6c8164");
  const sphere = new THREE.SphereGeometry(1, 14, 10);
  function oval(parent, material, pos, scale) {
    const mesh = new THREE.Mesh(sphere, material);
    mesh.position.set(...pos);
    mesh.scale.set(...scale);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  oval(dog, fur, [0, 0.29, 0], [0.115, 0.13, 0.235]);
  oval(dog, cream, [0, 0.26, 0.13], [0.09, 0.11, 0.12]);
  const head = new THREE.Group();
  head.position.set(0, 0.37, 0.21);
  dog.add(head);
  oval(head, fur, [0, 0, 0], [0.1, 0.105, 0.115]);
  oval(head, cream, [0, -0.035, 0.1], [0.072, 0.055, 0.09]);
  oval(head, dark, [0, -0.015, 0.175], [0.032, 0.023, 0.021]);
  const ears = [];
  for (const side of [-1, 1]) {
    const flap = oval(
      head,
      ear,
      [side * 0.092, -0.025, -0.005],
      [0.033, 0.105, 0.06],
    );
    flap.rotation.z = side * 0.2;
    ears.push(flap);
    oval(head, dark, [side * 0.061, 0.028, 0.079], [0.012, 0.014, 0.01]);
  }
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.083, 0.014, 8, 20),
    collar,
  );
  band.position.set(0, 0.325, 0.155);
  dog.add(band);
  const legs = [];
  const limbGeometry = new THREE.CylinderGeometry(1, 1, 1, 12);
  function limb(material) {
    const mesh = new THREE.Mesh(limbGeometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    dog.add(mesh);
    return mesh;
  }
  // A four-beat walk, with separate shoulder/elbow and hip/hock joints.
  for (const side of [-1, 1])
    for (const front of [-1, 1]) {
      const upper = limb(fur);
      const lower = limb(fur);
      const joint = oval(dog, fur, [0, 0, 0], [0.029, 0.029, 0.029]);
      oval(
        dog,
        fur,
        [side * 0.078, 0.245, front * 0.15],
        [0.046, 0.075, 0.057],
      );
      const paw = oval(dog, cream, [0, 0, 0], [0.032, 0.022, 0.043]);
      legs.push({
        side,
        front,
        upper,
        lower,
        joint,
        paw,
        offset: side < 0 ? (front < 0 ? 0 : 0.25) : front < 0 ? 0.5 : 0.75,
        contact: new THREE.Vector3(),
        cycle: -1,
        initialized: false,
        planted: false,
      });
    }
  const tail = new THREE.Group();
  tail.position.set(0, 0.32, -0.2);
  dog.add(tail);
  const tip = oval(tail, fur, [0, 0.065, -0.095], [0.035, 0.045, 0.14]);
  tip.rotation.x = 0.5;
  const straight = 1.7,
    radius = 0.5,
    arc = Math.PI * radius;
  const length = 2 * straight + 2 * arc,
    stride = 0.22,
    stance = 0.64;
  const ground = -0.36,
    pawHeight = 0.022;
  let time = 0,
    distance = 0.5,
    frontZ = 3;
  const up = new THREE.Vector3(0, 1, 0);
  function path(at) {
    let d = ((at % length) + length) % length;
    let x, z, dx, dz;
    if (d < straight) {
      x = -0.85 + d;
      z = -radius;
      dx = 1;
      dz = 0;
    } else if ((d -= straight) < arc) {
      const a = -Math.PI / 2 + d / radius;
      x = 0.85 + radius * Math.cos(a);
      z = radius * Math.sin(a);
      dx = -Math.sin(a);
      dz = Math.cos(a);
    } else if ((d -= arc) < straight) {
      x = 0.85 - d;
      z = radius;
      dx = -1;
      dz = 0;
    } else {
      d -= straight;
      const a = Math.PI / 2 + d / radius;
      x = -0.85 + radius * Math.cos(a);
      z = radius * Math.sin(a);
      dx = -Math.sin(a);
      dz = Math.cos(a);
    }
    return { x: x - 0.35, z: z + frontZ, dx, dz };
  }
  function landing(leg, at, reach = stride * stance * 0.5) {
    const p = path(at),
      along = leg.front * 0.15 + reach;
    return new THREE.Vector3(
      p.x + p.dx * along + p.dz * leg.side * 0.078,
      ground + pawHeight,
      p.z + p.dz * along - p.dx * leg.side * 0.078,
    );
  }
  function segment(mesh, a, b, width) {
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    const direction = b.clone().sub(a);
    mesh.quaternion.setFromUnitVectors(up, direction.clone().normalize());
    mesh.scale.set(width, direction.length(), width);
  }
  function update(dt, { building = false, reduced = false, hut = false } = {}) {
    if (building) {
      root.visible = false;
      legs.forEach((l) => (l.initialized = false));
      return;
    }
    root.visible = true;
    frontZ = THREE.MathUtils.damp(frontZ, hut ? 2.45 : 3, 4, dt);
    if (!reduced) {
      time += dt;
      distance += dt * 0.23;
    }
    const p = path(distance),
      beat = distance / stride;
    root.position.set(p.x, ground, p.z);
    root.rotation.y = Math.atan2(p.dx, p.dz);
    dog.position.y = reduced ? 0 : Math.sin(beat * Math.PI * 4) * 0.0015;
    dog.rotation.z = reduced ? 0 : Math.sin(beat * Math.PI * 2) * 0.006;
    root.updateMatrixWorld(true);
    for (const leg of legs) {
      const total = beat + leg.offset,
        cycle = Math.floor(total),
        phase = total - cycle;
      const planted = phase < stance;
      if (!leg.initialized || (planted && cycle !== leg.cycle)) {
        leg.contact.copy(landing(leg, distance - phase * stride));
        leg.cycle = cycle;
        leg.initialized = true;
      }
      const foot = leg.contact.clone();
      if (reduced) {
        foot.copy(landing(leg, distance, 0));
        leg.initialized = false;
      } else if (!planted) {
        // The swing lands at the next step's future root position.
        const u = (phase - stance) / (1 - stance),
          ease = u * u * (3 - 2 * u);
        const next = landing(leg, distance + (1 - phase) * stride);
        foot.copy(leg.contact).lerp(next, ease);
        foot.y += Math.sin(Math.PI * u) * 0.02;
      }
      leg.planted = reduced || planted;
      const target = dog.worldToLocal(foot.clone());
      const hip = new THREE.Vector3(leg.side * 0.078, 0.268, leg.front * 0.15);
      const direction = target.clone().sub(hip),
        span = direction.length();
      direction.normalize();
      // Short, near-straight limbs. The shoulder/thigh covers the upper hinge.
      const upperLength = 0.134,
        lowerLength = 0.139;
      const along =
        (upperLength ** 2 - lowerLength ** 2 + span ** 2) / (2 * span);
      const bend = new THREE.Vector3(0, 0, leg.front > 0 ? -1 : 1);
      bend.addScaledVector(direction, -bend.dot(direction)).normalize();
      const knee = hip
        .clone()
        .addScaledVector(direction, along)
        .addScaledVector(
          bend,
          Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2)),
        );
      leg.joint.position.copy(knee);
      segment(leg.upper, hip, knee, 0.029);
      segment(leg.lower, knee, target, 0.024);
      leg.paw.position.copy(target);
      leg.paw.rotation.x =
        reduced || planted
          ? 0
          : Math.sin((Math.PI * (phase - stance)) / (1 - stance)) * 0.12;
    }
    head.rotation.x = reduced ? 0 : Math.sin(beat * Math.PI * 2 - 0.6) * 0.023;
    head.rotation.y = reduced ? 0 : Math.sin(time * 0.6) * 0.035;
    tail.rotation.y = reduced ? 0 : Math.sin(time * 3) * 0.18;
    ears.forEach(
      (e, i) =>
        (e.rotation.x = reduced
          ? 0
          : Math.sin(beat * Math.PI * 2 - 1 + i * 0.2) * 0.035),
    );
  }
  root.visible = false;
  return { root, update, legs };
}
