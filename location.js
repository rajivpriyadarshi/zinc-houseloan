import { mountFlowShell } from "./lib/flowShell.js";
import { readPurchaseBudget, formatMoney } from "./lib/purchaseBudget.js";
import { STATE_DUTY_RATES } from "./lib/stateDuty.js";
mountFlowShell(2);
const $ = (id) => document.getElementById(id),
  budget = readPurchaseBudget();
const cities = ["Bangalore", "Mumbai", "Delhi"];
let selected = budget.location,
  version = 0,
  cityScene = null,
  disposed = false;
for (const name of Object.keys(STATE_DUTY_RATES).filter(
  (name) => !cities.includes(name),
)) {
  const option = document.createElement("option");
  option.value = name;
  option.textContent = name;
  $("state-dropdown").append(option);
}
$("location-value").textContent = "A home worth " + formatMoney(budget.price);
function showLocation(name) {
  const token = ++version;
  cityScene?.dispose();
  cityScene = null;
  $("city-canvas").hidden = true;
  $("replay-city").hidden = true;
  selected = name;
  $("city-name").textContent = name || "Somewhere new";
  $("proceed-btn").disabled = !name;
  const other = !cities.includes(name);
  $("dropdown-container").hidden = !other;
  document.querySelectorAll("[data-city]").forEach((button) => {
    const active = button.dataset.city === (other ? "Others" : name);
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (other) {
    $("state-dropdown").value = name || "";
    $("city-image").hidden = true;
    $("city-placeholder").hidden = false;
    return;
  }
  $("city-placeholder").hidden = true;
  if (name === "Delhi") {
    $("city-image").hidden = true;
    $("city-canvas").hidden = false;
    $("city-name").textContent = "Delhi · India Gate";
    const fallback = () => {
      if (token !== version || disposed) return;
      cityScene?.dispose();
      cityScene = null;
      $("city-canvas").hidden = true;
      $("replay-city").hidden = true;
      $("city-placeholder").hidden = false;
    };
    import("./lib/delhiScene.js")
      .then(({ createDelhiScene }) => {
        if (token !== version || disposed) return;
        cityScene = createDelhiScene($("city-canvas"), { onError: fallback });
        $("replay-city").hidden = !cityScene;
      })
      .catch(fallback);
    return;
  }
  showImage(name, token);
}
function showImage(name, token) {
  $("city-image").hidden = true;
  const image = $("city-image");
  image.classList.add("changing");
  const next = new Image();
  next.onload = () => {
    if (token !== version || disposed) return;
    image.src = next.src;
    image.alt = name + " city illustration";
    image.hidden = false;
    image.classList.remove("changing");
  };
  next.onerror = () => {
    if (token !== version || disposed) return;
    image.hidden = true;
    $("city-placeholder").hidden = false;
  };
  next.src = "/new-cities/" + name + ".png";
}
$("replay-city").addEventListener("click", () => cityScene?.replay());
document
  .querySelectorAll("[data-city]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      showLocation(
        button.dataset.city === "Others" ? null : button.dataset.city,
      ),
    ),
  );
$("state-dropdown").addEventListener("change", (event) =>
  showLocation(event.target.value || null),
);
$("proceed-btn").addEventListener("click", () => {
  if (!selected) return;
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
