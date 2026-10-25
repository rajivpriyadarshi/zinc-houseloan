import * as THREE from "three";
import { ConvexHull } from "three/addons/math/ConvexHull.js";

// Measure only the built tier; hidden wings and landscape upgrades must not shrink a small home.
export function visibleHomeCorners(root) {
  root.updateMatrixWorld(true);
  const unique = new Map();
  root.traverseVisible((node) => {
    if (!node.isMesh) return;
    node.geometry.computeBoundingBox();
    const bounds = node.geometry.boundingBox;
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          const point = new THREE.Vector3(x, y, z).applyMatrix4(
            node.matrixWorld,
          );
          unique.set(
            point
              .toArray()
              .map((v) => v.toFixed(5))
              .join(","),
            point,
          );
        }
  });
  // A convex envelope avoids imaginary roof-height corners above the distant pool and garden.
  // Build once; projecting its small set of vertices keeps each film frame cheap.
  const hull = new ConvexHull().setFromPoints([...unique.values()]);
  const vertices = new Set();
  for (const face of hull.faces) {
    let edge = face.edge;
    do {
      vertices.add(edge.head().point);
      edge = edge.next;
    } while (edge !== face.edge);
  }
  return [...vertices];
}

// Fit the entire footprint, including garage and pool, at the current camera angle.
export function fitHomeZoom(
  camera,
  corners,
  requestedZoom,
  { horizontal = 0.84, vertical = 0.82 } = {},
) {
  camera.updateMatrixWorld(true);
  let extentX = 0,
    extentY = 0;
  for (const point of corners) {
    const view = point.clone().applyMatrix4(camera.matrixWorldInverse);
    extentX = Math.max(extentX, Math.abs(view.x));
    extentY = Math.max(extentY, Math.abs(view.y));
  }
  return Math.min(
    requestedZoom,
    (camera.right * horizontal) / Math.max(extentX, 0.001),
    (camera.top * vertical) / Math.max(extentY, 0.001),
  );
}
