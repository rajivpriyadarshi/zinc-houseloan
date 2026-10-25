import { mountFlowShell } from "./lib/flowShell.js";
mountFlowShell(0);
let scene = null,
  disposed = false;
const phrases = [...document.querySelectorAll(".funding-phrase")];
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
let phraseIndex = 0;
let phraseTimer = 0;
function syncRotation() {
  clearInterval(phraseTimer);
  if (disposed || document.hidden || motionPreference.matches) return;
  phraseTimer = setInterval(() => {
    phrases.forEach((phrase) => phrase.classList.remove("exit"));
    phrases[phraseIndex].classList.remove("active");
    phrases[phraseIndex].classList.add("exit");
    phraseIndex = (phraseIndex + 1) % phrases.length;
    phrases[phraseIndex].classList.add("active");
  }, 2500);
}
document.addEventListener("visibilitychange", syncRotation);
motionPreference.addEventListener("change", syncRotation);
syncRotation();
const fallback = () => {
  scene?.dispose();
  scene = null;
  document.getElementById("property-canvas").hidden = true;
};
import("./lib/propertyScene.js")
  .then(({ createPropertyScene }) => {
    if (disposed) return;
    scene = createPropertyScene(document.getElementById("property-canvas"), {
      // A composed hero home keeps the landing scene calm at every saved budget.
      value: 30000000,
      neighbourhood: true,
      interactive: true,
      onError: fallback,
    });
  })
  .catch(fallback);
function dispose() {
  disposed = true;
  clearInterval(phraseTimer);
  document.removeEventListener("visibilitychange", syncRotation);
  motionPreference.removeEventListener("change", syncRotation);
  scene?.dispose();
}
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) dispose();
});
if (import.meta.hot) import.meta.hot.dispose(dispose);
