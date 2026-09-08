import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Copy,
  Download,
  Expand,
  FileDown,
  FolderOpen,
  Layers,
  LayoutTemplate,
  Lightbulb,
  LockKeyhole,
  Maximize,
  Moon,
  MoreHorizontal,
  Move3D,
  Pause,
  Play,
  Plus,
  Printer,
  Redo2,
  RotateCcw,
  Ruler,
  Scissors,
  Share2,
  ShieldCheck,
  Sun,
  Trash2,
  Undo2,
  UnlockKeyhole,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import {
  analyzeProject,
  applyRepair,
  makePrintPlan,
  packLanes,
  poseProject,
  parseProject,
  proposeRepairs,
  STARTERS,
  REPAIR_CASES,
} from "./core";
import type {
  Analysis,
  Mechanism,
  PrintPlan,
  Project,
  RepairProposal,
  Starter,
} from "./core";
import type { AssemblyStep } from "./export/types";
import { PaperViewer } from "./render/PaperViewer";
import { MiniPaper, PrintViewer } from "./render/PrintViewer";
import {
  downloadWorkspace,
  downloadStoredRecovery,
  clearProcessedShare,
  encodeShare,
  MAX_FILE_BYTES,
  parseWorkspace,
  readWorkspace,
  saveWorkspace,
  type Language,
  type Theme,
  type Workspace,
} from "./workspace";

type Mode = "design" | "check" | "make" | "assemble";
const palette = [
  "#ee987b",
  "#ab9ad5",
  "#8eb7b2",
  "#e5c56e",
  "#91a9d0",
  "#d995b0",
];
const fmt = (n: number) => Number(n.toFixed(2)).toLocaleString("en-US");
const metricNames: Record<string, [string, string]> = {
  required: ["Required", "Necesario"],
  available: ["Available", "Disponible"],
  overhang: ["Overhang", "Saliente"],
  width: ["Page width", "Ancho de página"],
  height: ["Page height", "Altura de página"],
  margin: ["Margin", "Margen"],
  a: ["Height a", "Altura a"],
  b: ["Depth b", "Fondo b"],
  creaseOffset: ["Crease offset", "Desplazamiento del pliegue"],
  start: ["Start", "Inicio"],
  end: ["End", "Fin"],
  betaDeg: ["Base angle β", "Ángulo base β"],
  gammaDeg: ["Panel angle γ", "Ángulo de panel γ"],
  discriminant: [
    "Full-opening discriminant",
    "Discriminante de apertura completa",
  ],
  length: ["Length", "Longitud"],
  inset: ["End inset", "Retiro del extremo"],
  usable: ["Usable hinge", "Bisagra útil"],
  lower: ["Zone start", "Inicio de zona"],
  upper: ["Zone end", "Fin de zona"],
  minimum: ["Minimum", "Mínimo"],
  maximum: ["Maximum", "Máximo"],
  actualGap: ["Current gap", "Separación actual"],
  requiredGap: ["Required gap", "Separación necesaria"],
  requiredStart: ["Required start", "Inicio necesario"],
  pinnedStart: ["Pinned start", "Inicio fijado"],
};
const posed = (p: Project, angle: number) => {
  const r = poseProject(p, angle);
  return r.ok ? r.value : null;
};
const fieldNames: Record<string, [string, string]> = {
  a: ["Step height · a", "Altura del escalón · a"],
  b: ["Step depth · b", "Fondo del escalón · b"],
  width: ["Strip width", "Ancho de la tira"],
  r: ["Attachment length · r", "Longitud de unión · r"],
  h: ["Ridge length · h", "Longitud de arista · h"],
  betaDeg: ["Base angle · β", "Ángulo en la base · β"],
  gammaDeg: ["Panel angle · γ", "Ángulo del panel · γ"],
  tabWidth: ["Glue tab width", "Ancho de pestaña"],
  tabInset: ["Tab end inset", "Retiro en extremos"],
  y: ["Position along gutter", "Posición en el centro"],
  W: ["Closed page width", "Ancho de página cerrada"],
  H: ["Card height", "Altura de tarjeta"],
  margin: ["Edge margin", "Margen del borde"],
  gap: ["Motion zone gap", "Separación entre zonas"],
};

function IconButton({
  label,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      {...props}
      className={"icon-button " + (props.className ?? "")}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}
function Dialog({
  open,
  title,
  children,
  onClose,
  className = "",
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    previous = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open && !ref.current?.open) {
      previous.current = document.activeElement as HTMLElement;
      ref.current?.showModal();
    } else if (!open && ref.current?.open) {
      ref.current.close();
      previous.current?.focus();
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={"dialog " + className}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <IconButton label="Close / Cerrar" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}
function NumericField({
  name,
  value,
  min = 0.1,
  max = 2000,
  step = 1,
  pinned,
  onValue,
  onPin,
  lang,
}: {
  name: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  pinned: boolean;
  onValue: (n: number) => void;
  onPin: () => void;
  lang: Language;
}) {
  const title = fieldNames[name]?.[lang === "es" ? 1 : 0] ?? name,
    angular = name.endsWith("Deg");
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(Number(value.toFixed(4)))), [value]);
  return (
    <div className="numeric-field">
      <div className="field-heading">
        <label htmlFor={"field-" + name}>{title}</label>
        <IconButton
          label={
            (pinned
              ? lang === "es"
                ? "Desfijar "
                : "Unpin "
              : lang === "es"
                ? "Fijar "
                : "Pin ") + title
          }
          aria-pressed={pinned}
          onClick={onPin}
        >
          {pinned ? <LockKeyhole size={13} /> : <UnlockKeyhole size={13} />}
        </IconButton>
      </div>
      <div className="number-line">
        <input
          type="range"
          aria-label={title + " " + (lang === "es" ? "deslizador" : "slider")}
          min={min}
          max={max}
          step={step}
          value={Math.min(max, Math.max(min, value))}
          onChange={(e) => onValue(Number(e.target.value))}
        />
        <span className="number-box">
          <input
            id={"field-" + name}
            aria-label={title}
            type="number"
            min={min}
            max={angular ? 180 : 2000}
            step="any"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const n = Number(e.target.value);
              if (
                e.target.value !== "" &&
                Number.isFinite(n) &&
                n >= min &&
                n <= (angular ? 180 : 2000)
              )
                onValue(n);
            }}
            onBlur={() => setText(String(Number(value.toFixed(4))))}
          />
          <small>{angular ? "°" : "mm"}</small>
        </span>
      </div>
    </div>
  );
}
function MotionZones({
  project,
  analysis,
  selected,
  onSelect,
  lang,
}: {
  project: Project;
  analysis: Analysis;
  selected: string;
  onSelect: (id: string) => void;
  lang: Language;
}) {
  const scale = 250 / project.card.H;
  return (
    <div className="zone-diagram">
      <svg
        viewBox="0 0 200 280"
        role="img"
        aria-label={
          lang === "es"
            ? "Zonas de movimiento durante toda la apertura"
            : "Motion zones throughout the full opening"
        }
      >
        <rect
          x="22"
          y="12"
          width="155"
          height="250"
          rx="5"
          fill="var(--surface)"
          stroke="var(--line)"
        />
        <path d="M100 12V262" stroke="var(--muted)" strokeDasharray="3 3" />
        {[0, project.card.H / 2, project.card.H].map((y) => (
          <text
            key={y}
            x="17"
            y={265 - y * scale}
            textAnchor="end"
            fontSize="8"
            fill="var(--muted)"
          >
            {fmt(y)}
          </text>
        ))}
        {analysis.modules.map((b) => {
          const m = project.modules.find((m) => m.id === b.moduleId)!;
          const y = 262 - b.sweptY[1] * scale,
            h = (b.sweptY[1] - b.sweptY[0]) * scale;
          return (
            <g
              key={b.moduleId}
              onClick={() => onSelect(m.id)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x="29"
                y={y}
                width="141"
                height={Math.max(2, h)}
                rx="3"
                fill={m.color}
                fillOpacity={selected === m.id ? 0.85 : 0.5}
                stroke={selected === m.id ? "var(--ink)" : "none"}
                strokeWidth="1"
              />
              <text
                x="36"
                y={y + Math.min(h / 2 + 3, 14)}
                fontSize="9"
                fill="#25243b"
              >
                {m.id} · {fmt(b.sweptY[1] - b.sweptY[0])} mm
              </text>
            </g>
          );
        })}
      </svg>
      <p>
        {lang === "es"
          ? "Las bandas incluyen paneles y pestañas durante todo el movimiento. El solape queda sin certificar."
          : "Bands include panels and tabs throughout motion. Overlapping bands remain uncertified."}
      </p>
    </div>
  );
}
function ClosedFit({
  project,
  analysis,
  selected,
  lang,
}: {
  project: Project;
  analysis: Analysis;
  selected: string;
  lang: Language;
}) {
  const b = analysis.modules.find((m) => m.moduleId === selected),
    m = project.modules.find((m) => m.id === selected);
  if (!b || !m) return null;
  const points = [
    ...b.closedPanels.flatMap((p) => p.polygon),
    ...b.tabFootprints.flatMap((p) => p.polygon),
  ];
  const xMin = Math.min(0, ...points.map((v) => v[0])),
    xMax = Math.max(project.card.W, ...points.map((v) => v[0]));
  const yMin = Math.min(0, ...points.map((v) => project.card.H - v[1])),
    yMax = Math.max(
      project.card.H,
      ...points.map((v) => project.card.H - v[1]),
    );
  return (
    <div className="closed-fit">
      <div className="small-heading">
        <span>{lang === "es" ? "Huella al cerrar" : "Closed footprint"}</span>
        <strong>
          {fmt(b.closedAcrossMax)} / {fmt(project.card.W - project.card.margin)}{" "}
          mm
        </strong>
      </div>
      <svg
        viewBox={`${xMin - 6} ${yMin - 6} ${xMax - xMin + 12} ${yMax - yMin + 12}`}
        role="img"
        aria-label={
          lang === "es"
            ? "Huella del mecanismo en la página cerrada"
            : "Mechanism footprint on the closed page"
        }
      >
        <rect
          width={project.card.W}
          height={project.card.H}
          rx="2"
          fill="var(--surface)"
          stroke="var(--line)"
        />
        <path
          d={`M${project.card.W - project.card.margin} 0V${project.card.H}`}
          stroke="var(--coral)"
          strokeDasharray="2 2"
          strokeWidth=".6"
        />
        {b.closedPanels.map((p) => (
          <polygon
            key={p.faceId}
            points={p.polygon
              .map((v) => `${v[0]},${project.card.H - v[1]}`)
              .join(" ")}
            fill={m.color}
            fillOpacity=".45"
            stroke={m.color}
            strokeWidth=".7"
          />
        ))}
        {b.tabFootprints.map((p) => (
          <polygon
            key={p.id}
            points={p.polygon
              .map((v) => `${v[0]},${project.card.H - v[1]}`)
              .join(" ")}
            fill="var(--accent)"
            fillOpacity=".2"
            stroke="var(--accent)"
            strokeWidth=".7"
            strokeDasharray="1 1"
          />
        ))}
        <path
          d={`M0 0V${project.card.H}`}
          stroke="var(--ink)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

export default function App() {
  const initial = useRef<ReturnType<typeof readWorkspace> | null>(null);
  if (!initial.current) initial.current = readWorkspace();
  const [workspace, setWorkspace] = useState(initial.current.workspace),
    [lang, setLang] = useState<Language>(() => {
      try {
        return localStorage.getItem("plega-language") === "es" ? "es" : "en";
      } catch {
        return "en";
      }
    }),
    [theme, setTheme] = useState<Theme>(() => {
      try {
        return localStorage.getItem("plega-theme") === "dark"
          ? "dark"
          : "light";
      } catch {
        return "light";
      }
    });
  const project = workspace.project,
    t = (en: string, es: string) => (lang === "es" ? es : en);
  const [mode, setMode] = useState<Mode>("design"),
    [selected, setSelected] = useState(project.modules[0]?.id ?? ""),
    [opening, setOpening] = useState(100),
    [playing, setPlaying] = useState(false),
    [view, setView] = useState<"model" | "pattern">("model"),
    [camera, setCamera] = useState<"perspective" | "top" | "front">(
      "perspective",
    ),
    [reset, setReset] = useState(0),
    [dimensions, setDimensions] = useState(true);
  const [library, setLibrary] = useState(false),
    [help, setHelp] = useState(false),
    [share, setShare] = useState(false),
    [more, setMore] = useState(false),
    [helpTopic, setHelpTopic] = useState("principles"),
    [query, setQuery] = useState(""),
    [notice, setNotice] = useState(""),
    [saved, setSaved] = useState(
      initial.current.storageAvailable && !initial.current.savedDataInvalid,
    ),
    [past, setPast] = useState<Project[]>([]),
    [future, setFuture] = useState<Project[]>([]),
    [repair, setRepair] = useState<RepairProposal | null>(null),
    [paper, setPaper] = useState<"A4" | "Letter">("A4"),
    [tiling, setTiling] = useState(true),
    [page, setPage] = useState(0),
    [exporting, setExporting] = useState(""),
    [steps, setSteps] = useState<readonly AssemblyStep[]>([]),
    [activeStep, setActiveStep] = useState(0),
    [updateWorker, setUpdateWorker] = useState<ServiceWorker | null>(null);
  const [incomingShare, setIncomingShare] = useState(
    initial.current.incomingShare ?? null,
  );
  const [recoveryOpen, setRecoveryOpen] = useState(
    initial.current.savedDataInvalid,
  );
  const [preserveUnreadable, setPreserveUnreadable] = useState(
    initial.current.savedDataInvalid,
  );
  const fileInput = useRef<HTMLInputElement>(null),
    editGroup = useRef({ key: "", time: 0 }),
    workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  const analysis = useMemo(() => analyzeProject(project), [project]),
    displayed = repair?.after ?? project,
    displayAnalysis = useMemo(() => analyzeProject(displayed), [displayed]);
  const scene = useMemo(() => posed(displayed, opening), [displayed, opening]);
  const planResult = useMemo(
    () =>
      makePrintPlan(displayed, {
        purpose: displayAnalysis.canFinalPrint ? "fabrication" : "draft",
        sheet:
          paper === "A4"
            ? { width: 210, height: 297, margin: 10 }
            : { width: 215.9, height: 279.4, margin: 10 },
        cuttingGap: 5,
        allowQuarterTurn: true,
        oversize: tiling ? "tile-transfer-pattern" : "reject",
      }),
    [displayed, displayAnalysis.canFinalPrint, paper, tiling],
  );
  const plan: PrintPlan | null = planResult.ok ? planResult.value : null;
  const repairs = useMemo(() => proposeRepairs(project), [project]),
    mechanism = project.modules.find((m) => m.id === selected);
  const reduced = useRef(false);
  useEffect(() => {
    const q = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      reduced.current = q.matches;
      if (q.matches) setPlaying(false);
    };
    change();
    q.addEventListener("change", change);
    return () => q.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = lang;
    try {
      localStorage.setItem("plega-language", lang);
      localStorage.setItem("plega-theme", theme);
    } catch {
      /* Visible storage status covers the workspace. */
    }
  }, [theme, lang]);
  useEffect(() => {
    if (preserveUnreadable) {
      setSaved(false);
      return;
    }
    setSaved(saveWorkspace(workspace));
  }, [workspace, preserveUnreadable]);
  useEffect(() => {
    const flush = () => {
      if (!preserveUnreadable) saveWorkspace(workspaceRef.current);
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [preserveUnreadable]);
  useEffect(() => {
    if (initial.current?.processedShare && !clearProcessedShare())
      setNotice(
        t(
          "Save your edits as a project file before reloading this shared link.",
          "Guarda tus cambios en un archivo antes de recargar este enlace.",
        ),
      );
    if (initial.current?.message === "invalid-share")
      setNotice(
        t(
          "The shared link is invalid. Your saved project was kept.",
          "El enlace no es válido. Se conservó tu proyecto guardado.",
        ),
      );
    if (initial.current?.message === "invalid-save")
      setNotice(
        t(
          "The saved data could not be read. Import a saved project file to recover it.",
          "No se pudieron leer los datos guardados. Importa un archivo para recuperarlos.",
        ),
      );
  }, []);
  useEffect(() => {
    if (!playing) return;
    let frame = 0,
      last = 0;
    let direction = 1;
    const tick = (now: number) => {
      if (!last) last = now;
      const delta = Math.min(now - last, 60);
      last = now;
      setOpening((value) => {
        let next = value + direction * delta * 0.032;
        if (next >= 180) {
          next = 180;
          direction = -1;
        }
        if (next <= 0) {
          next = 0;
          direction = 1;
        }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  useEffect(() => {
    if (!plan) {
      setSteps([]);
      return;
    }
    let active = true;
    void import("./export/assembly")
      .then(({ makeAssemblySteps }) => {
        if (active) setSteps(makeAssemblySteps(displayed, plan, lang));
      })
      .catch(() => {
        if (active) {
          setSteps([]);
          setNotice(
            t(
              "Assembly instructions could not load. Reload after saving the project.",
              "No se pudieron cargar las instrucciones. Guarda el proyecto y recarga.",
            ),
          );
        }
      });
    return () => {
      active = false;
    };
  }, [displayed, plan, lang]);
  useEffect(() => {
    setPage(0);
    setActiveStep(0);
  }, [project, paper, tiling]);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let active = true;
    void navigator.serviceWorker
      .register(import.meta.env.BASE_URL + "sw.js", {
        scope: import.meta.env.BASE_URL,
      })
      .then((reg) => {
        if (!active) return;
        if (reg.waiting) setUpdateWorker(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          worker?.addEventListener("statechange", () => {
            if (
              active &&
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            )
              setUpdateWorker(worker);
          });
        });
      })
      .catch(() => {
        /* Online workshop remains usable if offline caching is unavailable. */
      });
    return () => {
      active = false;
    };
  }, []);
  const commit = (next: Project, key = "") => {
    const checked = parseProject(next);
    if (!checked.ok) {
      setNotice(checked.diagnostics.map((d) => d.message[lang]).join(" "));
      return;
    }
    const previousProject = workspaceRef.current.project;
    if (JSON.stringify(next) === JSON.stringify(previousProject)) return;
    const now = Date.now(),
      coalesce =
        !!key &&
        editGroup.current.key === key &&
        now - editGroup.current.time < 600;
    if (!coalesce) setPast((items) => [...items.slice(-39), previousProject]);
    setFuture([]);
    editGroup.current = { key, time: now };
    setRepair(null);
    setWorkspace((w) => ({ ...w, project: next, completed: [] }));
  };
  const undo = () => {
    if (!past.length) return;
    const prev = past[past.length - 1];
    setFuture((f) => [project, ...f]);
    setPast((p) => p.slice(0, -1));
    setWorkspace((w) => ({ ...w, project: prev, completed: [] }));
    setRepair(null);
    editGroup.current = { key: "", time: 0 };
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p, project]);
    setWorkspace((w) => ({ ...w, project: future[0], completed: [] }));
    setFuture((f) => f.slice(1));
    setRepair(null);
    editGroup.current = { key: "", time: 0 };
  };
  const saveFile = () => {
    if (!downloadWorkspace(workspaceRef.current)) {
      setNotice(
        t(
          "The download could not start. Your current design is still open.",
          "La descarga no pudo iniciarse. Tu diseño sigue abierto.",
        ),
      );
      return;
    }
    setNotice(
      t(
        "Editable project, assembly notes and progress saved to a file.",
        "Proyecto editable, notas y avance guardados en un archivo.",
      ),
    );
  };
  const load = (s: Starter) => {
    if (!downloadWorkspace(workspaceRef.current)) {
      setNotice(
        t(
          "The backup download could not start. The current project is unchanged.",
          "No se pudo iniciar el respaldo. El proyecto actual no cambió.",
        ),
      );
      return;
    }
    commit(s.project);
    setWorkspace((w) => ({
      ...w,
      project: s.project,
      completed: [],
      notes: "",
    }));
    setSelected(s.project.modules[0]?.id ?? "");
    setOpening(100);
    setMode("design");
    setView("model");
    setLibrary(false);
    setReset((r) => r + 1);
    setNotice(
      t(
        "Previous project downloaded before opening this starter. Undo also restores its geometry.",
        "El proyecto anterior se descargó antes de abrir este modelo. Deshacer también restaura su geometría.",
      ),
    );
  };
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error();
      const next = parseWorkspace(await file.text());
      if (!next) throw new Error();
      if (!downloadWorkspace(workspaceRef.current))
        throw new Error("Backup could not start");
      commit(next.project);
      setWorkspace(next);
      setSelected(next.project.modules[0]?.id ?? "");
      setRepair(null);
      setNotice(
        t(
          "Imported successfully. The previous workspace was downloaded as a backup.",
          "Importación completa. El proyecto anterior se descargó como respaldo.",
        ),
      );
    } catch {
      setNotice(
        t(
          "Invalid or oversized project file. The current project is unchanged.",
          "Archivo no válido o demasiado grande. El proyecto actual no cambió.",
        ),
      );
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const patchModule = (patch: Partial<Mechanism>, key = "") => {
    if (!mechanism) return;
    commit(
      {
        ...project,
        modules: project.modules.map((m) =>
          m.id === selected ? ({ ...m, ...patch } as Mechanism) : m,
        ),
      },
      key,
    );
  };
  const param = (field: string, value: number) => {
    if (!mechanism) return;
    patchModule(
      field === "y"
        ? { y: value }
        : ({
            params: { ...mechanism.params, [field]: value },
          } as Partial<Mechanism>),
      selected + field,
    );
  };
  const pin = (field: string) => {
    if (!mechanism) return;
    const pins = mechanism.pins as readonly string[];
    patchModule({
      pins: pins.includes(field)
        ? pins.filter((v) => v !== field)
        : [...pins, field],
    } as Partial<Mechanism>);
  };
  const add = (kind: "P" | "V") => {
    if (project.modules.length >= 6) return;
    let id = "m1";
    for (let i = 1; project.modules.some((m) => m.id === id); i++)
      id = "m" + (i + 1);
    const color = palette[project.modules.length % palette.length];
    const y = Math.max(
      project.card.margin,
      ...analysis.modules.map((m) => m.sweptY[1] + project.card.gap),
    );
    const m: Mechanism =
      kind === "P"
        ? {
            id,
            kind,
            label: t("New step", "Nuevo escalón"),
            color,
            y,
            params: { a: 20, b: 20, width: 20 },
            pins: [],
          }
        : {
            id,
            kind,
            label: t("New V-fold", "Nuevo pliegue V"),
            color,
            y: y + 15,
            params: {
              r: 30,
              h: 30,
              betaDeg: 30,
              gammaDeg: 70,
              tabWidth: 4,
              tabInset: 5,
            },
            pins: [],
          };
    commit({ ...project, modules: [...project.modules, m] });
    setSelected(id);
  };
  const move = (offset: number) => {
    const a = [...project.modules],
      i = a.findIndex((m) => m.id === selected),
      j = i + offset;
    if (i < 0 || j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    commit({ ...project, modules: a });
  };
  const preview = (r: RepairProposal) => {
    setRepair(r);
    setMode("check");
    setView("model");
    setPlaying(false);
  };
  const apply = () => {
    if (!repair) return;
    const r = applyRepair(project, repair);
    if (r.ok) {
      commit(r.value);
      setNotice(
        t(
          "Repair applied. Pinned dimensions were preserved.",
          "Corrección aplicada. Se conservaron las medidas fijadas.",
        ),
      );
    } else {
      setRepair(null);
      setNotice(r.diagnostics.map((d) => d.message[lang]).join(" "));
    }
  };
  const exportFiles = async (kind: "pdf" | "svg" | "fold") => {
    if (repair) return;
    if (!plan && kind !== "fold") return;
    setExporting(kind);
    try {
      const api = await import("./export");
      const result =
        kind === "pdf"
          ? await api.serializePdf(project, plan!, { lang })
          : kind === "svg"
            ? await api.serializeSvgPages(project, plan!, { lang })
            : api.serializeFold(project);
      if (!result.ok) {
        setNotice(result.errors.map((e) => e.message).join(" "));
        return;
      }
      const value = result.value;
      if (Array.isArray(value)) {
        const bundled = api.bundleFiles(
          value,
          kind === "svg"
            ? "plega-patterns-svg.zip"
            : "plega-flat-frames-fold.zip",
        );
        if (!bundled.ok) {
          setNotice(bundled.errors.map((e) => e.message).join(" "));
          return;
        }
        api.downloadFile(bundled.value);
      } else api.downloadFile(value as import("./export/types").ExportFile);
      setNotice(
        t(
          "Export ready. Print at actual size and measure the calibration ruler.",
          "Archivo listo. Imprime a tamaño real y mide la regla de calibración.",
        ),
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : t(
              "Export failed. Your project is saved.",
              "La exportación falló. Tu proyecto está guardado.",
            ),
      );
    } finally {
      setExporting("");
    }
  };
  const modes: [Mode, ReactNode, string, string][] = [
    ["design", <Move3D size={17} />, "Design", "Diseñar"],
    ["check", <ShieldCheck size={17} />, "Check", "Comprobar"],
    ["make", <Scissors size={17} />, "Make", "Fabricar"],
    ["assemble", <Layers size={17} />, "Assemble", "Montar"],
  ];
  const setWorkflow = (next: Mode) => {
    setMode(next);
    setPlaying(false);
    if (next === "make") setView("pattern");
    if (next === "assemble") setView("model");
  };
  const currentStep = steps[Math.min(activeStep, steps.length - 1)];
  const inspectStep = (index: number) => {
    setActiveStep(index);
    const s = steps[index];
    if (s?.moduleId) setSelected(s.moduleId);
    if (s?.openingDeg !== undefined) setOpening(s.openingDeg);
    setView("model");
    setPlaying(false);
  };

  return (
    <div className="app">
      <a className="skip-link" href="#workbench">
        {t("Skip to workbench", "Ir al taller")}
      </a>
      <header className="masthead">
        <a href={import.meta.env.BASE_URL} className="brand" aria-label="Plega">
          <svg viewBox="0 0 38 38" aria-hidden="true">
            <path d="M3 8 19 3 35 8 19 34Z" fill="var(--ink)" />
            <path d="m3 8 16 8 16-8-16 26Z" fill="var(--coral)" />
            <path
              d="M19 16V34M3 8l16 8L19 3"
              fill="none"
              stroke="var(--surface)"
              strokeWidth="1.2"
            />
          </svg>
          <span>
            plega<span className="brand-dot">.</span>
          </span>
        </a>
        <span className="brand-caption">
          {t("PAPER IN MOTION", "PAPEL EN MOVIMIENTO")}
        </span>
        <div className="header-actions">
          <button className="button subdued" onClick={() => setLibrary(true)}>
            <FolderOpen size={16} />
            <span>{t("Projects", "Proyectos")}</span>
          </button>
          <IconButton
            label={t("Workshop guide", "Guía del taller")}
            onClick={() => setHelp(true)}
          >
            <BookOpen size={19} />
          </IconButton>
          <IconButton
            label={
              theme === "light"
                ? t("Switch to dark theme", "Activar tema oscuro")
                : t("Switch to light theme", "Activar tema claro")
            }
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </IconButton>
          <button
            className="language"
            onClick={() => setLang(lang === "en" ? "es" : "en")}
            aria-label={
              lang === "en" ? "Cambiar a español" : "Switch to English"
            }
          >
            {lang === "en" ? "ES" : "EN"}
          </button>
          <a
            className="source-link"
            href="https://github.com/fsantibanezleal/CAOS_Plega"
            target="_blank"
            rel="noreferrer"
          >
            {t("Source", "Código")} ↗
          </a>
        </div>
      </header>
      <div className="project-bar">
        <div className="project-name">
          <span className="project-eyebrow">
            {t("YOUR WORKBENCH", "TU TALLER")}
          </span>
          <input
            aria-label={t("Project title", "Título del proyecto")}
            maxLength={100}
            value={project.title}
            onChange={(e) => {
              if (e.target.value.trim())
                commit({ ...project, title: e.target.value }, "title");
            }}
          />
          <span className={"save-state " + (!saved ? "warning" : "")}>
            <i />
            {saved
              ? t("Saved on this device", "Guardado en este dispositivo")
              : t(
                  "Use Save: browser storage is unavailable",
                  "Usa Guardar: almacenamiento no disponible",
                )}
          </span>
        </div>
        <div className="project-tools">
          <IconButton
            label={t("Undo", "Deshacer")}
            disabled={!past.length}
            onClick={undo}
          >
            <Undo2 size={18} />
          </IconButton>
          <IconButton
            label={t("Redo", "Rehacer")}
            disabled={!future.length}
            onClick={redo}
          >
            <Redo2 size={18} />
          </IconButton>
          <span className="tool-divider" />
          <button className="button subdued" onClick={() => setShare(true)}>
            <Share2 size={16} />
            <span>{t("Share", "Compartir")}</span>
          </button>
          <button className="button primary" onClick={saveFile}>
            <Download size={16} />
            <span>{t("Save project", "Guardar proyecto")}</span>
          </button>
          <IconButton
            label={t("More project actions", "Más acciones")}
            onClick={() => setMore(true)}
          >
            <MoreHorizontal size={20} />
          </IconButton>
        </div>
      </div>
      <nav
        className="workflow"
        aria-label={t("Workshop stages", "Etapas del taller")}
      >
        {modes.map(([id, icon, en, es], i) => (
          <button
            key={id}
            aria-current={mode === id ? "step" : undefined}
            onClick={() => setWorkflow(id)}
          >
            <span className="step-number">0{i + 1}</span>
            {icon}
            <span>{t(en, es)}</span>
            {id === "check" &&
              analysis.diagnostics.some((d) => d.blocks.length > 0) && (
                <i className="attention-dot" />
              )}
          </button>
        ))}
        <span className="workflow-note">
          {t(
            "An idea. A fold. Something you can make.",
            "Una idea. Un pliegue. Algo que puedes fabricar.",
          )}
        </span>
      </nav>
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <IconButton
            label={t("Dismiss message", "Cerrar mensaje")}
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </IconButton>
        </div>
      )}
      {updateWorker && (
        <div className="notice">
          <span>
            {t(
              "An updated workshop is ready.",
              "Hay una versión nueva del taller.",
            )}
          </span>
          <button
            className="text-button"
            onClick={() => {
              if (!saveWorkspace(workspace)) {
                saveFile();
              }
              updateWorker.addEventListener("statechange", () => {
                if (updateWorker.state === "activated") location.reload();
              });
              updateWorker.postMessage({ type: "PLEGA_ACTIVATE_UPDATE" });
            }}
          >
            {t("Save and reload", "Guardar y recargar")}
          </button>
        </div>
      )}
      <main id="workbench" className="workbench">
        <aside className="parts-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">{t("COMPOSITION", "COMPOSICIÓN")}</span>
              <h2>{t("Your mechanisms", "Tus mecanismos")}</h2>
            </div>
            <span className="count">{project.modules.length}/6</span>
          </div>
          <div className="parts-list">
            {project.modules.map((m, i) => (
              <button
                className={"part " + (selected === m.id ? "selected" : "")}
                key={m.id}
                onClick={() => {
                  setSelected(m.id);
                  setRepair(null);
                }}
                aria-pressed={selected === m.id}
              >
                <span className="part-swatch" style={{ background: m.color }}>
                  {m.kind === "P" ? (
                    <Layers size={20} />
                  ) : (
                    <svg viewBox="0 0 24 24" width="22" height="22">
                      <path
                        d="m3 19 9-16 9 16-9-5zM12 3v11"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                      />
                    </svg>
                  )}
                </span>
                <span>
                  <strong>{m.label}</strong>
                  <small>
                    {String(i + 1).padStart(2, "0")} ·{" "}
                    {m.kind === "P"
                      ? t("Parallel step", "Escalón paralelo")
                      : t("V-fold", "Pliegue V")}
                  </small>
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
          <div className="add-buttons">
            <button
              className="button outline"
              disabled={project.modules.length >= 6 || !!repair}
              onClick={() => add("P")}
            >
              <Plus size={14} />
              {t("Step", "Escalón")}
            </button>
            <button
              className="button outline"
              disabled={project.modules.length >= 6 || !!repair}
              onClick={() => add("V")}
            >
              <Plus size={14} />
              {t("V-fold", "Pliegue V")}
            </button>
          </div>
          <div className="lane-heading">
            <h3>{t("Room to move", "Espacio para moverse")}</h3>
            <IconButton
              label={t(
                "Learn about motion zones",
                "Aprender sobre zonas de movimiento",
              )}
              onClick={() => {
                setHelpTopic("checks");
                setHelp(true);
              }}
            >
              <CircleHelp size={14} />
            </IconButton>
          </div>
          <MotionZones
            project={displayed}
            analysis={displayAnalysis}
            selected={selected}
            onSelect={setSelected}
            lang={lang}
          />
          <button
            className="button outline pack-button"
            disabled={!!repair}
            onClick={() => {
              const p = packLanes(project);
              if (p.ok && p.value.changes.length) preview(p.value);
              else
                setNotice(
                  p.ok
                    ? t(
                        "Motion zones are already packed.",
                        "Las zonas ya están ordenadas.",
                      )
                    : p.diagnostics.map((d) => d.message[lang]).join(" "),
                );
            }}
          >
            <WandSparkles size={15} />
            {t("Preview tidy layout", "Ver distribución ordenada")}
          </button>
          <div className="left-bottom">
            <Lightbulb size={18} />
            <p>
              {t(
                "Pin a dimension to keep it unchanged in every repair.",
                "Fija una medida para conservarla en todas las correcciones.",
              )}
            </p>
          </div>
        </aside>
        <section
          className="stage-column"
          aria-label={t("Live design workspace", "Espacio de diseño en vivo")}
        >
          <div className="stage-heading">
            <div className="segmented">
              <button
                aria-pressed={view === "model"}
                onClick={() => setView("model")}
              >
                <Move3D size={15} />
                {t("Motion", "Movimiento")}
              </button>
              <button
                aria-pressed={view === "pattern"}
                onClick={() => setView("pattern")}
              >
                <LayoutTemplate size={15} />
                {t("Flat pattern", "Patrón plano")}
              </button>
            </div>
            <div
              className={
                "status-chip " +
                (displayAnalysis.certificate === "pass" ? "pass" : "review")
              }
            >
              <span />
              {displayAnalysis.certificate === "pass"
                ? t("Geometry checked", "Geometría comprobada")
                : t("Review geometry", "Revisar geometría")}
            </div>
          </div>
          <div
            className={"stage " + (view === "pattern" ? "pattern-stage" : "")}
          >
            <div className="stage-title">
              <span className="eyebrow">
                {repair
                  ? t("REPAIR PREVIEW", "VISTA DE CORRECCIÓN")
                  : mode === "assemble"
                    ? t("FOLLOW THE FOLD", "SIGUE EL PLIEGUE")
                    : t(
                        "A LITTLE PAPER. A LOT OF POSSIBILITY.",
                        "POCO PAPEL. MUCHAS POSIBILIDADES.",
                      )}
              </span>
              <h1>
                {repair
                  ? repair.label[lang]
                  : mode === "assemble" && currentStep
                    ? currentStep.title
                    : mode === "make"
                      ? t("From screen to paper.", "De la pantalla al papel.")
                      : t("Make it move.", "Haz que se mueva.")}
              </h1>
            </div>
            {view === "model" ? (
              <PaperViewer
                scene={scene}
                height={displayed.card.H}
                width={displayed.card.W}
                selected={selected}
                onSelect={setSelected}
                theme={theme}
                lang={lang}
                camera={camera}
                reset={reset}
                dimensions={dimensions}
              />
            ) : (
              <div className="print-preview">
                <PrintViewer
                  plan={plan}
                  pageIndex={page}
                  selected={selected}
                  onSelect={setSelected}
                  lang={lang}
                />
              </div>
            )}
            {view === "model" ? (
              <>
                <div className="camera-tools">
                  <IconButton
                    label={t("Perspective view", "Vista en perspectiva")}
                    aria-pressed={camera === "perspective"}
                    onClick={() => setCamera("perspective")}
                  >
                    <Move3D size={18} />
                  </IconButton>
                  <IconButton
                    label={t("Top view", "Vista superior")}
                    aria-pressed={camera === "top"}
                    onClick={() => setCamera("top")}
                  >
                    <LayoutTemplate size={17} />
                  </IconButton>
                  <IconButton
                    label={t("Front view", "Vista frontal")}
                    aria-pressed={camera === "front"}
                    onClick={() => setCamera("front")}
                  >
                    <BookOpen size={17} />
                  </IconButton>
                  <span />
                  <IconButton
                    label={t("Fit the card", "Encuadrar tarjeta")}
                    onClick={() => setReset((r) => r + 1)}
                  >
                    <Maximize size={17} />
                  </IconButton>
                  <IconButton
                    label={t("Show dimensions", "Mostrar medidas")}
                    aria-pressed={dimensions}
                    onClick={() => setDimensions(!dimensions)}
                  >
                    <Ruler size={18} />
                  </IconButton>
                </div>
                <div className="orbit-hint">
                  {t(
                    "Drag to orbit · Scroll to zoom · Select a part",
                    "Arrastra para orbitar · Rueda para ampliar · Selecciona una pieza",
                  )}
                </div>
              </>
            ) : (
              plan && (
                <div className="page-navigation">
                  <IconButton
                    label={t("Previous pattern sheet", "Hoja anterior")}
                    disabled={page <= 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft size={17} />
                  </IconButton>
                  <span>
                    {t("Pattern", "Patrón")} {page + 1} / {plan.pages.length}
                  </span>
                  <IconButton
                    label={t("Next pattern sheet", "Hoja siguiente")}
                    disabled={page >= plan.pages.length - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight size={17} />
                  </IconButton>
                  <span className="draft-stamp">
                    {plan.purpose === "draft"
                      ? t("DRAFT", "BORRADOR")
                      : t("ACTUAL SIZE", "TAMAÑO REAL")}
                  </span>
                </div>
              )
            )}
          </div>
          {view === "model" ? (
            <div className="motion-control">
              <button
                className="play-button"
                aria-label={
                  playing
                    ? t("Pause motion", "Pausar movimiento")
                    : t("Play motion", "Reproducir movimiento")
                }
                onClick={() => setPlaying(!playing)}
                disabled={!scene}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <div className="fold-slider">
                <div>
                  <label htmlFor="opening">
                    {t("Open the card", "Abre la tarjeta")}
                  </label>
                  <output htmlFor="opening">{fmt(opening)}°</output>
                </div>
                <input
                  id="opening"
                  type="range"
                  min="0"
                  max="180"
                  step="1"
                  value={opening}
                  onChange={(e) => {
                    setPlaying(false);
                    setOpening(Number(e.target.value));
                  }}
                />
                <div className="angle-presets">
                  {[0, 90, 180].map((a) => (
                    <button
                      key={a}
                      onClick={() => {
                        setPlaying(false);
                        setOpening(a);
                      }}
                    >
                      {a === 0
                        ? t("Closed", "Cerrada")
                        : a === 90
                          ? t("Display · 90°", "Exhibir · 90°")
                          : t("Open · 180°", "Abierta · 180°")}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="print-legend">
              <span>
                <i className="cut" />
                {t("Cut", "Cortar")}
              </span>
              <span>
                <i className="mountain" />
                {t("Mountain fold", "Montaña")}
              </span>
              <span>
                <i className="valley" />
                {t("Valley fold", "Valle")}
              </span>
              <span>
                <i className="glue" />
                {t("Glue footprint", "Huella de pegado")}
              </span>
            </div>
          )}
          <div className="stage-foot">
            <span>
              {t(
                "Rigid panels · Zero thickness · Millimetres",
                "Paneles rígidos · Sin espesor · Milímetros",
              )}
            </span>
            <button
              className="text-button"
              onClick={() => {
                setHelpTopic("principles");
                setHelp(true);
              }}
            >
              {t("What the model checks", "Qué comprueba el modelo")}{" "}
              <ArrowRight size={13} />
            </button>
          </div>
        </section>
        <aside className="inspector">
          <div className="inspector-content">
            {repair ? (
              <section className="repair-inspector">
                <span className="eyebrow">
                  {t("BEFORE YOU APPLY", "ANTES DE APLICAR")}
                </span>
                <h2>{repair.label[lang]}</h2>
                <div className="repair-comparison">
                  <div>
                    <MiniPaper scene={posed(project, 100)} />
                    <small>{t("Current", "Actual")}</small>
                  </div>
                  <ArrowRight size={16} />
                  <div>
                    <MiniPaper scene={posed(repair.after, 100)} />
                    <small>{t("Proposed", "Propuesta")}</small>
                  </div>
                </div>
                <p>
                  {t(
                    "Only the changes below will be applied. Pins are respected.",
                    "Solo se aplicarán los cambios indicados. Se respetan las medidas fijadas.",
                  )}
                </p>
                <div className="change-list">
                  {repair.changes.map((c, i) => (
                    <div key={i}>
                      <span>
                        {c.scope === "module" ? c.moduleId + " · " : ""}
                        {fieldNames[c.field]?.[lang === "es" ? 1 : 0] ??
                          c.field}
                      </span>
                      <strong>
                        {fmt(c.before)} <ArrowRight size={12} /> {fmt(c.after)}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="repair-summary">
                  <Check size={17} />
                  {repair.resolves.length}{" "}
                  {t(
                    "blocking checks resolved",
                    "comprobaciones bloqueantes resueltas",
                  )}
                </div>
                {repair.remaining.length > 0 && (
                  <p className="warning-text">
                    {repair.remaining.length}{" "}
                    {t(
                      "blocking checks remain. Review before fabrication.",
                      "comprobaciones siguen pendientes. Revisa antes de fabricar.",
                    )}
                  </p>
                )}
                <button className="button primary full" onClick={apply}>
                  <CheckCheck size={17} />
                  {t("Apply this repair", "Aplicar corrección")}
                </button>
                <button
                  className="button outline full"
                  onClick={() => setRepair(null)}
                >
                  {t("Keep current design", "Conservar diseño actual")}
                </button>
              </section>
            ) : mode === "design" ? (
              <>
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">
                      {t("SHAPE THE IDEA", "DA FORMA A LA IDEA")}
                    </span>
                    <h2>
                      {mechanism?.kind === "P"
                        ? t("Parallel step", "Escalón paralelo")
                        : mechanism
                          ? t("V-fold", "Pliegue V")
                          : t("Card settings", "Ajustes de tarjeta")}
                    </h2>
                  </div>
                  <IconButton
                    label={t("Mechanism guide", "Guía del mecanismo")}
                    onClick={() => {
                      setHelpTopic(mechanism?.kind === "P" ? "step" : "vfold");
                      setHelp(true);
                    }}
                  >
                    <CircleHelp size={18} />
                  </IconButton>
                </div>
                {mechanism && (
                  <>
                    <label className="text-field">
                      {t("Part label", "Nombre de la pieza")}
                      <input
                        value={mechanism.label}
                        maxLength={48}
                        onChange={(e) => {
                          if (e.target.value.trim())
                            patchModule(
                              { label: e.target.value },
                              selected + "label",
                            );
                        }}
                      />
                    </label>
                    <div className="color-row">
                      <span>{t("Paper colour", "Color del papel")}</span>
                      <div>
                        {palette.map((color) => (
                          <button
                            key={color}
                            className="color-chip"
                            style={{ background: color }}
                            aria-label={color}
                            aria-pressed={mechanism.color === color}
                            onClick={() => patchModule({ color })}
                          >
                            {mechanism.color === color && <Check size={13} />}
                          </button>
                        ))}
                        <input
                          type="color"
                          aria-label={t(
                            "Custom paper colour",
                            "Color personalizado",
                          )}
                          value={mechanism.color}
                          onChange={(e) =>
                            patchModule({ color: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="parameter-list">
                      {Object.entries(mechanism.params).map(
                        ([field, value]) => (
                          <NumericField
                            key={selected + field}
                            name={field}
                            value={value}
                            min={field.endsWith("Deg") ? 1 : 0.5}
                            max={
                              field === "betaDeg"
                                ? 60
                                : field === "gammaDeg"
                                  ? 110
                                  : field === "tabWidth"
                                    ? 15
                                    : field === "tabInset"
                                      ? 25
                                      : Math.max(100, value)
                            }
                            step={
                              field === "tabWidth" || field === "tabInset"
                                ? 0.5
                                : 1
                            }
                            pinned={(
                              mechanism.pins as readonly string[]
                            ).includes(field)}
                            onValue={(n) => param(field, n)}
                            onPin={() => pin(field)}
                            lang={lang}
                          />
                        ),
                      )}
                      <NumericField
                        name="y"
                        value={mechanism.y}
                        min={0}
                        max={project.card.H}
                        pinned={mechanism.pins.includes("y")}
                        onValue={(n) => param("y", n)}
                        onPin={() => pin("y")}
                        lang={lang}
                      />
                    </div>
                    <div className="part-actions">
                      <IconButton
                        label={t("Move part earlier", "Mover pieza antes")}
                        disabled={project.modules[0]?.id === selected}
                        onClick={() => move(-1)}
                      >
                        <ArrowUp size={15} />
                      </IconButton>
                      <IconButton
                        label={t("Move part later", "Mover pieza después")}
                        disabled={project.modules.at(-1)?.id === selected}
                        onClick={() => move(1)}
                      >
                        <ArrowDown size={15} />
                      </IconButton>
                      <button
                        className="text-button danger"
                        onClick={() => {
                          commit({
                            ...project,
                            modules: project.modules.filter(
                              (m) => m.id !== selected,
                            ),
                          });
                          setSelected(
                            project.modules.find((m) => m.id !== selected)
                              ?.id ?? "",
                          );
                        }}
                      >
                        <Trash2 size={14} />
                        {t("Remove part", "Quitar pieza")}
                      </button>
                    </div>
                  </>
                )}
                <details className="card-settings">
                  <summary>
                    {t("Card & spacing", "Tarjeta y separación")}
                    <ChevronDown size={15} />
                  </summary>
                  <label className="text-field">
                    {t("Starting blank", "Pliego inicial")}
                    <select
                      value={project.card.blank}
                      onChange={(e) =>
                        commit({
                          ...project,
                          card: {
                            ...project.card,
                            blank: e.target.value as "uncreased" | "prefolded",
                          },
                        })
                      }
                    >
                      <option value="uncreased">
                        {t("Uncreased sheet", "Hoja sin pliegue previo")}
                      </option>
                      <option value="prefolded">
                        {t("Already folded card", "Tarjeta ya plegada")}
                      </option>
                    </select>
                  </label>
                  {(["W", "H", "margin", "gap"] as const).map((field) => (
                    <NumericField
                      key={field}
                      name={field}
                      value={project.card[field]}
                      min={
                        field === "W" || field === "H"
                          ? 10
                          : field === "gap"
                            ? 0.1
                            : 0
                      }
                      max={field === "W" ? 200 : field === "H" ? 300 : 20}
                      pinned={project.card.pins.includes(field)}
                      lang={lang}
                      onValue={(n) =>
                        commit(
                          { ...project, card: { ...project.card, [field]: n } },
                          "card" + field,
                        )
                      }
                      onPin={() =>
                        commit({
                          ...project,
                          card: {
                            ...project.card,
                            pins: project.card.pins.includes(field)
                              ? project.card.pins.filter((p) => p !== field)
                              : [...project.card.pins, field],
                          },
                        })
                      }
                    />
                  ))}
                </details>
                <div className="next-card">
                  <span>
                    {analysis.canFinalPrint
                      ? t("Your geometry is ready.", "Tu geometría está lista.")
                      : t(
                          "Some dimensions need a look.",
                          "Algunas medidas necesitan revisión.",
                        )}
                  </span>
                  <button
                    className="button primary full"
                    onClick={() => setWorkflow("check")}
                  >
                    {t("Check the design", "Comprobar diseño")}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </>
            ) : mode === "check" ? (
              <>
                <span className="eyebrow">
                  {t("CONFIDENCE BEFORE CUTTING", "CONFIANZA ANTES DE CORTAR")}
                </span>
                <h2>{t("Will it fold?", "¿Se podrá plegar?")}</h2>
                <div
                  className={
                    "check-verdict " +
                    (analysis.certificate === "pass" ? "pass" : "review")
                  }
                >
                  <ShieldCheck size={26} />
                  <div>
                    <strong>
                      {analysis.certificate === "pass"
                        ? t(
                            "Supported geometry passes",
                            "Geometría admitida correcta",
                          )
                        : t(
                            "Review these constraints",
                            "Revisa estas restricciones",
                          )}
                    </strong>
                    <p>
                      {t(
                        "Checks cover the entire opening, including the closed footprint.",
                        "Las comprobaciones cubren toda la apertura, incluida la huella cerrada.",
                      )}
                    </p>
                  </div>
                </div>
                <div className="check-counts">
                  <span>
                    <strong>
                      {analysis.checks.filter((c) => c.state === "pass").length}
                    </strong>
                    {t("checks pass", "correctas")}
                  </span>
                  <span>
                    <strong>
                      {
                        analysis.diagnostics.filter((d) => d.blocks.length)
                          .length
                      }
                    </strong>
                    {t("need review", "por revisar")}
                  </span>
                </div>
                <ClosedFit
                  project={project}
                  analysis={analysis}
                  selected={selected}
                  lang={lang}
                />
                <div className="diagnostics">
                  {analysis.diagnostics.map((d) => (
                    <article key={d.id} className={"diagnostic " + d.severity}>
                      <strong>{d.message[lang]}</strong>
                      {d.numbers.length > 0 && (
                        <div>
                          {d.numbers.map((n, i) => (
                            <span key={i}>
                              {metricNames[n.key]?.[lang === "es" ? 1 : 0] ??
                                n.key}
                              :{" "}
                              <b>
                                {fmt(n.value)}{" "}
                                {n.unit === "unitless" || n.unit === "count"
                                  ? ""
                                  : n.unit}
                              </b>
                            </span>
                          ))}
                        </div>
                      )}
                      {d.moduleIds.length > 0 && (
                        <button
                          className="text-button"
                          onClick={() => setSelected(d.moduleIds[0])}
                        >
                          {t("Select affected part", "Seleccionar pieza")}
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </article>
                  ))}
                </div>
                {repairs.length > 0 && (
                  <>
                    <h3>{t("Ways to resolve it", "Cómo resolverlo")}</h3>
                    <div className="repair-options">
                      {repairs.map((r) => (
                        <button key={r.id} onClick={() => preview(r)}>
                          <WandSparkles size={17} />
                          <span>
                            <strong>{r.label[lang]}</strong>
                            <small>
                              {r.changes.length}{" "}
                              {t(
                                "changes · preview first",
                                "cambios · ver antes",
                              )}
                            </small>
                          </span>
                          <ChevronRight size={15} />
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <p className="fine-print">
                  {t(
                    "A pass applies to rigid, zero-thickness panels in the two supported families. Paper thickness, glue and cutting tolerances still need a physical check.",
                    "El resultado se aplica a paneles rígidos sin espesor de las dos familias admitidas. El espesor, pegamento y tolerancias requieren una prueba física.",
                  )}
                </p>
                <button
                  className="button primary full"
                  onClick={() => setWorkflow("make")}
                >
                  {t("Prepare print sheets", "Preparar hojas")}
                  <ArrowRight size={16} />
                </button>
              </>
            ) : mode === "make" ? (
              <>
                <span className="eyebrow">
                  {t("THE CUTTING TABLE", "LA MESA DE CORTE")}
                </span>
                <h2>{t("Ready for real paper.", "Listo para el papel.")}</h2>
                <p className="intro-text">
                  {t(
                    "A complete set: overview, numbered assembly guide, and patterns at 1:1 scale.",
                    "Un conjunto completo: vista general, guía de montaje numerada y patrones a escala 1:1.",
                  )}
                </p>
                <label className="text-field">
                  {t("Printer paper", "Papel de impresora")}
                  <select
                    value={paper}
                    onChange={(e) =>
                      setPaper(e.target.value as "A4" | "Letter")
                    }
                  >
                    <option value="A4">A4 · 210 × 297 mm</option>
                    <option value="Letter">
                      {t("US Letter", "Carta")} · 215.9 × 279.4 mm
                    </option>
                  </select>
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={tiling}
                    onChange={(e) => setTiling(e.target.checked)}
                  />
                  <span>
                    {t(
                      "Tile oversized pieces as transfer patterns",
                      "Dividir piezas grandes como patrones de transferencia",
                    )}
                    <small>
                      {t(
                        "Join the template, then trace onto one continuous piece of card.",
                        "Une la plantilla y transfiérela a una pieza continua de cartulina.",
                      )}
                    </small>
                  </span>
                </label>
                {plan ? (
                  <div className="print-summary">
                    <div>
                      <strong>{plan.pages.length}</strong>
                      <span>{t("pattern sheets", "hojas de patrón")}</span>
                    </div>
                    <div>
                      <strong>{plan.pieces.length}</strong>
                      <span>{t("continuous pieces", "piezas continuas")}</span>
                    </div>
                  </div>
                ) : (
                  <div className="diagnostic error">
                    {planResult.diagnostics.map((d) => (
                      <p key={d.id}>{d.message[lang]}</p>
                    ))}
                  </div>
                )}
                {!analysis.canFinalPrint && (
                  <div className="diagnostic warning">
                    <strong>
                      {t(
                        "Draft only: unresolved geometry",
                        "Solo borrador: geometría pendiente",
                      )}
                    </strong>
                    <p>
                      {t(
                        "Draft pages are marked. Resolve the checks before cutting.",
                        "Las hojas llevan una marca de borrador. Corrige las comprobaciones antes de cortar.",
                      )}
                    </p>
                  </div>
                )}
                <div className="download-options">
                  <button
                    className="button primary full"
                    disabled={!plan || !!exporting}
                    onClick={() => void exportFiles("pdf")}
                  >
                    <Printer size={18} />
                    {exporting === "pdf"
                      ? t("Preparing PDF…", "Preparando PDF…")
                      : plan?.purpose === "draft"
                        ? t("Download draft PDF", "Descargar PDF de borrador")
                        : t("Download complete PDF", "Descargar PDF completo")}
                  </button>
                  <button
                    className="button outline full"
                    disabled={!plan || !!exporting}
                    onClick={() => void exportFiles("svg")}
                  >
                    <FileDown size={17} />
                    {t("SVG sheets · ZIP", "Hojas SVG · ZIP")}
                  </button>
                  <button
                    className="button outline full"
                    disabled={!analysis.canFoldExport || !!exporting}
                    onClick={() => void exportFiles("fold")}
                  >
                    <Layers size={17} />
                    {t("FOLD flat frames · ZIP", "Marcos planos FOLD · ZIP")}
                  </button>
                </div>
                <div className="calibration-card">
                  <Ruler size={23} />
                  <h3>
                    {t("Measure before you cut.", "Mide antes de cortar.")}
                  </h3>
                  <p>
                    {t(
                      "Print at 100% / actual size. Turn off “fit to page”. Verify the 100 mm ruler and 10 mm square on the printed sheet.",
                      "Imprime al 100% / tamaño real. Desactiva “ajustar a página”. Verifica la regla de 100 mm y el cuadrado de 10 mm impresos.",
                    )}
                  </p>
                  <svg viewBox="0 0 220 25" aria-hidden="true">
                    <path
                      d="M5 5v15h210V5M26 12v8m21-8v8m21-8v8m21-8v8m21-15v15m21-8v8m21-8v8m21-8v8m21-8v8"
                      stroke="currentColor"
                      fill="none"
                    />
                  </svg>
                  <small>
                    {t(
                      "Screen illustration; use the exported calibration marks.",
                      "Ilustración en pantalla; usa las marcas del archivo exportado.",
                    )}
                  </small>
                </div>
                <button
                  className="button primary full"
                  onClick={() => setWorkflow("assemble")}
                >
                  {t("Open assembly guide", "Abrir guía de montaje")}
                  <ArrowRight size={16} />
                </button>
              </>
            ) : (
              <>
                <span className="eyebrow">
                  {t("BRING IT TO LIFE", "DALE VIDA")}
                </span>
                <h2>{t("One fold at a time.", "Un pliegue a la vez.")}</h2>
                <div className="assembly-progress">
                  <div>
                    <strong>
                      {
                        steps.filter((s) => workspace.completed.includes(s.id))
                          .length
                      }{" "}
                      / {steps.length}
                    </strong>
                    <span>
                      {t("steps checked by you", "pasos marcados por ti")}
                    </span>
                  </div>
                  <progress
                    value={
                      steps.filter((s) => workspace.completed.includes(s.id))
                        .length
                    }
                    max={steps.length || 1}
                  />
                </div>
                {!analysis.canFinalPrint && (
                  <div className="diagnostic warning">
                    {t(
                      "Review the geometry before using these instructions to build.",
                      "Revisa la geometría antes de usar estas instrucciones para construir.",
                    )}
                  </div>
                )}
                <ol className="assembly-list">
                  {steps.map((s, i) => (
                    <li key={s.id} className={activeStep === i ? "active" : ""}>
                      <button onClick={() => inspectStep(i)}>
                        <span>
                          {workspace.completed.includes(s.id) ? (
                            <Check size={15} />
                          ) : (
                            i + 1
                          )}
                        </span>
                        <strong>{s.title}</strong>
                      </button>
                      {activeStep === i && (
                        <div>
                          <p>{s.body}</p>
                          <label className="checkbox-field">
                            <input
                              type="checkbox"
                              checked={workspace.completed.includes(s.id)}
                              onChange={(e) =>
                                setWorkspace((w) => ({
                                  ...w,
                                  completed: e.target.checked
                                    ? [...w.completed, s.id]
                                    : w.completed.filter((id) => id !== s.id),
                                }))
                              }
                            />
                            {t("I completed this step", "Completé este paso")}
                          </label>
                          {i < steps.length - 1 && (
                            <button
                              className="text-button"
                              onClick={() => inspectStep(i + 1)}
                            >
                              {t("Next step", "Siguiente paso")}
                              <ArrowRight size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
                <label className="text-field notes-field">
                  {t("Your build observations", "Observaciones de tu montaje")}
                  <textarea
                    rows={4}
                    maxLength={8000}
                    value={workspace.notes}
                    placeholder={t(
                      "Paper used, adjustments, what happened when you closed it…",
                      "Papel usado, ajustes, qué ocurrió al cerrar…",
                    )}
                    onChange={(e) =>
                      setWorkspace((w) => ({ ...w, notes: e.target.value }))
                    }
                  />
                  <small>
                    {t(
                      "Private on this device and in your project file. Excluded from share links.",
                      "Privadas en este dispositivo y en tu archivo. No se incluyen en enlaces compartidos.",
                    )}
                  </small>
                </label>
                <button className="button primary full" onClick={saveFile}>
                  <Download size={17} />
                  {t("Save project & observations", "Guardar proyecto y notas")}
                </button>
              </>
            )}
          </div>
        </aside>
      </main>
      <footer className="app-footer">
        <span>
          PLEGA <small>v0.01.000</small>
        </span>
        <span>
          {t(
            "Make, understand, keep creating.",
            "Crea, comprende, sigue creando.",
          )}
        </span>
        <button
          className="text-button"
          onClick={() => {
            setHelpTopic("sources");
            setHelp(true);
          }}
        >
          {t("Sources & model limits", "Fuentes y límites")}
        </button>
      </footer>
      <input
        ref={fileInput}
        type="file"
        accept=".json,.plega.json,application/json"
        hidden
        onChange={(e) => void importFile(e.target.files?.[0])}
      />
      <Dialog
        open={!!incomingShare}
        title={t("A shared design is ready", "Hay un diseño compartido")}
        onClose={() => setIncomingShare(null)}
      >
        <p>
          {t(
            "You already have a saved project on this device. Keep working on it, or download a backup before opening the shared design.",
            "Ya tienes un proyecto guardado en este dispositivo. Puedes conservarlo o descargar un respaldo antes de abrir el diseño compartido.",
          )}
        </p>
        {incomingShare && (
          <div className="repair-comparison">
            <div>
              <MiniPaper scene={posed(project, 100)} />
              <small>{project.title}</small>
            </div>
            <ArrowRight size={16} />
            <div>
              <MiniPaper scene={posed(incomingShare.project, 100)} />
              <small>{incomingShare.project.title}</small>
            </div>
          </div>
        )}
        <button
          className="button primary full"
          onClick={() => {
            if (!incomingShare) return;
            if (!downloadWorkspace(workspaceRef.current)) {
              setNotice(
                t(
                  "Could not start the backup. Your project is unchanged.",
                  "No se pudo iniciar el respaldo. Tu proyecto no cambió.",
                ),
              );
              return;
            }
            commit(incomingShare.project);
            setWorkspace(incomingShare);
            setSelected(incomingShare.project.modules[0]?.id ?? "");
            setIncomingShare(null);
          }}
        >
          {t(
            "Back up and open shared design",
            "Respaldar y abrir diseño compartido",
          )}
        </button>
        <button
          className="button outline full"
          onClick={() => setIncomingShare(null)}
        >
          {t("Keep my current project", "Conservar mi proyecto actual")}
        </button>
      </Dialog>
      <Dialog
        open={recoveryOpen}
        title={t("Keep your stored data safe", "Conserva tus datos guardados")}
        onClose={() => setRecoveryOpen(false)}
      >
        <p>
          {t(
            "The previous browser save cannot be read. Its original bytes remain untouched, and automatic saving is paused. Download the stored data before explicitly replacing it, or keep it and use portable project downloads.",
            "No se puede leer el guardado anterior. Sus bytes originales siguen intactos y el guardado automático está pausado. Descarga esos datos antes de reemplazarlos explícitamente, o consérvalos y usa archivos portátiles.",
          )}
        </p>
        <button
          className="button primary full"
          onClick={() => {
            if (!downloadStoredRecovery()) {
              setNotice(
                t(
                  "Recovery download could not start. Stored bytes remain untouched.",
                  "No se pudo descargar la recuperación. Los datos guardados siguen intactos.",
                ),
              );
              return;
            }
            if (
              saveWorkspace(workspaceRef.current, { replaceUnreadable: true })
            ) {
              setPreserveUnreadable(false);
              setRecoveryOpen(false);
              setSaved(true);
            } else
              setNotice(
                t(
                  "The new save failed. Keep the recovery download and use project files.",
                  "Falló el nuevo guardado. Conserva la recuperación y usa archivos de proyecto.",
                ),
              );
          }}
        >
          {t(
            "Download stored data and replace save",
            "Descargar datos y reemplazar guardado",
          )}
        </button>
        <button
          className="button outline full"
          onClick={() => setRecoveryOpen(false)}
        >
          {t(
            "Keep stored data; pause automatic saving",
            "Conservar datos; pausar guardado automático",
          )}
        </button>
      </Dialog>
      <Dialog
        open={library}
        title={t(
          "Start with a fold. Make it yours.",
          "Empieza con un pliegue. Hazlo tuyo.",
        )}
        onClose={() => setLibrary(false)}
        className="library-dialog"
      >
        <p className="dialog-intro">
          {t(
            "Six original compositions, two repair challenges. Opening a starter downloads your current project first.",
            "Seis composiciones originales, dos retos de corrección. Al abrir un modelo se descarga primero tu proyecto actual.",
          )}
        </p>
        <input
          className="search"
          type="search"
          placeholder={t("Find a project…", "Buscar proyecto…")}
          aria-label={t("Find a project", "Buscar proyecto")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="starter-grid">
          {[...STARTERS, ...REPAIR_CASES]
            .filter((s) =>
              (s.title[lang] + " " + s.description[lang])
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((s, i) => (
              <button
                className="starter-card"
                key={s.id}
                onClick={() => load(s)}
              >
                <div className={"starter-art art-" + (i % 4)}>
                  <MiniPaper scene={posed(s.project, 100)} />
                  <span>
                    {REPAIR_CASES.some((r) => r.id === s.id)
                      ? t("REPAIR CHALLENGE", "RETO DE CORRECCIÓN")
                      : String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div>
                  <h3>{s.title[lang]}</h3>
                  <p>{s.description[lang]}</p>
                  <small>{s.learning[lang]}</small>
                  <span className="starter-action">
                    {t("Open project", "Abrir proyecto")}
                    <ArrowRight size={16} />
                  </span>
                </div>
              </button>
            ))}
        </div>
      </Dialog>
      <Dialog
        open={more}
        title={t("Project files", "Archivos del proyecto")}
        onClose={() => setMore(false)}
      >
        <div className="project-menu">
          <button
            className="button outline full"
            onClick={() => {
              setMore(false);
              fileInput.current?.click();
            }}
          >
            <Upload size={18} />
            {t("Import project JSON", "Importar proyecto JSON")}
          </button>
          <button
            className="button primary full"
            onClick={() => {
              saveFile();
              setMore(false);
            }}
          >
            <Download size={18} />
            {t("Save a portable project file", "Guardar archivo portátil")}
          </button>
          <p>
            {t(
              "Projects stay in this browser. A saved file includes editable geometry, your assembly progress and observations. Opening another project automatically downloads the current one.",
              "Los proyectos permanecen en este navegador. El archivo incluye geometría editable, progreso y observaciones. Abrir otro proyecto descarga automáticamente el actual.",
            )}
          </p>
        </div>
      </Dialog>
      <Dialog
        open={share}
        title={t("Share the design", "Compartir el diseño")}
        onClose={() => setShare(false)}
      >
        <p>
          {t(
            "Anyone with this link can open an editable copy. Your assembly progress and private notes are excluded. The design lives in the link fragment; it is not uploaded to an account.",
            "Quien tenga este enlace puede abrir una copia editable. Se excluyen tu avance y notas privadas. El diseño está en el fragmento del enlace; no se sube a una cuenta.",
          )}
        </p>
        <label className="text-field">
          {t("Design link", "Enlace del diseño")}
          <textarea
            readOnly
            rows={3}
            value={encodeShare(project)}
            onFocus={(e) => e.target.select()}
          />
        </label>
        <button
          className="button primary full"
          onClick={() =>
            void navigator.clipboard
              .writeText(encodeShare(project))
              .then(() =>
                setNotice(t("Design link copied.", "Enlace copiado.")),
              )
              .catch(() =>
                setNotice(
                  t(
                    "Select and copy the link manually. Clipboard permission is unavailable.",
                    "Selecciona y copia el enlace manualmente. El portapapeles no está disponible.",
                  ),
                ),
              )
          }
        >
          <Copy size={17} />
          {t("Copy link", "Copiar enlace")}
        </button>
      </Dialog>
      <Dialog
        open={help}
        title={t("The paper workshop guide", "La guía del taller de papel")}
        onClose={() => setHelp(false)}
        className="guide-dialog"
      >
        <div className="guide-layout">
          <nav aria-label={t("Guide chapters", "Capítulos de la guía")}>
            {[
              ["principles", "Start here", "Empieza aquí"],
              ["step", "Parallel step", "Escalón paralelo"],
              ["vfold", "V-fold", "Pliegue V"],
              ["checks", "Checks & repairs", "Comprobar y corregir"],
              ["print", "Printing & assembly", "Imprimir y montar"],
              ["sources", "Sources & limits", "Fuentes y límites"],
            ].map(([id, en, es]) => (
              <button
                key={id}
                aria-current={helpTopic === id ? "page" : undefined}
                onClick={() => setHelpTopic(id)}
              >
                {t(en, es)}
                <ChevronRight size={14} />
              </button>
            ))}
          </nav>
          <Guide topic={helpTopic} lang={lang} />
        </div>
      </Dialog>
    </div>
  );
}

function Guide({ topic, lang }: { topic: string; lang: Language }) {
  const t = (en: string, es: string) => (lang === "es" ? es : en);
  const source = (
    <a
      href="https://fab.cba.mit.edu/classes/865.18/discrete/folding/KinematicPaperMechanisms.pdf"
      target="_blank"
      rel="noreferrer"
    >
      Winder, Magleby & Howell (2009) ↗
    </a>
  );
  return (
    <article className="guide-article">
      {topic === "principles" ? (
        <>
          <span className="eyebrow">
            {t(
              "FROM AN IDEA TO A PRINTABLE OBJECT",
              "DE UNA IDEA A UN OBJETO IMPRIMIBLE",
            )}
          </span>
          <h3>
            {t("Paper can be a mechanism.", "El papel puede ser un mecanismo.")}
          </h3>
          <p>
            {t(
              "Rigid faces joined by straight creases form linkages. Opening the card drives each mechanism through a constrained motion. Plega gives you two known families, original starter compositions, and the tools to turn your own dimensions into a fabrication package.",
              "Las caras rígidas unidas por pliegues rectos forman mecanismos. Abrir la tarjeta impulsa un movimiento restringido. Plega ofrece dos familias conocidas, composiciones originales y herramientas para convertir tus medidas en un paquete de fabricación.",
            )}
          </p>
          <p>
            {t(
              "Design a composition with up to six parts. Check the closed fit and motion zones. Preview a repair without losing your dimensions. Make a complete print package. Assemble it while recording what you actually observe.",
              "Diseña hasta seis piezas. Comprueba la huella cerrada y las zonas de movimiento. Previsualiza una corrección sin perder tus medidas. Prepara el paquete impreso. Móntalo registrando lo que observes.",
            )}
          </p>
          <div className="guide-callout">
            {t(
              "The animation is geometry, not material physics. A checked design still needs a careful physical build.",
              "La animación representa geometría, no física de materiales. Un diseño comprobado todavía necesita un montaje físico cuidadoso.",
            )}
          </div>
          <h4>
            {t(
              "Explore without losing your work",
              "Explora sin perder tu trabajo",
            )}
          </h4>
          <p>
            {t(
              "Select parts in the list or by clicking the 3D model. Drag to orbit; use the wheel to zoom. With the canvas focused, arrow keys orbit, +/− zoom, and R fits the card. Motion starts only when you press Play. Save a project file to keep geometry, notes and progress outside this browser. Undo restores prior geometry.",
              "Selecciona piezas en la lista o en el modelo 3D. Arrastra para orbitar y usa la rueda para ampliar. Con el lienzo enfocado, las flechas orbitan, +/− amplían y R encuadra. El movimiento empieza al pulsar Reproducir. Guarda un archivo para conservar geometría, notas y avance fuera del navegador. Deshacer restaura geometría anterior.",
            )}
          </p>
          <p>
            {t(
              "The linkage interpretation follows the established paper-mechanism literature.",
              "La interpretación mediante mecanismos sigue la literatura existente.",
            )}{" "}
            {source}
          </p>
        </>
      ) : topic === "step" ? (
        <>
          <span className="eyebrow">
            {t(
              "FAMILY P · ONE CONTINUOUS SHEET",
              "FAMILIA P · UNA HOJA CONTINUA",
            )}
          </span>
          <h3>{t("The parallel step", "El escalón paralelo")}</h3>
          <p>
            {t(
              "Two open slits leave a connected strip. Two valley hinges and one central mountain turn it into a step when the card is held at 90°. The step becomes flat again at 180°. No glue is needed.",
              "Dos ranuras abiertas dejan una tira conectada. Dos bisagras en valle y una montaña central forman un escalón a 90°. El escalón vuelve a ser plano a 180°. No necesita pegamento.",
            )}
          </p>
          <div className="formula">
            C = a · u(θ) + b · v<br />
            |AC| = b, |BC| = a<br />a + b ≤ W − m
          </div>
          <p>
            {t(
              "The two moving faces keep their edge lengths as the pages rotate. At closure their reach is a + b, so increasing either height or depth uses the same closed-page allowance. Pin one dimension before asking for a repair.",
              "Las dos caras móviles conservan sus longitudes al girar las páginas. Al cerrar alcanzan a + b: aumentar altura o fondo consume el mismo espacio. Fija una medida antes de pedir una corrección.",
            )}
          </p>
          <h4>
            {t(
              "An asymmetric step needs an uncreased blank",
              "Un escalón asimétrico necesita una hoja sin pliegue",
            )}
          </h4>
          <p>
            {t(
              "In the flat pattern the two cuts run from x = −a to x = b. The middle mountain is at x = b − a. If a and b differ, that crease is offset from the gutter. An already folded card would introduce an extra hinge; the prefolded setting therefore requires a = b.",
              "En el patrón plano, los cortes van de x = −a a x = b. La montaña central está en x = b − a. Si a y b difieren, el pliegue queda desplazado. Una tarjeta ya doblada añadiría una bisagra; por eso ese ajuste exige a = b.",
            )}
          </p>
          <p>
            {t(
              "The app uses its own rectangular linkage derivation, within the established kinematic framework.",
              "La app usa una derivación rectangular propia dentro del marco cinemático establecido.",
            )}{" "}
            {source}
          </p>
        </>
      ) : topic === "vfold" ? (
        <>
          <span className="eyebrow">
            {t("FAMILY V · A GLUED INSERT", "FAMILIA V · UN INSERTO PEGADO")}
          </span>
          <h3>
            {t(
              "A ridge that rises from the page",
              "Una arista que se eleva de la página",
            )}
          </h3>
          <p>
            {t(
              "Two rigid triangles meet along one ridge. Their outer edges attach to the card with paired glue tabs. The base angle β and triangle angle γ determine the ridge direction; changing the opening does not stretch the panels.",
              "Dos triángulos rígidos comparten una arista. Los bordes exteriores se unen a la tarjeta con pestañas emparejadas. El ángulo de base β y el del triángulo γ determinan la dirección de la arista; la apertura no estira los paneles.",
            )}
          </p>
          <div className="formula">
            20° ≤ β ≤ 45°
            <br />β + 15° ≤ γ ≤ 90°
            <br />
            LC² = r² + h² − 2rh cos γ
          </div>
          <p>
            {t(
              "This workshop restricts the angles to a domain with a real, continuous interior branch across the full opening. Its triangles occupy opposite half-spaces and share only their ridge. The restrictions are sufficient for this model; a rejected value is not proof that every other paper construction is impossible.",
              "El taller restringe los ángulos a un dominio con una rama interior real y continua durante toda la apertura. Los triángulos ocupan semiespacios opuestos y comparten solo la arista. Son condiciones suficientes para este modelo; un valor rechazado no prueba que toda construcción alternativa sea imposible.",
            )}
          </p>
          <h4>
            {t(
              "Tabs are part of the fit check",
              "Las pestañas forman parte de la comprobación",
            )}
          </h4>
          <p>
            {t(
              "Tab width and end inset change the footprint. The printed insert and the base have matching labels. Glue the back of each tab to the front of its matching base outline. Keep the ridge, hinges and gutter free.",
              "El ancho y retiro de pestañas cambian la huella. El inserto y la base tienen etiquetas coincidentes. Pega el reverso de cada pestaña en el frente del contorno correspondiente. Deja libres arista, bisagras y centro.",
            )}
          </p>
          <p>
            <a
              href="https://cg.cs.tsinghua.edu.cn/people/~xianying/Papers/V-Popup/index.html"
              target="_blank"
              rel="noreferrer"
            >
              Li, Ju, Gu & Hu (2011) ↗
            </a>{" "}
            {t(
              "studies a broader V-style geometric class. Plega implements a separate, explicitly restricted triangular construction.",
              "estudia una clase geométrica V más amplia. Plega implementa una construcción triangular propia y restringida.",
            )}
          </p>
        </>
      ) : topic === "checks" ? (
        <>
          <span className="eyebrow">
            {t(
              "EXPLAIN, PREVIEW, RECHECK",
              "EXPLICAR, PREVISUALIZAR, COMPROBAR",
            )}
          </span>
          <h3>
            {t(
              "A moving preview is not a proof.",
              "Una animación no es una prueba.",
            )}
          </h3>
          <p>
            {t(
              "Plega checks analytic bounds rather than inferring safety from a handful of animation frames. Each mechanism stays in a fixed zone along the gutter for its entire motion. Separated zones prove that different mechanisms cannot cross in this restricted model.",
              "Plega comprueba cotas analíticas en vez de inferir seguridad de algunos fotogramas. Cada mecanismo permanece en una zona fija a lo largo del centro durante todo el movimiento. Las zonas separadas prueban que no se cruzan en este modelo restringido.",
            )}
          </p>
          <div className="formula">Σ zone heights + (n − 1) gap ≤ H − 2m</div>
          <p>
            {t(
              "This capacity condition applies when origins can move freely. Pins can prevent a valid placement even when there is enough total space. The tidy-layout action previews only a feasible placement and never moves a pinned origin.",
              "La condición de capacidad se aplica cuando los orígenes se pueden mover libremente. Las medidas fijadas pueden impedir una distribución aunque haya espacio total. Ordenar previsualiza solo una distribución factible y nunca mueve un origen fijado.",
            )}
          </p>
          <h4>{t("What a repair means", "Qué significa una corrección")}</h4>
          <p>
            {t(
              "Repairs show the exact changed fields and remaining checks. They preserve pins and apply only to the project state that was previewed. You can cancel before applying or undo afterward. If no offered repair satisfies your pins, edit the design deliberately or release a pin. Overlapping conservative zones are “uncertified”, not automatically a proven collision.",
              "Las correcciones muestran los campos modificados y comprobaciones pendientes. Conservan las medidas fijadas y solo se aplican al estado previsualizado. Puedes cancelar o deshacer. Si ninguna opción respeta tus medidas fijadas, edita deliberadamente el diseño o libera una medida. Las zonas conservadoras solapadas quedan sin certificar, no prueban automáticamente una colisión.",
            )}
          </p>
          <p>
            {t(
              "Independent derivation and numeric fixtures are documented in the public repository.",
              "La derivación independiente y los datos numéricos se documentan en el repositorio público.",
            )}{" "}
            <a
              href="https://github.com/fsantibanezleal/CAOS_Plega/tree/main/docs"
              target="_blank"
              rel="noreferrer"
            >
              {t("Model documentation", "Documentación del modelo")} ↗
            </a>
          </p>
        </>
      ) : topic === "print" ? (
        <>
          <span className="eyebrow">
            {t("ACTUAL-SIZE FABRICATION", "FABRICACIÓN A TAMAÑO REAL")}
          </span>
          <h3>
            {t(
              "From geometry to your cutting mat",
              "De la geometría a tu mesa de corte",
            )}
          </h3>
          <p>
            {t(
              "Choose A4 or US Letter. The package includes a reduced overview, assembly instructions, and actual-size patterns. Solid lines are cuts; the two dash patterns distinguish mountain and valley folds even in monochrome. Glue outlines are not cuts.",
              "Elige A4 o Carta. El paquete incluye una vista general reducida, instrucciones y patrones a tamaño real. Las líneas continuas son cortes; los dos patrones discontinuos distinguen montaña y valle incluso en monocromo. Los contornos de pegado no se cortan.",
            )}
          </p>
          <div className="guide-callout">
            {t(
              "Print at 100%. Measure the 100 mm ruler and 10 mm square before cutting. Screen size is not print size.",
              "Imprime al 100%. Mide la regla de 100 mm y el cuadrado de 10 mm antes de cortar. El tamaño de pantalla no es el de impresión.",
            )}
          </div>
          <p>
            {t(
              "Oversized pieces can be tiled as transfer templates. Match the registration crosses and copy the assembled pattern to one continuous sheet of card. Taped fragments are not equivalent to a rigid panel. Draft exports remain visibly marked until geometry checks pass.",
              "Las piezas grandes se pueden dividir como plantillas de transferencia. Une las cruces de registro y copia el patrón a una hoja continua de cartulina. Los fragmentos unidos con cinta no equivalen a un panel rígido. Los borradores quedan marcados hasta superar las comprobaciones.",
            )}
          </p>
          <p>
            {t(
              "PDF is the complete print booklet. SVG ZIP keeps editable vector sheets. FOLD ZIP describes separate flat base and insert crease graphs; it does not claim an assembled multi-piece model or layer ordering. Project JSON keeps editable parameters and local observations.",
              "PDF es el cuadernillo completo. SVG ZIP conserva hojas vectoriales editables. FOLD ZIP describe grafos planos separados de base e insertos; no representa un modelo ensamblado ni orden de capas. El JSON conserva parámetros editables y observaciones locales.",
            )}
          </p>
          <p>
            <a
              href="https://warwick.ac.uk/fac/sci/wmg/about/outreach/resources/paperengineering/"
              target="_blank"
              rel="noreferrer"
            >
              Warwick: Paper engineering ↗
            </a>
          </p>
        </>
      ) : (
        <>
          <span className="eyebrow">
            {t(
              "OPEN METHODS, HONEST BOUNDARIES",
              "MÉTODOS ABIERTOS, LÍMITES EXPLÍCITOS",
            )}
          </span>
          <h3>
            {t("What this workshop is built on", "En qué se basa el taller")}
          </h3>
          <p>
            {t(
              "The two mechanism families are established paper engineering. The starter designs, restricted derivations and implementation are original to this project. The source and design data are openly licensed for inspection, reuse and extension.",
              "Las dos familias son mecanismos establecidos de ingeniería de papel. Los modelos, derivaciones restringidas e implementación son originales del proyecto. El código y los datos tienen licencias abiertas para examinarlos, reutilizarlos y ampliarlos.",
            )}
          </p>
          <ul>
            <li>
              {source}{" "}
              {t(
                "Kinematic representations of planar and spherical paper linkages.",
                "Representaciones cinemáticas de mecanismos de papel planos y esféricos.",
              )}
            </li>
            <li>
              <a
                href="https://cg.cs.tsinghua.edu.cn/people/~xianying/Papers/V-Popup/index.html"
                target="_blank"
                rel="noreferrer"
              >
                Li et al. (2011), A Geometric Study of V-style Pop-ups ↗
              </a>
            </li>
            <li>
              <a
                href="https://www.glassner.com/wp-content/uploads/2014/04/CG-CGA-PDF-02-03-Pop-Up-Cards-2-Mar02.pdf"
                target="_blank"
                rel="noreferrer"
              >
                Glassner (2002), Pop-Up Cards, Part 2 ↗
              </a>
            </li>
            <li>
              <a
                href="https://warwick.ac.uk/fac/sci/wmg/about/outreach/resources/paperengineering/"
                target="_blank"
                rel="noreferrer"
              >
                Warwick, Paper engineering resources ↗
              </a>
            </li>
          </ul>
          <h4>{t("The assumptions", "Las suposiciones")}</h4>
          <p>
            {t(
              "Perfectly rigid panels. Zero thickness and friction. Straight hinges. No gravity, adhesive failure, paper strain or added cutouts. At exact closure, overlapping layers are expected. Up to six mechanisms are checked using disjoint conservative motion zones; arbitrary nesting and interlocking are outside this model.",
              "Paneles perfectamente rígidos. Sin espesor ni fricción. Bisagras rectas. Sin gravedad, fallos de adhesivo, deformación ni recortes añadidos. Al cerrar exactamente se espera contacto entre capas. Se comprueban hasta seis mecanismos con zonas conservadoras separadas; el anidamiento y entrelazado arbitrarios quedan fuera del modelo.",
            )}
          </p>
          <p>
            {t(
              "Software checks and print-file dimensions are testable; physical builds, printer accuracy, paper choice and durability are not certified by this app. There is no account or server-side project storage.",
              "Las comprobaciones de software y medidas de archivos se pueden verificar; los montajes físicos, precisión de impresora, papel y durabilidad no están certificados por esta app. No hay cuentas ni almacenamiento de proyectos en servidor.",
            )}
          </p>
          <a
            href="https://github.com/fsantibanezleal/CAOS_Plega"
            target="_blank"
            rel="noreferrer"
          >
            {t(
              "Source code, data pipeline, tests and licenses",
              "Código, procesamiento de datos, pruebas y licencias",
            )}{" "}
            ↗
          </a>
        </>
      )}
    </article>
  );
}
