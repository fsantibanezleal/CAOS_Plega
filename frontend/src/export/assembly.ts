import type { PrintPlan, Project } from "../core/types";
import type { AssemblyStep, ExportLanguage } from "./types";

/** Stable step IDs follow engine assembly IDs; progress never changes geometry. */
export function makeAssemblySteps(
  project: Project,
  plan: PrintPlan,
  lang: ExportLanguage,
): readonly AssemblyStep[] {
  const say = (en: string, es: string) => (lang === "es" ? es : en);
  const steps: AssemblyStep[] = [];
  const add = (
    key: string,
    title: string,
    body: string,
    kind: AssemblyStep["kind"],
    moduleId?: string,
    openingDeg?: number,
  ) => {
    const entry = plan.assembly.find(
      (s) =>
        s.messageKey === key && (!moduleId || s.entityIds.includes(moduleId)),
    );
    const entities = entry?.entityIds ?? (moduleId ? [moduleId] : ["base"]);
    steps.push({
      id: entry?.id ?? `assembly:${moduleId ?? "project"}:${key}`,
      number: steps.length + 1,
      title,
      body,
      kind,
      entityIds: [...entities],
      ...(moduleId ? { moduleId } : {}),
      ...(openingDeg === undefined ? {} : { openingDeg }),
    });
  };
  add(
    "print.calibrate",
    say("Verify the printed scale", "Comprueba la escala impresa"),
    say(
      "Print the pattern pages at 100% / actual size. Disable fit-to-page. Measure the 100 mm ruler and 10 mm square with a physical ruler before cutting. The overview is a reduced map, never a cutting template.",
      "Imprime las páginas de patrón al 100% / tamaño real. Desactiva el ajuste a página. Mide la regla de 100 mm y el cuadrado de 10 mm con una regla física antes de cortar. La vista general es un mapa reducido, nunca una plantilla de corte.",
    ),
    "prepare",
  );
  if (plan.pages.some((p) => p.transferOnly)) {
    const overlap = [
      ...new Set(
        plan.placements.flatMap((p) => (p.tile ? [p.tile.overlapMm] : [])),
      ),
    ].join(" / ");
    steps.push({
      id: "assembly:transfer",
      number: steps.length + 1,
      kind: "prepare",
      title: say("Join the transfer pattern", "Une el patrón de transferencia"),
      body: say(
        `Match rows, columns and registration crosses within the ${overlap} mm overlap. Rows count from the bottom; columns from the left. Transfer the complete outline and folds onto ONE continuous sheet of card for each piece. Do not replace a rigid panel with taped fragments; that construction is outside this model.`,
        `Haz coincidir filas, columnas y cruces de registro en el solape de ${overlap} mm. Las filas se cuentan desde abajo y las columnas desde la izquierda. Transfiere el contorno y los pliegues a UNA hoja continua de cartulina por pieza. No sustituyas un panel rígido por fragmentos unidos con cinta; esa construcción queda fuera del modelo.`,
      ),
      entityIds: plan.pieces.map((p) => p.id),
    });
  }
  add(
    "base.cut",
    say("Prepare one continuous base", "Prepara una base continua"),
    say(
      `Cut only the solid outer boundary of the ${2 * project.card.W} × ${project.card.H} mm base. Keep the printed face toward you. Internal solid slits belong to the named step mechanisms below. Glue outlines are not cuts.`,
      `Corta solo el contorno exterior continuo de la base de ${2 * project.card.W} × ${project.card.H} mm. Mantén la cara impresa hacia ti. Las ranuras interiores continuas pertenecen a los mecanismos indicados más abajo. Los contornos de pegado no se cortan.`,
    ),
    "cut",
    undefined,
    180,
  );
  add(
    "base.score",
    say("Score the base valley", "Marca el valle de la base"),
    say(
      "Score the dashed gutter segments only where printed. A valley folds away from the printed/front face; a mountain rises toward it. Never add a gutter crease through an asymmetric step strip: its middle crease is offset as labelled.",
      "Marca los segmentos discontinuos del centro solo donde aparecen impresos. Un valle se hunde respecto de la cara impresa; una montaña sobresale hacia ella. No añadas un pliegue central que atraviese una tira asimétrica: su pliegue medio está desplazado como se indica.",
    ),
    "score",
    undefined,
    180,
  );
  for (const module of project.modules) {
    if (module.kind === "P") {
      add(
        "p.cut",
        say(
          `${module.label}: cut two open slits`,
          `${module.label}: corta dos ranuras abiertas`,
        ),
        say(
          `Cut the two solid slit lines for ${module.id}. Stop exactly at their endpoints. Leave both attachment edges intact; do not join the slits into a rectangular cutout or detach the moving strip.`,
          `Corta las dos ranuras continuas de ${module.id}. Detente exactamente en sus extremos. Conserva ambos bordes de unión; no conectes las ranuras para formar un recorte rectangular ni separes la tira móvil.`,
        ),
        "cut",
        module.id,
        180,
      );
      add(
        "p.score",
        say(
          `${module.label}: form the step`,
          `${module.label}: forma el escalón`,
        ),
        say(
          `Score its two valley hinges and central mountain. The middle mountain lies at x = b - a = ${Number((module.params.b - module.params.a).toFixed(3))} mm from the gutter, positive toward the right page. Gently reverse-fold this strip while closing the card. It needs no glue.`,
          `Marca sus dos bisagras en valle y la montaña central. La montaña media está en x = b - a = ${Number((module.params.b - module.params.a).toFixed(3))} mm respecto del centro, positivo hacia la página derecha. Invierte suavemente el pliegue de esta tira al cerrar la tarjeta. No necesita pegamento.`,
        ),
        "score",
        module.id,
        90,
      );
    } else {
      const insert = plan.pieces.find((p) => p.id === `insert:${module.id}`);
      const pairs = [
        ...new Set(
          insert?.glue.map(
            (g) =>
              `${insert.labels.find((l) => l.id === `${g.pairId}:label:tab`)?.text ?? g.pairId} (${g.pairId})`,
          ) ?? [`${module.id}:glue:left`, `${module.id}:glue:right`],
        ),
      ].join(" / ");
      add(
        "v.cut",
        say(
          `${module.label}: cut the insert`,
          `${module.label}: corta el inserto`,
        ),
        say(
          `Cut the continuous outside perimeter of insert:${module.id}, retaining both glue tabs and the shared centre ridge. Do not cut its ridge or tab hinges.`,
          `Corta el perímetro exterior continuo de insert:${module.id}, conservando las dos pestañas y la arista central compartida. No cortes la arista ni las bisagras de las pestañas.`,
        ),
        "cut",
        module.id,
        180,
      );
      add(
        "v.score",
        say(
          `${module.label}: score ridge and tabs`,
          `${module.label}: marca arista y pestañas`,
        ),
        say(
          "With the printed face toward you, form the ridge as a mountain and the tab hinges as valleys. The dash patterns distinguish them even on a monochrome printer. Fold gently before applying glue.",
          "Con la cara impresa hacia ti, forma la arista como montaña y las bisagras de las pestañas como valles. Los patrones de línea las distinguen incluso en impresión monocroma. Pliega suavemente antes de aplicar pegamento.",
        ),
        "score",
        module.id,
        90,
      );
      add(
        "v.glue",
        say(
          `${module.label}: match the two tab pairs`,
          `${module.label}: une los dos pares de pestañas`,
        ),
        say(
          `Match pairs ${pairs}. Apply a thin layer of glue to the BACK of each tab and place it on the matching FRONT base footprint. Align the labelled hinge edge. Keep glue off the ridge, gutter and hinges; preserve the unglued inset near the origin. Let it set without forcing the mechanism.`,
          `Haz coincidir los pares ${pairs}. Aplica una capa fina de pegamento al REVERSO de cada pestaña y colócala sobre la huella correspondiente de la CARA IMPRESA de la base. Alinea el borde de bisagra indicado. No pongas pegamento en la arista, el centro ni las bisagras; conserva el espacio sin pegar cerca del origen. Deja secar sin forzar el mecanismo.`,
        ),
        "glue",
        module.id,
        90,
      );
    }
  }
  add(
    "assembly.close",
    say(
      "Close slowly and check the edges",
      "Cierra despacio y revisa los bordes",
    ),
    say(
      "Guide each crease along its indicated direction and close gently. Stop if paper catches, buckles or requires force. Check that every mechanism stays within the base and each tab remains attached. Real stock thickness, glue and cutting tolerances are not modelled.",
      "Guía cada pliegue en la dirección indicada y cierra suavemente. Detente si el papel se atasca, se abomba o exige fuerza. Comprueba que cada mecanismo quede dentro de la base y que cada pestaña siga adherida. El modelo no incluye espesor real, pegamento ni tolerancias de corte.",
    ),
    "test",
    undefined,
    0,
  );
  add(
    "assembly.test",
    say(
      "Reopen and record the physical result",
      "Abre de nuevo y registra el resultado físico",
    ),
    say(
      "Reopen slowly, inspect the slits and tabs, and save this editable project with your observations. Passing geometric checks certifies only the restricted zero-thickness model; this document is not evidence that a physical build has already been tested.",
      "Abre lentamente, revisa las ranuras y pestañas, y guarda el proyecto editable con tus observaciones. Superar las comprobaciones geométricas certifica solo el modelo restringido sin espesor; este documento no demuestra que ya se haya probado una construcción física.",
    ),
    "test",
    undefined,
    90,
  );
  return steps;
}
