import * as THREE from "three";

// Deterministic, seamless surface maps: the model stays self-contained and loads locally.
function surface(kind) {
  const size = 256,
    pixels = new Uint8Array(size * size * 4);
  const tau = Math.PI * 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size;
      const noise =
        (((Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1) + 1) % 1;
      const drift = Math.sin(v * tau) * 0.018 + Math.sin(v * tau * 3) * 0.006;
      let tone;
      if (kind === "oak") {
        const grain = Math.sin((u + drift) * tau * 36);
        const broad = Math.sin((u + drift * 2) * tau * 7);
        tone = 213 + grain * 11 + broad * 17 + noise * 9;
      } else if (kind === "stone") {
        const vein = Math.abs(
          Math.sin((u + v * 2 + Math.sin(v * tau) * 0.12) * tau * 3),
        );
        tone = 229 - Math.pow(1 - vein, 14) * 40 + (noise - 0.5) * 15;
      } else if (kind === "linen") {
        tone =
          215 +
          Math.sin((x * Math.PI) / 2) * 13 +
          Math.sin((y * Math.PI) / 2) * 13 +
          noise * 10;
      } else {
        tone = 230 + (noise - 0.5) * 26;
      }
      const i = (y * size + x) * 4;
      pixels[i] =
        pixels[i + 1] =
        pixels[i + 2] =
          Math.max(0, Math.min(255, tone));
      pixels[i + 3] = 255;
    }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function createHomeMaterials() {
  const oak = surface("oak"),
    stone = surface("stone"),
    linen = surface("linen"),
    plaster = surface("plaster");
  const material = (color, roughness, map, bumpScale = 0.008, extra = {}) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness,
      ...(map ? { map, bumpMap: map, bumpScale } : {}),
      ...extra,
    });
  return {
    stone: material("#c5bba8", 0.64, stone, 0.012),
    plaster: material("#e4dfd3", 0.84, plaster, 0.008),
    concrete: material("#77786e", 0.86, plaster, 0.018),
    wood: material("#8b6849", 0.49, oak, 0.012),
    woodLight: material("#b18c61", 0.55, oak, 0.009),
    dark: material("#303c36", 0.4, undefined, 0, { metalness: 0.35 }),
    roofMetal: material("#46564d", 0.38, plaster, 0.003, { metalness: 0.55 }),
    brass: material("#b39a63", 0.3, undefined, 0, { metalness: 0.8 }),
    glass: material("#b5cec4", 0.08, undefined, 0, {
      transparent: true,
      opacity: 0.16,
      metalness: 0.3,
      depthWrite: false,
    }),
    cushion: material("#d8cebb", 0.98, linen, 0.018),
    accent: material("#596a57", 0.97, linen, 0.014),
    leather: material("#94674d", 0.66, plaster, 0.007),
    rug: material("#b9ad98", 1, linen, 0.025),
    ceramic: material("#e2dacb", 0.28),
  };
}
