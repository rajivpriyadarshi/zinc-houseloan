import { mountFlowShell } from "./lib/flowShell.js";
import { readPurchaseBudget, formatMoney } from "./lib/purchaseBudget.js";
mountFlowShell(1);
const $ = (id) => document.getElementById(id),
  slider = $("amount-slider"),
  editor = $("amount-input");
const anchors = [100000, 5000000, 10000000, 20000000, 50000000, 100000000];
let value = readPurchaseBudget().price,
  scene = null,
  disposed = false;
function valueFromPosition(position) {
  const segment = Math.min(4, Math.floor(position / 200)),
    fraction = (position - segment * 200) / 200;
  return (
    Math.round(
      (anchors[segment] +
        (anchors[segment + 1] - anchors[segment]) * fraction) /
        100000,
    ) * 100000
  );
}
function positionFromValue(amount) {
  const segment = Math.min(
    4,
    Math.max(
      0,
      anchors.findLastIndex((v) => v <= amount),
    ),
  );
  return (
    segment * 200 +
    ((amount - anchors[segment]) / (anchors[segment + 1] - anchors[segment])) *
      200
  );
}
function update(amount) {
  value = Math.max(100000, Math.min(100000000, amount));
  slider.value = positionFromValue(value);
  slider.style.setProperty("--fill", slider.value / 10 + "%");
  slider.setAttribute("aria-valuetext", formatMoney(value));
  $("amount-text").textContent = formatMoney(value);
  document
    .querySelectorAll("[data-value]")
    .forEach((button) =>
      button.classList.toggle("active", Number(button.dataset.value) === value),
    );
  scene?.setValue(value);
}
slider.addEventListener("input", () =>
  update(valueFromPosition(Number(slider.value))),
);
document
  .querySelectorAll("[data-value]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      update(Number(button.dataset.value)),
    ),
  );
$("amount-display").addEventListener("click", () => {
  editor.value = new Intl.NumberFormat("en-IN").format(value);
  editor.hidden = false;
  $("amount-display").hidden = true;
  editor.focus();
  editor.select();
});
function closeEditor(commit = true) {
  if (editor.hidden) return;
  if (commit) {
    const raw = editor.value.replace(/[^0-9]/g, "");
    update(raw ? Math.round(Number(raw) / 100000) * 100000 : value);
  }
  editor.hidden = true;
  $("amount-display").hidden = false;
}
editor.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    closeEditor();
    $("amount-display").focus();
  }
  if (event.key === "Escape") {
    closeEditor(false);
    $("amount-display").focus();
  }
});
editor.addEventListener("blur", () => closeEditor());
$("proceed-btn").addEventListener("click", () => {
  closeEditor();
  try {
    localStorage.setItem("houseValue", String(value));
  } catch {}
  window.location.href = "location.html";
});
function fallback() {
  scene?.dispose();
  scene = null;
  $("property-canvas").hidden = true;
}
update(value);
import("./lib/propertyScene.js")
  .then(({ createPropertyScene }) => {
    if (disposed) return;
    scene = createPropertyScene($("property-canvas"), {
      value,
      interactive: true,
      onError: fallback,
    });
  })
  .catch(fallback);
function dispose() {
  disposed = true;
  scene?.dispose();
}
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) dispose();
});
if (import.meta.hot) import.meta.hot.dispose(dispose);
