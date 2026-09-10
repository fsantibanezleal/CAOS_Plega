# Fabrication export verification

The [export tests](../frontend/src/test/export.test.ts) exercise complete PDFs, SVGs, ZIPs and engine print plans. They check actual A4 and Letter page dimensions, the 100 mm PDF ruler operators, independently specified asymmetric slit/score coordinates, quarter-turn orientation, tiling, draft/final gates, clipping rejection, label fitting, XML escaping, Unicode handling and assembly identity. Every original starter, a blank base and a six-insert project are exported. Python's standard `zipfile` independently decodes the resulting archive and verifies its checksums and UTF-8 filenames.

Run the focused checks from the repository root:

```sh
npm --prefix frontend run test -- --run src/test/export.test.ts
npm --prefix frontend run check
```

To retain sample artifacts for independent inspection, set `PLEGA_EXPORT_QA_DIR` to an **absolute** output directory before running the export test. The test writes A4 mixed-family, Letter/Spanish, tiled transfer, failed-fit draft, V-starter and six-insert/Spanish PDFs, plus representative SVG sheets. Use the repository's ignored `build/qa/print` directory or a temporary audit directory.

The generated artifacts have also been reopened using the independent `pypdf` reader and rendered with PyMuPDF. A4 pages measured 595.2755905511812 × 841.8897637795277 points; Letter pages measured 612 × 792 points within floating-point precision. Accented text such as “Café” extracted correctly, and the inspected files contained no replacement glyphs or open actions. A4 mixed templates, Spanish pages, V tabs, six-insert layouts and transfer sheets received rendered review. Guide pagination was adjusted to keep complete numbered steps together and avoid a nearly empty last page.

For a repeatable independent size/text inspection, install `pypdf` in the audit environment and run:

```python
from pathlib import Path
from pypdf import PdfReader

for file in Path('build/qa/print').glob('*.pdf'):
    reader = PdfReader(file)
    print(file.name, len(reader.pages))
    for page in reader.pages:
        print(float(page.mediabox.width), float(page.mediabox.height))
        print(page.get('/PlegaPageKind'), len(page.extract_text()))
```

Render the latest PDFs with `pdftoppm -png sample.pdf sample-page` or an equivalent independent PDF renderer. Inspect every relevant template, guide transition and label at a useful zoom. A text-extraction pass does not demonstrate visual fit.

The test suite distinguishes geometry from serialization. A failed closed fit cannot be overridden by supplying a forged passing certificate. A clipping rectangle is rejected unless it belongs to an explicitly labelled transfer tile. Font failures and unreadable label boxes return export errors; the original project remains recoverable as JSON. No exporter loads arbitrary SVG or executes user text.

These are digital software checks. No physical paper build, printer calibration, adhesive behavior or user outcome is claimed by this evidence. The geometrical certificate and completed software checks retain their documented scope.
