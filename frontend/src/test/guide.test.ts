import { describe, expect, it } from "vitest";
import { foldFrame, polygonArea } from "../guide/foldEngine";
import { GUIDED } from "../guide/guided";
import commons from "../../../data/guide/commons-diagrams.json";
import club from "../../../data/guide/origami-club-index.json";
import plans from "../../../data/guide/origami-plan-index.json";

describe("original folding guide", () => {
  it("keeps the paper area and finite coordinates through every fold", () => {
    for (const recipe of GUIDED) {
      expect(recipe.steps.length).toBeGreaterThan(1);
      const area = recipe.paper[0] * recipe.paper[1];
      for (let index = 0; index < recipe.steps.length; index++) {
        for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
          const facets = foldFrame(recipe, index, progress);
          expect(facets.length).toBeGreaterThan(0);
          const total = facets.reduce(
            (sum, facet) => sum + polygonArea(facet.points),
            0,
          );
          // The 2-D projection shrinks while a flap rises, so area is conserved only flat.
          if (progress === 0 || progress === 1)
            expect(total).toBeCloseTo(area, 5);
          for (const facet of facets)
            for (const point of facet.points) {
              expect(
                Number.isFinite(point[0]) && Number.isFinite(point[1]),
              ).toBe(true);
            }
        }
      }
    }
  });

  it("does not claim external links are owned or licensed plan assets", () => {
    expect(club.entries.length).toBeGreaterThan(500);
    expect(plans.entries.length).toBeGreaterThan(300);
    expect(
      new Set([...club.entries, ...plans.entries].map((item) => item.planUrl))
        .size,
    ).toBeGreaterThan(1000);
    expect(
      club.entries.every((item) => item.rights.includes("external only")),
    ).toBe(true);
    expect(
      plans.entries.every((item) => item.rights.includes("external only")),
    ).toBe(true);
    expect(commons.records).toHaveLength(17);
    expect(
      commons.records.every(
        (item) =>
          item.asset.startsWith("/guide/commons/") &&
          item.licenseUrl.startsWith("https://"),
      ),
    ).toBe(true);
  });
});
