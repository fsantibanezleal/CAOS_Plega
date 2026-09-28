import type { FoldRecipe, FoldStep, Point } from "./foldEngine";

const fold = (
  a: Point,
  b: Point,
  movingSide: 1 | -1,
  title: readonly [string, string],
  instruction: readonly [string, string],
  check: readonly [string, string],
): FoldStep => ({ crease: [a, b], movingSide, title, instruction, check });

export const GUIDED: readonly FoldRecipe[] = [
  {
    id: "blintz-base",
    name: ["Blintz base", "Base blintz"],
    category: "Bases",
    summary: [
      "Four corners meet at the center. A foundation for many traditional models.",
      "Cuatro esquinas se encuentran en el centro. Base de muchos modelos tradicionales.",
    ],
    paper: [100, 100],
    source: "Original PLEGA diagrams of a traditional base",
    steps: [
      fold(
        [0, 50],
        [50, 0],
        -1,
        ["First corner", "Primera esquina"],
        [
          "Bring the upper-left corner to the exact center. Crease the diagonal between the two adjacent edge midpoints.",
          "Lleva la esquina superior izquierda al centro exacto. Marca la diagonal entre los puntos medios de los lados vecinos.",
        ],
        [
          "The tip should land at the center.",
          "La punta debe llegar al centro.",
        ],
      ),
      fold(
        [50, 0],
        [100, 50],
        -1,
        ["Second corner", "Segunda esquina"],
        [
          "Bring the upper-right corner to the center without shifting the first flap.",
          "Lleva la esquina superior derecha al centro sin mover la primera solapa.",
        ],
        [
          "Both tips meet without a gap.",
          "Ambas puntas se encuentran sin separación.",
        ],
      ),
      fold(
        [100, 50],
        [50, 100],
        -1,
        ["Third corner", "Tercera esquina"],
        [
          "Bring the lower-right corner to the same center point and sharpen the new edge.",
          "Lleva la esquina inferior derecha al mismo centro y marca el nuevo borde.",
        ],
        [
          "Keep the paper square as you press.",
          "Conserva la forma cuadrada al presionar.",
        ],
      ),
      fold(
        [50, 100],
        [0, 50],
        -1,
        ["Fourth corner", "Cuarta esquina"],
        [
          "Close the last corner over the others. The four original corners now meet in the center.",
          "Cierra la última esquina sobre las otras. Las cuatro esquinas originales se encuentran en el centro.",
        ],
        [
          "The result is a smaller square with four flaps.",
          "El resultado es un cuadrado menor con cuatro solapas.",
        ],
      ),
    ],
  },
  {
    id: "open-envelope",
    name: ["Open envelope", "Sobre abierto"],
    category: "Useful",
    summary: [
      "Three corner folds create a small open-top paper sleeve.",
      "Tres pliegues de esquina forman una funda de papel abierta arriba.",
    ],
    paper: [100, 100],
    source: "Original PLEGA elementary fold study",
    steps: [
      fold(
        [50, 100],
        [0, 50],
        -1,
        ["Left flap", "Solapa izquierda"],
        [
          "Fold the lower-left corner to the center.",
          "Lleva la esquina inferior izquierda al centro.",
        ],
        ["Its point marks the center.", "La punta marca el centro."],
      ),
      fold(
        [100, 50],
        [50, 100],
        -1,
        ["Bottom flap", "Solapa inferior"],
        [
          "Fold the lower-right corner to the center so it overlaps the first flap.",
          "Lleva la esquina inferior derecha al centro para que se superponga a la primera solapa.",
        ],
        ["Press along the diagonal edge.", "Presiona el borde diagonal."],
      ),
      fold(
        [50, 0],
        [100, 50],
        -1,
        ["Right flap", "Solapa derecha"],
        [
          "Fold the upper-right corner inward. Leave the upper-left corner open as the envelope lip.",
          "Pliega la esquina superior derecha. Deja abierta la esquina superior izquierda como boca del sobre.",
        ],
        [
          "Tuck a small note beneath the open lip.",
          "Introduce una nota pequeña bajo la abertura.",
        ],
      ),
    ],
  },
  {
    id: "gatefold-letter",
    name: ["Gatefold letter", "Carta de doble puerta"],
    category: "Useful",
    summary: [
      "Two doors close at the center, then the bottom locks the letter into a compact packet.",
      "Dos lados cierran al centro; el borde inferior compacta la carta.",
    ],
    paper: [100, 120],
    source: "Original PLEGA elementary fold study",
    steps: [
      fold(
        [25, 0],
        [25, 120],
        1,
        ["Left gate", "Puerta izquierda"],
        [
          "Fold the left edge to the vertical centerline.",
          "Pliega el borde izquierdo hacia la línea central vertical.",
        ],
        [
          "The edge must align with the center.",
          "El borde debe coincidir con el centro.",
        ],
      ),
      fold(
        [75, 0],
        [75, 120],
        -1,
        ["Right gate", "Puerta derecha"],
        [
          "Fold the right edge to meet the left edge at the center.",
          "Pliega el borde derecho hasta encontrar el izquierdo en el centro.",
        ],
        [
          "The two edges meet cleanly.",
          "Los dos bordes se encuentran limpiamente.",
        ],
      ),
      fold(
        [0, 90],
        [100, 90],
        1,
        ["Bottom closure", "Cierre inferior"],
        [
          "Lift the lower quarter upward and press across the width.",
          "Levanta el cuarto inferior y marca el pliegue a lo ancho.",
        ],
        [
          "The packet remains flat and even.",
          "El paquete queda plano y parejo.",
        ],
      ),
    ],
  },
  {
    id: "corner-tab",
    name: ["Corner tab", "Pestaña de esquina"],
    category: "Useful",
    summary: [
      "A compact marker made by folding two corners toward the center.",
      "Un marcador compacto formado al plegar dos esquinas al centro.",
    ],
    paper: [100, 100],
    source: "Original PLEGA elementary fold study",
    steps: [
      fold(
        [0, 50],
        [50, 0],
        -1,
        ["First wing", "Primera ala"],
        [
          "Bring the upper-left corner to the center.",
          "Lleva la esquina superior izquierda al centro.",
        ],
        ["Keep the top edge straight.", "Conserva recto el borde superior."],
      ),
      fold(
        [50, 0],
        [100, 50],
        -1,
        ["Second wing", "Segunda ala"],
        [
          "Bring the upper-right corner to the same center point.",
          "Lleva la esquina superior derecha al mismo centro.",
        ],
        [
          "Both wings form a clean point.",
          "Ambas alas forman una punta limpia.",
        ],
      ),
    ],
  },
];
