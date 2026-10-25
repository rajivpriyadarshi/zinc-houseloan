export function mountFlowShell(step = 0) {
  const header = document.createElement("header");
  header.className = "flow-header";
  header.innerHTML = `<a class="wordmark" href="index.html" aria-label="Zinc home">zinc<sup>®</sup></a><span class="product-label">HOME PLANNER</span><nav class="flow-progress" aria-label="Your home plan">${["Property", "Location", "Your budget"].map((label, i) => `<span class="${i + 1 === step ? "current" : i + 1 < step ? "done" : ""}" ${i + 1 === step ? 'aria-current="step"' : ""}><i>${i + 1 < step ? "✓" : i + 1}</i>${label}</span>`).join("")}</nav><span class="flow-count"><strong>0${step || 1}</strong> / 04</span>`;
  document.body.prepend(header);
  const footer = document.createElement("footer");
  footer.className = "flow-footer";
  footer.innerHTML =
    "<span>A LITTLE CLARITY. A BIG NEXT STEP.</span><span>Zinc Home Planner <b>·</b> Made for your next chapter</span>";
  document.body.append(footer);
}
export const arrow =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';
