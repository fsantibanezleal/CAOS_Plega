# Continuous origami motion source review

Reviewed: 2026-10-03. This follows the user's instruction to synchronize PLEGA and continue all pending implementation.

## Current release and gap

The released application is 0.07.000 with one complete Fold Spec crane. Main and develop are synchronized with their respective remote branches; PRs 24 and 25 are merged and their release workflows succeeded. No unmerged PLEGA branch work or isolated PLEGA checkout was found. The requested categorized library of thousands of individually animated models is still open. External links, static diagrams, repeated appearances and isolated fold exercises cannot satisfy that count.

## Primary sources

| Source | Verified material | Integration boundary |
| --- | --- | --- |
| [PurelandFold](https://huggingface.co/datasets/mayaweiz/PurelandFold) at `df09f5169a6a1e8bdd9f6c97ea235a42e2c7fa0b` | CC BY 4.0; 337 annotated states in 27 sequences; crease-pattern and folded-state geometry | Useful endpoint evidence. The dataset alone does not specify every continuous transition. Photographs are not required for the PLEGA animation pipeline. |
| [FoldingAgent](https://github.com/maya-moriya/FoldingAgent) | MIT code; public action vocabulary and controller semantics | Read action and rollback semantics. PLEGA can replay published actions without provider keys or inference calls. It does not claim to reproduce the research agent's evaluation. |
| [FoldingAgent Simulator](https://github.com/maya-moriya/FoldingAgentSimulator) at `f6d4fc6aaf4dfa2c82a8b5f7274c198498f4f122` | MIT geometric simulator; folds, unfolds, rotations, flips and edge subdivisions | An explicit offline authoring dependency. Check generated endpoints and material geometry independently; no physical paper certification is inferred. |
| [Project results](https://maya-moriya.github.io/origami-page/FoldingAgentResults/overview.html) and [project page](https://maya-moriya.github.io/origami-page/) | Manifest lists 27 completed reconstructions; public logs contain actions and geometric states. The project page carries CC BY-SA 4.0. | Extract only geometry, action parameters and attribution. Exclude inference prose, provider settings, local paths, photos and videos. Completion in the research manifest is an upstream report, not PLEGA acceptance. Preserve hashes and a source map. |
| [Fold Spec](https://github.com/FoldLab/fold-spec) and the already pinned crane | MIT resolved-motion document and browser player contract | Reuse PLEGA's current player and license boundary. Add independently validated documents with a manifest of permitted same-origin URLs and hashes. |

## Admission evidence

For every candidate, the importer must resolve final checkpoint history after restores and rollbacks. The compiler must execute the actual actions, resolve all subdivisions, and produce finite continuous motion. Unknown actions, missing states, endpoint mismatch, collapsed paper area or changing rigid-face edge lengths must fail admission. Whole-sequence playback and each movement require rendered checks. A completed model also needs bilingual model-specific instructions and a recognizable final form.

The 27 candidate reconstructions are a bounded source set. They do not solve the thousand-model requirement. That requirement stays open until distinct complete lessons pass the same admission gates; the app count comes only from the admitted manifest.
