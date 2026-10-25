import * as THREE from "three";
import { citySurface } from "./cityMaterials.js";
import { landmarkKit } from "./landmarkKit.js";

/** An architectural interpretation of the Lotus Temple's three sets of nine shells. */
export function createLotusTempleModel() {
  const k = landmarkKit("#c3bca8", "sandstone");
  const { block, cylinder, palette, trim, lawn } = k;
  const petalMarble = citySurface("marble", "#efeee5");
  const marble = Array.from({ length: 4 }, (_, i) => {
    const m = petalMarble.clone();
    m.color.set(["#e4e3da", "#dddfd6", "#e9e7de", "#dedfd7"][i]);
    m.roughness = 1;
    m.bumpScale = 0.006;
    return m;
  });
  const water = citySurface("water", "#7ba9a3");
  k.plinth(10.6, 9.6);
  block(10.42, 0.035, 9.42, 0, -0.105, 0, lawn, 0.12, 0.12);
  cylinder(4.58, 4.66, 0.09, 0, -0.055, 0, trim, 0.2, 72);
  cylinder(2.72, 2.81, 0.12, 0, 0.035, 0, trim, 0.36, 72);
  cylinder(2.54, 2.65, 0.1, 0, 0.145, 0, palette.stone, 0.48, 72);
  // Nine separate reflecting pools, with broad stone coping and radial approach paths.
  function poolShape(inner, outer, halfAngle) {
    const s = new THREE.Shape();
    s.moveTo(Math.sin(-halfAngle) * inner, Math.cos(-halfAngle) * inner);
    s.lineTo(Math.sin(-halfAngle) * outer, Math.cos(-halfAngle) * outer);
    for (let i = 1; i <= 24; i++) {
      const a = -halfAngle + (2 * halfAngle * i) / 24;
      s.lineTo(Math.sin(a) * outer, Math.cos(a) * outer);
    }
    s.lineTo(Math.sin(halfAngle) * inner, Math.cos(halfAngle) * inner);
    for (let i = 23; i >= 0; i--) {
      const a = -halfAngle + (2 * halfAngle * i) / 24;
      s.lineTo(Math.sin(a) * inner, Math.cos(a) * inner);
    }
    s.closePath();
    return s;
  }
  for (let i = 0; i < 9; i++) {
    const a = (i * Math.PI * 2) / 9;
    const basin = new THREE.Mesh(
      new THREE.ExtrudeGeometry(poolShape(2.88, 4.44, 0.29), {
        depth: 0.035,
        bevelEnabled: false,
      }),
      palette.dark,
    );
    basin.rotation.set(-Math.PI / 2, 0, a + Math.PI);
    basin.position.y = 0.003;
    k.add(basin, 0.35 + i * 0.06, 0.12);
    const pool = new THREE.Mesh(
      new THREE.ShapeGeometry(poolShape(2.96, 4.36, 0.274), 32),
      water,
    );
    pool.rotation.set(-Math.PI / 2, 0, a + Math.PI);
    pool.position.y = 0.043;
    k.add(pool, 0.55 + i * 0.07, 0.1);
    pool.castShadow = false;
    const pathAngle = a + Math.PI / 9;
    for (let step = 0; step < 4; step++) {
      const r = 2.6 + step * 0.38;
      const slab = block(
        0.29,
        0.055,
        0.38,
        Math.sin(pathAngle) * r,
        0.19 - step * 0.037,
        Math.cos(pathAngle) * r,
        trim,
        0.4 + step * 0.07 + i * 0.025,
        0.2,
      );
      slab.rotation.y = pathAngle;
    }
  }
  // Glazed recesses beneath the entrance canopies keep the flower recognisably architectural.
  for (let i = 0; i < 9; i++) {
    const a = (i * Math.PI * 2) / 9;
    const entrance = new THREE.Group();
    entrance.position.set(Math.sin(a) * 1.88, 0.21, Math.cos(a) * 1.88);
    entrance.rotation.y = a;
    for (const side of [-1, 1]) {
      const jamb = new THREE.Mesh(
        new THREE.BoxGeometry(0.085, 0.7, 0.14),
        marble[1],
      );
      jamb.position.set(side * 0.35, 0.35, 0);
      entrance.add(jamb);
    }
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(0.59, 0.63, 0.025),
      palette.dark,
    );
    glass.position.y = 0.315;
    entrance.add(glass);
    const mullion = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.63, 0.035),
      trim,
    );
    mullion.position.set(0, 0.315, 0.022);
    entrance.add(mullion);
    k.add(entrance, 0.9 + i * 0.045, 0.35);
  }
  const shells = [];
  const rings = [
    {
      base: 1.72,
      tip: 3.18,
      height: 0.83,
      arch: 1.12,
      width: 0.72,
      start: 0.95,
      bands: 7,
      kind: "entrance",
    },
    {
      base: 2.12,
      tip: 0.92,
      height: 2.86,
      arch: 0,
      width: 0.86,
      start: 1.8,
      bands: 9,
      kind: "outer",
    },
    {
      base: 1.39,
      tip: 0.24,
      height: 4.03,
      arch: 0,
      width: 0.64,
      start: 2.85,
      bands: 11,
      kind: "inner",
    },
  ];
  function point(ring, t, v) {
    const inner = ring.kind === "inner",
      entrance = ring.kind === "entrance";
    const r =
      THREE.MathUtils.lerp(ring.base, ring.tip, t) +
      (entrance ? 0.12 : inner ? 0.78 : 0.44) * Math.sin(Math.PI * t);
    const profile = Math.max(0, Math.sin(Math.PI * (0.12 + 0.88 * t)));
    const width = entrance
      ? ring.width * Math.pow(profile, 0.72)
      : r * 0.342 * Math.pow(profile, 0.32);
    const y = 0.22 + ring.height * t + ring.arch * Math.sin(Math.PI * t);
    // The raised centre ridge and curved lateral edges give each petal a shell-like section.
    return new THREE.Vector3(
      width * v,
      y - (entrance ? 0.18 : 0.09) * v * v * Math.sin(Math.PI * t),
      r + 0.17 * (1 - v * v) * Math.sin(Math.PI * t),
    );
  }
  function panelGeometry(ring, t0, t1) {
    const rows = 5,
      columns = 12,
      vertices = [],
      normals = [],
      uvs = [],
      indices = [];
    for (let row = 0; row <= rows; row++)
      for (let col = 0; col <= columns; col++) {
        const t = t0 + ((t1 - t0) * row) / rows,
          v = -1 + (2 * col) / columns;
        const p = point(ring, t, v),
          sample = THREE.MathUtils.clamp(t, 0.0001, 0.9999);
        const dt = point(ring, sample + 0.00005, v).sub(
          point(ring, sample - 0.00005, v),
        );
        const dv = point(ring, sample, v + 0.00005).sub(
          point(ring, sample, v - 0.00005),
        );
        const n = dv.cross(dt).normalize();
        vertices.push(p.x, p.y, p.z);
        uvs.push((v + 1) * ring.width, t * 3.2);
        normals.push(n.x, n.y, n.z);
      }
    const count = vertices.length / 3;
    for (let i = 0; i < count; i++)
      vertices.push(
        vertices[i * 3] - normals[i * 3] * 0.045,
        vertices[i * 3 + 1] - normals[i * 3 + 1] * 0.045,
        vertices[i * 3 + 2] - normals[i * 3 + 2] * 0.045,
      );
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < columns; col++) {
        const a = row * (columns + 1) + col,
          b = a + 1,
          c = a + columns + 1,
          d = c + 1;
        indices.push(
          a,
          b,
          c,
          b,
          d,
          c,
          a + count,
          c + count,
          b + count,
          b + count,
          c + count,
          d + count,
        );
      }
    const rim = [];
    for (let c = 0; c <= columns; c++) rim.push(c);
    for (let r = 1; r <= rows; r++) rim.push(r * (columns + 1) + columns);
    for (let c = columns - 1; c >= 0; c--) rim.push(rows * (columns + 1) + c);
    for (let r = rows - 1; r > 0; r--) rim.push(r * (columns + 1));
    rim.forEach((a, i) => {
      const b = rim[(i + 1) % rim.length];
      indices.push(a, a + count, b, b, a + count, b + count);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute([...uvs, ...uvs], 2));
    g.setIndex(indices);
    // Analytic face normals match across panel joints instead of shading every joint as a rib.
    g.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(
        [...normals, ...normals.map((n) => -n)],
        3,
      ),
    );
    g.computeBoundingBox();
    const center = g.boundingBox.getCenter(new THREE.Vector3());
    g.translate(-center.x, -center.y, -center.z);
    return { g, center };
  }
  rings.forEach((ring, layer) => {
    for (let petal = 0; petal < 9; petal++) {
      const angle = (petal * Math.PI * 2) / 9 + (layer === 1 ? Math.PI / 9 : 0);
      const axis = new THREE.Vector3(0, 1, 0);
      for (let band = 0; band < ring.bands; band++) {
        const { g, center } = panelGeometry(
          ring,
          band / ring.bands + 0.0004,
          (band + 1) / ring.bands - 0.0004,
        );
        const mesh = new THREE.Mesh(g, marble[(petal + layer) % 4]);
        mesh.position.copy(center.applyAxisAngle(axis, angle));
        mesh.rotation.y = angle;
        k.add(mesh, ring.start + band * 0.13 + petal * 0.035, 0.42);
        shells.push(mesh);
      }
    }
  });
  // A restrained grove frames the flower without competing with the shell silhouette.
  for (const [i, [x, z, size]] of [
    [-4.55, -3.3, 0.8],
    [4.55, -3.3, 0.88],
    [-4.7, 2.85, 0.62],
    [4.7, 2.85, 0.66],
  ].entries())
    k.tree(x, z, size, 5.05 + i * 0.1);
  const model = k.finish({
    width: 11.8,
    halfHeight: 3.9,
    targetY: 1.48,
    polar: 1.05,
    angle: 0.37,
  });
  return { ...model, shells, petalCount: 27 };
}
