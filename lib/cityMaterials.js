import * as THREE from "three";

// Local, repeatable PBR surfaces: colour, micro-relief and roughness share the same grain.
function hash(x, y) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function noise(u, v, f) {
  const x = u * f,
    y = v * f,
    ix = Math.floor(x),
    iy = Math.floor(y);
  const a = x - ix,
    b = y - iy,
    s = a * a * (3 - 2 * a),
    t = b * b * (3 - 2 * b);
  const h = (i, j) => hash((i + f) % f, (j + f) % f);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(h(ix, iy), h(ix + 1, iy), s),
    THREE.MathUtils.lerp(h(ix, iy + 1), h(ix + 1, iy + 1), s),
    t,
  );
}
function maps(kind) {
  const size = ["granite", "sandstone", "marble"].includes(kind) ? 512 : 256;
  const colour = new Uint8Array(size * size * 4),
    surface = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size,
        fine = hash(x, y),
        broad = noise(u, v, 8),
        medium = noise(u, v, 32),
        grain = noise(u, v, 128);
      let tone = 0.88,
        height = 0.5,
        rough = 0.8,
        warm = 0;
      if (kind === "granite") {
        const fleck =
          grain > 0.64
            ? (grain - 0.64) * 1.1
            : grain < 0.32
              ? -(0.32 - grain) * 1.4
              : 0;
        tone =
          0.91 +
          (broad - 0.5) * 0.04 +
          (medium - 0.5) * 0.05 +
          fleck * .4 +
          (fine - 0.5) * 0.035;
        height = 0.5 + (grain - 0.5) * 0.32 + (fine - 0.5) * 0.12;
        rough = 0.72 + (medium - 0.5) * 0.2;
        warm = (broad - 0.5) * 0.018;
      } else if (kind === "sandstone") {
        const bed =
          noise(u, v, 16) * 0.6 +
          Math.sin(v * Math.PI * 32 + (broad - 0.5) * 1.1) * 0.025;
        tone = 0.83 + bed * 0.16 + (medium - 0.5) * 0.1 + (fine - 0.5) * 0.065;
        const pore = fine < 0.035 ? 0.1 : 0;
        height = 0.5 + (medium - 0.5) * 0.22 + (grain - 0.5) * 0.19 - pore;
        rough = 0.84 + (grain - 0.5) * 0.15;
        warm = 0.015;
      } else if (kind === "marble") {
        const flow = Math.sin(
          u * Math.PI * 6 +
            Math.sin(v * Math.PI * 2) * 1.2 +
            Math.sin(v * Math.PI * 6) * 0.24 +
            (broad - 0.5) * 0.8,
        );
        const vein = Math.pow(1 - Math.abs(flow), 18);
        tone =
          0.96 - vein * 0.105 + (broad - 0.5) * 0.035 + (fine - 0.5) * 0.014;
        height = 0.5 - vein * 0.028 + (grain - 0.5) * 0.035;
        rough = 0.46 + vein * 0.12 + (medium - 0.5) * 0.1;
      } else if (kind === "lawn") {
        tone =
          0.79 +
          (broad - 0.5) * 0.15 +
          (medium - 0.5) * 0.16 +
          (fine - 0.5) * 0.14;
        height = 0.5 + (grain - 0.5) * 0.4 + (fine - 0.5) * 0.28;
        rough = 0.95;
      } else if (kind === "leaf") {
        tone =
          0.83 +
          (broad - 0.5) * 0.18 +
          (medium - 0.5) * 0.15 +
          (grain - 0.5) * 0.1;
        height = 0.5 + (medium - 0.5) * 0.22;
        rough = 0.84 + (grain - 0.5) * 0.15;
      } else if (kind === "bark") {
        const rib = Math.sin(
          u * Math.PI * 38 + Math.sin(v * Math.PI * 2) * 0.7,
        );
        tone = 0.82 + rib * 0.09 + (grain - 0.5) * 0.12;
        height = 0.5 + rib * 0.22 + (grain - 0.5) * 0.14;
        rough = 0.9;
      } else if (kind === "water") {
        const ripple =
          Math.sin(u * Math.PI * 12 + Math.sin(v * Math.PI * 4) * 0.8) *
          Math.cos(v * Math.PI * 10);
        tone = 0.91 + ripple * 0.035 + (broad - 0.5) * 0.07;
        height = 0.5 + ripple * 0.1;
        rough = 0.19 + (broad - 0.5) * 0.08;
      }
      const index = (y * size + x) * 4,
        byte = (n) => Math.round(THREE.MathUtils.clamp(n, 0, 1) * 255);
      colour[index] = byte(tone + warm);
      colour[index + 1] = byte(tone);
      colour[index + 2] = byte(tone - warm);
      colour[index + 3] = 255;
      surface[index] = byte(height);
      surface[index + 1] = byte(rough);
      surface[index + 2] = 128;
      surface[index + 3] = 255;
    }
  function texture(data, srgb = false) {
    const t = new THREE.DataTexture(data, size, size);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }
  return { colour: texture(colour, true), surface: texture(surface) };
}
export function citySurface(kind, color) {
  const texture = maps(kind);
  return new THREE.MeshStandardMaterial({
    color,
    map: texture.colour,
    bumpMap: texture.surface,
    roughnessMap: texture.surface,
    roughness: 1,
    bumpScale: {
      granite: 0.004,
      sandstone: 0.008,
      marble: 0.006,
      lawn: 0.008,
      leaf: 0.006,
      bark: 0.018,
      water: 0.013,
    }[kind],
    metalness: kind === "water" ? 0.12 : 0,
  });
}
export function createCityMaterials(color, kind) {
  const stone = citySurface(kind, color),
    lawn = citySurface("lawn", "#58714b"),
    leaf = citySurface("leaf", "#637d50");
  return {
    stone,
    lawn,
    leaves: ["#506c48", "#718557", "#8b9964"].map((c) => {
      const m = leaf.clone();
      m.color.set(c);
      return m;
    }),
    wood: citySurface("bark", "#816a4d"),
    brass: new THREE.MeshStandardMaterial({ color: "#b49b61", roughness: .38, metalness: .75 }),
    dark: new THREE.MeshStandardMaterial({
      color: "#34413b",
      roughness: 0.68,
      metalness: 0.12,
    }),
  };
}
