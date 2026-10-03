import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import manifest from "../guide/lesson-manifest.json";
import { FoldViewerStore } from "../vendor/fold-viewer/store";
import {
  sampleDocument,
  sampleOperation,
} from "../vendor/fold-viewer/geometry";
import {
  loadFoldDocument,
  parseFoldDocument,
} from "../vendor/fold-viewer/validation";

describe("admitted continuous model library", () => {
  it("plays every step through the end and stops single-step playback", async () => {
    for (const id of ["crane", "heart"]) {
      const entry = manifest.find((m) => m.id === id)!;
      const bytes = readFileSync(
        new URL(`../../public${entry.url}`, import.meta.url),
      );
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(bytes)),
      );
      const callbacks = new Map<number, FrameRequestCallback>();
      let nextId = 0;
      vi.stubGlobal(
        "requestAnimationFrame",
        (callback: FrameRequestCallback) => {
          callbacks.set(++nextId, callback);
          return nextId;
        },
      );
      vi.stubGlobal("cancelAnimationFrame", (id: number) =>
        callbacks.delete(id),
      );
      const visited = new Set<number>();
      const store = new FoldViewerStore();
      store.configure({
        autoAdvance: true,
        playbackRate: 2,
        onStepChange: (_, index) => visited.add(index),
      });
      await store.load({ kind: "url", url: entry.url });
      store.play();
      for (let time = 10; time < 180000; time += 100) {
        const frames = [...callbacks.values()];
        callbacks.clear();
        for (const frame of frames) frame(time);
      }
      expect(store.getSnapshot().stepIndex).toBe(entry.steps - 1);
      expect(store.getSnapshot().progress).toBe(1);
      expect(store.getSnapshot().playing).toBe(false);
      expect(visited.size).toBe(entry.steps - 1); // initial load uses onLoad, each subsequent step emits onStepChange
      store.configure({ autoAdvance: false });
      store.setStep(store.getSnapshot().document!.instructions.steps[1].id);
      store.play();
      for (let time = 200000; time < 220000; time += 100) {
        const frames = [...callbacks.values()];
        callbacks.clear();
        for (const frame of frames) frame(time);
      }
      expect(store.getSnapshot().stepIndex).toBe(1);
      expect(store.getSnapshot().playing).toBe(false);
      store.destroy();
      vi.unstubAllGlobals();
    }
  });
  it("renders every authored operation without shrinking rigid paper triangles", () => {
    for (const entry of manifest.filter((m) => m.id !== "crane")) {
      const doc = parseFoldDocument(
        readFileSync(
          new URL(`../../public${entry.url}`, import.meta.url),
          "utf8",
        ),
      );
      for (const op of doc.geometry!.operations) {
        const mesh = doc.geometry!.meshes.find((m) => m.id === op.mesh)!;
        const start = sampleOperation(op, mesh, 0);
        const distance = (p: Float64Array, a: number, b: number) =>
          Math.hypot(...[0, 1, 2].map((i) => p[a * 3 + i] - p[b * 3 + i]));
        for (const progress of [0.17, 0.38, 0.64, 0.89, 1]) {
          const positions = sampleOperation(op, mesh, progress);
          expect([...positions].every(Number.isFinite)).toBe(true);
          for (const face of mesh.faces) {
            const [a, b, c] = face.vertices;
            for (const [v, w] of [
              [a, b],
              [b, c],
              [c, a],
            ])
              expect(
                Math.abs(distance(positions, v, w) - distance(start, v, w)),
              ).toBeLessThan(0.002);
          }
        }
      }
      // The player, not just the compiler, must reach the stored target at each step.
      const illustrations = (
        doc.plega as {
          illustrations: Array<{ step: string; endPositionsMm: number[][] }>;
        }
      ).illustrations;
      for (const annotation of illustrations) {
        const index = doc.instructions.steps.findIndex(
          (s) => s.id === annotation.step,
        );
        const sampled = sampleDocument(doc, index, 1)[0];
        annotation.endPositionsMm.forEach((p, i) =>
          p.forEach((v, j) =>
            expect(sampled.positions[i * 3 + j]).toBeCloseTo(v, 2),
          ),
        );
      }
    }
  });
  it("rejects an unlisted URL before any network call", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      loadFoldDocument({
        kind: "url",
        url: "https://example.invalid/model.json",
      }),
    ).rejects.toMatchObject({ code: "unsupported-source" });
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it("rejects tampered bytes of a listed lesson", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"tampered":true}')),
    );
    await expect(
      loadFoldDocument({ kind: "url", url: manifest[1].url }),
    ).rejects.toMatchObject({ code: "asset-integrity" });
    vi.unstubAllGlobals();
  });
});
