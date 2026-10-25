import {
  readPurchaseBudget,
  formatMoney as money,
} from "./lib/purchaseBudget.js";
import { mountFlowShell } from "./lib/flowShell.js";
import { createFundingInputs, calculateModel } from "./lib/fundingModel.js";
import { createFundingScroll } from "./lib/fundingScroll.js";

mountFlowShell(4);
const budget = readPurchaseBudget();
let inputs = createFundingInputs(budget),
  model,
  selected = "zinc-loan";
const $ = (id) => document.getElementById(id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const order = [
  "zinc-loan",
  "use-cash",
  "sell-land",
  "sell-indian-equity",
  "sell-rsus",
];
const signed = (value) => `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`;
const row = (label, value, total = false) =>
  `<div${total ? ' class="equation-total"' : ""}><span>${label}</span><strong>${value}</strong></div>`;

function renderDetail() {
  const strategy = model.strategies.find((s) => s.strategyId === selected);
  const detail = model.detail[selected],
    years = inputs.zincLoanTenureYears;
  let description, equation;
  if (selected === "zinc-loan") {
    description = `Keep your investments while borrowing the upfront amount. This illustration uses RSUs growing at ${(inputs.assets.foreignRsu.usdCagrPct * 100).toFixed(1)}% in USD, with 2.5% annual INR depreciation, and a ${(model.zincRate * 100).toFixed(1)}% interest-only loan. Principal is repaid after ${years} years.`;
    equation =
      row("Estimated retained RSU value", money(detail.retainedValue)) +
      row(
        "Less principal + interest with opportunity cost",
        `−${money(detail.burden)}`,
      ) +
      row(
        `Modeled net value after ${years} years`,
        signed(-strategy.impact),
        true,
      );
  } else {
    const asset =
      selected === "use-cash"
        ? "savings"
        : selected === "sell-land"
          ? "land"
          : selected === "sell-indian-equity"
            ? "equities"
            : "RSUs";
    description = `Use your ${asset} to cover ${money(model.fundingGap)} upfront. The bar shows the future value of those assets you would give up over ${years} years under these assumptions${selected === "use-cash" ? "." : ", including the extra assets sold to cover estimated capital-gains tax."}`;
    equation =
      row(
        selected === "use-cash" ? "Savings used today" : "Assets sold today",
        money(detail.amount),
      ) +
      row("Estimated tax on sale", money(detail.tax)) +
      row(
        `Future value given up after ${years} years`,
        signed(-strategy.impact),
        true,
      );
  }
  $("option-detail").innerHTML =
    `<div class="detail-copy"><p class="eyebrow">HOW THIS OPTION WORKS</p><h3 id="option-title">${strategy.strategyName}</h3><p>${description}</p></div><div class="detail-equation">${equation}</div>`;
}
function render() {
  model = calculateModel(inputs);
  $("funding-amount").textContent = money(model.fundingGap);
  $("period-label").textContent = `${inputs.zincLoanTenureYears} years`;
  const max = Math.max(...model.strategies.map((s) => Math.abs(s.impact)), 1);
  $("chart-options").innerHTML = order
    .map((id, index) => {
      const s = model.strategies.find((s) => s.strategyId === id),
        positive = s.impact <= 0;
      const height = Math.max(3, (Math.abs(s.impact) / max) * 85),
        top = positive ? 165 - height : 166;
      return `<button class="option-column" data-option="${id}" aria-haspopup="dialog" style="--i:${index}" aria-label="${s.strategyName}: ${signed(-s.impact)} modeled impact over ${inputs.zincLoanTenureYears} years"><h3>${s.strategyName}<span aria-hidden="true">↗</span></h3><span class="funding-bar" aria-hidden="true" style="top:${top}px;height:${height}px;transform-origin:${positive ? "bottom" : "top"};--bar:${positive ? "#a7bc89" : ["#b1947c", "#aa967d", "#a58d77", "#a78574", "#987866"][index]}"></span><span class="column-value" style="top:${positive ? top - 39 : top + height + 12}px;color:${positive ? "#cce3a8" : "#c9b7a5"}">${signed(-s.impact)}</span></button>`;
    })
    .join("");
  document
    .querySelectorAll("[data-years]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(Number(b.dataset.years) === inputs.zincLoanTenureYears),
      ),
    );
  if ($("option-dialog").open) renderDetail();
  window.dispatchEvent(new Event("scroll"));
}
$("chart-options").addEventListener("click", (event) => {
  const button = event.target.closest("[data-option]");
  if (!button) return;
  selected = button.dataset.option;
  renderDetail();
  $("option-dialog").showModal();
});
document.querySelector(".horizon").addEventListener("click", (event) => {
  const button = event.target.closest("[data-years]");
  if (!button) return;
  inputs.zincLoanTenureYears = Number(button.dataset.years);
  render();
});
const fields = {
  "input-home-rate": [
    () => inputs.selectedHomeLoanRatePct,
    (v) => (inputs.selectedHomeLoanRatePct = v),
  ],
  "input-ltv": [
    () => inputs.homeLoanLtvPct,
    (v) => (inputs.homeLoanLtvPct = v),
  ],
  "input-cash": [
    () => inputs.assets.cash.cagrPct,
    (v) => (inputs.assets.cash.cagrPct = v),
  ],
  "input-land": [
    () => inputs.assets.land.cagrPct,
    (v) => (inputs.assets.land.cagrPct = v),
  ],
  "input-equity": [
    () => inputs.assets.indianEquity.cagrPct,
    (v) => (inputs.assets.indianEquity.cagrPct = v),
  ],
  "input-rsu": [
    () => inputs.assets.foreignRsu.usdCagrPct,
    (v) => (inputs.assets.foreignRsu.usdCagrPct = v),
  ],
};
function fillForm() {
  Object.entries(fields).forEach(
    ([id, [get]]) => ($(id).value = Number((get() * 100).toFixed(2))),
  );
}
for (const id of ["assumptions-open", "assumptions-inline"])
  $(id).addEventListener("click", () => {
    $("option-dialog").close();
    fillForm();
    $("assumptions-dialog").showModal();
  });
document
  .querySelector("#assumptions-dialog .close-dialog")
  .addEventListener("click", () => $("assumptions-dialog").close());
$("assumptions-form").addEventListener("submit", (event) => {
  event.preventDefault();
  Object.entries(fields).forEach(([id, [, set]]) =>
    set(Number($(id).value) / 100),
  );
  render();
  $("assumptions-dialog").close();
});
$("reset-assumptions").addEventListener("click", () => {
  const defaults = createFundingInputs(budget);
  const values = [
    defaults.selectedHomeLoanRatePct,
    defaults.homeLoanLtvPct,
    defaults.assets.cash.cagrPct,
    defaults.assets.land.cagrPct,
    defaults.assets.indianEquity.cagrPct,
    defaults.assets.foreignRsu.usdCagrPct,
  ];
  Object.keys(fields).forEach(
    (id, i) => ($(id).value = Number((values[i] * 100).toFixed(2))),
  );
});
$("assumptions-dialog").addEventListener("close", () =>
  $("assumptions-open").focus({ preventScroll: true }),
);
$("option-close").addEventListener("click", () => $("option-dialog").close());
render();
const scrollStory = createFundingScroll(reduced);
function dispose() {
  scrollStory.dispose();
}
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) dispose();
});
if (import.meta.hot) import.meta.hot.dispose(dispose);
