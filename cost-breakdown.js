import { formatMoney, readPurchaseBudget } from "./lib/purchaseBudget.js";
import { mountFlowShell } from "./lib/flowShell.js";
import {
  STORY,
  chapters,
  progress,
  mix,
  money,
  chartLayout,
  chartCamera,
  costEmphasis,
  interiorFocus,
  faxMotion,
  spring,
  clamp,
} from "./lib/costStory.js";
import { createPaperTilt } from "./lib/paperTilt.js";
mountFlowShell(3);
const budget = readPurchaseBudget(),
  $ = (id) => document.getElementById(id),
  pref = matchMedia("(prefers-reduced-motion: reduce)");
const paperTilt = createPaperTilt($("paper-carrier"), $("paper-feed"), pref);
$("property-amount").textContent = formatMoney(budget.price);
$("receipt-location").textContent =
  `${budget.location} · Property ${formatMoney(budget.price)}`;
$("receipt-note").textContent =
  `Home loan of ${money(budget.loan)} is covered separately.`;
$("headline-total").textContent = money(budget.upfront);
for (const name of ["down", "interiors", "duty"])
  $("bill-" + name + "-amount").textContent = "+ " + money(budget[name]);
const billRows = ["down", "interiors", "duty"].map((name) => $("bill-" + name));
const names = ["loan", "down", "interiors", "duty"],
  starts = [STORY.loan, STORY.down, STORY.interiors, STORY.duty];
const rows = names.map((name) => ({
  root: $(name + "-row"),
  amount: $(name + "-amount"),
  caption: $(name + "-row").querySelector(".row-caption"),
  leader: $(name + "-row").querySelector(".row-leader"),
  bar: $(name + "-bar"),
}));
let scene = null,
  elapsed = 0,
  last = 0,
  frame = 0,
  ready = false,
  paused = false,
  disposed = false,
  chapter = -1,
  layout;
function opacity(node, value) {
  node.style.opacity = value;
  node.style.visibility = value > 0.001 ? "visible" : "hidden";
}
function position(node, x, y, scale = 1) {
  node.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale})`;
}
const titleWords = [...document.querySelectorAll(".title-word")];
function present(time) {
  if (!layout) return;
  const l = layout,
    cam = chartCamera(time, l),
    barX = cam.x,
    emphasis = costEmphasis(time),
    propertyEmphasis = mix(1, 0.55, interiorFocus(time));
  const exit = progress(time, STORY.summary, 0.65),
    next = chapters.findLastIndex((c) => time >= c.at);
  if (next !== chapter) {
    chapter = next;
    $("explainer").dataset.chapter = chapters[next].name;
    $("narration").textContent = chapters[next].line;
  }

  $("story-heading").setAttribute(
    "aria-hidden",
    String(time > STORY.summary + 0.4),
  );
  // The opening title is the first subject. It becomes the persistent page heading.
  const dock = progress(time, STORY.titleDock, 0.95);
  opacity($("story-heading"), 1 - progress(time, STORY.summary - 0.1, 0.5));
  $("story-title").style.transform =
    `translate3d(0,${(1 - dock) * l.titleY}px,0) scale(${mix(l.titleScale, 1, dock)})`;
  titleWords.forEach((word, i) => {
    const p = progress(time, STORY.title + i * 0.12, 0.58);
    opacity(word, p);
    word.style.transform = `translateY(${(1 - p) * 24}px)`;
    word.style.filter = `blur(${(1 - p) * 5}px)`;
  });
  const narrationIn = progress(
    time,
    Math.max(STORY.loan, chapters[next].at) + 0.12,
    0.38,
  );
  opacity($("narration"), narrationIn * (1 - exit));
  $("narration").style.transform = `translateY(${(1 - narrationIn) * 8}px)`;
  opacity($("summary-heading"), progress(time, STORY.summary + 0.28, 0.55));
  const headingSettle = spring(time, STORY.summary + 0.25, 0.95, 0.84);
  $("summary-heading").style.transform =
    `translateY(${(1 - headingSettle) * 23}px) scale(${mix(0.96, 1, headingSettle)})`;

  // The home enters on the outgoing momentum of the chart's camera pullback.
  const houseIn = progress(time, STORY.down + 0.05, 0.85),
    houseSettle = spring(time, STORY.down + 0.05, 1.1, 0.86);
  opacity($("house-composition"), houseIn * (1 - exit));
  $("house-composition").style.transform =
    `translate3d(${(1 - houseSettle) * -85 - exit * 75}px,${(1 - houseSettle) * 26 + exit * 15}px,0) scale(${mix(0.82, 1, houseSettle) * (1 - exit * 0.18)})`;
  const property = progress(time, STORY.property, 0.65) * (1 - exit);
  opacity($("property-label"), property * propertyEmphasis);
  const propertyTop = l.segments[1].top,
    mid = (propertyTop + l.bottom) / 2,
    x = barX - 15,
    px = l.width * 0.25,
    py = l.height - 3;
  $("property-bracket").setAttribute(
    "d",
    `M${x + 7},${propertyTop}H${x}V${l.bottom}H${x + 7}`,
  );
  $("property-connector").setAttribute(
    "d",
    `M${px},${l.height - 15}V${py - 9}Q${px},${py} ${px + 10},${py}H${x - 35}Q${x - 22},${py} ${x - 22},${py - 14}V${mid + 14}Q${x - 22},${mid} ${x - 10},${mid}H${x}`,
  );
  $("property-connector").style.strokeDashoffset = 1 - property;
  $("property-bracket").style.strokeDashoffset = 1 - property;
  opacity($("chart-connections"), (1 - exit) * propertyEmphasis);
  $("chart-bar").style.transform =
    `translate3d(${barX + exit * 25}px,${cam.y + exit * 24}px,0) scale(${cam.width * (1 - exit * 0.2)},${cam.zoom * (1 - exit * 0.12)})`;
  opacity($("chart-bar"), 1 - progress(time, STORY.summary, 0.65));

  // Paper physically rises through the slot; the same feed distance reveals the ink.
  const fax = faxMotion(time, l),
    printing = time >= STORY.print && fax.feed < 1;
  $("fax-machine").style.left = (l.width - 440) / 2 + "px";
  const vibration = printing ? Math.sin(time * 55) * 0.22 : 0;
  $("fax-machine").style.transform =
    `translate3d(0,${fax.machineY + vibration}px,0)`;
  opacity($("fax-machine"), fax.machineOpacity);
  $("fax-light").style.opacity = printing ? 0.6 + 0.4 * Math.sin(time * 9) : 1;
  $("fax-status").textContent =
    fax.feed >= 1 ? "ESTIMATE COMPLETE" : "PRINTING ESTIMATE";
  $("fax-meter").style.transform = `scaleX(${fax.feed})`;
  $("paper-carrier").style.left = l.paperX + "px";
  $("paper-carrier").style.top = fax.paperY + "px";
  $("paper-carrier").style.transform =
    `scale(${fax.paperScale}) rotate(${fax.paperTurn}deg)`;
  $("paper-carrier").style.zIndex = fax.dock > 0 ? 6 : 4;
  opacity($("paper-carrier"), time >= STORY.print ? 1 : 0);
  $("receipt").style.transform = `translate3d(0,${343 * (1 - fax.feed)}px,0)`;
  opacity($("receipt"), 1);
  $("receipt").setAttribute("aria-hidden", String(fax.feed < 0.05));
  billRows.forEach((row, i) => {
    const ink = fax.ink([111, 155, 199][i]);
    row.style.clipPath = `inset(0 ${(1 - ink) * 100}% 0 0)`;
    row.setAttribute("aria-hidden", String(ink < 0.01));
  });
  rows.forEach((row, i) => {
    const seg = l.segments[i],
      reveal = progress(time, starts[i], 0.32),
      arrival = spring(time, starts[i], 0.95, i === 0 ? 0.7 : 0.63);
    const label = progress(time, starts[i] + 0.17, 0.38),
      labelSettle = spring(time, starts[i] + 0.17, 0.7, 0.8);
    const center = cam.y + seg.center * cam.zoom,
      y = center - 12,
      alpha = label * (1 - exit) * emphasis[i];
    row.bar.style.top = seg.top + "px";
    row.bar.style.height = seg.height + "px";
    // A tiny impact response in the base makes each added layer feel connected.
    const impact =
      i === 0
        ? starts
            .slice(1)
            .reduce(
              (sum, at) =>
                sum +
                Math.sin(Math.max(0, time - at) * 27) *
                  Math.exp(-Math.max(0, time - at) * 12) *
                  (time >= at && time < at + 0.6 ? 0.016 : 0),
              0,
            )
        : 0;
    row.bar.style.transform = `translateY(${(1 - clamp(arrival)) * (i ? 12 : 20)}px) scale(${1 + (1 - arrival) * 0.08},${Math.max(0.001, arrival - impact)})`;
    opacity(row.bar, reveal * emphasis[i]);
    const active =
      chapters[next].name === names[i] ||
      (chapters[next].name === "property" && i < 2);
    row.bar.style.filter = active ? "brightness(1.09)" : "none";
    position(row.leader, barX + 26 * cam.width + 15, center);
    opacity(row.leader, alpha);
    const hero = i === 0 ? 1 - cam.pull : 0,
      amountRight = barX + mix(179, 330, hero);
    row.leader.style.width =
      mix(38, Math.max(38, l.loanTextLeft - 84), hero) + "px";
    position(
      row.amount,
      amountRight - 130,
      y - hero * 13 + (1 - labelSettle) * 20,
      mix(1, 2.12, hero),
    );
    position(
      row.caption,
      barX + mix(194, l.loanTextLeft, hero),
      y + hero * 42 + (1 - labelSettle) * 13,
      mix(1, 1.2, hero),
    );
    row.amount.style.color = active ? "#eef0e7" : "#cfd8c6";
    row.caption.style.color = active ? "#bfcfaf" : "#98a58f";
    row.amount.textContent = money(seg.value);
    opacity(row.amount, alpha);
    opacity(row.caption, alpha);
    row.root.setAttribute("aria-hidden", String(alpha < 0.1));
  });
  const hero = 1 - cam.pull,
    loanCenter = cam.y + l.segments[0].center * cam.zoom;
  position(
    $("loan-detail"),
    barX + mix(179 - l.loanTextWidth, l.loanTextLeft, hero),
    loanCenter + mix(17, 58, hero),
  );
  opacity(
    $("loan-detail"),
    progress(time, STORY.loan + 0.5, 0.35) * (1 - exit) * emphasis[0],
  );
  const total = fax.ink(255);
  $("upfront-total").textContent = money(budget.upfront);
  opacity($("receipt-total"), total > 0 ? 1 : 0);
  $("receipt-total").style.clipPath = `inset(0 ${(1 - total) * 100}% 0 0)`;
  opacity($("receipt-note"), fax.ink(296));
  const ending = progress(time, STORY.total + 0.6, 0.5);
  opacity($("story-end"), ending);
  $("story-end").style.transform =
    `translateY(${(1 - ending) * 15}px) scale(${mix(0.95, 1, ending)})`;
  $("story-end").style.pointerEvents = ending > 0.99 ? "auto" : "none";
  $("continue-btn").tabIndex = ending > 0.99 ? 0 : -1;
  $("story-end").setAttribute("aria-hidden", String(ending < 0.1));
  const complete = time >= STORY.end;
  paperTilt.setEnabled(complete);
  $("pause-btn").hidden = complete;
  $("skip-btn").hidden = complete;
  $("replay-btn").hidden = !complete || pref.matches;
  $("story-progress").style.transform = `scaleX(${time / STORY.end})`;
  scene?.seek(time, pref.matches);
}
function measure() {
  const b = $("story-stage").getBoundingClientRect();
  layout = chartLayout(b.width, b.height, budget);
  const main = $("explainer").getBoundingClientRect();
  // Match the rendered amount, including its font spacing and current zoom.
  rows[0].amount.textContent = money(budget.loan);
  const style = getComputedStyle(rows[0].amount);
  const range = document.createRange();
  range.selectNodeContents(rows[0].amount);
  const scale = new DOMMatrixReadOnly(style.transform).a || 1;
  layout.loanTextWidth = range.getBoundingClientRect().width / scale;
  layout.loanTextLeft = 330 - layout.loanTextWidth * 2.12;
  layout.titleY =
    main.height * 0.46 -
    $("story-heading").offsetTop -
    $("story-title").offsetHeight / 2;
  layout.titleScale =
    Math.min(72, b.width * 0.06) /
    Math.min(40, Math.max(28, innerWidth * 0.026));
  present(elapsed);
}
const ro = new ResizeObserver(measure);
ro.observe($("story-stage"));
function tick(now) {
  frame = 0;
  if (disposed || !ready || paused || document.hidden) return;
  if (last)
    elapsed = Math.min(STORY.end, elapsed + Math.min((now - last) / 1000, 0.1));
  last = now;
  present(elapsed);
  if (elapsed < STORY.end) frame = requestAnimationFrame(tick);
}
function stop() {
  cancelAnimationFrame(frame);
  frame = 0;
  last = 0;
}
function wake() {
  if (
    !frame &&
    ready &&
    !paused &&
    !disposed &&
    !document.hidden &&
    elapsed < STORY.end
  ) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}
function setPaused(value) {
  paused = value;
  $("pause-btn").textContent = paused ? "▶" : "Ⅱ";
  $("pause-btn").setAttribute(
    "aria-label",
    paused ? "Resume explanation" : "Pause explanation",
  );
  if (paused) stop();
  else wake();
}
function finish() {
  stop();
  paused = false;
  elapsed = STORY.end;
  present(elapsed);
}
function start() {
  ready = true;
  measure();
  if (pref.matches) finish();
  else wake();
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
function visibility() {
  if (document.hidden) stop();
  else wake();
}
function preference() {
  if (pref.matches) finish();
  else present(elapsed);
}
document.addEventListener("visibilitychange", visibility);
pref.addEventListener("change", preference);
function fallback(error) {
  console.warn("3D home unavailable:", error?.message);
  scene?.dispose();
  scene = null;
  $("home-canvas").hidden = true;
  if (!ready) start();
}
measure();
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
  ro.disconnect();
  paperTilt.dispose();
  scene?.dispose();
  document.removeEventListener("visibilitychange", visibility);
  pref.removeEventListener("change", preference);
}
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) dispose();
});
if (import.meta.hot) import.meta.hot.dispose(dispose);
