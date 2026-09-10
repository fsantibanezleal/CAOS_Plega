# PLEGA geometry: restricted paper mechanisms

The engine uses the following independently derived rigid-panel models and constructive print patterns. All coordinates are millimetres. The supported scope is a one-sheet parallel step and a glued symmetric triangular V-fold, with up to six separated motion lanes. This is a zero-thickness geometric model, not a physical assembly test.

## 1. Evidence and scope of the derivation

[Winder, Magleby and Howell, Kinematic Representations of Pop-Up Paper Mechanisms, 2009, DOI 10.1115/1.3046128](https://fab.cba.mit.edu/classes/865.18/discrete/folding/KinematicPaperMechanisms.pdf) treats planar and spherical linkage representations, distinguishes one-piece and layered mechanisms, and notes endpoint/change-point behavior. [Li, Ju, Gu and Hu, A Geometric Study of V-style Pop-ups, 2011](https://cg.cs.tsinghua.edu.cn/people/~xianying/Papers/V-Popup/index.html), [compact paper](https://cg.cs.tsinghua.edu.cn/people/~xianying/Papers/V-Popup/vpopup%281.8M%29.pdf), supplies broader sufficient conditions for a particular geometric class. Its rigid, zero-thickness model does not predict real material mechanics. [Glassner's original treatment](https://www.glassner.com/wp-content/uploads/2014/04/CG-CGA-PDF-02-03-Pop-Up-Cards-2-Mar02.pdf) discusses interactive construction and numerical collision sampling. [Warwick's practical teaching resources](https://warwick.ac.uk/fac/sci/wmg/about/outreach/resources/paperengineering/) establish the relevance of V-fold/box construction, tolerances and assembly.

The formulas and proofs below are an independent elementary derivation for just the specified rectangles and triangles. They do not implement or claim the full Li et al. theorem. No source figure, template or artwork is copied. Formula checks by arithmetic are not physical validation.

Assume perfectly rigid panels, zero-thickness straight hinges, no friction, no gravity, no material stretch and no glue failure. Geometry describes a permitted motion, not required force or life expectancy. Contact at the exactly closed endpoint is expected. Printed fold instructions select a branch that is not uniquely determined at every flat endpoint.

## 2. Coordinates and units

- All design coordinates and print dimensions are in millimetres. Compute angles in radians; display degrees.
- Each base page has width `W` away from the gutter and height `H` along it. The fully open blank has coordinates `x in [-W,W]`, `y in [0,H]`, `z=0`. The gutter is `x=0`.
- The paper's printed/inside face has normal `+z` in the flat template. Use consistent front-side mountain/valley labels. The reverse view must invert the visual interpretation, not silently reuse front labels.
- Book opening angle `theta=0` is closed and `theta=pi` is fully open. A composed card uses the common symmetric book frame defined below; cameras may change without changing that frame.
- Optional manufacturing margin `m`, tab width `t`, tab endpoint inset `g` and inter-module gap are user-visible design settings. They are not a calibrated paper-mechanics model.

## 3. Family P: one-sheet parallel step

Parameters: left attachment distance `a>0`, right attachment distance `b>0`, gutter interval `[y0,y1]` with width `w=y1-y0>0`, and base dimensions. Define right-page direction `v=(1,0,0)` and left-page direction `u(theta)=(cos(theta),0,sin(theta))`. For each endpoint `y` of the interval:

```text
O(y) = (0,y,0)
A(y) = O(y) + a*u(theta)
B(y) = O(y) + b*v
C(y) = O(y) + a*u(theta) + b*v
```

Moving panel P1 is rectangle `A(y0),C(y0),C(y1),A(y1)`. P2 is `C(y0),B(y0),B(y1),C(y1)`. Hinge axes are all parallel to y. The base surface must contain the actual cut slot; do not render solid uncut base paper through the module.

**Analytic invariants and limits:** `|AC|=b`, `|BC|=a`, panel widths remain `w`, adjacent edges remain perpendicular and shared hinge points are identical. For `0<theta<pi`, `u` and `v` are linearly independent. In their cross-section basis the moving edges have coordinates `(a,s)` for `0<=s<=b` and `(s,b)` for `0<=s<=a`; therefore they meet only at `(a,b)` and touch the base-page rays only at their assigned attachment points. Extrusion along the disjoint y interval preserves this nonintersection argument. At `theta=0`, C is at distance `a+b` from the gutter. At `theta=pi` the original strip lies in the original blank. Endpoint contacts and change points are not interior collisions.

Thus a sufficient closed-page fit is `a+b <= W-m`, with `m <= y0 < y1 <= H-m`. At 90 degrees the step height is `a`, depth is `b`, and width is `w`. It becomes flat again at 180 degrees: call it a **90-degree display step**, not a structure that remains raised on a fully open card.

### Exact print construction

At `theta=pi`, `A_x=-a`, `B_x=b`, `C_x=b-a`. Consequently:

1. Cut two **open** segments, from `(-a,y0)` to `(b,y0)` and from `(-a,y1)` to `(b,y1)`. Do not close them into a rectangular cutout: that would detach the mechanism.
2. Score side hinges `x=-a` and `x=b` between y0 and y1 as valleys.
3. Score the middle hinge `x=b-a` between y0 and y1 as a mountain.
4. Score the main gutter `x=0` only outside the module's y interval, as a valley.

For an asymmetric step, the middle mountain is **not at the original gutter**. The left moving rectangle has net width b and the right moving rectangle width a. A generic "cut across the fold and push it inward" construction on an already creased card introduces an extra hinge when `a!=b`; allow asymmetric steps only on an initially uncreased blank. The prefolded-card preset enforces `a=b`.

For verification, the net mapping is also explicit: on P1, a point with flat x maps to `O+a*u+(x+a)*v`; on P2 it maps to `O+(b-x)*u+b*v`. These agree at `x=b-a`. Front normal and signed hinge rotations give side-valley/middle-mountain/side-valley assignments. Art initially stays printed within each rectangle; no geometry-changing decorative attachment is part of this certificate.

Assembly: print at actual size; check ruler; cut only the two slit segments; precrease the marked valleys and mountain; fold the base while guiding the strip into the book's interior; display at 90 degrees. A backing sheet is optional aesthetic finishing and is not glued across any moving fold.

## 4. Family V: symmetric triangular V-fold

Parameters: origin `O=(0,y0,0)` on the gutter, equal attachment lengths `r>0`, shared ridge length `h>0`, base attachment angle `beta`, and angle `gamma` within each triangular panel. The mathematical condition is `0<beta<pi/2` and `beta<gamma<pi-beta`. A conservative initial product domain is `20deg<=beta<=45deg`, `beta+15deg<=gamma<=90deg`. This margin avoids a near-singular mechanism and simplifies the tab layout.

Use a symmetric coordinate system about the open book's bisector. Let `q=theta/2`, `s=sin(beta)`, `A=cos(beta)`, `B=s*cos(q)`, `K=cos(gamma)`, `R2=A*A+B*B`, and `D=sqrt(R2-K*K)`.

```text
aL = (-s*sin(q), A, B)
aR = ( s*sin(q), A, B)
cy = (A*K - B*D) / R2
cz = (B*K + A*D) / R2
c  = (0,cy,cz)
L  = O + r*aL
R  = O + r*aR
C  = O + h*c
```

The physical panels are triangles OLC and ORC, sharing crease OC. The attachment hinges are OL and OR. At `theta=pi`, the card is the ordinary flat xy blank; at `theta=0`, both pages are in the same yz plane. Their across-page coordinate in the closed view is z, not x.

### Derivation and invariants

Symmetry and the two fixed panel angles require `c_x=0`, `A*cy+B*cz=K`, and `cy*cy+cz*cz=1`. The displayed formulas solve that line-circle intersection with the interior branch `cz>0`. Since `|K|<A`, `R2-K*K>0` throughout the opening range, and the chosen `cz` remains positive. The other solution lies outside the intended interior branch. Therefore, for `theta>0`, the pages determine a unique interior ridge direction within this restricted model.

Both `aL` and `aR` have unit length; `aL dot c = aR dot c = cos(gamma)`. It follows that the three edge lengths of each triangle are invariant:

```text
OL = OR = r
OC = h
LC = RC = sqrt(r*r+h*h-2*r*h*cos(gamma))
```

For `0<theta<=pi`, L has negative x, R positive x, and O/C zero x. The triangles occupy opposite closed x half-spaces and meet only along OC. For `0<theta<pi`, the book's interior wedge is `z >= cot(q)*abs(x)`; attachment edges are on its boundary and C is strictly inside. Convexity places each triangle interior inside that wedge. At `theta=pi`, page planes are z=0 while the ridge has positive z. Thus the two triangles do not cross each other or the base pages during the supported interior motion. This proof does not cover added riders, nested mechanisms, cut-away hinges, finite thickness or arbitrary polygons.

### Closed footprint and useful extrema

At closure:

```text
L_closed = R_closed = (across=r*sin(beta), along=y0+r*cos(beta))
C_closed = (across=h*sin(beta+gamma), along=y0+h*cos(beta+gamma))
O_closed = (0,y0)
```

Check those three vertices against the page rectangle, allowing the origin on the gutter. Convexity then covers the full triangle. Check the fixed glue polygons separately. Positive m may be required away from the gutter and page edge according to the selected manufacturing preset.

At full opening, `cy=cos(gamma)/cos(beta)` and `cz=sqrt(1-cy*cy)`. Hence ridge height is `h*cz`. When `gamma=90deg`, the ridge is vertical and has height h. A lean is a consequence of beta/gamma, not an independently editable pose that can violate triangle dimensions.

For composition, cy increases from `cos(beta+gamma)` at closure to `K/A` at full opening. An independent check follows by implicit differentiation: `d(cy)/dB=-cz*cz/D<0`, while B decreases as theta increases. An exact conservative y interval for the moving triangles is therefore:

```text
[ y0 + min(0,h*cos(beta+gamma)),
  y0 + max(r*cos(beta),h*cos(gamma)/cos(beta)) ]
```

Including the tabs defined below gives the complete module interval, expressed as offsets from y0:

```text
lo = min(0, h*cos(beta+gamma), g*cos(beta)-t*sin(beta))
hi = max(r*cos(beta), h*cos(gamma)/cos(beta))
```

The fixed tabs' lowest y offset is `g*cos(beta)-t*sin(beta)` and their highest is `(r-g)*cos(beta)`, which cannot exceed the attachment endpoint already included in hi. This bound therefore includes moving panels, attachment hinges and all fixed glue footprints throughout the full motion. The maximum closed across-page extent, also including tabs, is:

```text
max(r*sin(beta), h*sin(beta+gamma), (r-g)*sin(beta)+t*cos(beta))
```

Require this to be at most `W-m`. The y lane test below checks both closed fit and full-motion separation. These are conservative product constraints: an arrangement outside this supported domain is not automatically physically impossible.

### Exact print net and tabs

Use a separate initially flat insert with:

```text
o=(0,0), c0=(0,h)
l0=(-r*sin(gamma), r*cos(gamma))
r0=( r*sin(gamma), r*cos(gamma))
```

The two triangles `o-l0-c0` and `o-r0-c0` share `o-c0`. Their union can be cut as one insert. Score OC as a mountain from the printed/front side. For each attachment edge, add one rectangular glue tab only between distances g and r-g along that edge; require `0<2g<r` and `t>0`. Use outward unit normals:

```text
vL=(-sin(gamma),cos(gamma)); nL=(-cos(gamma),-sin(gamma))
vR=( sin(gamma),cos(gamma)); nR=( cos(gamma),-sin(gamma))
tab(v,n) = [g*v, (r-g)*v, (r-g)*v+t*n, g*v+t*n]
```

Tab hinges are valleys. Tapering or beveling tab corners may be added later only while preserving their attachment edge and material width. The supported domain `gamma<=90deg` keeps the two tabs on opposite sides of the insert centre. Polygon-union and self-intersection checks must still validate the exported net.

Print the base placement outlines using the same construction with `gamma` replaced by `beta`, translated by `(0,y0)`, and hinge length r. These are congruent to the insert tabs; their outer directions point away from the gutter. Label left/right tab pairs and glue the **back** of each tab to its matching base outline. No glue belongs on OC or in the gutter. The endpoint inset leaves an unglued region near the common hinge origin. A fold-only animation can explain placing the tabs; it must not pretend to simulate adhesive.

Assembly: print and verify scale; cut the insert perimeter; score its ridge mountain and the two tab valleys; fold the base valley; align the labelled tab outlines; attach tabs without covering their hinges; close gently along the selected branch; reopen. Artwork stays inside the supported triangles, with a keep-out strip near hinges. PLEGA does not promise automatic silhouette cutting from arbitrary uploaded SVG.

## 5. Multiple modules, diagnosis and repair

### One common book frame

For a card containing both families, use the V family's symmetric frame, whose right and left page directions are `eR=(sin(q),0,cos(q))` and `eL=(-sin(q),0,cos(q))`, where `q=theta/2`. Transform every P point from its local frame by a rotation around y through `alpha=q-pi/2`:

```text
R_y(alpha)(x,y,z) =
  (cos(alpha)*x + sin(alpha)*z,
   y,
   -sin(alpha)*x + cos(alpha)*z)
```

This maps P's v to eR and u to eL. At full opening it is the identity. Lengths, rigidity and all y bounds are unchanged. The preview must render one shared base with P's slit regions removed, and V's tabs attached to the corresponding remaining page regions. Rendering each family in its own unconverted orientation would produce an invalid mixed preview.

### Constructive continuous separation for up to six mechanisms

Support one to six modules, each in a separately ordered gutter lane. Six is a product/UI limit, not a mathematical limit. A P module of width w has local y bounds `[0,w]`; a V module has the exact conservative `[lo,hi]` above, including its tabs. Set `ell_i=hi_i-lo_i`, positive inter-module gap d, and page-edge margin m. For origins y_i, require:

```text
y_1 + lo_1 >= m
y_i + hi_i + d <= y_(i+1) + lo_(i+1)   for every adjacent pair
y_n + hi_n <= H-m
```

With fixed module dimensions, freely translatable origins, fixed order, and no pinned origins, the necessary and sufficient capacity condition for these interval constraints is:

```text
sum(ell_i) + (n-1)*d <= H-2*m
```

A constructive placement is `b_1=m`, `b_i=m+sum(ell_j+d for j<i)`, followed by `y_i=b_i-lo_i`. Any remaining space may be left above the last lane or distributed by an explicitly stated spacing rule. With pinned origins, check the full inequalities; total capacity alone is no longer sufficient. Do not silently move a pinned origin. A later solver may perform constrained interval placement, but it is unnecessary for the initial repair menu.

**Why this certifies whole-motion separation:** every module vertex remains in its fixed closed y slab for every theta, as proved by the P extrusion and V monotonic extrema. Each panel and tab is a convex polygon, so every point on it also remains in the slab. The common book-frame rotation preserves y. Distinct slabs have a positive separating gap; therefore no two modules can intersect at any opening angle. This is a continuous geometric argument, not sampled animation evidence. The same separation keeps base slits, glue footprints and attachment hinges from another module's material. It does not model paper thickness, bending during handling, adhesive or user-added geometry.

Rotating modules around the gutter, overlapping or nesting arbitrary mechanisms is outside this certificate. An overlap of conservative intervals means **not certified by this rule**, not a proven collision. A displayed pair of intersecting non-adjacent triangles at a particular pose is a positive collision witness; failure to find one in sampled poses is not a continuous certificate. Optional decorative content must remain ink within the current faces, so that it does not enlarge the certified swept geometry.

If capacity fails, present explicit alternatives: a taller card, a selected narrower/shorter mechanism, a smaller chosen gap, or fewer mechanisms. Preserve all pinned dimensions and rerun both width and lane constraints. Resizing may also violate a chosen minimum tab or readable-artwork size, so those checks run after a geometric repair. Reordering does not improve total capacity for freely translated intervals, although it can resolve conflicts with pinned origins or a user's desired composition.

Diagnostics should answer a concrete question with highlighted geometry and dimensions:

- "This step closes to 55 mm but only 45 mm is available." Offer reduced depth while height is pinned, proportional scale, or a larger card. Revalidate after each candidate change.
- "The asymmetric strip needs its middle crease 5 mm from the gutter." Move the score line, or use equal attachment distances on a prefolded card. Do not preserve an extra unintended crease.
- "These panel angles cannot reach the requested opening." Show negative discriminant or a domain-bound failure. Offer the nearest allowed gamma with beta pinned, or vice versa. A domain limit and an impossible real-valued pose are different reasons.
- "The closed ridge leaves the page at its lower edge." Move the gutter origin into the exact permitted interval or shorten h. Show the closed view beside the open one.
- "These mechanisms occupy overlapping motion zones." Offer a separated layout. Do not falsely call a merely uncertified arrangement geometrically impossible.

Repairs are constrained proposals with a visible before/after and undo. Preserve the user's pinned parameters. Do not call a change "minimum" unless the stated distance metric and search domain have actually been solved. Small finite alternatives are sufficient for a useful first workflow.

## 6. Numeric fixtures for an independent checker

All coordinates below use the respective family's coordinate convention and millimetres. V fixtures use O=(0,y0,0). Decimal values are rounded references, not physical measurement precision.

| Fixture | Inputs | Expected result |
| --- | --- | --- |
| P-valid-asymmetric | W90,H140,a25,b30,y0=40,y1=72 | Net middle crease x=5; closed reach55; at90deg C=(30,y,25); both moving panels25/30 by opposite-side assignment. |
| P-valid-prefolded | W90,H140,a20,b20,y0=30,y1=65 | Middle crease at gutter; closed reach40. |
| P-overwidth | W50,m5,a25,b30 | Available45, closed reach55. With a pinned25, b=20 satisfies the selected margin. |
| P-wrong-hinge | P-valid-asymmetric but middle score forced x=0 | Reject as not the specified parallel-step net. Do not claim this rules out every other possible linkage. |
| P-detached-cut | Close the two slit segments into a rectangle | Reject: side hinges have been cut away. |
| V-lean-closed | beta30deg,gamma 60 deg,r40,h50,y0=55,theta0 | L/R=(0,89.641016,20); C=(0,55,50). Closed footprint fits W90,H140. |
| V-lean-half | Same,theta90deg | L=(-14.142136,89.641016,14.142136), R has opposite x; C=(0,63.771669,49.224565). cy=.1754333768,cz=.9844913053. |
| V-lean-open | Same,theta180deg | L=(-20,89.641016,0), R has opposite x; C=(0,83.867513,40.824829). |
| V-vertical | beta30deg,gamma 90 deg,r40,h50,y0=60 | At180deg C=(0,60,50); at0deg C=(0,35,43.301270). |
| V-no-real-open | beta40deg,gamma30deg | At180deg `D^2=-.1631759112`; reject. A pose at90deg may still exist, so one plausible preview is insufficient. |
| V-overwidth | beta30deg,gamma 60 deg,r40,h70,W60,m5 | Closed ridge across70 exceeds available55. Holding other parameters, h=55 reaches the margin. |
| V-below-page | beta30deg,gamma 90 deg,h60,y0=10 | Closed ridge along=-20; fails actual page bounds. With m5, origin y0=35 reaches the margin. |
| V-tab-unavailable | r=10,g=6 | Reject because the proposed tab's usable attachment length r-2g is negative. |
| mixed-uncertified | V-vertical above plus box y40..70 | V triangle motion interval35..94.641016 overlaps box interval. No whole-motion composition certificate; not necessarily a collision. |
| mixed-packed | W90,H140,m5,d5; first P with w30; then V with beta30deg,gamma 90 deg,r40,h50,g3,t5 | P origin5 has slab[5,35]. V has lo=-25,hi=34.641016; origin65 gives slab[40,99.641016]. Exact gap5; both fit. V closed across maximum43.301270. |
| six-too-tall | Six copies of that V, H140,m5,d5 | Required lane span382.846097 exceeds available130. Reject this size/layout; the six-module UI cap does not promise that every set of dimensions fits. |

Add parameter-grid and seeded tests throughout the allowed domain; include endpoints and values close to all allowed boundaries. Check finite vertices, triangle edge lengths, normals, shared hinges, page/triangle half-spaces, net lengths, template connectivity and actual closed footprint independently of renderer state. Suggested numeric residual threshold: `1e-8*max(1,W,H)` millimetres for internal double-precision identities; this is a software tolerance, not a paper tolerance. Export roundtrip tests must account explicitly for their chosen decimal precision.

## 7. Print contract and useful finished projects

An exported project includes editable JSON, SVG with real width/height in mm, calibrated PDF, a single-page overview, numbered cut/score/assembly instructions and the geometric check result plus assumptions. Optional FOLD interchange records topology; it does not replace the fabrication schema. Keep cutting, valley scoring, mountain scoring, glue regions, artwork and annotations in distinct labelled layers, with monochrome-safe line styles. Tab names must match base placement names.

### Honest FOLD interchange boundary

The [official FOLD 1.2 specification](https://github.com/edemaine/fold/blob/main/doc/spec.md), checked 2026-09-06, permits multiple frames, millimetre units, crease assignments and optional faces. Proposed export: a base crease-pattern frame, plus one independent frame per V insert, all with `frame_unit="mm"`. Use actual perimeter `B`, slit `C`, mountain `M` and valley `V` assignments. Base gutter segments exclude P strips; the asymmetric P middle crease stays at `x=b-a`. Insert ridge is M; its tab hinges are V.

Split edges at actual intersections/endpoints. Export coordinates, edge connectivity and assignments first; include material faces only after their restricted topology has been independently validated. Do not invent closed-manifold status or collapse opposite slit boundaries into a mechanical hinge. Keep glue pairing and fabrication instructions in the project JSON, optionally referenced through namespaced metadata. Separate frames do not encode a solved glued assembly. Cut and multiframe support are optional in consumers, so also offer separate per-piece files with a compatibility note. Omit unsupported fold angles, inferred layer orders and arbitrary-cut import guarantees. These limits concern this proposed exporter, not FOLD's full expressive capacity.

### Separate fabrication-sheet packing

The motion-lane layout and the printable-sheet layout solve different problems. The base is one continuous `2W by H` blank with all selected P cuts and V placement outlines. The V inserts are separate continuous cut pieces. Their exact axis-aligned bounding boxes in the print net are:

```text
xmax = max(r*sin(gamma), (r-g)*sin(gamma)+t*cos(gamma))
xmin = -xmax
ymin = min(0, g*cos(gamma)-t*sin(gamma))
ymax = max(h, r*cos(gamma))
```

Packing these boxes with a positive cutting gap is a constructive sufficient nonoverlap rule. Deterministic first-fit shelves, with optional quarter-turn rotation, are enough for a useful implementation; do not claim optimal sheet usage. Labels and art rotate with the piece. Do not mirror a template implicitly because it changes its printed-face orientation and fold interpretation. Printable page margins and the boxes' full extents must be included. Add pages when necessary, never shrink the drawing merely to make everything fit one page.

If one continuous piece exceeds the printable area, a tiled output is an alignment/transfer pattern for a single continuous sheet of card stock. Joining smaller pieces with tape changes the rigid-panel material and is outside the model unless a future joint type is explicitly introduced. State that limitation on the tiled assembly sheet. Registration marks and matching tile labels establish alignment; they are not a physical-strength certificate.

PDF uses 72 points per inch and 25.4 mm per inch. A 100 mm scale ruler should therefore span 283.464566929 points before chosen output rounding. Print at actual size, not fit-to-page; include a calibration square, tile overlap, registration marks, page numbering and printable margins. Avoid a tile boundary crossing a hinge when feasible; otherwise label its alignment clearly. A numerical 1:1 file does not guarantee the user's printer scale. A template is not a photographed successful build.

The original starter catalog uses these two families:

1. **Name on a stage:** one asymmetric step; select front-face text and see how pinning height changes the required closed depth.
2. **Three celebration terraces:** three disjoint step bands with coordinated original colours and messages, each independently editable.
3. **Mountain greeting:** a symmetric V insert with gamma 90 deg; two printed triangular faces, vertical ridge and a clear two-tab assembly.
4. **Leaning pennant:** gamma 60 deg; a deliberate lean with a closed-footprint comparison showing where the apparent height goes when folded.
5. **Split message:** original complementary artwork on the two V faces; the mechanical geometry remains unchanged while viewing angle changes the reading.
6. **Mechanism sampler:** one P and one V module in certified separate bands, with an annotated export explaining the two different display angles.

These are original parameterized layouts. They have software geometry checks and no physical assembly validation. They give the app reusable outcomes beyond a single showcase animation.
