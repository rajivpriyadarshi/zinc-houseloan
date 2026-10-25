import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createHomeMaterials } from "./homeMaterials.js";

// An architectural interpretation of India Gate, assembled from individual stone courses.
export function createDelhiModel() {
  const root = new THREE.Group(),
    pieces = [];
  const palette = createHomeMaterials();
  const sandstone = palette.stone;
  sandstone.color.set("#bc9974");
  const stoneVariants = Array.from({ length: 5 }, (_, i) => {
    const m = sandstone.clone();
    m.color.offsetHSL(0, (i - 2) * 0.008, (i - 2) * 0.012);
    return m;
  });
  const trim = sandstone.clone();
  trim.color.set("#cfb28a");
  const baseStone = sandstone.clone();
  baseStone.color.set("#936f53");
  const lawn = new THREE.MeshStandardMaterial({
    color: "#425a42",
    roughness: 1,
  });
  const leaves = ["#476348", "#59754e", "#6b8057"].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 1 }),
  );
  const cube = new THREE.BoxGeometry(1, 1, 1);
  function register(
    mesh,
    time,
    { duration = 0.65, lift = 0.65, side = 0 } = {},
  ) {
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    pieces.push({
      mesh,
      time,
      duration,
      lift,
      side,
      position: mesh.position.clone(),
      scale: mesh.scale.clone(),
      rotation: mesh.rotation.clone(),
    });
    mesh.visible = false;
    return mesh;
  }
  function block(w, h, d, x, y, z, material, time, options = {}) {
    const geometry = options.rounded
      ? new RoundedBoxGeometry(w, h, d, 2, Math.min(0.045, h / 4))
      : cube;
    const mesh = new THREE.Mesh(geometry, material);
    if (!options.rounded) mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    return register(mesh, time, options);
  }
  function extrude(shape, depth, material, time, side = 0) {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      curveSegments: 12,
    });
    geometry.computeBoundingBox();
    const center = geometry.boundingBox.getCenter(new THREE.Vector3());
    geometry.translate(-center.x, -center.y, -center.z);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(center.x, center.y, 0);
    return register(mesh, time, { side });
  }
  // A low, restrained garden plinth with a clear path through the monument.
  block(7.6, 0.15, 5.2, 0, -0.26, 0, palette.dark, 0, {
    lift: 0.18,
    rounded: true,
  });
  block(7.48, 0.05, 5.08, 0, -0.16, 0, palette.stone, 0.06, {
    lift: 0.15,
    rounded: true,
  });
  for (const x of [-2.85, 2.85])
    block(1.55, 0.045, 4.5, x, -0.105, 0, lawn, 0.25, {
      lift: 0.1,
      rounded: true,
    });
  for (let i = 0; i < 5; i++)
    block(
      1.65,
      0.025,
      0.36,
      0,
      -0.115,
      1.15 + i * 0.28,
      trim,
      0.15 + i * 0.06,
      { lift: 0.16 },
    );
  for (let i = 0; i < 3; i++) {
    const w = 4.95 - i * 0.2,
      d = 2.38 - i * 0.18;
    for (let j = 0; j < 7; j++)
      block(
        w / 7 - 0.008,
        0.105,
        d,
        -w / 2 + ((j + 0.5) * w) / 7,
        -0.04 + i * 0.105,
        0,
        baseStone,
        0.25 + i * 0.13 + j * 0.025,
        { lift: 0.3 },
      );
  }

  const halfWidth = 2.18,
    spring = 2.73,
    innerRadius = 0.94,
    outerRadius = 1.18;
  const rowHeight = 0.215,
    gap = 0.008;
  // Clip each stone against the arch's outer curve. The opening is genuinely hollow.
  const boundary = (y) =>
    y < spring
      ? innerRadius
      : y < spring + outerRadius
        ? Math.sqrt(Math.max(0, outerRadius ** 2 - (y - spring) ** 2))
        : 0;
  for (let row = 0; row < 18; row++) {
    const y0 = 0.27 + row * rowHeight,
      y1 = y0 + rowHeight - gap;
    for (const side of [-1, 1]) {
      const offset = row % 2 ? -0.22 : 0;
      for (let column = 0; column < 6; column++) {
        const x0 = Math.max(0, offset + column * 0.44),
          x1 = Math.min(halfWidth, offset + (column + 1) * 0.44 - gap);
        if (x1 <= x0) continue;
        // Split at the spring line so no block spans the radial arch joint.
        const spans =
          y0 < spring && y1 > spring
            ? [
                [y0, spring - gap / 2],
                [spring + gap / 2, y1],
              ]
            : [[y0, y1]];
        for (const [bottom, top] of spans) {
          let low = bottom;
          if (boundary(top) >= x1) continue;
          if (top >= spring && x1 < outerRadius && boundary(bottom) >= x1)
            low = Math.max(
              bottom,
              spring + Math.sqrt(outerRadius ** 2 - x1 ** 2) + 0.002,
            );
          if (low >= top) continue;
          const points = [];
          for (let k = 0; k <= 8; k++) {
            const y = low + ((top - low) * k) / 8;
            points.push([side * Math.max(x0, boundary(y) + gap / 2), y]);
          }
          points.push([side * x1, top], [side * x1, low]);
          const shape = new THREE.Shape();
          shape.moveTo(...points[0]);
          points.slice(1).forEach((p) => shape.lineTo(...p));
          shape.closePath();
          extrude(
            shape,
            1.48,
            stoneVariants[(row + column) % 5],
            0.75 + row * 0.125 + column * 0.028 + (side > 0 ? 0.045 : 0),
            side * 0.15,
          );
        }
      }
    }
  }
  // Radial voussoirs rise from both piers; the central keystone arrives last.
  const segments = 19;
  for (let i = 0; i < segments; i++) {
    const a = (i * Math.PI) / segments + 0.004,
      b = ((i + 1) * Math.PI) / segments - 0.004;
    const shape = new THREE.Shape();
    shape.moveTo(Math.cos(a) * innerRadius, spring + Math.sin(a) * innerRadius);
    shape.absarc(0, spring, innerRadius, a, b, false);
    shape.lineTo(Math.cos(b) * outerRadius, spring + Math.sin(b) * outerRadius);
    shape.absarc(0, spring, outerRadius, b, a, true);
    shape.closePath();
    const order = Math.min(i, segments - 1 - i);
    extrude(
      shape,
      1.56,
      i === 9 ? trim : stoneVariants[i % 5],
      2.15 + order * 0.095,
      Math.cos((a + b) / 2) * 0.22,
    );
  }
  // Projecting pilasters, rusticated bases and paired capitals.
  for (const side of [-1, 1]) {
    const x = side * 1.67;
    for (const z of [-0.83, 0.83]) {
      block(0.66, 0.18, 0.25, x, 0.4, z, baseStone, 0.85, { lift: 0.3 });
      for (let row = 0; row < 13; row++)
        block(
          0.48,
          0.207,
          0.16,
          x,
          0.59 + row * 0.215,
          z,
          stoneVariants[row % 5],
          1 + row * 0.125,
          { side: side * 0.12 },
        );
      block(0.64, 0.12, 0.27, x, 3.4, z, trim, 3.15);
      block(0.73, 0.1, 0.32, x, 3.51, z, trim, 3.3);
    }
  }
  // The deep entablature and stepped crown give India Gate its familiar silhouette.
  for (const [w, h, d, y, t] of [
    [4.55, 0.13, 1.72, 4.19, 3.35],
    [4.7, 0.12, 1.85, 4.315, 3.5],
    [4.86, 0.095, 1.97, 4.422, 3.65],
  ])
    for (let i = 0; i < 9; i++)
      block(
        w / 9 - 0.007,
        h,
        d,
        -w / 2 + ((i + 0.5) * w) / 9,
        y,
        0,
        trim,
        t + i * 0.025,
      );
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 9; i++)
      block(
        0.485,
        0.197,
        1.48,
        -1.96 + i * 0.49,
        4.57 + row * 0.205,
        0,
        stoneVariants[(row + i) % 5],
        3.8 + row * 0.13 + i * 0.025,
      );
  for (const [w, h, d, y, t] of [
    [4.65, 0.13, 1.76, 5.13, 4.3],
    [4.85, 0.12, 1.94, 5.255, 4.45],
    [4.55, 0.13, 1.7, 5.38, 4.6],
  ])
    for (let i = 0; i < 9; i++)
      block(
        w / 9 - 0.007,
        h,
        d,
        -w / 2 + ((i + 0.5) * w) / 9,
        y,
        0,
        trim,
        t + i * 0.025,
      );
  block(2.25, 0.24, 1.25, 0, 5.56, 0, baseStone, 4.85);
  block(2.4, 0.095, 1.38, 0, 5.725, 0, trim, 5.05);
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.29, 0.14, 40),
    trim,
  );
  bowl.position.set(0, 5.83, 0);
  register(bowl, 5.2, { lift: 0.35 });
  const bowlRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.43, 0.035, 8, 48),
    trim,
  );
  bowlRim.rotation.x = Math.PI / 2;
  bowlRim.position.set(0, 5.91, 0);
  register(bowlRim, 5.3, { lift: 0.3 });
  // Carved roundels on the frieze, with shallow concentric relief.
  for (const z of [-0.81, 0.81])
    for (const x of [-1.55, 1.55]) {
      const medallion = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.035, 32),
        trim,
      );
      medallion.rotation.x = Math.PI / 2;
      medallion.position.set(x, 4.79, z);
      register(medallion, 4.65, { lift: 0.25 });
    }
  // Sparse groves stay below the arch's spring line and do not obscure the facade.
  for (const [index, [x, z, size]] of [
    [-3.0, -1.45, 0.88],
    [-2.65, -1.85, 0.62],
    [3.0, -1.45, 0.8],
    [3.15, 0.85, 0.56],
  ].entries()) {
    const group = new THREE.Group();
    group.position.set(x, -0.07, z);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.06, 0.8 * size, 10),
      palette.wood,
    );
    trunk.position.y = 0.4 * size;
    group.add(trunk);
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.38, 2),
        leaves[(i + index) % 3],
      );
      leaf.position.set(
        Math.sin(i * 2.4) * 0.16 * size,
        (0.9 + i * 0.08) * size,
        Math.cos(i * 2.4) * 0.12 * size,
      );
      leaf.scale.set(size, size * 1.35, size);
      leaf.castShadow = true;
      group.add(leaf);
    }
    register(group, 4.7 + index * 0.12, { duration: 0.9, lift: 0.3 });
  }
  // Lettering stays part of the masonry assembly rather than becoming UI chrome.
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#614b37";
    ctx.font = "56px Georgia";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("I N D I A", 256, 66);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const ink = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: 1,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    for (const side of [-1, 1]) {
      const label = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.44), ink);
      label.position.set(0, 4.8, side * 0.746);
      label.rotation.y = side < 0 ? Math.PI : 0;
      register(label, 4.65, { duration: 0.5, lift: 0 });
      label.castShadow = false;
    }
  }
  const duration = Math.max(...pieces.map((p) => p.time + p.duration));
  function seek(time, reduced = false) {
    for (const p of pieces) {
      const t = reduced
        ? 1
        : THREE.MathUtils.clamp((time - p.time) / p.duration, 0, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      p.mesh.visible = t > 0;
      p.mesh.position.copy(p.position);
      p.mesh.position.y += (1 - ease) * p.lift;
      p.mesh.position.x += (1 - ease) * p.side;
      p.mesh.scale
        .copy(p.scale)
        .multiplyScalar(Math.max(0.001, 0.82 + 0.18 * ease));
      p.mesh.rotation.copy(p.rotation);
      p.mesh.rotation.z += (1 - ease) * p.side * 0.13;
    }
  }
  seek(0);
  return { root, pieces, duration, seek };
}
