import type { Project, Result } from "./types";
import { ALL, diag, freeze } from "./shared";
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype ||
    Object.getPrototypeOf(v) === null);
const keys = (v: Obj, allowed: string[]) =>
  Object.keys(v).length === allowed.length &&
  Object.keys(v).every((k) => allowed.includes(k));
const num = (v: unknown, min: number, max = 2000) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const positive = (v: unknown) => num(v, 0.1);
const str = (v: unknown, max: number) =>
  typeof v === "string" &&
  v.length > 0 &&
  v.length <= max &&
  !/[\u0000-\u001f\u007f]/.test(v);
const color = (v: unknown) =>
  typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
const pins = (v: unknown, allowed: string[]) =>
  Array.isArray(v) &&
  v.length <= allowed.length &&
  new Set(v).size === v.length &&
  v.every((x) => typeof x === "string" && allowed.includes(x));
function duplicateKeys(text: string): boolean {
  const stack: (Set<string> | null)[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "{") stack.push(new Set());
    else if (c === "[") stack.push(null);
    else if (c === "}" || c === "]") stack.pop();
    else if (c === '"') {
      const start = i;
      for (i++; i < text.length; i++) {
        if (text[i] === "\\") {
          i++;
          continue;
        }
        if (text[i] === '"') break;
      }
      let next = i + 1;
      while (/\s/.test(text[next] ?? "") && next < text.length) next++;
      if (text[next] === ":" && stack.at(-1)) {
        const key = JSON.parse(text.slice(start, i + 1)) as string;
        const keys = stack.at(-1)!;
        if (keys.has(key)) return true;
        keys.add(key);
      }
    }
  }
  return false;
}
export function parseProject(input: unknown): Result<Project> {
  let v = input;
  if (typeof v === "string") {
    if (v.length > 131072 || new TextEncoder().encode(v).byteLength > 131072)
      return {
        ok: false,
        diagnostics: [diag("LIMIT_EXCEEDED", [], {}, ALL, "json-bytes")],
      };
    try {
      const source = v;
      v = JSON.parse(source);
      if (duplicateKeys(source))
        return {
          ok: false,
          diagnostics: [
            diag("INPUT_INVALID", [], {}, ALL, "duplicate-json-key"),
          ],
        };
    } catch {
      return {
        ok: false,
        diagnostics: [diag("INPUT_INVALID", [], {}, ALL, "json-syntax")],
      };
    }
  }
  const bad = (reason: string): Result<Project> => ({
    ok: false,
    diagnostics: [diag("INPUT_INVALID", [], {}, ALL, reason)],
  });
  if (
    !isObj(v) ||
    !keys(v, ["schemaVersion", "title", "card", "modules"]) ||
    v.schemaVersion !== 1 ||
    !str(v.title, 100)
  )
    return bad("project-shape");
  const c = v.card;
  if (
    !isObj(c) ||
    !keys(c, ["W", "H", "margin", "gap", "blank", "color", "pins"]) ||
    !positive(c.W) ||
    !positive(c.H) ||
    !num(c.margin, 0) ||
    !positive(c.gap) ||
    !["uncreased", "prefolded"].includes(c.blank as string) ||
    !color(c.color) ||
    !pins(c.pins, ["W", "H", "margin", "gap"])
  )
    return bad("card-shape");
  if (!Array.isArray(v.modules) || v.modules.length > 6)
    return bad("module-count");
  const ids = new Set<string>();
  for (const m of v.modules) {
    if (
      !isObj(m) ||
      !keys(m, ["id", "kind", "label", "color", "y", "params", "pins"]) ||
      !str(m.id, 48) ||
      !/^[a-z][a-z0-9-]*$/.test(m.id as string) ||
      ids.has(m.id as string) ||
      !str(m.label, 80) ||
      !color(m.color) ||
      !num(m.y, -4000, 4000) ||
      !isObj(m.params)
    )
      return bad("module-shape");
    ids.add(m.id as string);
    const p = m.params;
    if (m.kind === "P") {
      if (
        !keys(p, ["a", "b", "width"]) ||
        !positive(p.a) ||
        !positive(p.b) ||
        !positive(p.width) ||
        !pins(m.pins, ["y", "a", "b", "width"])
      )
        return bad("step-shape");
    } else if (m.kind === "V") {
      if (
        !keys(p, ["r", "h", "betaDeg", "gammaDeg", "tabWidth", "tabInset"]) ||
        !["r", "h", "tabWidth", "tabInset"].every((k) => positive(p[k])) ||
        !num(p.betaDeg, 0, 180) ||
        !num(p.gammaDeg, 0, 180) ||
        !pins(m.pins, [
          "y",
          "r",
          "h",
          "betaDeg",
          "gammaDeg",
          "tabWidth",
          "tabInset",
        ])
      )
        return bad("vfold-shape");
    } else return bad("module-kind");
  }
  return {
    ok: true,
    value: freeze(JSON.parse(JSON.stringify(v)) as Project),
    diagnostics: [],
  };
}
