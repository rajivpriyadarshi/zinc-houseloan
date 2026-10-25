import * as THREE from "three";
import { furnitureKit } from "./homeFurniture.js";
import { createNewspaper } from "./newspaper.js";

/** Small domestic vignettes share their furniture's coordinate system and scale. */
export function createHomeResidents(materials) {
  const kit = furnitureKit(materials);
  const mat = (color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.86 });
  const skin = mat("#b18a6c"),
    hair = mat("#39352f"),
    trousers = mat("#43574e");
  const clay = mat("#b77c64"),
    sage = mat("#90a28b"),
    cream = mat("#c5b89d");
  function sphere(parent, r, position, material, scale = [1, 1, 1]) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function seated(shirt, { child = false, seat = 0.38 } = {}) {
    const root = new THREE.Group(),
      torso = new THREE.Group(),
      head = new THREE.Group();
    root.add(torso);
    torso.position.y = seat;
    const s = child ? 0.72 : 1;
    torso.scale.setScalar(s);
    kit.block(torso, [0.21, 0.075, 0.16], [0, 0, 0], trousers);
    kit.block(torso, [0.23, 0.28, 0.15], [0, 0.18, -0.015], shirt);
    torso.add(head);
    head.position.set(0, 0.43, -0.015);
    sphere(head, 0.09, [0, 0, 0], skin, [0.92, 1.06, 0.94]);
    sphere(head, 0.1, [0, 0.057, -0.017], hair, [0.97, 0.76, 1]);
    sphere(head, 0.082, [0, 0.01, -0.05], hair, [1, 0.79, 0.7]);
    const fringe = sphere(
      head,
      0.058,
      [-0.026, 0.082, 0.033],
      hair,
      [1.1, 0.6, 0.8],
    );
    fringe.rotation.z = -0.25;
    sphere(head, 0.019, [0, -0.005, 0.081], skin);
    const arms = [],
      knees = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group(),
        elbow = new THREE.Group();
      torso.add(shoulder);
      shoulder.position.set(side * 0.14, 0.28, -0.015);
      kit.block(shoulder, [0.067, 0.12, 0.075], [0, -0.045, 0], shirt);
      kit.block(shoulder, [0.048, 0.09, 0.05], [0, -0.13, 0], skin);
      shoulder.add(elbow);
      elbow.position.y = -0.17;
      kit.block(elbow, [0.047, 0.15, 0.05], [0, -0.07, 0], skin);
      sphere(elbow, 0.033, [0, -0.155, 0], skin);
      shoulder.rotation.x = -0.35;
      elbow.rotation.x = -1.05;
      arms.push({ shoulder, elbow });
      kit.block(
        torso,
        [0.085, 0.09, 0.25],
        [side * 0.064, -0.015, 0.105],
        trousers,
      );
      const knee = new THREE.Group();
      torso.add(knee);
      knee.position.set(side * 0.064, -0.02, 0.22);
      const shin = child ? 0.15 : 0.28;
      kit.block(knee, [0.075, shin, 0.08], [0, -shin / 2, 0], trousers);
      kit.block(
        knee,
        [0.09, 0.045, 0.16],
        [0, -shin, 0.035],
        materials.ceramic,
      );
      knees.push(knee);
    }
    return { root, torso, head, arms, knees };
  }
  function book(parent, tablet = false) {
    const g = new THREE.Group();
    parent.add(g);
    g.position.set(0, 0.12, 0.24);
    g.rotation.x = -0.32;
    if (tablet) {
      kit.block(g, [0.21, 0.018, 0.16], [0, 0, 0], materials.dark, 0.01);
      kit.block(g, [0.18, 0.004, 0.13], [0, 0.012, 0], sage, 0.005);
    } else {
      for (const side of [-1, 1]) {
        const page = new THREE.Group();
        g.add(page);
        page.rotation.z = side * -0.12;
        kit.block(
          page,
          [0.125, 0.018, 0.18],
          [side * 0.064, 0, 0],
          clay,
          0.004,
        );
        kit.block(
          page,
          [0.115, 0.012, 0.165],
          [side * 0.064, 0.014, 0],
          materials.ceramic,
          0.003,
        );
      }
    }
    return g;
  }
  const main = new THREE.Group();
  const viewer = seated(sage);
  main.add(viewer.root);
  viewer.root.position.set(-1.59, 0.2, -0.16);
  viewer.root.rotation.y = Math.PI / 2;
  const newspaper = createNewspaper();
  viewer.torso.add(newspaper.root);
  const tv = new THREE.Group();
  main.add(tv);
  tv.position.set(0.36, 1.15, -1.07);
  kit.block(tv, [0.83, 0.46, 0.045], [0, 0, 0], materials.dark, 0.02);
  kit.block(tv, [0.77, 0.4, 0.008], [0, 0, 0.027], mat("#8ca8a3"), 0.008);
  kit.block(tv, [0.77, 0.12, 0.01], [0, -0.14, 0.036], mat("#6b805e"), 0.003);
  sphere(tv, 0.047, [0.22, 0.1, 0.039], cream, [1, 1, 0.05]);
  const cloud = kit.block(
    tv,
    [0.19, 0.025, 0.01],
    [-0.13, 0.08, 0.04],
    materials.ceramic,
    0.01,
  );
  kit.block(tv, [0.055, 0.09, 0.04], [0, -0.275, 0], materials.dark);
  kit.block(tv, [0.29, 0.02, 0.15], [0, -0.31, 0], materials.dark);
  // A child and a few blocks occupy the clear floor in front of the coffee table.
  const child = seated(clay, { child: true, seat: 0.145 });
  main.add(child.root);
  child.root.position.set(-0.99, 0.2, 0.76);
  child.root.rotation.y = Math.PI / 2;
  const blocks = new THREE.Group();
  main.add(blocks);
  blocks.position.set(-0.56, 0.2, 0.73);
  for (const [x, y, z, color] of [
    [0, 0.045, 0, sage],
    [0, 0.13, 0, cream],
    [0.14, 0.045, 0.02, clay],
    [-0.08, 0.045, -0.13, cream],
  ])
    kit.block(blocks, [0.08, 0.08, 0.08], [x, y, z], color, 0.01);
  kit.block(blocks, [0.08, 0.08, 0.08], [0, 0.215, 0], clay, 0.01);
  // The moving block is held by the child's hand, so it cannot float away.
  kit.block(
    child.arms[1].elbow,
    [0.105, 0.105, 0.105],
    [0, -0.17, 0.03],
    sage,
    0.01,
  );
  const wing = new THREE.Group(),
    reader = seated(cream);
  wing.add(reader.root);
  reader.root.position.set(-3.48, 0.01, -0.44);
  book(reader.torso);
  const upper = new THREE.Group(),
    lounger = seated(clay, { seat: 0.41 });
  upper.add(lounger.root);
  lounger.root.position.set(-0.6, 2.03, 0.38);
  book(lounger.torso, true);
  function seek(time) {
    const pageTurn = newspaper.seek(time, viewer.arms);
    // Lean into the paper, scan its columns, and glance up between editions.
    const glance = Math.pow(Math.max(0, Math.sin((time * Math.PI) / 5)), 12);
    viewer.torso.rotation.x = 0.055 + Math.sin(time * 0.65) * 0.012;
    viewer.torso.rotation.z = Math.sin(time * 0.43) * 0.016;
    viewer.head.rotation.y = Math.sin(time * 1.1) * 0.11 - pageTurn * 0.1;
    viewer.head.rotation.x =
      0.26 - glance * 0.18 + Math.sin(time * 0.7) * 0.025;
    viewer.knees[0].rotation.x = -0.08 + Math.sin(time * 1.25) * 0.045;
    viewer.knees[1].rotation.x = 0.035;
    cloud.position.x = -0.13 + Math.sin(time * 0.17) * 0.09;
    for (const [person, offset] of [
      [reader, 0],
      [lounger, 1.4],
    ]) {
      person.head.rotation.x = 0.22 + Math.sin(time * 0.55 + offset) * 0.035;
      person.head.rotation.y = Math.sin(time * 0.4 + offset) * 0.06;
      person.arms[0].elbow.rotation.x =
        -1.05 + Math.sin(time * 0.5 + offset) * 0.045;
    }
    const cycle = (time % 6) / 6;
    const lift = Math.pow(Math.max(0, Math.sin(cycle * Math.PI * 2)), 2);
    child.head.rotation.x = 0.17 + lift * 0.1;
    child.arms[1].shoulder.rotation.x = -0.35 - lift * 0.42;
    child.arms[1].elbow.rotation.x = -1.05 + lift * 0.2;
  }
  seek(0);
  return { main, wing, upper, seek, viewer, reader, child, lounger, newspaper };
}
