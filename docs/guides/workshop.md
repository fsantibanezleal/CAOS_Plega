# From design to a printable mechanism

Choose an original starter or a failure case. The card dimensions are in millimetres; width is one page, so the open blank is twice as wide. The opening angle runs from closed at 0 degrees to flat at 180 degrees. The moving view and flat cut sheet refer to the same physical project.

Select a module and adjust its dimensions. A parallel step is cut from the base blank. A symmetric V-fold is a separate insert attached using matching tab/glue labels. Up to six modules can occupy separated lanes along the gutter. The parameters and supported ranges are documented in [the geometry model](../geometry.md).

Read the diagnosis before printing. A card can fail closed fit, use unsupported geometry or lack a lane-separation certificate. These are different conditions. An uncertified overlap does not assert an actual collision, and a pleasing pose does not override a failed check. Use a draft sheet to inspect the current design; fabrication output requires its specific checks to pass.

Pin dimensions that must stay fixed. Review a proposed repair's before/after values and remaining diagnoses, then apply it or keep the original. Undo returns to the preceding project. The repair engine offers bounded explicit changes, not a guarantee of the smallest possible redesign.

Save a project file before moving to another device. Choose A4 or Letter, inspect the layout and export vector PDF/SVG. Print at **actual size / 100%**, with fit-to-page disabled, and measure the 100 mm ruler and calibration square. PDF coordinates use exactly `72/25.4` points per millimetre; printer output still requires a physical measurement.

Follow the cut, mountain, valley and glue legends and the matching part labels. An oversized tiled export is a transfer pattern to align onto one continuous sheet; joining the tiled paper itself changes the material assumptions. Record assembly progress locally. Read [fabrication.md](../fabrication.md) before assembly: zero-thickness rigid geometry does not predict stiffness, glue strength, tool handling or physical success.
