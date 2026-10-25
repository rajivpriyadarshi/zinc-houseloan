import { mountFlowShell } from "./lib/flowShell.js";
import { readPurchaseBudget, formatMoney } from "./lib/purchaseBudget.js";
mountFlowShell(2);
const $ = (id) => document.getElementById(id),
  budget = readPurchaseBudget();
const landmarks = {
  Bangalore: "Vidhana Soudha",
  Mumbai: "Gateway of India",
  Delhi: "Lotus Temple",
};
let selected = Object.hasOwn(landmarks, budget.location)
    ? budget.location
    : "Bangalore",
  version = 0,
  cityScene = null,
  disposed = false,
  lifePaused = false;
$("location-value").textContent = "A home worth " + formatMoney(budget.price);
function showLocation(name) {
  if (!Object.hasOwn(landmarks, name)) return;
  const token = ++version;
  cityScene?.dispose();
  cityScene = null;
  $("city-canvas").hidden = false;
  $("replay-city").hidden = true;
  $("city-placeholder").hidden = true;
  selected = name;
  lifePaused = false;
  $("toggle-city-life").hidden = true;
  $("toggle-city-life").textContent = "Pause life";
  $("toggle-city-life").setAttribute("aria-label", "Pause people and animals");
  $("toggle-city-life").setAttribute("aria-pressed", "false");
  $("city-name").textContent = name + " · " + landmarks[name];
  $("city-canvas").setAttribute(
    "aria-label",
    landmarks[name] +
      " in " +
      name +
      (name === "Delhi"
        ? " assembling marble petals around reflecting pools and greenery"
        : " assembling stone by stone, with landscaped surroundings") +
      ", with walking visitors, dogs and cats",
  );
  $("replay-city").setAttribute(
    "aria-label",
    "Replay " + landmarks[name] + " construction",
  );
  document.querySelectorAll("[data-city]").forEach((button) => {
    const active = button.dataset.city === name;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const fallback = () => {
    if (token !== version || disposed) return;
    cityScene?.dispose();
    cityScene = null;
    $("city-canvas").hidden = true;
    $("replay-city").hidden = true;
    $("city-placeholder").hidden = false;
    $("toggle-city-life").hidden = true;
  };
  import("./lib/cityScene.js")
    .then(({ createCityScene }) => {
      if (token !== version || disposed) return;
      cityScene = createCityScene($("city-canvas"), {
        city: name,
        onError: fallback,
      });
      $("replay-city").hidden = !cityScene;
      $("toggle-city-life").hidden = !cityScene;
    })
    .catch(fallback);
}
$("toggle-city-life").addEventListener("click", () => {
  lifePaused = !lifePaused;
  cityScene?.setLifePaused(lifePaused);
  $("toggle-city-life").textContent = lifePaused ? "Resume life" : "Pause life";
  $("toggle-city-life").setAttribute(
    "aria-label",
    lifePaused ? "Resume people and animals" : "Pause people and animals",
  );
  $("toggle-city-life").setAttribute("aria-pressed", String(lifePaused));
});
$("replay-city").addEventListener("click", () => cityScene?.replay());
document
  .querySelectorAll("[data-city]")
  .forEach((button) =>
    button.addEventListener("click", () => showLocation(button.dataset.city)),
  );
$("proceed-btn").addEventListener("click", () => {
  try {
    localStorage.setItem("selectedCity", selected);
  } catch {}
  window.location.href = "cost-breakdown.html";
});
showLocation(selected);
function dispose() {
  disposed = true;
  version++;
  cityScene?.dispose();
}
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) dispose();
});
if (import.meta.hot) import.meta.hot.dispose(dispose);
