import * as THREE from "three";

// A one-time construction score. Subsequent price changes retain the reversible tier animation.
export function createPropertyAssembly(model) {
  model.update(0, true);
  const records = [],
    materials = model.materials,
    people = [
      model.residents.main,
      model.residents.wing,
      model.residents.upper,
      ...model.terrace.kids.map((kid) => kid.body),
      model.terrace.ball,
      model.poolLife.root,
    ];
  const organic = (x, z) => {
    const n = Math.sin(x * 73.17 + z * 39.43 + 8.1) * 43758.5453;
    return n - Math.floor(n);
  };
  function add(node, start, duration, kind = "drop", lift = 1, tier = 0, rest) {
    records.push({
      node,
      start,
      duration,
      kind,
      lift,
      tier,
      position: rest?.position.clone() ?? node.position.clone(),
      scale: rest?.scale.clone() ?? node.scale.clone(),
    });
  }
  const upgradeNodes = new Set(model.pieces.map((p) => p.mesh));
  const isWood = (node) =>
    node.material === materials.wood || node.material === materials.woodLight;
  let slab = 0,
    plank = 0,
    post = 0,
    wall = 0;
  for (const node of model.foundation.children) {
    if (upgradeNodes.has(node)) continue;
    const plant = node.userData.assemblyKind;
    if (plant)
      add(
        node,
        2.3 + organic(node.position.x, node.position.z) * 0.75,
        0.9,
        plant,
      );
    else if (node === model.outdoorFurnishings) {
      node.children.forEach((part, i) =>
        add(part, 2.5 + i * 0.08, 0.6, "drop", 0.65),
      );
    } else if (isWood(node))
      add(node, 0.35 + plank++ * 0.024, 0.5, "drop", 0.65);
    else add(node, slab++ * 0.045, 0.55, "drop", 0.42);
  }
  for (const node of model.interior.children) {
    if (node === model.furnishings) {
      node.children
        .filter((part) => !people.includes(part))
        .forEach((part, i) => add(part, 2.25 + i * 0.009, 0.65, "drop", 0.7));
    } else add(node, 0.45 + plank++ * 0.018, 0.5, "drop", 0.65);
  }
  for (const node of model.shell.children) {
    if (upgradeNodes.has(node)) continue;
    const tallPost =
      node.scale.y > 1 && node.scale.x < 0.15 && node.scale.z < 0.15;
    if (tallPost) add(node, 0.75 + post++ * 0.065, 0.6, "drop", 1.3);
    else if (node.material === materials.glass)
      add(node, 1.35 + wall++ * 0.045, 0.65, "drop", 1.05);
    else if (isWood(node)) add(node, 1.6 + wall++ * 0.04, 0.6, "drop", 1.2);
    else add(node, 0.9 + wall++ * 0.025, 0.7, "drop", 1.1);
  }
  for (const node of model.roof.children) {
    const sweep = THREE.MathUtils.clamp((node.position.z + 1.75) / 3, 0, 1);
    add(
      node,
      2.15 + sweep * 0.55 + (node.position.x > -0.48 ? 0.12 : 0),
      0.75,
      "drop",
      1.2,
    );
  }
  for (const p of model.pieces) {
    const isPerson = people.includes(p.mesh);
    const isFurniture = model.furnishingGroups.includes(p.mesh);
    const grow = p.style === "grow" || p.style === "plant";
    const start = grow
      ? 2.3 + organic(p.position.x, p.position.z) * 0.75
      : isPerson
        ? 3.8
        : isFurniture
          ? 2.35 + p.order * 0.012
          : (p.tier === 3 ? 1.05 : 0.55) + p.order * 0.038;
    add(
      p.mesh,
      start,
      grow ? 0.9 : 0.65,
      p.style === "plant" ? "plant" : grow ? "shrub" : "drop",
      p.style === "rise" ? 0.5 : 1.35,
      p.tier,
      p,
    );
  }
  for (const part of model.hut.parts) {
    add(part.node, part.start, 0.6, "drop", 0.8, 0, part);
  }
  // Animated people must not arrive as falling construction components.
  const peopleSet = new Set(people);
  const duration = Math.max(
    4,
    ...records
      .filter((r) => !peopleSet.has(r.node))
      .map((r) => r.start + r.duration),
  );
  let time = 0,
    active = true;
  function update(dt, reduced = false) {
    if (!active) return false;
    time = reduced ? duration : Math.min(duration, time + dt);
    for (const r of records) {
      const u = THREE.MathUtils.clamp((time - r.start) / r.duration, 0, 1);
      const grow = r.kind === "plant" || r.kind === "shrub";
      const p = reduced || time === duration ? 1 : 1 - (1 - u) ** 3;
      r.node.visible = model.level >= r.tier && p > 0;
      r.node.position.copy(r.position);
      r.node.scale.copy(r.scale);
      if (grow) {
        r.node.scale.multiplyScalar(Math.max(0.001, p));
        if (r.kind === "shrub")
          r.node.position.y = 0.05 + (r.position.y - 0.05) * p;
      } else {
        // Keep architectural pieces recognisable while they descend into their sockets.
        r.node.position.y += (1 - p) * r.lift;
        r.node.scale.multiplyScalar(0.92 + 0.08 * p);
      }
    }
    for (const person of people) person.visible = time >= duration;
    model.residents.wing.visible = time >= duration && model.level >= 2;
    model.residents.upper.visible = time >= duration && model.level >= 3;
    model.poolLife.root.visible = time >= duration && model.level >= 4;
    model.garage.car.visible = false;
    active = time < duration;
    return active;
  }
  update(0);
  return {
    update,
    records,
    duration,
    get active() {
      return active;
    },
  };
}
