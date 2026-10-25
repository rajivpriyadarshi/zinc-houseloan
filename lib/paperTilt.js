/** The carrier owns the fax choreography; its inner sheet owns pointer tilt. */
export function createPaperTilt(carrier, sheet, preference) {
  let enabled = false,
    frame = 0,
    last = 0;
  let x = 0,
    y = 0,
    targetX = 0,
    targetY = 0;
  const limit = (value) => Math.max(-1, Math.min(1, value));
  function paint() {
    sheet.style.transform = `perspective(1100px) rotateX(${-y * 5}deg) rotateY(${x * 7}deg)`;
  }
  function tick(now) {
    frame = 0;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
    last = now;
    const alpha = 1 - Math.exp(-dt / (targetX || targetY ? 0.085 : 0.14));
    x += (targetX - x) * alpha;
    y += (targetY - y) * alpha;
    const settled = Math.abs(x - targetX) + Math.abs(y - targetY) < 0.001;
    if (settled) {
      x = targetX;
      y = targetY;
    }
    paint();
    if (!settled) frame = requestAnimationFrame(tick);
    else {
      last = 0;
      sheet.style.willChange = "";
    }
  }
  function wake() {
    sheet.style.willChange = "transform";
    if (!frame) frame = requestAnimationFrame(tick);
  }
  function move(event) {
    if (!enabled || preference.matches || event.pointerType === "touch") return;
    // Measure the stationary carrier so a rotating hit surface never feeds back into itself.
    const rect = carrier.getBoundingClientRect();
    targetX = limit(((event.clientX - rect.left) / rect.width) * 2 - 1);
    targetY = limit(((event.clientY - rect.top) / rect.height) * 2 - 1);
    wake();
  }
  function reset(immediate = false) {
    targetX = targetY = 0;
    if (immediate) {
      cancelAnimationFrame(frame);
      frame = last = 0;
      x = y = 0;
      sheet.style.transform = "";
      sheet.style.willChange = "";
    } else wake();
  }
  const leave = () => reset();
  const visibility = () => {
    if (document.hidden) reset(true);
  };
  carrier.addEventListener("pointermove", move);
  carrier.addEventListener("pointerleave", leave);
  carrier.addEventListener("pointercancel", leave);
  window.addEventListener("blur", leave);
  document.addEventListener("visibilitychange", visibility);
  return {
    setEnabled(value) {
      const next = value && !preference.matches;
      if (enabled === next) return;
      enabled = next;
      carrier.classList.toggle("tilt-ready", enabled);
      if (!enabled) reset(true);
    },
    dispose() {
      reset(true);
      carrier.classList.remove("tilt-ready");
      carrier.removeEventListener("pointermove", move);
      carrier.removeEventListener("pointerleave", leave);
      carrier.removeEventListener("pointercancel", leave);
      window.removeEventListener("blur", leave);
      document.removeEventListener("visibilitychange", visibility);
    },
  };
}
