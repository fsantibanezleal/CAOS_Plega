# Complete motion lesson pipeline

Committed sanitized source trajectories live in `data/guide/motion-sources`.
They contain geometry and action parameters only. Never commit downloaded source
logs, inference prose, provider configuration, user paths or intermediate caches.
Each file records its public source URL, source SHA-256 and data license.

From the repository root, compile or check exact artifacts offline:

```powershell
./.venv/Scripts/python.exe data-pipeline/build_motion_lessons.py generate
./.venv/Scripts/python.exe data-pipeline/build_motion_lessons.py verify
```

`verify` also runs in routine tests and builds. It recomputes every lesson,
preview and manifest from source. Admission checks include endpoint errors below
0.002 mm, total paper area and rigid-face edge lengths at intermediate states.
Browser tests exercise the actual player rather than just this compiler.
Derived JSON coordinates are canonicalized to nine decimal places in millimeters
and SVG view boxes to six. This removes platform-specific final-bit `libm` noise
without changing retained source trajectories or the admission tolerance.

To independently repeat simulator replay, use an optional authoring environment:

```powershell
git clone https://github.com/maya-moriya/FoldingAgentSimulator.git build/motion-simulator
git -C build/motion-simulator checkout f6d4fc6aaf4dfa2c82a8b5f7274c198498f4f122
python -m venv build/motion-authoring
./build/motion-authoring/Scripts/python.exe -m pip install -r requirements-authoring.txt
./build/motion-authoring/Scripts/python.exe scripts/replay_motion_sources.py --simulator build/motion-simulator
```

Linux/macOS use `bin/python` in each environment. Add `--verify-upstream` only
for a deliberate network refresh: it downloads and hashes the original public
logs without saving or printing their contents. A changed source fails rather
than silently updating the license boundary or accepted geometry.

For a new model, establish a complete final action history and license first.
Replay its actual actions, retain source and target geometric states, and provide
a bilingual model identity and teaching instructions. Add the identity to the
compiler's curated model table, regenerate, update the asset license inventory
and exercise every step and the completed shape. Do not count a diagram, an
isolated fold, an incomplete action history or a recolored model as a new lesson.

The current 27-candidate research source is bounded. Sixteen histories passed
the initial exact replay. The remaining histories need rollback resolution or
endpoint correction; they are excluded from the runtime manifest. The target of
at least a thousand distinct complete lessons remains an open authoring task.
