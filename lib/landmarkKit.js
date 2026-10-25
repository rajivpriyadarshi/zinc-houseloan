import * as THREE from "three";
import { createCityMaterials } from "./cityMaterials.js";

/** Shared materials and timed stone placement keep the three city dioramas cohesive. */
export function landmarkKit(color, stoneKind = "granite") {
  const root = new THREE.Group(),
    pieces = [],
    palette = createCityMaterials(color, stoneKind);
  palette.stone.color.set(color);
  const trim = palette.stone.clone();
  trim.color.offsetHSL(0, -0.04, 0.09);
  const stones = Array.from({ length: 5 }, (_, i) => {
    const m = palette.stone.clone();
    m.color.offsetHSL(0, 0, (i - 2) * 0.013);
    return m;
  });
  const { lawn, leaves } = palette;
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const blockGeometry = new Map();
  function stoneBlockGeometry(w, h, d) {
    const key = [w, h, d].join("/");
    if (blockGeometry.has(key)) return blockGeometry.get(key);
    const geometry = cube.clone(),
      positions = geometry.attributes.position,
      normals = geometry.attributes.normal,
      uv = geometry.attributes.uv;
    // Physical texture scale instead of stretching one grain sample over every slab.
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i) * w,
        y = positions.getY(i) * h,
        z = positions.getZ(i) * d;
      if (Math.abs(normals.getX(i)) > 0.5) uv.setXY(i, z, y);
      else if (Math.abs(normals.getY(i)) > 0.5) uv.setXY(i, x, z);
      else uv.setXY(i, x, y);
    }
    blockGeometry.set(key, geometry);
    return geometry;
  }
  function add(mesh, time, lift = 0.55) {
    root.add(mesh);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.traverse((n) => {
      if (n.isMesh) n.castShadow = n.receiveShadow = true;
    });
    pieces.push({
      mesh,
      time,
      duration: 0.65,
      lift,
      position: mesh.position.clone(),
      scale: mesh.scale.clone(),
    });
    mesh.visible = false;
    return mesh;
  }
  function block(w, h, d, x, y, z, material, time, lift = 0.55) {
    const mesh = new THREE.Mesh(stoneBlockGeometry(w, h, d), material);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    return add(mesh, time, lift);
  }
  function cylinder(r1, r2, h, x, y, z, material, time, segments = 24) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(r1, r2, h, segments),
      material,
    );
    const uv = mesh.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, uv.getX(i) * Math.PI * 2 * Math.max(r1, r2), uv.getY(i) * h);
    mesh.position.set(x, y, z);
    return add(mesh, time);
  }
  function shape(points, depth, x, z, material, time) {
    const s = new THREE.Shape();
    s.moveTo(...points[0]);
    points.slice(1).forEach((p) => s.lineTo(...p));
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
    g.computeBoundingBox();
    const center = g.boundingBox.getCenter(new THREE.Vector3());
    g.translate(-center.x, -center.y, -center.z);
    const m = new THREE.Mesh(g, material);
    m.position.set(x + center.x, center.y, z);
    return add(m, time);
  }
  function courses(
    width,
    height,
    depth,
    x,
    bottom,
    z,
    time,
    rows = 10,
    columns = 16,
  ) {
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < columns; col++) {
        const w = width / columns,
          offset = row % 2 ? w * 0.32 : 0;
        const left = Math.max(-width / 2, -width / 2 + col * w - offset),
          right = Math.min(width / 2, -width / 2 + (col + 1) * w - offset);
        block(
          right - left - 0.008,
          height / rows - 0.008,
          depth,
          x + (left + right) / 2,
          bottom + ((row + 0.5) * height) / rows,
          z,
          stones[(row + col) % 5],
          time + row * 0.12 + col * 0.012,
        );
      }
    // Close the offset bond at the edge with half stones.
    for (let row = 1; row < rows; row += 2) {
      const w = (width / columns) * 0.32;
      block(
        w - 0.008,
        height / rows - 0.008,
        depth,
        x + width / 2 - w / 2,
        bottom + ((row + 0.5) * height) / rows,
        z,
        stones[row % 5],
        time + row * 0.12 + 0.22,
      );
    }
  }
  function dome(x, y, z, r, h, time) {
    const profile = [
      [0, 0],
      [0.95, 0],
      [1, 0.1],
      [0.99, 0.22],
      [0.88, 0.48],
      [0.66, 0.73],
      [0.32, 0.91],
      [0.1, 1],
      [0, 1.04],
    ].map(([a, b]) => new THREE.Vector2(a * r, b * h));
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(
        new THREE.LatheGeometry(
          profile,
          6,
          (i * Math.PI) / 6,
          Math.PI / 6 - 0.008,
        ),
        stones[i % 5],
      );
      mesh.position.set(x, y, z);
      add(mesh, time + i * 0.025, 0.45);
    }
    cylinder(0.055, 0.09, 0.2, x, y + h * 1.04 + 0.1, z, trim, time + 0.38, 12);
  }
  function tree(x, z, size, time) {
    const group = new THREE.Group();
    group.position.set(x, -0.08, z);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.06, 0.7 * size, 10),
      palette.wood,
    );
    trunk.position.y = 0.35 * size;
    group.add(trunk);
    for (let i = 0; i < 3; i++) {
      const crown = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.34, 2),
        leaves[i],
      );
      crown.position.set(
        Math.sin(i * 2.4) * 0.15 * size,
        (0.8 + i * 0.08) * size,
        Math.cos(i * 2.4) * 0.12 * size,
      );
      crown.scale.set(size, size * 1.35, size);
      group.add(crown);
    }
    add(group, time, 0.25);
  }
  function plinth(width, depth) {
    block(width, 0.16, depth, 0, -0.26, 0, palette.dark, 0, 0.12);
    block(width - 0.12, 0.055, depth - 0.12, 0, -0.15, 0, trim, 0.08, 0.12);
  }
  // A genuine hollow arch with individually clipped masonry courses and radial arch stones.
  function arch({
    x = 0,
    z = 0,
    halfWidth = 1.8,
    bottom = 0.15,
    height = 4,
    spring = 2.25,
    r = 0.9,
    rise = 1.2,
    depth = 1.4,
    time = 0.6,
  }) {
    const outerR = r + 0.2,
      outerRise = rise + 0.2;
    const boundary = (y) =>
      y < spring
        ? r
        : y < spring + outerRise
          ? outerR * Math.sqrt(Math.max(0, 1 - ((y - spring) / outerRise) ** 2))
          : 0;
    const rows = Math.ceil((height - bottom) / 0.21),
      cols = Math.ceil(halfWidth / 0.37);
    for (let row = 0; row < rows; row++) {
      const low = bottom + (row * (height - bottom)) / rows,
        high = bottom + ((row + 1) * (height - bottom)) / rows - 0.008;
      for (const sign of [-1, 1])
        for (let col = 0; col < cols; col++) {
          const left = (col * halfWidth) / cols,
            right = ((col + 1) * halfWidth) / cols - 0.008;
          let b = low;
          if (boundary(high) >= right) continue;
          if (high >= spring && right < outerR && boundary(b) >= right)
            b = Math.max(
              b,
              spring + outerRise * Math.sqrt(1 - (right / outerR) ** 2) + 0.002,
            );
          if (b >= high) continue;
          const p = [];
          for (let i = 0; i <= 8; i++) {
            const y = b + ((high - b) * i) / 8;
            p.push([sign * Math.max(left, boundary(y) + 0.004), y]);
          }
          p.push([sign * right, high], [sign * right, b]);
          shape(
            p,
            depth,
            x,
            z,
            stones[(row + col) % 5],
            time + row * 0.12 + col * 0.02,
          );
        }
    }
    for (let i = 0; i < 19; i++) {
      const a = (i * Math.PI) / 19 + 0.004,
        b = ((i + 1) * Math.PI) / 19 - 0.004,
        p = [];
      for (let j = 0; j <= 4; j++) {
        const t = a + ((b - a) * j) / 4;
        p.push([Math.cos(t) * r, spring + Math.sin(t) * rise]);
      }
      for (let j = 4; j >= 0; j--) {
        const t = a + ((b - a) * j) / 4;
        p.push([Math.cos(t) * outerR, spring + Math.sin(t) * outerRise]);
      }
      shape(
        p,
        depth + 0.1,
        x,
        z,
        trim,
        time + 1.15 + Math.min(i, 18 - i) * 0.075,
      );
    }
  }
  function finish(view) {
    const duration = Math.max(...pieces.map((p) => p.time + p.duration));
    function seek(time, reduced = false) {
      for (const p of pieces) {
        const u = reduced
            ? 1
            : THREE.MathUtils.clamp((time - p.time) / p.duration, 0, 1),
          e = 1 - (1 - u) ** 3;
        p.mesh.visible = u > 0;
        p.mesh.position.copy(p.position);
        p.mesh.position.y += (1 - e) * p.lift;
        p.mesh.scale.copy(p.scale).multiplyScalar(0.82 + 0.18 * e);
      }
    }
    seek(0);
    return { root, pieces, duration, seek, view };
  }
  return {
    root,
    pieces,
    palette,
    trim,
    stones,
    lawn,
    add,
    block,
    cylinder,
    courses,
    dome,
    tree,
    plinth,
    arch,
    finish,
  };
}
