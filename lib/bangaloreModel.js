import { landmarkKit } from "./landmarkKit.js";

/** Vidhana Soudha: broad granite wings, ceremonial steps, colonnade and five domes. */
export function createBangaloreModel() {
  const k = landmarkKit("#c2bba6", "granite");
  const { block, cylinder, courses, dome, tree, palette, trim, stones, lawn } =
    k;
  k.plinth(11.4, 6);
  for (const side of [-1, 1]) {
    block(3.1, 0.035, 1.25, side * 3.5, -0.105, 1.97, lawn, 0.22, 0.1);
    block(0.85, 0.035, 4.9, side * 5.02, -0.105, -0.05, lawn, 0.28, 0.1);
  }
  // Ascending stone treads reveal the entrance before the facade starts to rise.
  for (let i = 0; i < 9; i++)
    block(
      3.5 - i * 0.035,
      0.075,
      2.1 - i * 0.16,
      0,
      -0.04 + i * 0.075,
      1.25,
      trim,
      0.25 + i * 0.065,
      0.25,
    );
  courses(8.7, 2.6, 1.85, 0, 0.04, -0.47, 0.6, 13, 24);
  // Deep-set windows and slender piers give both wings a readable rhythm.
  for (const side of [-1, 1])
    for (let col = 0; col < 5; col++)
      for (let floor = 0; floor < 3; floor++) {
        const x = side * (1.85 + col * 0.52),
          y = 0.48 + floor * 0.77,
          t = 1.25 + floor * 0.48 + col * 0.035;
        block(0.31, 0.46, 0.045, x, y, 0.479, palette.dark, t);
        block(0.37, 0.055, 0.12, x, y + 0.26, 0.49, trim, t + 0.1);
        block(0.37, 0.055, 0.12, x, y - 0.26, 0.49, trim, t + 0.12);
        block(0.024, 0.46, 0.022, x, y, 0.51, trim, t + 0.14);
      }
  for (const y of [0.84, 1.61, 2.67, 2.84])
    for (let i = 0; i < 24; i++)
      block(
        0.377,
        0.095,
        y > 2.6 ? 2.08 : 1.98,
        -4.34 + i * 0.377,
        y,
        -0.47,
        trim,
        2.2 + y * 0.3 + i * 0.01,
      );
  block(3.1, 0.13, 1.1, 0, 0.66, 0.9, trim, 1.8);
  for (let i = 0; i < 12; i++) {
    const x = -1.42 + i * 0.258,
      t = 1.65 + i * 0.045;
    cylinder(0.075, 0.1, 0.14, x, 0.79, 1.27, trim, t);
    for (let j = 0; j < 7; j++)
      cylinder(
        0.06,
        0.066,
        0.22,
        x,
        0.97 + j * 0.22,
        1.27,
        stones[j % 5],
        t + 0.15 + j * 0.1,
        12,
      );
    cylinder(0.105, 0.075, 0.14, x, 2.47, 1.27, trim, 2.65 + i * 0.025);
  }
  for (const [w, h, y, t] of [
    [3.35, 0.15, 2.61, 3],
    [3.48, 0.1, 2.74, 3.15],
    [3.2, 0.28, 2.93, 3.3],
    [3.45, 0.12, 3.13, 3.5],
  ])
    for (let i = 0; i < 9; i++)
      block(
        w / 9 - 0.006,
        h,
        1.2,
        -w / 2 + ((i + 0.5) * w) / 9,
        y,
        0.9,
        trim,
        t + i * 0.02,
      );
  // Small balustrades finish the roofline without filling the silhouette with clutter.
  for (const side of [-1, 1])
    for (let i = 0; i < 11; i++) {
      const x = side * (1.8 + i * 0.235);
      block(0.065, 0.23, 0.08, x, 2.99, 0.54, trim, 3.35 + i * 0.016);
    }
  for (const side of [-1, 1])
    block(2.6, 0.065, 0.16, side * 3, 3.13, 0.54, trim, 3.65);
  for (const x of [-3.8, 3.8])
    for (const z of [-1.12, 0.35]) {
      block(0.78, 0.24, 0.78, x, 2.94, z, trim, 3.55);
      cylinder(0.3, 0.34, 0.32, x, 3.22, z, stones[2], 3.85, 16);
      cylinder(0.39, 0.39, 0.075, x, 3.42, z, trim, 4.05, 16);
      dome(x, 3.46, z, 0.38, 0.49, 4.1 + (z < 0 ? 0.1 : 0));
    }
  cylinder(0.63, 0.7, 0.4, 0, 3.34, 0.07, stones[2], 3.85, 32);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    cylinder(
      0.055,
      0.055,
      0.35,
      Math.cos(a) * 0.66,
      3.34,
      0.07 + Math.sin(a) * 0.66,
      trim,
      3.95 + i * 0.02,
      8,
    );
  }
  cylinder(0.77, 0.77, 0.1, 0, 3.59, 0.07, trim, 4.15, 32);
  dome(0, 3.64, 0.07, 0.76, 0.86, 4.3);
  // A small sculptural crown suggests the national emblem above the central dome.
  cylinder(0.095, 0.14, 0.15, 0, 4.79, 0.07, palette.brass, 4.95, 12);
  for (const x of [-0.065, 0.065])
    cylinder(0.055, 0.065, 0.13, x, 4.92, 0.07, palette.brass, 5.05, 8);
  for (const [i, [x, z, s]] of [
    [-5, -1.9, 0.9],
    [-4.85, 1.5, 0.72],
    [5, -1.7, 0.85],
    [4.95, 1.5, 0.67],
  ].entries())
    tree(x, z, s, 4.85 + i * 0.12);
  return k.finish({
    width: 12.3,
    halfHeight: 3.7,
    targetY: 1.85,
    polar: 1.12,
    angle: 0.31,
  });
}
