// Headless harness: pull the <script> out of hex_sphere.html, stub just enough DOM to
// run it, then exercise the geometry and the render loop to catch runtime errors.
import fs from "node:fs";

const html = fs.readFileSync("/local/home/tongluca/hexsphere/hex_sphere.html", "utf8");
const code = html.split("<script>")[1].split("</script>")[0];

const ctxStub = new Proxy({}, {
  get: (t, k) => {
    if (k === "createRadialGradient") return () => ({ addColorStop() {} });
    if (k === "measureText") return () => ({ width: 10 });
    if (k === "canvas") return elStub("canvas");
    return () => {};
  },
  set: () => true,
});

function elStub(id) {
  const e = {
    id, value: "0", checked: false, textContent: "", innerHTML: "",
    clientWidth: 1200, clientHeight: 800, width: 1200, height: 800,
    style: {}, tagName: "DIV", dataset: {},
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    addEventListener(type, fn) { (this._h ||= {})[type] = fn; },
    setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 800 }),
    getContext: () => ctxStub,
  };
  // give the sliders their documented defaults so build() sees real parameters
  if (id === "sAngle") e.value = "16.5";
  if (id === "sRings") e.value = "3";
  if (id === "sGap") e.value = "0";
  if (id === "proj") e.value = "equidistant";
  if (id === "sphereMode") e.value = "solid";
  return e;
}

const els = new Map();
const getEl = id => {
  if (!els.has(id)) els.set(id, elStub(id));
  return els.get(id);
};

let rafCb = null;
const g = globalThis;
g.document = {
  getElementById: getEl,
  addEventListener() {},
  querySelectorAll: () => [],          // the angle-table rows are DOM-only decoration
};
g.window = g;
g.addEventListener = () => {};
g.devicePixelRatio = 1;
g.performance = performance;
g.requestAnimationFrame = cb => { rafCb = cb; return 1; };

// Run the page script. Its top-level bindings are function-scoped inside new Function,
// so append an export block to reach in and test the internals.
const api = new Function(code + `
  return {
    get tiles() { return tiles; },
    get lastDrawable() { return lastDrawable; },
    get angleGroups() { return angleGroups; },
    get selected() { return selected; },
    get cam() { return cam; },
    hitTest, selectTile, camBasis, angleAtCenter, norm, cross, dot, makeProjector,
  };`)();

// --- geometry checks, read straight off the panel table the page just wrote
const table = getEl("stats").innerHTML;
const rows = [...table.matchAll(/<td class="k">(.*?)<\/td><td class="v">(.*?)<\/td>/g)]
  .map(m => [m[1], m[2].replace(/&rarr;/g, "->").replace(/&deg;/g, " deg")
                       .replace(/&ndash;/g, "-").replace(/&mdash;/g, "-")]);
console.log("panel stats:");
for (const [k, v] of rows) console.log("  " + k.padEnd(20) + v);

// --- drive several frames at each preset / projection to smoke out render errors
let frames = 0;
let t = 1000;
const run = n => { for (let i = 0; i < n; i++) { rafCb(t += 16); frames++; } };

for (const p of ["equidistant", "stereographic", "lambert", "gnomonic"]) {
  getEl("proj").value = p;
  run(4);
}
console.log(`\nrendered ${frames} frames across 4 projections with no errors`);

// --- selection: click the center of every tile on screen and check we pick that tile
run(2);                                        // make sure lastDrawable is populated
const drawn = api.lastDrawable.length;
let hits = 0, wrong = 0;
for (const d of api.lastDrawable) {
  let cx = 0, cy = 0;
  for (const p of d.poly) { cx += p[0] / d.poly.length; cy += p[1] / d.poly.length; }
  if (api.hitTest(cx, cy) === d.t) hits++; else wrong++;
}
console.log(`picking: ${hits}/${drawn} front tiles pick themselves at their centroid` +
            (wrong ? `  (${wrong} WRONG)` : ""));

// --- fly-to: after selecting a tile the camera must look straight down that tile's own
// radius (so the tile-to-center line is perpendicular to the screen), with hex 1 directly
// above it on screen. Checked for a rim tile, a ring-1 tile and hex 1 itself (the pole,
// where the roll-free frame degenerates).
const dotv = (u, v) => api.dot(u, v);
for (const idx of [37, 21, 8, 2, 1]) {
  const target = api.tiles.find(t => t.index === idx);
  api.selectTile(target);
  run(80);                                     // let the 0.7 s animation finish
  const basis = api.camBasis();
  const a = api.tiles[0].center, b = api.norm(target.center);
  // view axis vs the tile's radius: fwd should be exactly -b
  const axisErr = Math.abs(dotv(basis.fwd, b) + 1);
  // hex 1 should project straight up: its component perpendicular to b aligns with up
  let want = [a[0] - b[0]*dotv(a, b), a[1] - b[1]*dotv(a, b), a[2] - b[2]*dotv(a, b)];
  const wl = Math.hypot(...want);
  const upErr = wl < 1e-9 ? 0 : Math.abs(dotv(api.norm(want), basis.up) - 1);
  const deg = api.angleAtCenter(a, target.center);
  const ok = axisErr < 1e-9 && upErr < 1e-9 ? "ok" : "FAIL";
  console.log(`  hex ${String(idx).padEnd(2)} ${ok}  radius-perpendicular-to-screen err ` +
              `${axisErr.toExponential(1)}, hex-1-straight-up err ${upErr.toExponential(1)}, ` +
              `1:${idx} = ${deg.toFixed(3)} deg`);
}

// --- horizontal dragging must spin the sphere about the axis through hex 1 (the pole):
// hex 1 stays put on screen, everything else moves, and the camera's tilt is untouched.
const cvEl = getEl("cv");
const sel = api.tiles.find(t => t.index === 21);
api.selectTile(sel);
run(80);
const before = api.makeProjector();
const pole0 = before(api.tiles[0].center), tile0 = before(sel.center);
const pitch0 = api.cam.pitch, roll0 = api.cam.roll;
cvEl._h.pointerdown({ clientX: 600, clientY: 400, pointerId: 1 });
cvEl._h.pointermove({ clientX: 740, clientY: 400, pointerId: 1 });   // pure x movement
cvEl._h.pointerup({ clientX: 740, clientY: 400, pointerId: 1 });
run(1);
const after = api.makeProjector();
const pole1 = after(api.tiles[0].center), tile1 = after(sel.center);
const poleMoved = Math.hypot(pole1[0] - pole0[0], pole1[1] - pole0[1]);
const tileMoved = Math.hypot(tile1[0] - tile0[0], tile1[1] - tile0[1]);
console.log(`\nx-drag spin: hex 1 moved ${poleMoved.toExponential(1)} px, ` +
            `hex 21 moved ${tileMoved.toFixed(1)} px, ` +
            `pitch delta ${Math.abs(api.cam.pitch - pitch0).toExponential(1)}, ` +
            `roll ${roll0.toExponential(1)} -> ${api.cam.roll.toExponential(1)}  ` +
            `${poleMoved < 1e-9 && tileMoved > 1 ? "ok" : "FAIL"}`);

// --- polar coordinates: r from hex 1, theta from the hex 1 -> hex 2 line.
// The user's spec by example: hex 3 = 60 deg, hex 10 = 60 deg, hex 5 = 180 deg.
const EXPECT_THETA = { 2: 0, 3: 60, 5: 180, 10: 60 };
let bad = 0;
for (const [idx, want] of Object.entries(EXPECT_THETA)) {
  const t = api.tiles.find(x => x.index === +idx);
  if (Math.abs(t.theta - want) > 1e-9) {
    bad++;
    console.log(`  THETA MISMATCH hex ${idx}: got ${t.theta.toFixed(6)}, want ${want}`);
  }
}
console.log(`\npolar spec examples: ${bad ? bad + " WRONG" : "all match (hexes 2, 3, 5, 10)"}`);
// theta must be projection-independent (azimuth is untouched by the wrapping)
const thetaBefore = api.tiles.map(t => t.theta);
getEl("proj").value = "gnomonic";
getEl("proj")._h.change({ target: { value: "gnomonic" } });
const drift = Math.max(...api.tiles.map((t, i) =>
  t.theta === null ? 0 : Math.abs(t.theta - thetaBefore[i])));
getEl("proj")._h.change({ target: { value: "stereographic" } });
console.log(`theta drift when switching projection: ${drift.toExponential(1)} deg`);

console.log("\npolar coordinates (r, theta) of all 37 hexagons:");
for (const t of api.tiles) {
  console.log(`  hex ${String(t.index).padStart(2)}  ring ${t.ring}  ` +
              `r ${t.rho.toFixed(3).padStart(7)}   ` +
              `theta ${t.theta === null ? "     -" : t.theta.toFixed(3).padStart(7)}`);
}

// --- the distinct-angle list that the sidebar shows
console.log("\nangles from hex 1 (distinct values):");
for (const grp of api.angleGroups) {
  console.log(`  1:${String(grp.rep.index).padEnd(3)} ${grp.angle.toFixed(3).padStart(7)} deg` +
              `   shared by ${grp.members.length} hexes`);
}
