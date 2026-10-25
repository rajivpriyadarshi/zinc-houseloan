// One seekable score; the paper feed and printing share the same clock.
export const STORY = Object.freeze({
  title: 0.08,
  titleDock: 1.05,
  loan: 1.85,
  pullback: 3.65,
  down: 4.1,
  property: 5.35,
  interiors: 6.75,
  furniture: 7.7,
  duty: 11.1,
  summary: 13.75,
  print: 15,
  detach: 18.45,
  total: 19,
  end: 20.25,
});
export const clamp = (v) => Math.max(0, Math.min(1, v));
export const ease = (t) => {
  const x = clamp(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
export const progress = (time, start, duration = 1) =>
  ease((time - start) / duration);
export const mix = (a, b, t) => a + (b - a) * t;
// The camera and chart share this envelope so the overview becomes opaque exactly on return.
export const interiorFocus = (time) =>
  clamp(
    progress(time, STORY.interiors, 1.05) *
      (1 - progress(time, STORY.duty - 0.7, 1.05)),
  );
export function costEmphasis(time) {
  const down =
    progress(time, STORY.down, 0.4) *
    (1 - progress(time, STORY.property - 0.35, 0.35));
  const interiors = interiorFocus(time);
  return [
    mix(1, 0.55, Math.max(down, interiors)),
    mix(1, 0.55, interiors),
    mix(1, 0.55, down),
    mix(1, 0.55, Math.max(down, interiors)),
  ];
}
export const chapters = [
  {
    at: 0,
    name: "loan",
    line: "Your home loan may cover 80% of the property price.",
  },
  {
    at: STORY.down,
    name: "down",
    line: "You bring the remaining 20% as a down payment.",
  },
  {
    at: STORY.property,
    name: "property",
    line: "Together, these cover the price of your house.",
  },
  {
    at: STORY.interiors,
    name: "interiors",
    line: "Then come the interiors. Let’s make it feel like home.",
  },
  {
    at: STORY.duty,
    name: "duty",
    line: "Add stamp duty and registration to make it yours.",
  },
  {
    at: STORY.summary,
    name: "summary",
    line: "Here’s what you’ll need beyond your home loan.",
  },
];
export const money = (amount) =>
  amount >= 10000000
    ? `₹${(amount / 10000000).toFixed(2)} Cr`
    : `₹${(amount / 100000).toFixed(2)} L`;
// Damped step response, exact endpoints. Overshoot is for geometry, never money.
export function spring(time, start, duration = 0.85, damping = 0.66) {
  const t = (time - start) / duration;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const w = 12,
    wd = w * Math.sqrt(1 - damping * damping);
  return (
    1 -
    Math.exp(-damping * w * t) *
      (Math.cos(wd * t) + ((damping * w) / wd) * Math.sin(wd * t))
  );
}
export function chartCamera(time, layout) {
  const pull = progress(time, STORY.pullback, 1.25);
  const zoom = mix(
    Math.min(1.85, (layout.height - 66) / layout.segments[0].height),
    1,
    pull,
  );
  const center = mix(layout.height * 0.5 + 8, layout.segments[0].center, pull);
  return {
    pull,
    zoom,
    width: mix(2.1, 1, pull),
    x: mix(layout.width / 2 - 186, layout.barX, pull),
    y: center - layout.segments[0].center * zoom,
  };
}
export function chartLayout(width, height, budget) {
  const barHeight = Math.min(350, height - 60),
    bottom = height - 24,
    gap = 10;
  const values = [budget.loan, budget.down, budget.interiors, budget.duty];
  let cursor = bottom;
  const segments = values.map((value, index) => {
    const h = (barHeight * value) / budget.total;
    const top = cursor - h;
    cursor = top - gap;
    return { value, height: h, top, center: top + h / 2, index };
  });
  const paperWidth = 430,
    paperHeight = 334,
    paperX = (width - paperWidth) / 2,
    paperY = Math.max(0, (height - paperHeight) / 2);
  return {
    width,
    height,
    bottom,
    barX: width * 0.56,
    initialX: width / 2 - 148,
    segments,
    paperWidth,
    paperHeight,
    paperX,
    paperY,
    rowY: [paperY + 111, paperY + 155, paperY + 199],
  };
}

// Feed in short motor-driven passes, easing between each pause at a printed row.
export function faxMotion(time, layout) {
  const passes = [
    [0, 0],
    [0.36, 0.2],
    [0.72, 0.32],
    [1.1, 0.43],
    [1.46, 0.56],
    [1.84, 0.7],
    [2.22, 0.82],
    [2.64, 0.94],
    [3.1, 1],
  ];
  const local = time - STORY.print;
  let feed = local >= 3.1 ? 1 : 0;
  for (let i = 1; i < passes.length; i++) {
    const [a, y] = passes[i - 1],
      [b, z] = passes[i];
    if (local >= a && local < b) {
      feed = mix(y, z, progress(local, a, b - a));
      break;
    }
  }
  const dock = progress(time, STORY.detach, 1.05);
  const machineIn = spring(time, STORY.summary + 0.28, 0.95, 0.83);
  const machineOut = progress(time, STORY.detach + 0.4, 0.85);
  const slot = layout.height * 0.68 + 10;
  return {
    feed,
    dock,
    slot,
    machineY: slot - 20 + (1 - machineIn) * 190 + machineOut * 270,
    machineOpacity:
      progress(time, STORY.summary + 0.28, 0.3) * (1 - machineOut),
    paperY:
      dock === 1
        ? layout.paperY
        : mix(slot - 343, layout.paperY, dock) - Math.sin(dock * Math.PI) * 16,
    paperScale: mix(0.68, 1, dock),
    paperTurn: dock === 1 ? 0 : Math.sin(dock * Math.PI) * -2.2,
    ink: (y) => progress(feed * 343, y, 22),
  };
}
