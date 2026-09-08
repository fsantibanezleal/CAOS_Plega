import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STARTERS, type Project } from "../core";
import {
  clearProcessedShare,
  downloadStoredRecovery,
  downloadWorkspace,
  encodeShare,
  MAX_FILE_BYTES,
  MAX_RECOVERY_BYTES,
  parseWorkspace,
  readWorkspace,
  saveWorkspace,
  STORAGE_KEY,
  type Workspace,
} from "../workspace";

const NativeURL = URL;
let location: URL;
let store: Map<string, string>;
let storage: {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
};
let history: { state: object; replaceState: ReturnType<typeof vi.fn> };
const workspace = (project: Project = STARTERS[0]!.project): Workspace => ({
  format: "plega-workspace",
  version: 1,
  project,
  completed: ["calibrate"],
  notes: "Private build notes: 220 g/m² paper.",
});
beforeEach(() => {
  store = new Map();
  storage = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
  };
  location = new NativeURL("https://example.test/CAOS_Plega/?mode=workshop");
  history = {
    state: { existing: true },
    replaceState: vi.fn((_state: unknown, _title: string, url: string) => {
      location.href = new NativeURL(url, location.href).href;
    }),
  };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("location", location);
  vi.stubGlobal("history", history);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("workspace import and persistence boundary", () => {
  it("accepts original project and full workspace files without losing Unicode notes", () => {
    const p = STARTERS[0]!.project,
      w = workspace(p);
    expect(parseWorkspace(JSON.stringify(p))).toEqual({
      format: "plega-workspace",
      version: 1,
      project: p,
      completed: [],
      notes: "",
    });
    expect(parseWorkspace(JSON.stringify(w))).toEqual(w);
    expect(parseWorkspace(w)).toEqual(w);
    expect(
      parseWorkspace({ ...w, completed: ["one", "one", "two"] })?.completed,
    ).toEqual(["one", "two"]);
  });
  it("rejects duplicate envelope and nested project keys before JSON.parse can discard them", () => {
    const raw = JSON.stringify(workspace());
    expect(
      parseWorkspace(raw.replace('"version":1', '"version":1,"version":1')),
    ).toBeNull();
    expect(
      parseWorkspace(
        raw.replace('"notes":', '"no\\u0074es":"hidden","notes":'),
      ),
    ).toBeNull();
    expect(
      parseWorkspace(
        raw.replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1'),
      ),
    ).toBeNull();
  });
  it("rejects malformed, oversized, unknown and structurally invalid imports", () => {
    const w = workspace();
    for (const value of [
      null,
      [],
      new Date(),
      "not JSON",
      { ...w, version: 2 },
      { ...w, extra: true },
      { ...w, notes: "x".repeat(8001) },
      { ...w, completed: Array(101).fill("step") },
      { ...w, completed: [""] },
      { ...w, completed: ["bad\nstep"] },
      {
        ...w,
        project: { ...w.project, modules: Array(7).fill(w.project.modules[0]) },
      },
      { ...w, project: { ...w.project, card: { ...w.project.card, gap: 0 } } },
    ])
      expect(parseWorkspace(value)).toBeNull();
    expect(parseWorkspace(" ".repeat(MAX_FILE_BYTES + 1))).toBeNull();
    // The character count fits; the UTF-8 byte count does not.
    expect(parseWorkspace('"' + "界".repeat(50000) + '"')).toBeNull();
  });
  it("restores a saved workspace without any write or fragment side effect", () => {
    const w = workspace();
    store.set(STORAGE_KEY, JSON.stringify(w));
    const first = readWorkspace(),
      second = readWorkspace();
    expect(first.message).toBe("restored");
    expect(first.workspace).toEqual(w);
    expect(second.workspace).toEqual(w);
    expect(first.savedDataInvalid).toBe(false);
    expect(first.processedShare).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(history.replaceState).not.toHaveBeenCalled();
  });
  it("distinguishes unreadable saved JSON from unavailable storage and preserves its raw bytes", () => {
    const raw = "{incomplete original data";
    store.set(STORAGE_KEY, raw);
    const r = readWorkspace();
    expect(r.message).toBe("invalid-save");
    expect(r.storageAvailable).toBe(true);
    expect(r.savedDataInvalid).toBe(true);
    expect(r.recoveryRaw).toBe(raw);
    expect(saveWorkspace(workspace())).toBe(false);
    expect(store.get(STORAGE_KEY)).toBe(raw);
    expect(saveWorkspace(workspace(), { replaceUnreadable: true })).toBe(true);
    expect(parseWorkspace(store.get(STORAGE_KEY))).toEqual(workspace());
  });
  it("keeps large corrupt saves in storage without copying them into the bounded recovery payload", () => {
    const raw = "x".repeat(MAX_RECOVERY_BYTES + 1);
    store.set(STORAGE_KEY, raw);
    const r = readWorkspace();
    expect(r.savedDataInvalid).toBe(true);
    expect(r.recoveryRaw).toBeNull();
    expect(store.get(STORAGE_KEY)).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("refuses invalid saves and reports storage failures without erasing a prior value", () => {
    const old = JSON.stringify(workspace());
    store.set(STORAGE_KEY, old);
    expect(saveWorkspace({ ...workspace(), notes: "x".repeat(8001) })).toBe(
      false,
    );
    expect(store.get(STORAGE_KEY)).toBe(old);
    storage.setItem.mockImplementation(() => {
      throw new Error("quota");
    });
    expect(saveWorkspace(workspace(STARTERS[1]!.project))).toBe(false);
    expect(store.get(STORAGE_KEY)).toBe(old);
    storage.getItem.mockImplementation(() => {
      throw new Error("denied");
    });
    const r = readWorkspace();
    expect(r.storageAvailable).toBe(false);
    expect(r.message).toBe("new");
  });
});

describe("incoming share decisions and reload safety", () => {
  it("encodes only the public project and never assembly progress or private notes", () => {
    const w = workspace(),
      url = encodeShare(w.project);
    expect(url.startsWith("https://example.test/CAOS_Plega/#project=")).toBe(
      true,
    );
    expect(
      JSON.parse(decodeURIComponent(new NativeURL(url).hash.slice(9))),
    ).toEqual(w.project);
    expect(url).not.toContain("Private");
    expect(url).not.toContain("completed");
    expect(encodeShare({} as Project)).toBe("");
  });
  it("stages a different valid share while retaining local notes and progress", () => {
    const local = workspace(),
      incoming = workspace(STARTERS[2]!.project);
    store.set(STORAGE_KEY, JSON.stringify(local));
    location.hash = "#project=" + encodeURIComponent(JSON.stringify(incoming));
    const r = readWorkspace();
    expect(r.message).toBe("incoming-share");
    expect(r.workspace).toEqual(local);
    expect(r.incomingShare?.project).toEqual(incoming.project);
    expect(r.incomingShare?.notes).toBe("");
    expect(r.incomingShare?.completed).toEqual([]);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(history.replaceState).not.toHaveBeenCalled();
    expect(location.hash).toContain("#project=");
    expect(clearProcessedShare()).toBe(true);
    expect(location.hash).toBe("");
    expect(location.search).toBe("?mode=workshop");
    expect(readWorkspace().workspace).toEqual(local);
  });
  it("retains local notes when the shared design matches despite object-key order", () => {
    const local = workspace();
    store.set(STORAGE_KEY, JSON.stringify(local));
    const reversed = JSON.parse(
      JSON.stringify(local.project),
      (_key, value: unknown) =>
        value && typeof value === "object" && !Array.isArray(value)
          ? Object.fromEntries(Object.entries(value).reverse())
          : value,
    );
    location.hash = "#project=" + encodeURIComponent(JSON.stringify(reversed));
    const r = readWorkspace();
    expect(r.message).toBe("restored");
    expect(r.workspace.notes).toBe(local.notes);
    expect(r.incomingShare).toBeUndefined();
  });
  it("loads a first shared design and never replays its old version after fragment consumption", () => {
    location.hash =
      "#project=" +
      encodeURIComponent(JSON.stringify(workspace(STARTERS[3]!.project)));
    const first = readWorkspace();
    expect(first.message).toBe("shared");
    expect(first.workspace.notes).toBe("");
    expect(first.processedShare).toBe(true);
    clearProcessedShare();
    const edited = {
      ...first.workspace,
      project: {
        ...first.workspace.project,
        title: "My edited shared project",
      },
    };
    expect(saveWorkspace(edited)).toBe(true);
    expect(readWorkspace().workspace.project.title).toBe(
      "My edited shared project",
    );
    expect(clearProcessedShare()).toBe(true);
    expect(history.replaceState).toHaveBeenCalledTimes(1);
  });
  it("preserves valid local work across malformed, oversized and duplicate-key fragments", () => {
    const local = workspace();
    store.set(STORAGE_KEY, JSON.stringify(local));
    const duplicate = JSON.stringify(local.project).replace(
      '"schemaVersion":1',
      '"schemaVersion":1,"schemaVersion":1',
    );
    for (const hash of [
      "#project=%E0%A4%A",
      "#project=" + encodeURIComponent(duplicate),
      "#project=" + "x".repeat(MAX_FILE_BYTES),
    ]) {
      location.hash = hash;
      const r = readWorkspace();
      expect(r.message).toBe("invalid-share");
      expect(r.workspace).toEqual(local);
      expect(r.processedShare).toBe(true);
    }
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("preserves non-share fragments and reports a denied fragment-clear action", () => {
    location.hash = "#guide";
    expect(readWorkspace().processedShare).toBe(false);
    expect(clearProcessedShare()).toBe(true);
    expect(history.replaceState).not.toHaveBeenCalled();
    location.hash = "#project=bad";
    history.replaceState.mockImplementation(() => {
      throw new Error("denied");
    });
    expect(clearProcessedShare()).toBe(false);
    expect(location.hash).toBe("#project=bad");
  });
});

describe("portable and raw recovery download boundaries", () => {
  it("downloads the exact unreadable bytes without changing storage", async () => {
    vi.useFakeTimers();
    const raw = "{unfinished private project";
    store.set(STORAGE_KEY, raw);
    let captured: Blob | undefined;
    const create = vi.fn((blob: Blob) => {
        captured = blob;
        return "blob:recovery";
      }),
      revoke = vi.fn(),
      link = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    vi.stubGlobal("document", {
      createElement: vi.fn(() => link),
      body: { append: vi.fn() },
    });
    expect(downloadStoredRecovery()).toBe(true);
    expect(await captured!.text()).toBe(raw);
    expect(link.download).toBe("plega-unreadable-workspace.json");
    expect(store.get(STORAGE_KEY)).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
    vi.runOnlyPendingTimers();
    expect(revoke).toHaveBeenCalledWith("blob:recovery");
  });
  it("rejects invalid portable data before requesting any download", () => {
    const create = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: vi.fn() });
    expect(downloadWorkspace({ ...workspace(), notes: "x".repeat(8001) })).toBe(
      false,
    );
    expect(create).not.toHaveBeenCalled();
  });
  it("reports a failed download request and cleans its temporary anchor", () => {
    const revoke = vi.fn();
    const link = {
      href: "",
      download: "",
      remove: vi.fn(),
      click: vi.fn(() => {
        throw new Error("download denied");
      }),
    };
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:denied"),
      revokeObjectURL: revoke,
    });
    vi.stubGlobal("document", {
      createElement: vi.fn(() => link),
      body: { append: vi.fn() },
    });
    expect(downloadWorkspace(workspace())).toBe(false);
    expect(link.remove).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith("blob:denied");
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
