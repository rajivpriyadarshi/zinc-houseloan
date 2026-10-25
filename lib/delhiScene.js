import { createCityScene } from "./cityScene.js";

export function createDelhiScene(container, options = {}) {
  return createCityScene(container, { ...options, city: "Delhi" });
}
