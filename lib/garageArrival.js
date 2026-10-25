import * as THREE from "three";

/** A single arrival per garage appearance. Higher-tier changes preserve its progress. */
export function createGarageArrival(garage, material) {
  const root = new THREE.Group(),
    slabs = [];
  const x = garage.x,
    outside = x - 2.1,
    turnZ = 2.4,
    radius = 1.05;
  const v = (px, pz) => new THREE.Vector3(px, -0.33, pz);
  const path = new THREE.CurvePath();
  path.add(new THREE.LineCurve3(v(outside, -2.8), v(outside, turnZ)));
  const k = radius * 0.55228475;
  path.add(
    new THREE.CubicBezierCurve3(
      v(outside, turnZ),
      v(outside, turnZ + k),
      v(x - radius - k, turnZ + radius),
      v(x - radius, turnZ + radius),
    ),
  );
  path.add(
    new THREE.CubicBezierCurve3(
      v(x - radius, turnZ + radius),
      v(x - radius + k, turnZ + radius),
      v(x, turnZ + k),
      v(x, turnZ),
    ),
  );
  const approachLength = path.getLength();
  path.add(new THREE.LineCurve3(v(x, turnZ), v(x, -0.25)));
  const length = path.getLength(),
    duration = 12;
  // Short driveway stays attached to the garage threshold and builds in three slabs.
  for (let i = 0; i < 3; i++) {
    const z1 = 1.13 + (i * 1.27) / 3,
      z2 = z1 + 1.27 / 3 - 0.008;
    const y = (z) => THREE.MathUtils.lerp(-0.045, -0.3, (z - 1.13) / 1.27);
    const center = new THREE.Vector3(x, (y(z1) + y(z2)) / 2, (z1 + z2) / 2);
    const geometry = new THREE.BufferGeometry();
    const points = [];
    for (const offsetY of [0, -0.035])
      for (const [px, pz] of [
        [-0.74, z1],
        [0.74, z1],
        [0.74, z2],
        [-0.74, z2],
      ])
        points.push(px, y(pz) + offsetY - center.y, pz - center.z);
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points, 3),
    );
    geometry.setIndex([
      0, 3, 2, 0, 2, 1, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2,
      3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
    ]);
    geometry.computeVertexNormals();
    const slab = new THREE.Mesh(geometry, material);
    slab.position.copy(center);
    slab.receiveShadow = slab.castShadow = true;
    root.add(slab);
    slabs.push({ slab, center });
  }
  let enabled = false,
    elapsed = 0,
    finished = false,
    distance = 0;
  const smooth = (u) => u * u * (3 - 2 * u);
  function update(dt, level, reduced = false) {
    const eligible = level >= 3;
    if (eligible !== enabled) {
      enabled = eligible;
      elapsed = 0;
      finished = false;
    }
    root.visible = eligible;
    if (!eligible) {
      garage.car.visible = false;
      return false;
    }
    if (reduced) {
      elapsed = 2.6 + duration;
      finished = true;
    } else if (!finished) elapsed += dt;
    for (const [i, { slab, center }] of slabs.entries()) {
      const p = reduced
        ? 1
        : smooth(THREE.MathUtils.clamp((elapsed - 0.6 - i * 0.15) / 0.7, 0, 1));
      slab.visible = p > 0;
      slab.scale.set(p || 0.001, 1, p || 0.001);
      slab.position.y = center.y - (1 - p) * 0.2;
    }
    const u = THREE.MathUtils.clamp((elapsed - 2.6) / duration, 0, 1);
    distance = smooth(u) * length;
    const progress = Math.min(1, distance / length);
    const p = path.getPointAt(progress),
      tangent = path.getTangentAt(progress);
    const ramp = THREE.MathUtils.clamp((turnZ - p.z) / 1.27, 0, 1);
    if (distance >= approachLength) p.y += ramp * 0.26;
    garage.car.position.copy(p);
    garage.car.rotation.order = "YXZ";
    garage.car.rotation.y = Math.atan2(tangent.x, tangent.z);
    garage.car.rotation.x =
      distance >= approachLength ? -0.198 * Math.sin(Math.PI * ramp) : 0;
    garage.car.visible = elapsed > 2.6;
    // Grow into view behind the garage, then remain full-sized for the whole manoeuvre.
    garage.car.scale.setScalar(
      1.2 *
        (reduced
          ? 1
          : smooth(THREE.MathUtils.clamp((elapsed - 2.6) / 0.45, 0, 1))),
    );
    garage.roll(distance / 1.2);
    const ahead = path.getTangentAt(Math.min(1, (distance + 0.06) / length));
    const turn = Math.atan2(
      tangent.z * ahead.x - tangent.x * ahead.z,
      tangent.dot(ahead),
    );
    garage.steer?.(THREE.MathUtils.clamp(turn * 6, -0.4, 0.4));
    garage.door.rotation.x = Math.PI / 2;
    if (u === 1) finished = true;
    return !finished;
  }
  return {
    root,
    path,
    update,
    get active() {
      return enabled && !finished;
    },
    get elapsed() {
      return elapsed;
    },
  };
}
