import * as THREE from "three";

export function createNewspaper() {
  let texture;
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#e8e3d5";
    ctx.fillRect(0, 0, 384, 512);
    ctx.fillStyle = "#465048";
    ctx.textAlign = "center";
    ctx.font = "bold 40px Georgia";
    ctx.fillText("THE DAILY", 192, 58);
    ctx.fillRect(22, 75, 340, 3);
    ctx.font = "18px Georgia";
    ctx.fillText("LIFE  ·  HOME  ·  WEEKEND", 192, 106);
    ctx.fillRect(22, 124, 340, 2);
    ctx.fillStyle = "#93a08a";
    ctx.fillRect(23, 145, 156, 104);
    ctx.fillStyle = "#65765f";
    ctx.beginPath();
    ctx.moveTo(23, 249);
    ctx.lineTo(75, 181);
    ctx.lineTo(132, 222);
    ctx.lineTo(179, 189);
    ctx.lineTo(179, 249);
    ctx.fill();
    ctx.fillStyle = "#697168";
    for (let col = 0; col < 2; col++)
      for (let row = 0; row < 27; row++) {
        const y = 150 + row * 12;
        if (col === 0 && y < 265) continue;
        ctx.fillRect(
          23 + col * 179,
          y,
          row % 7 === 6 ? 108 : 155,
          row % 9 === 0 ? 5 : 3,
        );
      }
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  const material = new THREE.MeshStandardMaterial({
    color: texture ? "#ffffff" : "#e8e3d5",
    ...(texture ? { map: texture } : {}),
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const root = new THREE.Group();
  root.position.set(0, 0.205, 0.22);
  root.rotation.x = -0.3;
  function page(side, mat = material) {
    const hinge = new THREE.Group();
    const geometry = new THREE.PlaneGeometry(0.25, 0.31, 8, 1);
    // A small bow prevents the spread reading as a rigid rectangular board.
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i) + side * 0.125;
      positions.setX(i, x);
      positions.setZ(i, Math.sin((Math.abs(x) / 0.25) * Math.PI) * 0.009);
    }
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = true;
    hinge.add(mesh);
    root.add(hinge);
    return hinge;
  }
  const left = page(-1),
    right = page(1);
  left.rotation.y = -0.14;
  right.rotation.y = 0.14;
  const turnMaterial = material.clone();
  turnMaterial.transparent = true;
  turnMaterial.depthWrite = false;
  const turning = page(1, turnMaterial);
  turning.position.z = 0.003;
  const grip = new THREE.Vector3(),
    localGrip = new THREE.Vector3();
  const restAxis = new THREE.Vector3(0, -1, 0);
  function hold(arm, target, side) {
    // Two-bone reach keeps each hand attached while the paper and torso shift.
    const direction = target.clone().sub(arm.shoulder.position);
    const distance = THREE.MathUtils.clamp(direction.length(), 0.06, 0.323);
    direction.normalize();
    const upper = 0.17,
      lower = 0.155;
    const along =
      (upper * upper - lower * lower + distance * distance) / (2 * distance);
    const pole = new THREE.Vector3(side, -0.65, 0);
    pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    const elbow = arm.shoulder.position
      .clone()
      .addScaledVector(direction, along)
      .addScaledVector(
        pole,
        Math.sqrt(Math.max(0, upper * upper - along * along)),
      );
    arm.shoulder.quaternion.setFromUnitVectors(
      restAxis,
      elbow.clone().sub(arm.shoulder.position).normalize(),
    );
    const forearm = target
      .clone()
      .sub(elbow)
      .normalize()
      .applyQuaternion(arm.shoulder.quaternion.clone().invert());
    arm.elbow.quaternion.setFromUnitVectors(restAxis, forearm);
  }
  function seek(time, arms) {
    const t = ((time % 10) + 10) % 10;
    const u = THREE.MathUtils.clamp((t - 7.3) / 1.45, 0, 1);
    const ease = u * u * (3 - 2 * u);
    turning.visible = t >= 7.3 && t <= 8.75;
    turning.rotation.y = THREE.MathUtils.lerp(0.14, -Math.PI - 0.14, ease);
    turnMaterial.opacity = 1 - THREE.MathUtils.smoothstep(u, 0.88, 1);
    root.rotation.x = -0.3 + Math.sin(time * 0.8) * 0.025;
    root.rotation.z = Math.sin(time * 0.55) * 0.018;
    root.position.y = 0.205 + Math.sin(time * 1.35) * 0.004;
    root.updateMatrix();
    [left, right].forEach((leaf, i) => {
      const side = i ? 1 : -1;
      leaf.updateMatrix();
      grip.set(side * 0.195, -0.085, 0).applyMatrix4(leaf.matrix);
      if (i && turning.visible && u < 0.42) {
        turning.updateMatrix();
        localGrip.set(0.195, -0.085, 0).applyMatrix4(turning.matrix);
        grip.lerp(localGrip, Math.sin((u / 0.42) * Math.PI));
      }
      grip.applyMatrix4(root.matrix);
      hold(arms[i], grip, side);
    });
    return turning.visible ? Math.sin(Math.PI * u) : 0;
  }
  return { root, seek, turning };
}
