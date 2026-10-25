import * as THREE from "three";
import { citySurface } from "./cityMaterials.js";
import { landmarkKit } from "./landmarkKit.js";

/** Gateway of India: a hollow waterfront arch, side galleries and four domed turrets. */
export function createMumbaiModel() {
  const k = landmarkKit("#bea07a", "sandstone");
  const { block, cylinder, dome, tree, trim, stones, palette, lawn } = k;
  k.plinth(9.2, 6.5);
  const water = citySurface("water", "#6a9692");
  block(9.05, 0.035, 1.4, 0, -0.105, -2.48, water, 0.15, 0.12);
  for (let i = 0; i < 5; i++)
    block(
      1.2 + i * 0.18,
      0.004,
      0.014,
      -3.2 + i * 1.4,
      -0.081,
      -2.65 + (i % 2) * 0.3,
      trim,
      0.3 + i * 0.06,
      0.08,
    );
  for (let i = 0; i < 3; i++)
    block(
      6.8 - i * 0.14,
      0.07,
      3.7 - i * 0.15,
      0,
      -0.04 + i * 0.07,
      0.12,
      trim,
      0.2 + i * 0.1,
      0.25,
    );
  k.arch({
    halfWidth: 1.77,
    bottom: 0.19,
    height: 4.04,
    spring: 2.25,
    r: 0.89,
    rise: 1.2,
    depth: 1.78,
    time: 0.65,
  });
  // Smaller open passages connect the side galleries to the central gate.
  for (const side of [-1, 1]) {
    k.arch({
      x: side * 2.32,
      z: 0,
      halfWidth: 0.55,
      bottom: 0.19,
      height: 2.76,
      spring: 1.43,
      r: 0.34,
      rise: 0.52,
      depth: 1.44,
      time: 0.65,
    });
    for (let i = 0; i < 4; i++)
      block(
        0.29,
        0.14,
        1.66,
        side * 2.32 - 0.44 + i * 0.29,
        2.85,
        0,
        trim,
        2.8 + i * 0.03,
      );
    block(1.2, 0.12, 1.81, side * 2.32, 2.99, 0, trim, 3.02);
    for (let i = 0; i < 5; i++)
      block(
        0.09,
        0.28,
        0.09,
        side * 2.32 - 0.46 + i * 0.23,
        3.17,
        0.77,
        trim,
        3.2 + i * 0.03,
      );
    block(1.2, 0.08, 0.17, side * 2.32, 3.34, 0.77, trim, 3.45);
  }
  // The projecting cornice and perforated parapet distinguish it from Delhi's solid crown.
  for (const [w, h, d, y, t] of [
    [3.72, 0.14, 2, 4.12, 3.2],
    [3.94, 0.12, 2.14, 4.25, 3.4],
    [3.7, 0.2, 1.9, 4.42, 3.6],
  ])
    for (let i = 0; i < 10; i++)
      block(
        w / 10 - 0.007,
        h,
        d,
        -w / 2 + ((i + 0.5) * w) / 10,
        y,
        0,
        trim,
        t + i * 0.02,
      );
  for (const z of [-0.96, 0.96]) {
    for (let i = 0; i < 15; i++)
      block(
        0.08,
        0.28,
        0.09,
        -1.74 + i * 0.248,
        4.66,
        z,
        trim,
        3.9 + i * 0.015,
      );
    block(3.7, 0.075, 0.16, 0, 4.84, z, trim, 4.2);
  }
  // Four octagonal corner towers: stacked drums, open pavilions and lotus-like caps.
  for (const x of [-1.72, 1.72])
    for (const z of [-0.87, 0.87]) {
      for (let row = 0; row < 18; row++)
        cylinder(
          0.245,
          0.245,
          0.205,
          x,
          0.31 + row * 0.21,
          z,
          stones[row % 5],
          0.85 + row * 0.14,
          8,
        );
      for (const y of [0.35, 2.75, 3.7, 4.12])
        cylinder(0.31, 0.31, 0.1, x, y, z, trim, 1.1 + y * 0.7, 8);
      cylinder(0.38, 0.32, 0.16, x, 4.27, z, trim, 3.85, 8);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        cylinder(
          0.035,
          0.035,
          0.47,
          x + Math.cos(a) * 0.25,
          4.58,
          z + Math.sin(a) * 0.25,
          trim,
          4.05 + i * 0.025,
          8,
        );
      }
      cylinder(0.38, 0.38, 0.08, x, 4.85, z, trim, 4.3, 16);
      dome(x, 4.9, z, 0.37, 0.44, 4.45 + (z < 0 ? 0.12 : 0));
    }
  // A low central dome is visible behind the front parapet.
  dome(0, 4.2, -0.03, 0.74, 0.66, 4.05);
  for (const side of [-1, 1]) {
    block(1.08, 0.035, 1.36, side * 3.72, -0.105, 1.72, lawn, 0.35, 0.12);
    tree(side * 3.7, 1.55, 0.75, 5.0 + (side > 0 ? 0.15 : 0));
    block(0.9, 0.11, 0.34, side * 3.42, 0.02, -1.24, trim, 4.9);
  }
  return k.finish({
    width: 10.4,
    halfHeight: 4.05,
    targetY: 2.35,
    polar: 1.18,
    angle: 0.37,
  });
}
