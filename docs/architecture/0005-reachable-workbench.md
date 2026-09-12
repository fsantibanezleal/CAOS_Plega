# ADR 0005: Make the entire paper composition reachable

Status: accepted, 2026-09-12.

## Problem

The v0.03 landing section pushed the actual object below the first viewport. Its eight-item motion diagram was decorative, and phones silently selected a framing mode whose controls were hidden. Full-composition framing left individual parts too small to edit. The profile selector exposed four motifs but not their cut density or material-web parameter, although both already drove the 3D and print geometry.

## Decision

Use the viewport for the working object, with independent cast and inspector scroll regions on desktop. The card map is generated from each module's millimetre position and includes all sixteen possible modules. Clicking a cast or map entry frames that exact part; explicit Part, All parts, and Card modes remain available on every viewport. Keep direct projected handles and the supported parallel-step and V-fold families. Expose card dimensions, part name/color, density, and protected web; duplicate a part only into a checked lane, retaining its shape when the resulting composition passes the analytic checks. The original compositions are accessible as reversible starting points.

Preserve the authoritative geometry and exporter. The renderer may simplify lighting and recover its interface after WebGL context restoration, but it may not alter physical coordinates or fabrication claims. A live error state shows the actual analytic diagnostic instead of a generic prompt.

## Verification

Browser acceptance must reach and frame every part, drag a physical dimension handle, change surface and card parameters, load and undo a composition, connect the cut plan, and render a phone view without horizontal overflow. Core geometry and exporter tests remain release gates. This is software validation of a zero-thickness model, not a physical assembly certificate.
