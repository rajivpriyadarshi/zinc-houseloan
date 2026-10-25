import * as THREE from "three";
import { furnitureKit } from "./homeFurniture.js";

/** Two quiet lanes, with a pause to turn before each return length. */
export function createPoolSwimmers(materials) {
  const root = new THREE.Group(),
    kit = furnitureKit(materials);
  const mat = (color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.72 });
  const skin = [mat("#ba8e6b"), mat("#aa795c")];
  const hair = mat("#36352f"),
    suits = [mat("#486e68"), mat("#ae715f")];
  function oval(parent, radius, position, material, scale = [1, 1, 1]) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 16, 12),
      material,
    );
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function swimmer(index) {
    const carrier = new THREE.Group(),
      body = new THREE.Group();
    root.add(carrier);
    carrier.add(body);
    body.scale.setScalar(0.78);
    oval(
      body,
      0.12,
      [0, -0.025, 0.035],
      index ? suits[index] : skin[index],
      [1.03, 0.61, 1.65],
    );
    oval(body, 0.105, [0, -0.025, -0.145], suits[index], [1, 0.62, 1.12]);
    oval(body, 0.043, [0, 0.005, 0.23], skin[index], [1, 0.85, 1.1]);
    const head = new THREE.Group();
    body.add(head);
    head.position.set(0, 0.05, 0.32);
    oval(head, 0.082, [0, 0, 0], skin[index], [0.87, 0.82, 1.08]);
    oval(head, 0.084, [0, 0.035, -0.02], hair, [0.94, 0.66, 1]);
    if (index) oval(head, 0.042, [0, 0.066, -0.075], hair, [1, 0.9, 1]);
    for (const side of [-1, 1])
      kit.block(
        head,
        [0.043, 0.025, 0.021],
        [side * 0.034, 0.012, 0.075],
        materials.dark,
        0.008,
      );
    kit.block(
      head,
      [0.035, 0.012, 0.015],
      [0, 0.012, 0.08],
      suits[index],
      0.004,
    );
    const arms = [],
      legs = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group(),
        elbow = new THREE.Group();
      body.add(shoulder);
      shoulder.position.set(side * 0.145, -0.007, 0.13);
      oval(shoulder, 0.036, [0, 0, 0.09], skin[index], [1, 0.9, 2.65]);
      shoulder.add(elbow);
      elbow.position.z = 0.18;
      oval(elbow, 0.029, [0, 0, 0.08], skin[index], [1, 0.9, 2.8]);
      oval(elbow, 0.033, [0, 0, 0.175], skin[index], [0.85, 0.5, 1.15]);
      arms.push({ shoulder, elbow, side });
      const hip = new THREE.Group(),
        knee = new THREE.Group();
      body.add(hip);
      hip.position.set(side * 0.059, -0.025, -0.19);
      oval(hip, 0.042, [0, 0, -0.08], skin[index], [1, 0.85, 2.2]);
      hip.add(knee);
      knee.position.z = -0.16;
      oval(knee, 0.031, [0, 0, -0.08], skin[index], [1, 0.9, 2.75]);
      oval(knee, 0.036, [0, 0.007, -0.175], skin[index], [0.8, 0.5, 1.5]);
      legs.push({ hip, knee, side });
    }
    const wakes = [];
    for (let i = 0; i < 2; i++) {
      const geometry = new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 48 }, (_, j) => {
          const a = (j / 48) * Math.PI * 2;
          return new THREE.Vector3(Math.cos(a) * 0.17, 0, Math.sin(a) * 0.24);
        }),
      );
      const line = new THREE.LineLoop(
        geometry,
        new THREE.LineBasicMaterial({
          color: "#c1d8ca",
          transparent: true,
          opacity: 0.15,
          depthWrite: false,
        }),
      );
      line.position.set(0, 0.012, -0.21 - i * 0.1);
      carrier.add(line);
      wakes.push(line);
    }
    return { carrier, body, head, arms, legs, wakes };
  }
  const swimmers = [swimmer(0), swimmer(1)];
  const smooth = (u) => u * u * (3 - 2 * u);
  function seek(time) {
    swimmers.forEach((person, index) => {
      const phase = (((time + index * 8) % 16) + 16) % 16;
      let z,
        yaw,
        turning = false;
      if (phase < 6) {
        z = THREE.MathUtils.lerp(-0.78, 0.78, smooth(phase / 6));
        yaw = 0;
      } else if (phase < 8) {
        z = 0.78;
        yaw = Math.PI * smooth((phase - 6) / 2);
        turning = true;
      } else if (phase < 14) {
        z = THREE.MathUtils.lerp(0.78, -0.78, smooth((phase - 8) / 6));
        yaw = Math.PI;
      } else {
        z = -0.78;
        yaw = Math.PI + Math.PI * smooth((phase - 14) / 2);
        turning = true;
      }
      person.carrier.position.set(index ? 4.58 : 3.52, 0, z);
      person.carrier.rotation.y = yaw;
      const stroke = time * Math.PI + index * Math.PI;
      person.body.position.y = Math.sin(stroke * 2) * 0.005;
      person.body.rotation.z = Math.sin(stroke) * 0.035;
      person.head.rotation.z = Math.sin(stroke) * 0.13;
      for (const { shoulder, elbow, side } of person.arms) {
        const a = stroke + (side > 0 ? Math.PI : 0);
        shoulder.rotation.x = a;
        shoulder.rotation.y = side * 0.12;
        elbow.rotation.x = Math.max(0, Math.sin(a)) * 0.55;
      }
      for (const { hip, knee, side } of person.legs) {
        const kick = Math.sin(stroke * 2 + (side > 0 ? Math.PI : 0));
        hip.rotation.x = kick * 0.12;
        knee.rotation.x = Math.max(0, -kick) * 0.18;
      }
      person.wakes.forEach((line, i) => {
        const p = (((time / 1.6 + i * 0.5 + index * 0.25) % 1) + 1) % 1;
        line.scale.setScalar(0.7 + p * 0.65);
        line.material.opacity = Math.sin(p * Math.PI) * (turning ? 0.08 : 0.18);
      });
    });
  }
  seek(0);
  return { root, swimmers, seek };
}
