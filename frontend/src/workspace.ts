import { parseProject, STARTERS } from "./core";
import type { Project } from "./core";

export type Language = "en" | "es";
export type Theme = "light" | "dark";
export type Workspace = {
  format: "plega-workspace";
  version: 1;
  project: Project;
  completed: string[];
  notes: string;
};
export const STORAGE_KEY = "plega-workspace-v1";
export const MAX_FILE_BYTES = 131072;
export const MAX_RECOVERY_BYTES = 1048576;
export interface WorkspaceRead {
  workspace: Workspace;
  message:
    | "restored"
    | "shared"
    | "incoming-share"
    | "invalid-share"
    | "invalid-save"
    | "new";
  storageAvailable: boolean;
  incomingShare?: Workspace;
  processedShare: boolean;
  savedDataInvalid: boolean;
  recoveryRaw: string | null;
}
const bytes = (text: string) => new TextEncoder().encode(text).byteLength;
const wrap = (project: Project): Workspace => ({
  format: "plega-workspace",
  version: 1,
  project,
  completed: [],
  notes: "",
});
const stable = (value: unknown): string =>
  Array.isArray(value)
    ? "[" + value.map(stable).join(",") + "]"
    : value && typeof value === "object"
      ? "{" +
        Object.keys(value)
          .sort()
          .map(
            (k) =>
              JSON.stringify(k) +
              ":" +
              stable((value as Record<string, unknown>)[k]),
          )
          .join(",") +
        "}"
      : JSON.stringify(value);
export const defaultProject = () =>
  STARTERS.find(
    (s) =>
      s.project.modules.some((m) => m.kind === "P") &&
      s.project.modules.some((m) => m.kind === "V"),
  )?.project ?? STARTERS[0].project;
export function parseWorkspace(input: unknown): Workspace | null {
  if (typeof input === "string") {
    if (input.length > MAX_FILE_BYTES || bytes(input) > MAX_FILE_BYTES)
      return null;
    // Core checks JSON syntax and duplicate keys before the outer project shape.
    const project = parseProject(input);
    if (project.ok) return wrap(project.value);
    if (project.diagnostics.some((d) => d.reason !== "project-shape"))
      return null;
    try {
      input = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    (Object.getPrototypeOf(input) !== Object.prototype &&
      Object.getPrototypeOf(input) !== null)
  )
    return null;
  const obj = input as Record<string, unknown>;
  if (obj.format === "plega-workspace") {
    if (
      obj.version !== 1 ||
      Object.keys(obj).length !== 5 ||
      Object.keys(obj).some(
        (k) =>
          !["format", "version", "project", "completed", "notes"].includes(k),
      ) ||
      !Array.isArray(obj.completed) ||
      obj.completed.length > 100 ||
      !obj.completed.every(
        (s) =>
          typeof s === "string" &&
          s.length > 0 &&
          s.length <= 150 &&
          !/[\u0000-\u001f\u007f]/.test(s),
      ) ||
      typeof obj.notes !== "string" ||
      obj.notes.length > 8000
    )
      return null;
    const parsed = parseProject(obj.project);
    const result: Workspace | null = parsed.ok
      ? {
          format: "plega-workspace",
          version: 1,
          project: parsed.value,
          completed: [...new Set(obj.completed as string[])],
          notes: obj.notes,
        }
      : null;
    return result && bytes(JSON.stringify(result)) <= MAX_FILE_BYTES
      ? result
      : null;
  }
  const parsed = parseProject(input);
  return parsed.ok
    ? {
        format: "plega-workspace",
        version: 1,
        project: parsed.value,
        completed: [],
        notes: "",
      }
    : null;
}
/** Read-only initialization; consume processed fragments in a mount effect. */
export function readWorkspace(): WorkspaceRead {
  const fresh = wrap(defaultProject());
  let local: Workspace | null = null,
    available = true,
    invalid = false,
    raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      local = parseWorkspace(raw);
      invalid = !local;
    }
  } catch {
    available = false;
  }
  const recoveryRaw =
    invalid &&
    raw !== null &&
    raw.length <= MAX_RECOVERY_BYTES &&
    bytes(raw) <= MAX_RECOVERY_BYTES
      ? raw
      : null;
  const base = {
    workspace: local ?? fresh,
    storageAvailable: available,
    processedShare: false,
    savedDataInvalid: invalid,
    recoveryRaw,
  };
  if (location.hash.startsWith("#project=")) {
    try {
      if (location.hash.length > MAX_FILE_BYTES)
        throw new Error("Share exceeds size limit");
      const shared = parseWorkspace(decodeURIComponent(location.hash.slice(9)));
      if (shared) {
        const incoming = wrap(shared.project);
        if (local) {
          if (stable(local.project) !== stable(incoming.project))
            return {
              ...base,
              workspace: local,
              incomingShare: incoming,
              message: "incoming-share",
              processedShare: true,
            };
          return {
            ...base,
            workspace: local,
            message: "restored",
            processedShare: true,
          };
        }
        return {
          ...base,
          workspace: incoming,
          message: "shared",
          processedShare: true,
        };
      }
    } catch {
      /* Keep existing local data when a fragment is malformed. */
    }
    return { ...base, message: "invalid-share", processedShare: true };
  }
  return {
    ...base,
    message: invalid ? "invalid-save" : local ? "restored" : "new",
  };
}

export function clearProcessedShare(): boolean {
  if (!location.hash.startsWith("#project=")) return true;
  try {
    history.replaceState(
      history.state,
      "",
      location.pathname + location.search,
    );
    return true;
  } catch {
    return false;
  }
}

export function encodeShare(project: Project): string {
  const parsed = parseProject(project);
  if (!parsed.ok) return "";
  return (
    location.origin +
    location.pathname +
    "#project=" +
    encodeURIComponent(JSON.stringify(parsed.value))
  );
}

/** Preserve unreadable stored bytes until replacement is explicitly selected. */
export function saveWorkspace(
  workspace: Workspace,
  options: { replaceUnreadable?: boolean } = {},
): boolean {
  const parsed = parseWorkspace(workspace);
  if (!parsed) return false;
  try {
    const old = localStorage.getItem(STORAGE_KEY);
    if (old !== null && !parseWorkspace(old) && !options.replaceUnreadable)
      return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    return true;
  } catch {
    return false;
  }
}

function downloadText(text: string, name: string): boolean {
  let url: string | null = null;
  try {
    url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    try {
      link.click();
    } finally {
      link.remove();
    }
    const captured = url;
    setTimeout(() => URL.revokeObjectURL(captured), 1000);
    return true;
  } catch {
    if (url) URL.revokeObjectURL(url);
    return false;
  }
}

/** Requests a download; the browser controls its completion. */
export function downloadWorkspace(workspace: Workspace): boolean {
  const parsed = parseWorkspace(workspace);
  if (!parsed) return false;
  return downloadText(
    JSON.stringify(parsed, null, 2) + "\n",
    (parsed.project.title.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 64) ||
      "plega") + ".plega.json",
  );
}

/** Explicit recovery action; the original stored value is never modified. */
export function downloadStoredRecovery(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (
      raw === null ||
      raw.length > 8 * MAX_RECOVERY_BYTES ||
      bytes(raw) > 8 * MAX_RECOVERY_BYTES
    )
      return false;
    return downloadText(raw, "plega-unreadable-workspace.json");
  } catch {
    return false;
  }
}
