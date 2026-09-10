import type {
  Capability,
  Diagnostic,
  Localized,
  Vec2,
  Vec3,
  Box2,
} from "./types";
export const EPS = 1e-8;
export const RAD = Math.PI / 180;
export const ALL: readonly Capability[] = [
  "pose",
  "final-print",
  "certificate",
  "fold-export",
];
const TEXT: Record<string, Localized> = {
  FOLD_DENSITY: {
    en: "This crease graph contains too many cut edges. Reduce detail density or use the PDF/SVG patterns.",
    es: "El grafo contiene demasiados bordes de corte. Reduce la densidad o utiliza los patrones PDF/SVG.",
  },
  INPUT_INVALID: {
    en: "The project contains invalid or unsupported data.",
    es: "El proyecto contiene datos no válidos o no admitidos.",
  },
  LIMIT_EXCEEDED: {
    en: "The input exceeds a supported resource limit.",
    es: "La entrada supera un límite admitido.",
  },
  CARD_MARGIN_EMPTY: {
    en: "The margin leaves no usable card area.",
    es: "El margen no deja superficie utilizable en la tarjeta.",
  },
  P_PREFOLD_MISMATCH: {
    en: "A prefolded blank needs equal step attachment distances. Otherwise an extra crease remains.",
    es: "Una base preplegada necesita distancias iguales en el escalón. De otro modo queda un pliegue adicional.",
  },
  P_ATTACHMENT_OUTSIDE: {
    en: "A step hinge lies outside the available base material.",
    es: "Una bisagra del escalón queda fuera del material de la base.",
  },
  P_SLOT_OVERLAP: {
    en: "Two step strips overlap. Their shared cut topology is outside this model.",
    es: "Dos bandas de escalón se superponen. Esta topología de cortes no pertenece al modelo.",
  },
  V_DOMAIN: {
    en: "These angles are outside the supported symmetric V-fold domain.",
    es: "Estos ángulos están fuera del dominio del pliegue V simétrico admitido.",
  },
  V_TAB_INVALID: {
    en: "The glue tabs need a positive inset and a usable hinge segment.",
    es: "Las pestañas necesitan una separación positiva y un tramo útil de bisagra.",
  },
  V_ATTACHMENT_OUTSIDE: {
    en: "An attachment or glue footprint leaves the base paper.",
    es: "Una unión o zona de pegado queda fuera del papel de la base.",
  },
  CLOSED_WIDTH: {
    en: "The mechanism extends beyond the available width when closed.",
    es: "El mecanismo supera el ancho disponible al cerrarse.",
  },
  PAGE_Y_BOUNDS: {
    en: "The complete motion zone leaves the card height or its selected margin.",
    es: "La zona completa de movimiento supera la altura de la tarjeta o su margen.",
  },
  LANE_UNCERTIFIED: {
    en: "Motion zones overlap or lack the selected gap. Continuous separation is not certified.",
    es: "Las zonas de movimiento se superponen o no respetan la separación elegida. No se certifica su separación continua.",
  },
  LANE_CAPACITY: {
    en: "These motion zones and gaps do not fit the card height.",
    es: "Estas zonas de movimiento y separaciones no caben en la altura de la tarjeta.",
  },
  PIN_CONFLICT: {
    en: "The requested repair cannot preserve all pinned values.",
    es: "La reparación solicitada no puede conservar todos los valores fijados.",
  },
  PRINT_PIECE_TOO_LARGE: {
    en: "A continuous piece exceeds the printable area. Choose a larger sheet or a tiled transfer pattern.",
    es: "Una pieza continua supera el área imprimible. Elige una hoja mayor o un patrón de transferencia por mosaicos.",
  },
  PRINT_SCALE: {
    en: "The sheet or print settings cannot provide a bounded actual-size layout.",
    es: "La hoja o los ajustes no permiten una disposición acotada a tamaño real.",
  },
  PRINT_LABEL_SPACE: {
    en: "A printed label has too little safe space. Enlarge the tab or panel before printing.",
    es: "Una etiqueta impresa no tiene espacio seguro suficiente. Amplía la pestaña o el panel antes de imprimir.",
  },
  FOLD_UNSUPPORTED: {
    en: "A checked crease-pattern export is unavailable for this project.",
    es: "No hay una exportación verificada del patrón de pliegues para este proyecto.",
  },
  NO_MODULES: {
    en: "This is a blank card. Add a mechanism to begin.",
    es: "Esta tarjeta está vacía. Añade un mecanismo para comenzar.",
  },
  REPAIR_STALE: {
    en: "The project changed after this repair was proposed. Recalculate the proposal.",
    es: "El proyecto cambió después de proponer esta reparación. Vuelve a calcularla.",
  },
  REPAIR_INVALID: {
    en: "The proposed changes do not match their declared result.",
    es: "Los cambios propuestos no coinciden con el resultado declarado.",
  },
  PRINT_BLOCKED: {
    en: "Resolve the fabrication checks before exporting a final template. A labelled draft remains available when its geometry is defined.",
    es: "Resuelve las comprobaciones antes de exportar una plantilla final. Puede haber un borrador identificado cuando su geometría está definida.",
  },
  POSE_UNAVAILABLE: {
    en: "This project has no supported assembled pose. Inspect the diagnosis or the true flat draft.",
    es: "Este proyecto no tiene una posición ensamblada admitida. Revisa el diagnóstico o el borrador plano real.",
  },
};
export function diag(
  code: string,
  modules: readonly string[] = [],
  numbers: Record<string, number> = {},
  blocks: readonly Capability[] = ["final-print", "certificate"],
  reason = code,
  severity: Diagnostic["severity"] = "error",
): Diagnostic {
  return {
    id: `${code}:${modules.join("+") || "card"}:${reason}`,
    code,
    severity,
    moduleIds: [...modules],
    messageKey: code,
    message: TEXT[code] ?? TEXT.INPUT_INVALID!,
    reason,
    numbers: Object.entries(numbers)
      .filter(([, v]) => Number.isFinite(v))
      .map(([key, value]) => ({
        key,
        value,
        unit: key.toLowerCase().includes("deg")
          ? "deg"
          : key.toLowerCase().includes("count")
            ? "count"
            : key === "discriminant"
              ? "unitless"
              : "mm",
      })),
    highlights: modules.length
      ? modules.map((id) => ({ kind: "module" as const, id }))
      : [{ kind: "card", id: "card" }],
    blocks: [...blocks],
  };
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}
export function freeze<T>(v: T): T {
  if (v && typeof v === "object") {
    Object.values(v).forEach(freeze);
    Object.freeze(v);
  }
  return v;
}
export const add2 = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
export const mul2 = (a: Vec2, s: number): Vec2 => [a[0] * s, a[1] * s];
export const add3 = (a: Vec3, b: Vec3): Vec3 => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
export const mul3 = (a: Vec3, s: number): Vec3 => [
  a[0] * s,
  a[1] * s,
  a[2] * s,
];
export function bounds2(points: readonly Vec2[]): Box2 {
  return {
    min: [
      Math.min(...points.map((p) => p[0])),
      Math.min(...points.map((p) => p[1])),
    ],
    max: [
      Math.max(...points.map((p) => p[0])),
      Math.max(...points.map((p) => p[1])),
    ],
  };
}
export function area2(p: readonly Vec2[]): number {
  return (
    p.reduce((s, v, i) => {
      const n = p[(i + 1) % p.length]!;
      return s + v[0] * n[1] - v[1] * n[0];
    }, 0) / 2
  );
}
export function rect(x0: number, y0: number, x1: number, y1: number): Vec2[] {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}
export function rotate2(p: Vec2, deg: 0 | 90): Vec2 {
  return deg === 0 ? p : [-p[1], p[0]];
}
export function polygonsOverlap(
  a: readonly Vec2[],
  b: readonly Vec2[],
): boolean {
  for (const polygon of [a, b])
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i]!,
        q = polygon[(i + 1) % polygon.length]!,
        nx = p[1] - q[1],
        ny = q[0] - p[0],
        len = Math.hypot(nx, ny);
      if (len === 0) continue;
      const aa = a.map((v) => (v[0] * nx + v[1] * ny) / len),
        bb = b.map((v) => (v[0] * nx + v[1] * ny) / len);
      if (
        Math.min(Math.max(...aa), Math.max(...bb)) -
          Math.max(Math.min(...aa), Math.min(...bb)) <=
        EPS
      )
        return false;
    }
  return true;
}
