import * as THREE from "three";

/** A seated companion beside the front steps, with quiet tail and ear motion. */
export function createPlannerDog() {
  const root = new THREE.Group();
  const mat = (color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.88 });
  const fur = mat("#c9aa7e"),
    cream = mat("#e1c79e"),
    ear = mat("#956c49"),
    dark = mat("#302f29"),
    collar = mat("#6c8164");
  const sphere = new THREE.SphereGeometry(1, 16, 12);
  function oval(parent, material, position, scale) {
    const mesh = new THREE.Mesh(sphere, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  // Haunches rest on the ground; the upright chest sits over two straight front legs.
  oval(root, fur, [0, 0.15, -0.075], [0.135, 0.15, 0.155]);
  const chest = oval(root, fur, [0, 0.32, 0.015], [0.105, 0.18, 0.115]);
  chest.rotation.x = -0.16;
  oval(root, cream, [0, 0.32, 0.1], [0.075, 0.13, 0.045]);
  const paws = [];
  for (const side of [-1, 1]) {
    oval(root, fur, [side * 0.104, 0.085, -0.075], [0.065, 0.085, 0.1]);
    paws.push(
      oval(root, cream, [side * 0.13, 0.024, 0.005], [0.047, 0.024, 0.075]),
    );
    const leg = oval(
      root,
      fur,
      [side * 0.064, 0.16, 0.125],
      [0.03, 0.135, 0.035],
    );
    leg.rotation.x = -0.08;
    paws.push(
      oval(root, cream, [side * 0.064, 0.024, 0.155], [0.035, 0.024, 0.055]),
    );
  }
  const head = new THREE.Group();
  head.position.set(0, 0.5, 0.09);
  root.add(head);
  oval(head, fur, [0, 0, 0], [0.105, 0.11, 0.115]);
  oval(head, cream, [0, -0.035, 0.105], [0.072, 0.055, 0.09]);
  oval(head, dark, [0, -0.014, 0.179], [0.029, 0.022, 0.021]);
  const ears = [];
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(side * 0.092, 0.045, -0.008);
    head.add(hinge);
    const flap = oval(
      hinge,
      ear,
      [side * 0.006, -0.075, 0],
      [0.035, 0.103, 0.057],
    );
    flap.rotation.z = side * 0.15;
    ears.push({ hinge, side });
    oval(head, dark, [side * 0.061, 0.027, 0.082], [0.012, 0.014, 0.01]);
  }
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.084, 0.012, 8, 20),
    collar,
  );
  band.rotation.x = Math.PI / 2;
  band.position.set(0, 0.425, 0.045);
  root.add(band);
  const tail = new THREE.Group();
  tail.position.set(0, 0.095, -0.19);
  root.add(tail);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.07, -0.01, -0.075),
    new THREE.Vector3(0.17, 0.015, -0.14),
    new THREE.Vector3(0.23, 0.07, -0.16),
  ]);
  const tailMesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 18, 0.026, 8, false),
    fur,
  );
  tailMesh.castShadow = true;
  tail.add(tailMesh);
  oval(tail, cream, [0.23, 0.07, -0.16], [0.027, 0.027, 0.027]);
  let time = 0;
  function update(dt, { building = false, reduced = false, hut = false } = {}) {
    root.visible = !building;
    if (building) return;
    root.position.set(-0.6, -0.36, hut ? 2.08 : 2.6);
    root.rotation.y = 0.38;
    if (!reduced) time += dt;
    const wag = 0.24 + 0.07 * Math.sin(time * 0.7);
    tail.rotation.y = reduced ? 0 : Math.sin(time * 3.8) * wag;
    tail.rotation.z = reduced ? 0 : Math.sin(time * 3.8 - 0.4) * 0.035;
    for (const { hinge, side } of ears) {
      const phase = (time + (side > 0 ? 2.3 : 0)) % 6.5;
      const twitch =
        phase < 0.7
          ? Math.sin((Math.PI * phase) / 0.7) ** 2 * Math.sin(phase * 15)
          : 0;
      hinge.rotation.z = reduced ? 0 : side * twitch * 0.14;
      hinge.rotation.x = reduced ? 0 : twitch * 0.07;
    }
  }
  root.visible = false;
  return { root, update, paws, tail, ears };
}
