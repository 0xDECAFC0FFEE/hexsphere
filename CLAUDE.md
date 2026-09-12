# Hexagons on a spherical cap

Interactive simulation of 37 tessellating hexagons on a round surface, plus the offline
tooling used to choose the wrapping projection and to verify the geometry.

Not a Brazil package, not a git repo — a standalone scratch project in
`/local/home/tongluca/hexsphere`.

## Requirements

These came from the user across the session. All of them are currently satisfied.

### Geometry
1. Hexagons tessellate a roughly round region of a spherical surface. Perfect regularity
   is understood to be impossible; they must read as hexagons by eye.
2. Exactly **37 hexagons**: one center hexagon plus 3 concentric rings of 6, 12 and 18.
   "Radius of 4 hexagons" counting the center one.
3. The center hexagon sits at the top of the sphere (the +Z pole) — referred to as
   "hex 1" or "the topmost hexagon".
4. **The angle subtended at the sphere center between hex 1's center and any of its six
   ring-1 neighbours' centers is exactly 16.500°.** This is the hard constraint; it holds
   by construction for every projection, and is asserted in the checks.
5. The tiling must not gap or overlap.

### Projection choice
6. Objective, in the user's words: overlay each hexagon with an *ideal* hexagon — equal
   sides, equal angles, **same area** — slide and spin it to maximise the overlapping
   area, and maximise that overlap. The metric is therefore shape-only and scale-free.
7. **Stereographic is the default** as a result (99.31% mean overlap, 99.12% worst, vs
   97.73% / 95.82% for azimuthal equidistant). It is conformal, so it has zero first-order
   shape distortion; the residual is second-order in (hex size / sphere radius).
   Accepted cost: hex area spread grows to 40.7% (from 13.6%), and non-radial neighbour
   angles spread to 14.262–16.500°.
8. Other projections stay selectable for comparison: equidistant, Lambert equal-area,
   gnomonic.

### Display and interaction
9. Every hexagon is labelled with a number. Numbering spirals out from the center:
   1 = center, 2–7 = ring 1, 8–19 = ring 2, 20–37 = ring 3. Ring number and axial q,r are
   alternative label modes.
10. Sidebar lists the **distinct** angles from hex 1 (one representative pair per value,
    e.g. `1:2`, `1:9`, `1:8`, `1:21`, `1:20`) with how many hexes share each value.
    Rows are clickable. Do **not** draw all of those lines on the canvas at once — the
    user rejected that as too busy.
11. **Clicking a hexagon** flies the camera so the line from that hexagon to the sphere
    center is **perpendicular to the screen** — the hexagon ends up dead center, face-on —
    with hex 1 directly above it, and renders the angle between that hexagon and hex 1.
12. **Angles from hex 1 render to 3 decimals**, and the number goes **on the rendered
    wedge itself** — the arc between the two radii out of the sphere center — offset
    sideways so it clears the edge-on wedge. An earlier version put it in a true-size
    corner inset; the user asked for it on the actual angle instead, so the inset is gone.
    Do not reintroduce it.
13. **Angles between neighbouring hexagons render to 1 decimal**, printed on the seam each
    pair shares. The user later asked for these off the sphere, so the toggle exists but
    **defaults off**. Keep the feature; do not turn it back on by default.
14. **Polar coordinates for every hexagon**, about hex 1: `r` = polar angle from hex 1,
    `theta` = azimuth with **the hex 1 → hex 2 line as 0°**, increasing in the direction
    hex 2 → 3 → 4 around ring 1.
    The user wrote "a line from hexagon 0 to hexagon 1 as 0 deg", but their worked examples
    (hex 3 = 60°, hex 10 = 60°, hex 5 = 180°) only hold for the **1-based labels already on
    screen with the axis through hex 2** — that is the convention, and `check.mjs` asserts
    those three examples. Do not renumber to 0-based.
    `theta` is exactly projection-independent: the wrapping only touches polar angle, never
    azimuth. Asserted too (0.0 drift when switching to gnomonic).
    On the sphere: `r` appears **only for the clicked hexagon**, as the wedge label of
    requirement 12 — never per-tile, and never between pairs. `theta` is drawn as the blue
    0° reference meridian through hex 2 plus an accent arc sweeping along the selected
    tile's own small circle, labelled with its value (**on by default**).
    Both labels carry the **bare number** — the user asked to drop the `θ` glyph itself,
    not the rendering, so do not prefix them.
    There is no per-tile polar label mode; `r`/`theta` per hexagon live in the sidebar.
15. **Horizontal mouse movement still spins the sphere about the axis through the topmost
    hexagon**, in every view.
16. Free movement around the scene: orbit, zoom, and a free-fly mode.

## Files

| file | what it is |
|---|---|
| `hex_sphere.html` | **The deliverable.** Self-contained interactive sim: pure canvas 2D plus a hand-rolled 3D projection. No CDN, no build step, works offline and from `file://`. |
| `check.mjs` | Headless test harness. Runs the page's real `<script>` under a stubbed DOM and asserts the geometry and interaction invariants. `node check.mjs`. |

That is the whole project. There was also a Python overlap-metric optimiser and a static
matplotlib render; both had served their purpose and the user had them deleted. The numbers
they produced are recorded below, so don't rebuild them to re-derive the projection choice.

## How the geometry works

A perfect flat hex grid is built in axial coordinates (center-to-center spacing `d = 1`,
pointy-top), then wrapped onto the **unit sphere** by an azimuthal map about the +Z pole:
planar radius `r` maps to polar angle `theta`, azimuth is preserved.

Because the map is a pure function of planar position, two hexes that shared a vertex in
the plane still share it on the sphere — hence no gaps or overlaps, for free, for any
profile `theta(r)`.

Radial profiles, with `rho = k*r`:

| projection | theta(rho) | k solving theta(d) = 16.5° |
|---|---|---|
| equidistant | `rho` | `A` |
| stereographic | `2*atan(rho/2)` | `2*tan(A/2)` |
| Lambert equal-area | `2*asin(rho/2)` | `2*sin(A/2)` |
| gnomonic | `atan(rho)` | `tan(A)` |

`A = 16.5°` in radians. The scale `k` is always solved so requirement 4 holds exactly,
which is why switching projections never breaks the 16.5° step.

All four are one continuous family in a parameter `t`:
`t<0` → `(2/s)asin(s*rho/2)`, `t=0` → `rho`, `t>0` → `(2/s)atan(s*rho/2)` with `s=|t|`.
So `t = -2` orthographic, `-1` Lambert, `0` equidistant, `+1` stereographic, `+2`
gnomonic — a 1-D search space spanning all of them, if the projection choice ever needs
revisiting.

Everything lives on the unit sphere, so every reported angle *is* the angle subtended at
the sphere center, and no radius bookkeeping is needed.

### Why perfect hexagons are impossible
A spherical hexagon with six equal geodesic sides has interior angles greater than 120° —
at this size, 120.69°, which is exactly what the center tile measures. Three of those
meeting at a vertex sum to 362.1°, not 360°, so a regular hexagonal tiling cannot close
up. Gauss–Bonnet fixes the total angle defect over the cap at area/R², so distortion can
be redistributed but never removed. Conformality (stereographic) is the best available:
it zeroes the first-order term.

## Camera model (`hex_sphere.html`)

- World +Z is the pole, so hex 1 is at `[0,0,1]`.
- `cam = { yaw, pitch, roll, dist, mode }`. `pitch` is the elevation of the **look**
  direction, so looking down at the pole is a *negative* pitch.
- Orbit mode derives the eye from `target - fwd*dist`; free-fly moves the eye directly.
- `baseFrame(fwd)` gives the roll-free right/up, falling back to a different reference
  axis when `fwd` is parallel to Z (the exact-pole view, which otherwise collapses).
- `viewFor(tile)` implements requirement 11: `fwd = -normalize(tile.center)`, then roll so
  hex 1 lands screen-up. **That roll always evaluates to zero** while hex 1 is at the
  pole, because the pole, the tile's radius and the world Z axis are coplanar — which is
  exactly why requirement 15 comes for free: yaw is a rotation about Z, and Z's projection
  is a fixed point of it, so horizontal drag spins the sphere with hex 1 pinned in place.
  Keep the roll machinery — it is what makes this provable rather than accidental, and it
  is needed if hex 1 ever moves off the pole.
- Rendering is painter's algorithm over depth-sorted tiles with exact horizon culling
  (`dot(normal, eye - point) > 0`); the sphere is drawn from its exact silhouette circle
  (center `n/d`, radius `sqrt(1 - 1/d²)`), not an approximation.
- Labels and seam angles are drawn in **separate passes after** all tiles are filled, so
  a nearer neighbour can never paint over a number.

## Verifying changes

```bash
node check.mjs                 # geometry + interaction invariants, ~instant
```

`check.mjs` extracts the page's `<script>`, runs it via `new Function` with a stubbed
`document`/canvas, and reaches into the closure through an appended export block. It
checks:
- the panel's own measured numbers (so the UI cannot report something the geometry does
  not support);
- 16 frames across all 4 projections without a runtime error;
- **picking**: every front-facing tile picks itself when clicked at its centroid;
- **fly-to**: for hexes 37, 21, 8, 2 and 1, the view axis is the tile's own radius and hex
  1 is straight up, both to floating-point zero (hex 1 is the pole-singularity case);
- **x-drag**: a synthetic 140 px horizontal drag moves hex 1 by 0.0 px while hex 21 moves
  ~165 px, with pitch and roll unchanged;
- **polar coords**: the user's three worked examples, and that theta does not drift when
  the projection changes. It also prints the full 37-row table.

Expected numbers at the defaults (stereographic, 16.5°, 3 rings):

```
37 hexes, 1 + 6 + 12 + 18
center -> ring 1     16.500 deg (all six, exact)
all neighbours       14.262 - 16.500 deg
hex edge             7.623 - 9.537 deg   (25.1% spread)
area spread          40.7%
cap half-angle       53.970 deg
sphere R / hex step  3.4484
distinct angles from hex 1:
  1:2  16.500   x6
  1:9  28.195   x6
  1:8  32.343   x6
  1:21 41.975   x12
  1:20 47.016   x6
```

Polar coordinates, compactly (r depends on the projection, theta never does):

| hexes | r | theta |
|---|---|---|
| 1 | 0.000° | — (pole has no azimuth) |
| 2–7 (ring 1) | 16.500° | 0, 60, 120, 180, 240, 300 |
| 8, 10, 12, 14, 16, 18 (ring 2 corners) | 32.343° | 0, 60, 120, 180, 240, 300 |
| 9, 11, 13, 15, 17, 19 (ring 2 edges) | 28.195° | 30, 90, 150, 210, 270, 330 |
| 20, 23, 26, 29, 32, 35 (ring 3 corners) | 47.016° | 0, 60, 120, 180, 240, 300 |
| 21, 22, 24, 25, … (ring 3 edges) | 41.975° | 19.107 and 40.893, then +60 each |

For a visual check, headless Firefox works on this box:

```bash
firefox --headless --window-size=1500,950 --screenshot /tmp/shot.png \
  file:///local/home/tongluca/hexsphere/hex_sphere.html
```

## Environment gotchas

- **No scipy** on this box (numpy 1.21, matplotlib 3.5.3), so any Python numerics have to
  hand-roll their own optimisers. `node` is v24; Chromium is not installed.
- Headless Firefox screenshots are **flaky about timing**: it sometimes captures before
  the first `requestAnimationFrame`, giving a fully blank canvas with a correctly rendered
  sidebar. That is a capture artifact, not a bug — retry before debugging. (A blank canvas
  *with* no HUD text and a populated sidebar is the signature.)
- To screenshot a specific state, inject a line before `</script>` in a copy under `/tmp`,
  e.g. selecting a tile and skipping the fly-to animation:
  `selected=tiles.find(t=>t.index===8);Object.assign(cam,viewFor(selected));anim=null;syncEye();refreshSelection();`

## Conventions in this project

- The sidebar only ever shows numbers **measured from the built 3D geometry**, recomputed
  on every rebuild. Never hardcode a value into the panel.
- Angle precision is deliberate: **3 decimals** for angles from hex 1 and for polar
  coordinates in the sidebar, **1 decimal** for neighbour angles on the seams.
- The sphere stays sparse on purpose. What it shows by default: hexagon numbers, the
  selected hexagon's `r` on its wedge, and the 0°-line + azimuth arc with its value.
  Seam angles are behind an off-by-default toggle. When adding a readout, default to the
  sidebar; the user has twice asked for canvas clutter to be removed.
- Comments explain *why* (the constraint being satisfied, the singularity being dodged),
  not what the line does. No HTML tags in comments.
