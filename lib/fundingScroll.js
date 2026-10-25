/** One native scroll track: hold the introduction, then hand the stage to the chart. */
export function createFundingScroll(preference) {
  const track = document.getElementById("funding-track");
  const stage = document.getElementById("funding-stage");
  const intro = document.getElementById("zinc-intro");
  const comparison = document.getElementById("funding-comparison");
  const links = [
    ...document.querySelectorAll(
      'a[href="#funding-comparison"],a[href="#zinc-intro"]',
    ),
  ];
  let frame = 0,
    disposed = false;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const ease = (v) => {
    const t = clamp(v);
    return t * t * (3 - 2 * t);
  };
  function paint() {
    frame = 0;
    if (disposed) return;
    if (preference.matches) {
      intro.style.cssText = "";
      comparison.style.cssText = "";
      intro.inert = false;
      comparison.inert = false;
      intro.removeAttribute("aria-hidden");
      comparison.removeAttribute("aria-hidden");
      return;
    }
    const distance = Math.max(1, track.offsetHeight - stage.offsetHeight);
    const p = clamp((96 - track.getBoundingClientRect().top) / distance);
    const out = ease((p - 0.08) / 0.38),
      enter = ease((p - 0.46) / 0.32);
    intro.style.opacity = 1 - out;
    intro.style.transform = `translate3d(0,${-70 * out}px,0) scale(${1 - 0.07 * out})`;
    intro.style.visibility = out === 1 ? "hidden" : "visible";
    comparison.style.opacity = enter;
    comparison.style.visibility = enter > 0 ? "visible" : "hidden";
    comparison.style.transform = `translate3d(0,${70 * (1 - enter)}px,0) scale(${0.96 + 0.04 * enter})`;
    const next = p > 0.5;
    intro.inert = next;
    comparison.inert = !next;
    intro.setAttribute("aria-hidden", String(next));
    comparison.setAttribute("aria-hidden", String(!next));
    comparison.querySelectorAll(".funding-bar").forEach((bar, i) => {
      bar.style.setProperty("--reveal", ease((p - 0.55 - i * 0.045) / 0.23));
    });
  }
  function queue() {
    if (!frame && !disposed) frame = requestAnimationFrame(paint);
  }
  function navigate(event) {
    const target = event.currentTarget.getAttribute("href");
    if (preference.matches) return;
    event.preventDefault();
    const origin = scrollY + track.getBoundingClientRect().top - 96;
    const end = origin + track.offsetHeight - stage.offsetHeight;
    window.scrollTo({
      top: target === "#funding-comparison" ? end : origin,
      behavior: "smooth",
    });
    history.replaceState(null, "", target);
  }
  links.forEach((link) => link.addEventListener("click", navigate));
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue);
  preference.addEventListener("change", queue);
  paint();
  // An incoming comparison link should land on the final pinned frame.
  if (location.hash === "#funding-comparison" && !preference.matches) {
    window.scrollTo({
      top:
        scrollY +
        track.getBoundingClientRect().top -
        96 +
        track.offsetHeight -
        stage.offsetHeight,
      behavior: "instant",
    });
    queue();
  }
  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      links.forEach((link) => link.removeEventListener("click", navigate));
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      preference.removeEventListener("change", queue);
    },
  };
}
