# Print and assemble a PLEGA project

The export contains a reduced overview, numbered assembly instructions and actual-size pattern sheets. The base is one continuous piece. Each V mechanism adds one separate continuous insert. A parallel step remains part of the base; its two slits must not become a closed rectangular cutout.

Use the editable project JSON as your source. The PDF and SVG sheets are derived from the checked engine print plan. The adapters do not solve a second mechanism or change its dimensions.

## Choose the print result

| Output | Use |
|---|---|
| PDF | One file containing the overview, assembly guide and all calibrated pattern pages. |
| SVG set | Standalone vector sheets with real millimetre dimensions, labelled layers and an embedded print font. The set can be bundled into one ZIP download. |
| Project JSON | Editable dimensions, labels, colours, pins and module order. Preserves Unicode exactly. |
| FOLD files | Engine-validated crease-pattern interchange. Independent base/insert frames are not a solved glued assembly. Consumer support for cut edges and multiple frames varies. |

A fabrication export requires the applicable engine checks to pass. A draft remains visibly marked as a draft, carries that status in its metadata and lists the failed checks with their actual numbers in the guide. A draft is not an approved cutting template. The geometric certificate concerns the documented zero-thickness mechanism and separated motion lanes; it is not a physical build test.

## Scale and page layout

Choose A4 (210 × 297 mm) or US Letter (215.9 × 279.4 mm). The engine packs complete pieces and their annotation bounds within the selected margins. A quarter turn is permitted when selected; it never mirrors or shrinks the pattern. The adapters keep the engine's bottom-left page origin and upward y axis, reversing only SVG's display axis.

PDF conversion is exactly `points = millimetres × 72 / 25.4`. Thus a 100 mm ruler spans 283.464566929 points. SVG width/height use `mm`, and the viewBox contains the same numerical dimensions. Each pattern sheet includes a 100 mm ruler and a 10 mm square within a reserved 14 mm footer. This protects the ruler and status text from the cut layout.

Print at **actual size / 100%**, with fit-to-page disabled. The PDF records a no-scaling viewer preference, but a printer dialog can override it. Measure the ruler and square physically before cutting. A correct digital file does not certify your printer's scale.

An oversize piece can be rejected or exported as a **transfer pattern**. Tiles preserve scale, include clipping boundaries and registration crosses, and overlap by the amount shown in the guide. Row numbers count from the bottom and columns from the left. Align the matching crosses, then transfer the complete net onto one continuous sheet of card for that piece. Taping small fragments together changes the rigid-panel construction and is outside the model.

## Read the markings from the printed face

| Mark | Meaning |
|---|---|
| Solid dark line | Cut the stated boundary or open slit. |
| Short dashed line | Valley score: the crease sinks away from the printed/front face. |
| Dash-dot line | Mountain score: the crease rises toward the printed/front face. |
| Pale crossed region with a short pair label | Glue or placement footprint; it is not a cut boundary. |
| Small grey cross on a tiled pattern | Registration, not a cut or fold. |

Both PDF and SVG use these patterns in monochrome. Original face colours are optional in the adapter; the default export uses white faces, black text and grey glue regions. Colours never encode the only distinction between operations.

For a parallel step, cut the two open slits and retain their attachment edges. Score the two side valleys and the middle mountain. Its middle score lies at `x = b - a` from the gutter, positive toward the right page. Do not add a gutter crease through an asymmetric strip. This mechanism needs no glue.

For a V insert, cut its outside perimeter while retaining both tabs. Score its shared ridge as a mountain and tab hinges as valleys. Match the printed pairs, such as `2L` and `2R`, with the same labels on the base. Glue the **back of the tab** onto the **printed/front base footprint**. Leave the hinge, gutter, ridge and origin inset free of glue. The guide also records the stable pair IDs used by the model.

Fold gently and stop if the actual paper catches or requires force. PLEGA does not model stock thickness, adhesive, hand bending or cutting tolerances. Save physical observations separately from the geometric result.

## Labels and Unicode

The print font is bundled Noto Sans under the SIL Open Font License 1.1; see its [licence](../frontend/src/export/assets/OFL.txt) and [pinned source/hash record](../frontend/src/export/assets/provenance.json). It is embedded in PDFs and in every standalone SVG. There is no runtime request to a font provider.

The adapter measures every line against its declared label box and the same font metrics used for output. It returns `LABEL_OVERFLOW` rather than printing through a crease or reducing text below its readable minimum. Shorten the label or enlarge the design. The engine also checks that the label's box fits safely within its panel or tab.

Font support is finite. An unsupported glyph produces `FONT_GLYPH_UNSUPPORTED` with its Unicode code point; the exporter does not silently remove or substitute the character. Project JSON still preserves the original text. SVG labels are escaped plain text, never imported markup. Arbitrary SVG, silhouettes, embedded scripts and uploaded geometry are not part of the project format.

## Adapter integration

The entry point is [frontend/src/export/index.ts](../frontend/src/export/index.ts). `ExportFile` has `{name, mime, bytes: Uint8Array}`. Every serializer returns `{ok:true,value}` or `{ok:false,errors}`; errors include a stable code, readable message and related entity IDs.

```ts
makeAssemblySteps(project, plan, 'en');
await serializePdf(project, plan, { lang: 'en' });
await serializeSvgPages(project, plan, { lang: 'es' });
serializeProject(project, 'es');
serializeFold(project, 'en');
bundleFiles(files, 'plega-sheets.zip');
downloadFile(file); // call from the user's download action
```

`makeAssemblySteps` is pure. Each step has a stable ID, number, title, body, operation kind, entity IDs and optional module/opening information. English and Spanish retain the same progress IDs. Recording completion must not change geometry or claim a physical test was performed.

`fontBytes` is an optional serializer dependency for tests; normal browser exports load the bundled font. ZIP files use deterministic stored entries with UTF-8 names and CRC-32 checksums. The adapter rejects path separators, duplicate names, excessive file counts and oversized bundles. It only creates archives; it does not import them.
