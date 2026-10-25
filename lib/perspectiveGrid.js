import * as THREE from "three";

/** Sparse ground lines that dissolve before either the ground or canvas boundary. */
export function createPerspectiveGrid({ size, divisions, opacity }) {
  const grid = new THREE.GridHelper(size, divisions);
  grid.material.dispose();
  grid.material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      tint: { value: new THREE.Color("#708164") },
      opacity: { value: opacity },
      radius: { value: size / 2 },
      resolution: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: `
      varying vec2 groundPosition;
      void main() {
        groundPosition = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 tint;
      uniform float opacity;
      uniform float radius;
      uniform vec2 resolution;
      varying vec2 groundPosition;
      void main() {
        vec2 uv = gl_FragCoord.xy / resolution;
        vec2 edge = min(uv, 1.0 - uv);
        float viewportFade = smoothstep(0.025, 0.16, edge.x)
                           * smoothstep(0.025, 0.16, edge.y);
        float groundFade = 1.0 - smoothstep(0.48, 0.98, length(groundPosition) / radius);
        gl_FragColor = vec4(tint, opacity * viewportFade * groundFade);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  return grid;
}
