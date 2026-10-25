import { formatMoney, readPurchaseBudget } from "./lib/purchaseBudget.js";
import { mountFlowShell } from "./lib/flowShell.js";
mountFlowShell(3);
const budget = readPurchaseBudget();
const $ = (id) => document.getElementById(id);
for (const [id, value] of Object.entries({
  "property-amount": budget.price,
  "loan-amount": budget.loan,
  "down-amount": budget.down,
  "interiors-amount": budget.interiors,
  "duty-amount": budget.duty,
  "upfront-total": budget.upfront,
}))
  $(id).textContent = formatMoney(value);
$("estimate-note").textContent =
  `Estimated for ${budget.location} · Interiors at 20% of property value.`;

// One story clock drives the labels, camera, model and completion state.
// No accumulated timeouts: pause, replay and backgrounding preserve the sequence.
const chapters = [
  { at: 0, name: "intro", line: "Every home starts with a price." },
  { at: 3.2, name: "loan", line: "Your home loan covers 80% of it." },
  { at: 6.3, name: "down", line: "The remaining 20% comes from you." },
  { at: 9.4, name: "interiors", line: "Then, you make the space your own." },
  { at: 12.7, name: "duty", line: "And make it officially yours." },
  { at: 16, name: "total", line: "That’s what it takes to move in." },
];
const DURATION = 18;
const preference = matchMedia("(prefers-reduced-motion: reduce)");
let scene = null,
  elapsed = 0,
  previous = 0,
  frame = 0,
  chapter = -1,
  paused = false,
  disposed = false,
  ready = false;
let narrationAnimation;
let pausedAnimations = [];
const revealed = new Map();
const revealTimes = {
  "property-label": 1.1,
  "loan-label": 3.9,
  "cost-heading": 6.3,
  "down-step": 6.7,
  "interiors-step": 9.9,
  "duty-step": 13.2,
  "total-summary": 16.2,
  "continue-btn": 17.2,
  "estimate-note": 17.6,
};

function present(time) {
  const next = chapters.findLastIndex((item) => time >= item.at);
  if (next !== chapter) {
    chapter = next;
    const current = chapters[chapter];
    $("explainer").dataset.chapter = current.name;
    $("narration").textContent = current.line;
    narrationAnimation?.cancel();
    if (!preference.matches)
      narrationAnimation = $("narration").animate(
        [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 650, easing: "cubic-bezier(.22,1,.36,1)" },
      );
  }
  $("explainer").classList.toggle("is-explaining", time >= 3.2);
  for (const [id, at] of Object.entries(revealTimes)) {
    const visible = time >= at;
    if (revealed.get(id) !== visible) {
      revealed.set(id, visible);
      $(id).classList.toggle("visible", visible);
      $(id).setAttribute("aria-hidden", String(!visible));
      if (id === "continue-btn") $(id).tabIndex = visible ? 0 : -1;
    }
  }
  for (const part of ["down", "interiors", "duty"])
    $(`${part}-step`).classList.toggle(
      "active",
      chapters[chapter].name === part,
    );
  const complete = time >= DURATION;
  $("pause-btn").hidden = complete;
  $("skip-btn").hidden = complete;
  $("replay-btn").hidden = !complete || preference.matches;
  scene?.seek(time, preference.matches);
}
function tick(now) {
  frame = 0;
  if (disposed || !ready || paused || document.hidden) return;
  if (previous)
    elapsed = Math.min(
      DURATION,
      elapsed + Math.min((now - previous) / 1000, 0.1),
    );
  previous = now;
  present(elapsed);
  if (elapsed < DURATION) frame = requestAnimationFrame(tick);
}
function wake() {
  if (
    !frame &&
    ready &&
    !paused &&
    !disposed &&
    !document.hidden &&
    elapsed < DURATION
  ) {
    previous = 0;
    frame = requestAnimationFrame(tick);
  }
}
function stop() {
  cancelAnimationFrame(frame);
  frame = 0;
  previous = 0;
}
function finish() {
  stop();
  pausedAnimations.forEach((animation) => animation.play());
  pausedAnimations = [];
  paused = false;
  elapsed = DURATION;
  present(elapsed);
}
function start() {
  ready = true;
  if (preference.matches) finish();
  else {
    present(elapsed);
    wake();
  }
}
function setPaused(value) {
  paused = value;
  $("pause-btn").setAttribute(
    "aria-label",
    paused ? "Resume explanation" : "Pause explanation",
  );
  $("pause-btn").innerHTML = paused
    ? '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 8 6-8 6z"/></svg>'
    : '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10"/></svg>';
  if (paused) {
    stop();
    pausedAnimations = $("explainer").getAnimations({ subtree: true });
    pausedAnimations.forEach((animation) => animation.pause());
  } else {
    pausedAnimations.forEach((animation) => animation.play());
    pausedAnimations = [];
    wake();
  }
}
$("pause-btn").addEventListener("click", () => setPaused(!paused));
$("skip-btn").addEventListener("click", finish);
$("replay-btn").addEventListener("click", () => {
  stop();
  elapsed = 0;
  chapter = -1;
  setPaused(false);
  present(0);
  wake();
});
function onVisibility() {
  if (document.hidden) stop();
  else wake();
}
function onPreference() {
  if (preference.matches) {
    narrationAnimation?.cancel();
    finish();
  }
}
document.addEventListener("visibilitychange", onVisibility);
preference.addEventListener("change", onPreference);
function fallback(error) {
  console.warn("3D home unavailable:", error?.message);
  scene?.dispose();
  scene = null;
  $("home-canvas").hidden = true;
  if (!ready) start();
}
present(0);
// Start the film only once the 3D scene is ready; leave the stage clear while loading.
Promise.all([import("./lib/homeScene.js"), document.fonts.ready])
  .then(([{ createHomeScene }]) => {
    if (disposed) return;
    scene = createHomeScene($("home-canvas"), { onError: fallback });
    if (!ready) start();
  })
  .catch(fallback);
function dispose() {
  disposed = true;
  stop();
  narrationAnimation?.cancel();
  scene?.dispose();
  document.removeEventListener("visibilitychange", onVisibility);
  preference.removeEventListener("change", onPreference);
}
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) dispose();
});
if (import.meta.hot) import.meta.hot.dispose(dispose);
