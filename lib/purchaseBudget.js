import { getTransactionDutyRate } from "./stateDuty.js";

// Shared assumptions for the budget reveal and the funding comparison.
export const PURCHASE_DEFAULTS = Object.freeze({
  interiorsPct: 0.2,
  homeLoanLtvPct: 0.8,
});

export function readPurchaseBudget() {
  let price = 10000000;
  let location = "Bangalore";
  try {
    const storedPrice = Number(localStorage.getItem("houseValue"));
    if (
      Number.isFinite(storedPrice) &&
      storedPrice >= 100000 &&
      storedPrice <= 100000000
    )
      price = storedPrice;
    location = localStorage.getItem("selectedCity") || location;
  } catch {
    /* The default estimate also works when browser storage is unavailable. */
  }
  const dutyRate = getTransactionDutyRate(location);
  const loan = price * PURCHASE_DEFAULTS.homeLoanLtvPct;
  const down = price - loan;
  const interiors = price * PURCHASE_DEFAULTS.interiorsPct;
  const duty = price * dutyRate;
  return {
    price,
    location,
    dutyRate,
    loan,
    down,
    interiors,
    duty,
    upfront: down + interiors + duty,
    total: price + interiors + duty,
  };
}

export function formatMoney(value) {
  return value >= 10000000
    ? `₹${(value / 10000000).toFixed(2)} Cr`
    : `₹${(value / 100000).toFixed(2)} L`;
}
