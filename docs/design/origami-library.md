# Origami library implementation contract

Date: 2026-10-03. Status: implementation authorized by the user's continuation instruction. The current original PLEGA design and own-domain GitHub Pages deployment remain the governing product choices.

## Required outcomes and acceptance gates

| Requirement | Implementation | Gate |
| --- | --- | --- |
| A categorized library of thousands of distinct complete origami lessons | Source-bound lesson manifest, search and category filters; independent admission for every model | Manifest count and unique identity audit; no static documents or cosmetic variants counted |
| Full construction from flat paper to completed model | Ordered resolved operations, continuous whole-sequence playback, pause, speed and replay | First, every movement's midpoint and endpoint, and finished-pose browser evidence |
| Each step can be studied and replayed | Step navigation, previous/next, individual-step play and synchronized text and fold-line illustration | Selecting and replaying every step uses its own geometry and instruction |
| Rich model-specific instruction | EN/ES construction text, indicated moving region, crease and alignment, completion/check guidance | No generic-fold substitution; bilingual instruction inventory and rendered checks |
| A fluid library-to-lesson flow | Browseable model previews, category/search results, direct routes and recoverable loading/error states | Desktop/phone navigation, empty search, deep links and rapid model changes |
| Reachable controls and content | Dominant viewer, contained long model/step content on desktop, reachable phone flow | Scroll and keyboard checks; no inaccessible controls or horizontal overflow |
| Existing work remains available | Fold basics, Structure atlas, Paper studio and legacy workshop subareas | Existing numeric/export and browser regression gates |
| Reproducible public source and data pipeline | Pinned sources, sanitized action/state snapshots, deterministic compilation, per-asset hashes and licenses | Offline rebuild/verification, invalid-source rejection and source-to-output map |
| Safe static deployment | Same-origin allowlisted lessons, unchanged CSP, no runtime secrets or external inference | Built artifact and public URL behavior; main workflow and live manifest hash checks |

## Motion compiler

The initial expansion candidate is the published FoldingAgent source set described in the dated research dossier. Resolve its final saved checkpoint history and retain only geometric actions and states. An offline replay of the pinned MIT simulator produces one source and target mesh per physical operation. Subdivision introduces material vertices without visible displacement. A fold or unfold rotates its actual moving face set about the actual crease. A turn uses a rigid rotation; a flip uses a rigid half-turn. Operations with missing or inconsistent geometry are rejected, never displayed as a snap or a generic tween.

Compile operations into the existing Fold Spec playback profile in millimetres. Triangulate each convex face consistently and carry its parent/moving identity. Include explicit hold steps only when they represent a documented locating or final check. Preserve ordered source checkpoint/action mappings, instruction text and source hashes. Runtime accepts only manifest-listed URLs and verifies their expected bytes before parsing. Routine testing and release use committed resolved assets; network downloads and simulator replay are explicit authoring commands.

## Source and acceptance boundaries

The requested thousand-model library remains the target. The currently available candidate set must not be presented as its completion. A lesson is admitted only after its geometry, full action history, per-step instruction, final form, license and browser behavior have been checked. Reconstructed motion is described honestly and does not certify collision-free paper physics. Optional external diagrams are companion material. All current product code, source history and prior releases are retained.
