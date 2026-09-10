# ADR 0001: use an explicit restricted rigid-paper model

Status: accepted for version 0.01.000.

The workshop must connect an editable moving card to a physically dimensioned cut sheet. A visually plausible mesh is insufficient: unsupported constructions and failed closure must remain visible rather than being projected into an invented feasible pose.

Use millimetres throughout and two documented families: a parallel step cut from a continuous blank and a symmetric triangular V-fold insert. Bound projects to six modules. Restrict angles, lengths, tabs and blank assumptions to the domain derived in [geometry.md](../geometry.md). A card's width parameter is one page, so an open blank spans twice that width. Opening runs from zero degrees closed to 180 degrees flat.

The parallel step follows the parallelogram relation `C = a*u + b*v`; closed reach is `a+b`. Asymmetric side lengths require an uncreased blank. The V-fold follows the documented symmetric interior branch and tab geometry. Conservative swept lanes can certify separation continuously in this restricted domain. Overlapping bounding lanes produce an uncertified result, not a proof that the paper collides.

The [Li, Ju, Gu and Hu 2011 V-style paper](https://cg.cs.tsinghua.edu.cn/people/~xianying/Papers/V-Popup/index.html) supplies research context for rigid pop-up construction and sufficient conditions. PLEGA does not implement its entire design space or claim a new folding theorem. The [source and assumption record](../research/sources-and-assumptions.md) distinguishes references from the actual implemented derivation.

Validation, pose, repair and print functions share typed physical data, while tests independently check lengths, angles, closure endpoints, sheet area and PDF scale. Repair proposals respect pins and show their finite changes; no globally optimal or minimally disruptive repair is claimed. FOLD export follows the [official interchange specification](https://github.com/edemaine/fold/blob/main/doc/spec.md) for the represented pieces, with glue assembly limitations explicitly stated.

The model omits material thickness, stiffness, hinge force and adhesive behavior. Numerical regression and browser verification cannot certify physical assembly or a printer's actual scale. These limits remain visible in the documentation and fabrication output.
