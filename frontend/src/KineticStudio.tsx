import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Download,
  Eye,
  FileOutput,
  FoldHorizontal,
  Layers3,
  Moon,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Share2,
  Sparkles,
  Sun,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  analyzeProject,
  createModule,
  DEFAULT_PRINT_OPTIONS,
  makePrintPlan,
  poseProject,
  STARTERS,
  type Cutwork,
  type Mechanism,
  type Project,
} from "./core";
import {
  defaultProject,
  downloadWorkspace,
  encodeShare,
  readWorkspace,
  saveWorkspace,
  type Language,
  type Theme,
  type Workspace,
} from "./workspace";
import { PaperViewer } from "./render/PaperViewer";
import { PrintViewer } from "./render/PrintViewer";
import "./kinetic.css";
import "./kinetic-workbench.css";

type Stage = "compose" | "motion" | "make";
type Motif = {
  id: string;
  label: [string, string];
  kind: "P" | "V";
  pattern: Cutwork["pattern"] | "solid";
  color: string;
  note: [string, string];
};

const motifs: Motif[] = [
  {
    id: "arcade",
    label: ["Arcade", "Arcada"],
    kind: "P",
    pattern: "arcade",
    color: "#f06c4e",
    note: ["A stepped portal", "Un portal escalonado"],
  },
  {
    id: "rib",
    label: ["Rib", "Nervadura"],
    kind: "P",
    pattern: "leaf",
    color: "#198c8b",
    note: ["A rising spine", "Una nervadura ascendente"],
  },
  {
    id: "wing",
    label: ["Wing", "Ala"],
    kind: "V",
    pattern: "wing",
    color: "#6d58c8",
    note: ["A hinged sweep", "Un ala articulada"],
  },
  {
    id: "lattice",
    label: ["Lattice", "Celosía"],
    kind: "V",
    pattern: "lattice",
    color: "#d59b2b",
    note: ["A perforated veil", "Un velo perforado"],
  },
  {
    id: "leaf",
    label: ["Leaf", "Hoja"],
    kind: "V",
    pattern: "leaf",
    color: "#3b9c67",
    note: ["A folding canopy", "Un dosel plegable"],
  },
  {
    id: "plain",
    label: ["Panel", "Panel"],
    kind: "P",
    pattern: "solid",
    color: "#3477b9",
    note: ["A clean plane", "Un plano limpio"],
  },
];

const stageCopy: Record<
  Stage,
  { en: string; es: string; hint: [string, string] }
> = {
  compose: {
    en: "Compose",
    es: "Componer",
    hint: [
      "Build a choreography from parts",
      "Construye una coreografía de piezas",
    ],
  },
  motion: {
    en: "Motion",
    es: "Movimiento",
    hint: [
      "See every part answer the same fold",
      "Mira cómo cada pieza responde al mismo pliegue",
    ],
  },
  make: {
    en: "Make",
    es: "Fabricar",
    hint: [
      "Turn the movement into a cut plan",
      "Convierte el movimiento en un plan de corte",
    ],
  },
};

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      className="kinetic-icon"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default function KineticStudio() {
  const initial = useRef<ReturnType<typeof readWorkspace> | null>(null);
  if (!initial.current) initial.current = readWorkspace();
  const [workspace, setWorkspace] = useState<Workspace>(
    initial.current.workspace,
  );
  const [lang, setLang] = useState<Language>(() =>
    localStorage.getItem("plega-language") === "es" ? "es" : "en",
  );
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem("plega-theme") === "dark" ? "dark" : "light",
  );
  const [stage, setStage] = useState<Stage>("compose");
  const [selected, setSelected] = useState(
    workspace.project.modules[0]?.id ?? "",
  );
  const [opening, setOpening] = useState(92);
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState<"model" | "pattern">("model");
  const [camera, setCamera] = useState<"perspective" | "top" | "front">(
    "perspective",
  );
  const [framing, setFraming] = useState<"selected" | "sculpture" | "card">(
    "sculpture",
  );
  const [reset, setReset] = useState(0);
  const [past, setPast] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const [draft, setDraft] = useState<Project | null>(null);
  const [notice, setNotice] = useState("");
  const [showMotifs, setShowMotifs] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const project = workspace.project;
  const t = (en: string, es: string) => (lang === "es" ? es : en);
  const analysis = useMemo(() => analyzeProject(project), [project]);
  const displayed = draft ?? project;
  const displayedAnalysis = useMemo(
    () => analyzeProject(displayed),
    [displayed],
  );
  const scene = useMemo(() => {
    const result = poseProject(displayed, opening);
    return result.ok ? result.value : null;
  }, [displayed, opening]);
  const planResult = useMemo(
    () =>
      makePrintPlan(displayed, {
        ...DEFAULT_PRINT_OPTIONS,
        purpose: displayedAnalysis.canFinalPrint ? "fabrication" : "draft",
      }),
    [displayed, displayedAnalysis.canFinalPrint],
  );
  const plan = planResult.ok ? planResult.value : null;
  const selectedPart =
    displayed.modules.find((m) => m.id === selected) ?? displayed.modules[0];
  const focusPart = (id: string) => {
    setSelected(id);
    setFraming("selected");
    setView("model");
  };
  const phase = opening < 45 ? 0 : opening < 95 ? 1 : opening < 145 ? 2 : 3;
  const phaseNames = [
    ["Gather", "Reunir"],
    ["Lift", "Elevar"],
    ["Reveal", "Revelar"],
    ["Display", "Exhibir"],
  ];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = lang;
    localStorage.setItem("plega-language", lang);
    localStorage.setItem("plega-theme", theme);
  }, [theme, lang]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous = performance.now();
    let direction = 1;
    const tick = (now: number) => {
      const delta = Math.min(now - previous, 80);
      previous = now;
      setOpening((value) => {
        const next = value + direction * delta * 0.045;
        if (next >= 180) {
          direction = -1;
          return 180;
        }
        if (next <= 0) {
          direction = 1;
          return 0;
        }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  useEffect(() => {
    if (saveWorkspace(workspace))
      setNotice(t("Saved on this device", "Guardado en este dispositivo"));
  }, [workspace]);

  const commit = (next: Project) => {
    if (JSON.stringify(next) === JSON.stringify(project)) return;
    setPast((items) => [...items.slice(-39), project]);
    setFuture([]);
    setDraft(null);
    setWorkspace((current) => ({ ...current, project: next, completed: [] }));
  };
  const undo = () => {
    const previous = past.at(-1);
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [project, ...items]);
    setWorkspace((current) => ({
      ...current,
      project: previous,
      completed: [],
    }));
    setSelected(previous.modules[0]?.id ?? "");
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setPast((items) => [...items, project]);
    setWorkspace((current) => ({ ...current, project: next, completed: [] }));
    setSelected(next.modules[0]?.id ?? "");
  };
  const addMotif = (motif: Motif) => {
    const created = createModule(
      project,
      motif.kind,
      t(motif.label[0], motif.label[1]),
      motif.color,
    );
    if (!created.ok) {
      setNotice(
        t(
          "There is no checked motion lane for another part.",
          "No hay una zona de movimiento comprobada para otra pieza.",
        ),
      );
      return;
    }
    let next = created.project;
    const added = next.modules.find((m) => m.id === created.moduleId);
    if (added && motif.pattern !== "solid")
      next = {
        ...next,
        modules: next.modules.map((m) =>
          m.id === added.id
            ? ({
                ...m,
                cutwork: {
                  pattern: motif.pattern as Cutwork["pattern"],
                  detail: 3,
                  web: 1.5,
                },
              } as Mechanism)
            : m,
        ),
      };
    commit(next);
    setSelected(created.moduleId);
    setShowMotifs(false);
    setStage("compose");
    setNotice(
      t(
        `${motif.label[0]} added to the choreography`,
        `${motif.label[1]} añadida a la coreografía`,
      ),
    );
  };
  const updatePart = (field: string, value: number) => {
    if (!selectedPart || !Number.isFinite(value)) return;
    const next = {
      ...project,
      modules: project.modules.map((m) =>
        m.id !== selectedPart.id
          ? m
          : field === "y"
            ? { ...m, y: value }
            : ({ ...m, params: { ...m.params, [field]: value } } as Mechanism),
      ),
    };
    commit(next);
  };
  const updateSurface = (field: "detail" | "web", value: number) => {
    if (!selectedPart?.cutwork || !Number.isFinite(value)) return;
    commit({
      ...project,
      modules: project.modules.map((part) =>
        part.id === selectedPart.id && part.cutwork
          ? { ...part, cutwork: { ...part.cutwork, [field]: value } }
          : part,
      ),
    });
  };
  const updateCard = (field: "W" | "H" | "margin" | "gap", value: number) => {
    if (!Number.isFinite(value) || value <= 0) return;
    commit({ ...project, card: { ...project.card, [field]: value } });
  };
  const duplicatePart = () => {
    if (!selectedPart) return;
    const created = createModule(
      project,
      selectedPart.kind,
      `${selectedPart.label} II`,
      selectedPart.color,
    );
    if (!created.ok) {
      setNotice(
        t(
          "No checked lane is available for a copy.",
          "No hay una zona comprobada para la copia.",
        ),
      );
      return;
    }
    const withSurface = {
      ...created.project,
      modules: created.project.modules.map((part) =>
        part.id === created.moduleId && selectedPart.cutwork
          ? { ...part, cutwork: selectedPart.cutwork }
          : part,
      ),
    };
    const sameShape = {
      ...withSurface,
      modules: withSurface.modules.map((part) =>
        part.id === created.moduleId
          ? ({ ...part, params: selectedPart.params } as Mechanism)
          : part,
      ),
    };
    commit(
      analyzeProject(sameShape).certificate === "pass"
        ? sameShape
        : withSurface,
    );
    focusPart(created.moduleId);
  };
  const remove = () => {
    if (!selectedPart || project.modules.length <= 1) return;
    const next = {
      ...project,
      modules: project.modules.filter((m) => m.id !== selectedPart.id),
    };
    commit(next);
    setSelected(next.modules[0]?.id ?? "");
  };
  const loadStarter = (starter: (typeof STARTERS)[number]) => {
    commit(starter.project);
    setSelected(starter.project.modules[0]?.id ?? "");
    setOpening(92);
    setStage("compose");
    setFraming("sculpture");
    setNotice(t(`${starter.title.en} loaded`, `${starter.title.es} cargado`));
    setShowLibrary(false);
  };
  const share = async () => {
    const link = encodeShare(project);
    try {
      await navigator.clipboard.writeText(link);
      setNotice(t("Share link copied", "Enlace compartido copiado"));
    } catch {
      setNotice(
        t(
          "Copy was unavailable; save the project file instead",
          "No se pudo copiar; guarda el archivo del proyecto",
        ),
      );
    }
  };

  return (
    <div className="kinetic-shell">
      <header className="kinetic-header">
        <a className="kinetic-brand" href="/" aria-label="Plega home">
          <span className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          <span>
            plega<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="kinetic-wordmark">PAPER / MOTION / OBJECTS</div>
        <div className="kinetic-header-actions">
          <button
            className="kinetic-text-button"
            onClick={() => setShowLibrary(true)}
          >
            <Layers3 size={16} />
            {t("Compositions", "Composiciones")}
          </button>
          <button
            className="kinetic-text-button"
            onClick={() => setShowSources(true)}
          >
            <Eye size={16} />
            {t("How it works", "Cómo funciona")}
          </button>
          <IconButton
            label={t("Toggle language", "Cambiar idioma")}
            onClick={() => setLang(lang === "en" ? "es" : "en")}
          >
            <span className="language-pill">{lang === "en" ? "ES" : "EN"}</span>
          </IconButton>
          <IconButton
            label={t("Toggle theme", "Cambiar tema")}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
          </IconButton>
        </div>
      </header>
      <section className="kinetic-intro">
        <div>
          <span className="kinetic-kicker">
            {t("A PAPER MACHINE FOR IDEAS", "UNA MÁQUINA DE PAPEL PARA IDEAS")}
          </span>
          <h1>{t("Make the fold move.", "Haz que el pliegue se mueva.")}</h1>
          <p>
            {t(
              "Shape the paper directly. Every edit changes the motion and the cut plan.",
              "Transforma el papel directamente. Cada edición cambia el movimiento y el plan de corte.",
            )}
          </p>
        </div>
        <div className="kinetic-intro-stat">
          <strong>{project.modules.length}</strong>
          <span>{t("active parts", "piezas activas")}</span>
          <small>
            {t("one shared choreography", "una coreografía compartida")}
          </small>
        </div>
      </section>
      <nav
        className="kinetic-stage-nav"
        aria-label={t("Workflow", "Flujo de trabajo")}
      >
        {(Object.keys(stageCopy) as Stage[]).map((id, index) => (
          <button
            key={id}
            className={stage === id ? "active" : ""}
            onClick={() => setStage(id)}
          >
            <span>0{index + 1}</span>
            <strong>{stageCopy[id][lang]}</strong>
            <small>{stageCopy[id].hint[lang === "es" ? 1 : 0]}</small>
          </button>
        ))}
        <div className="kinetic-nav-actions">
          <IconButton
            label={t("Undo", "Deshacer")}
            onClick={undo}
            disabled={!past.length}
          >
            <Undo2 size={17} />
          </IconButton>
          <IconButton
            label={t("Redo", "Rehacer")}
            onClick={redo}
            disabled={!future.length}
          >
            <Redo2 size={17} />
          </IconButton>
          <span />
          <button
            className="kinetic-save"
            onClick={() => downloadWorkspace(workspace)}
          >
            <Download size={16} />
            {t("Save project", "Guardar proyecto")}
          </button>
          <button className="kinetic-share" onClick={share}>
            <Share2 size={16} />
            {t("Share", "Compartir")}
          </button>
        </div>
      </nav>
      {notice && (
        <div className="kinetic-notice" role="status">
          <Check size={15} />
          {notice}
          <button
            onClick={() => setNotice("")}
            aria-label={t("Dismiss", "Cerrar")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <main className="kinetic-workbench">
        <aside className="kinetic-rail">
          <div className="kinetic-rail-heading">
            <div>
              <span className="kinetic-kicker">
                {t("CHOREOGRAPHY", "COREOGRAFÍA")}
              </span>
              <h2>{t("The cast", "El reparto")}</h2>
            </div>
            <span className="kinetic-count">{project.modules.length}/16</span>
          </div>
          <p className="kinetic-rail-lead">
            {t(
              "Each part has a place, a shape, and a role in the motion. Select one to direct it.",
              "Cada pieza tiene un lugar, una forma y un papel en el movimiento. Selecciona una para dirigirla.",
            )}
          </p>
          <div className="kinetic-cast">
            {displayed.modules.map((m, index) => (
              <button
                key={m.id}
                className={selectedPart?.id === m.id ? "selected" : ""}
                onClick={() => focusPart(m.id)}
              >
                <span className="cast-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="cast-swatch" style={{ background: m.color }} />{" "}
                <span className="cast-copy">
                  <strong>{m.label}</strong>
                  <small>
                    {m.kind === "P"
                      ? t("parallel step", "escalón paralelo")
                      : t("V-fold insert", "inserto V")}
                  </small>
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
          <button
            className="kinetic-add-trigger"
            onClick={() => setShowMotifs(!showMotifs)}
          >
            <Plus size={16} />
            {t("Add a new voice", "Añadir una voz nueva")}
          </button>
          {showMotifs && (
            <div className="kinetic-motif-menu">
              {motifs.map((motif) => (
                <button key={motif.id} onClick={() => addMotif(motif)}>
                  <span style={{ background: motif.color }}>
                    <Sparkles size={14} />
                  </span>
                  <span>
                    <strong>{t(motif.label[0], motif.label[1])}</strong>
                    <small>{motif.note[lang === "es" ? 1 : 0]}</small>
                  </span>
                  <Plus size={14} />
                </button>
              ))}
            </div>
          )}
          <div className="kinetic-lane-card">
            <div className="lane-card-heading">
              <span>{t("MOTION MAP", "MAPA DE MOVIMIENTO")}</span>
              <Layers3 size={15} />
            </div>
            <div
              className="kinetic-lane-track"
              role="group"
              aria-label={t(
                "Parts by position on the card",
                "Piezas según su posición en la tarjeta",
              )}
              style={{
                height: Math.max(220, Math.min(520, displayed.card.H * 1.65)),
              }}
            >
              {displayed.modules.map((m, i) => (
                <button
                  key={m.id}
                  className={selectedPart?.id === m.id ? "selected" : ""}
                  style={{
                    top: `${Math.max(3, Math.min(97, (m.y / displayed.card.H) * 100))}%`,
                    borderColor: m.color,
                  }}
                  onClick={() => focusPart(m.id)}
                  title={`${m.label} · ${m.y.toFixed(1)} mm`}
                >
                  <span style={{ background: m.color }} />
                  <b>{String(i + 1).padStart(2, "0")}</b>
                  <strong>{m.label}</strong>
                  <small>{m.y.toFixed(1)}</small>
                </button>
              ))}
            </div>
            <small>
              {t(
                "Every part is shown at its actual position in millimetres. Choose one to frame and edit it.",
                "Cada pieza aparece en su posición real en milímetros. Elige una para encuadrarla y editarla.",
              )}
            </small>
          </div>
          <div className="kinetic-rail-bottom">
            <button onClick={() => setShowSources(true)}>
              <FileOutput size={16} />
              {t("Design limits & sources", "Límites y fuentes")}
            </button>
          </div>
        </aside>
        <section
          className="kinetic-stage"
          aria-label={t("Live paper workspace", "Espacio de papel en vivo")}
        >
          <div className="kinetic-stage-toolbar">
            <div className="kinetic-mode-switch">
              <button
                className={view === "model" ? "active" : ""}
                onClick={() => setView("model")}
              >
                <FoldHorizontal size={15} />
                {t("Live object", "Objeto vivo")}
              </button>
              <button
                className={view === "pattern" ? "active" : ""}
                onClick={() => setView("pattern")}
              >
                <FileOutput size={15} />
                {t("Cut plan", "Plan de corte")}
              </button>
            </div>
            <div
              className={
                "kinetic-check " +
                (displayedAnalysis.certificate === "pass" ? "pass" : "warn")
              }
            >
              <span />
              {displayedAnalysis.certificate === "pass"
                ? t("Motion is checked", "Movimiento comprobado")
                : t("Needs a correction", "Necesita una corrección")}
            </div>
          </div>
          <div className="kinetic-canvas-wrap">
            {view === "model" ? (
              <PaperViewer
                scene={scene}
                project={displayed}
                editable={
                  stage !== "make" && displayedAnalysis.certificate === "pass"
                }
                onPreview={(next) => {
                  setPlaying(false);
                  setDraft(next);
                }}
                onCommit={(next) => commit(next)}
                onAdd={(kind) =>
                  addMotif(motifs.find((m) => m.kind === kind) ?? motifs[0])
                }
                onRemove={remove}
                onProfile={(pattern) => {
                  if (!selectedPart) return;
                  const next = {
                    ...project,
                    modules: project.modules.map((m) =>
                      m.id === selectedPart.id
                        ? pattern === "solid"
                          ? (({ cutwork: _cutwork, ...solid }) =>
                              solid as Mechanism)(m as Mechanism)
                          : ({
                              ...m,
                              cutwork: {
                                pattern,
                                detail: m.cutwork?.detail ?? 3,
                                web: m.cutwork?.web ?? 1.5,
                              },
                            } as Mechanism)
                        : m,
                    ),
                  };
                  commit(next);
                }}
                height={displayed.card.H}
                width={displayed.card.W}
                selected={selectedPart?.id ?? ""}
                onSelect={focusPart}
                theme={theme}
                lang={lang}
                camera={camera}
                reset={reset}
                dimensions
                framing={framing}
              />
            ) : (
              <div className="kinetic-print-wrap">
                <PrintViewer
                  plan={plan}
                  pageIndex={0}
                  selected={selectedPart?.id ?? ""}
                  onSelect={setSelected}
                  lang={lang}
                />
              </div>
            )}
            <div className="kinetic-camera-strip">
              <button
                className={camera === "perspective" ? "active" : ""}
                onClick={() => setCamera("perspective")}
              >
                {t("Perspective", "Perspectiva")}
              </button>
              <button
                className={camera === "top" ? "active" : ""}
                onClick={() => setCamera("top")}
              >
                {t("Top", "Superior")}
              </button>
              <button
                className={camera === "front" ? "active" : ""}
                onClick={() => setCamera("front")}
              >
                {t("Front", "Frontal")}
              </button>
              <span />
              {(["selected", "sculpture", "card"] as const).map((mode) => (
                <button
                  key={mode}
                  className={framing === mode ? "active" : ""}
                  onClick={() => {
                    setFraming(mode);
                    setReset((value) => value + 1);
                  }}
                >
                  {mode === "selected"
                    ? t("Part", "Pieza")
                    : mode === "sculpture"
                      ? t("All parts", "Todas")
                      : t("Card", "Tarjeta")}
                </button>
              ))}
              <button onClick={() => setReset((value) => value + 1)}>
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
          <div className="kinetic-motion-bar">
            <button
              className="kinetic-play"
              onClick={() => setPlaying(!playing)}
              aria-label={
                playing
                  ? t("Pause motion", "Pausar movimiento")
                  : t("Play motion", "Reproducir movimiento")
              }
            >
              {playing ? <Pause size={19} /> : <Play size={19} />}
            </button>
            <div className="kinetic-scrub-copy">
              <strong>{t(phaseNames[phase][0], phaseNames[phase][1])}</strong>
              <span>{Math.round(opening)}° / 180°</span>
            </div>
            <div className="kinetic-scrub">
              <div className="kinetic-scrub-track">
                <span style={{ width: `${opening / 1.8}%` }} />
              </div>
              <input
                aria-label={t("Opening angle", "Ángulo de apertura")}
                type="range"
                min="0"
                max="180"
                step="1"
                value={opening}
                onChange={(event) => {
                  setPlaying(false);
                  setOpening(Number(event.target.value));
                }}
              />
              <div className="kinetic-scrub-labels">
                <span>{t("gather", "reunir")}</span>
                <span>{t("reveal", "revelar")}</span>
                <span>{t("display", "exhibir")}</span>
              </div>
            </div>
            <div className="kinetic-motion-actions">
              <button onClick={() => setOpening(0)}>0°</button>
              <button className="active" onClick={() => setOpening(90)}>
                90°
              </button>
              <button onClick={() => setOpening(180)}>180°</button>
            </div>
          </div>
        </section>
        <aside className="kinetic-inspector">
          <div className="kinetic-inspector-heading">
            <span className="kinetic-kicker">
              {stage === "make"
                ? t("FABRICATION", "FABRICACIÓN")
                : t("DIRECTOR'S DESK", "MESA DEL DIRECTOR")}
            </span>
            <div className="inspector-title-row">
              <h2>
                {selectedPart?.label ??
                  t("Select a part", "Selecciona una pieza")}
              </h2>
              <button
                onClick={duplicatePart}
                disabled={!selectedPart || project.modules.length >= 16}
                aria-label={t(
                  "Duplicate selected part",
                  "Duplicar pieza seleccionada",
                )}
              >
                <Plus size={16} />
              </button>
              <button
                onClick={remove}
                disabled={!selectedPart || project.modules.length <= 1}
                aria-label={t(
                  "Remove selected part",
                  "Retirar pieza seleccionada",
                )}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <p>
              {selectedPart
                ? t(
                    "This part is selected in the object. Drag its handles to change one dimension, then release to commit.",
                    "Esta pieza está seleccionada en el objeto. Arrastra sus controles para cambiar una medida y suelta para confirmar.",
                  )
                : t(
                    "Select a part from the cast or directly in the object.",
                    "Selecciona una pieza del reparto o directamente en el objeto.",
                  )}
            </p>
          </div>
          {displayedAnalysis.certificate !== "pass" && (
            <div className="kinetic-diagnostics" role="status">
              <strong>
                {t("What needs attention", "Qué necesita atención")}
              </strong>
              {displayedAnalysis.diagnostics
                .filter((d) => d.severity === "error")
                .slice(0, 3)
                .map((diagnostic) => (
                  <p key={diagnostic.id}>{diagnostic.message[lang]}</p>
                ))}
            </div>
          )}
          <div className="kinetic-inspector-section">
            <div className="inspector-section-title">
              <span>{t("Canvas size", "Tamaño del lienzo")}</span>
              <small>mm</small>
            </div>
            <div className="dimension-grid">
              {(["W", "H", "margin", "gap"] as const).map((field) => (
                <label key={field}>
                  <span>
                    {field === "W"
                      ? t("Half width", "Medio ancho")
                      : field === "H"
                        ? t("Height", "Alto")
                        : field === "margin"
                          ? t("Margin", "Margen")
                          : t("Lane gap", "Separación")}
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={project.card[field]}
                    onChange={(event) =>
                      updateCard(field, Number(event.target.value))
                    }
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="kinetic-inspector-section">
            <div className="inspector-section-title">
              <span>{t("Role in the movement", "Papel en el movimiento")}</span>
              <span
                className="role-dot"
                style={{ background: selectedPart?.color }}
              />
            </div>
            <div className="role-card">
              <strong>
                {selectedPart?.kind === "P"
                  ? t("Parallel rise", "Ascenso paralelo")
                  : t("Wing sweep", "Barrido de ala")}
              </strong>
              <span>
                {selectedPart?.kind === "P"
                  ? t(
                      "This part rises from the gutter and carries a panel through the opening.",
                      "Esta pieza asciende desde el centro y lleva un panel durante la apertura.",
                    )
                  : t(
                      "Two faces meet at a ridge and open as a single hinged gesture.",
                      "Dos caras se encuentran en una cresta y se abren como un gesto articulado.",
                    )}
              </span>
            </div>
          </div>
          {selectedPart && (
            <div className="kinetic-inspector-section">
              <div className="inspector-section-title">
                <span>{t("Dimensions", "Dimensiones")}</span>
                <small>mm</small>
              </div>
              <div className="kinetic-identity-grid">
                <label>
                  <span>{t("Part name", "Nombre de la pieza")}</span>
                  <input
                    key={selectedPart.id}
                    type="text"
                    maxLength={40}
                    defaultValue={selectedPart.label}
                    onBlur={(event) => {
                      const label = event.target.value.trim();
                      if (label && label !== selectedPart.label)
                        commit({
                          ...project,
                          modules: project.modules.map((part) =>
                            part.id === selectedPart.id
                              ? { ...part, label }
                              : part,
                          ),
                        });
                    }}
                  />
                </label>
                <label>
                  <span>{t("Paper color", "Color del papel")}</span>
                  <input
                    type="color"
                    value={selectedPart.color}
                    onChange={(event) =>
                      commit({
                        ...project,
                        modules: project.modules.map((part) =>
                          part.id === selectedPart.id
                            ? { ...part, color: event.target.value }
                            : part,
                        ),
                      })
                    }
                  />
                </label>
              </div>
              <div className="dimension-grid">
                {(selectedPart.kind === "P"
                  ? ["y", "a", "b", "width"]
                  : ["y", "r", "h"]
                ).map((field) => (
                  <label key={field}>
                    <span>
                      {field === "y"
                        ? t("Position", "Posición")
                        : field === "a"
                          ? t("Rise", "Altura")
                          : field === "b"
                            ? t("Depth", "Fondo")
                            : field === "width"
                              ? t("Width", "Ancho")
                              : field === "r"
                                ? t("Wing", "Ala")
                                : t("Ridge", "Cresta")}
                    </span>
                    <input
                      type="number"
                      step="0.5"
                      value={
                        field === "y"
                          ? selectedPart.y
                          : (selectedPart.params as Record<string, number>)[
                              field
                            ]
                      }
                      onChange={(event) =>
                        updatePart(field, Number(event.target.value))
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="kinetic-inspector-section">
            <div className="inspector-section-title">
              <span>{t("Cutwork language", "Lenguaje del calado")}</span>
              <small>
                {selectedPart?.cutwork
                  ? t("editable", "editable")
                  : t("solid", "sólido")}
              </small>
            </div>
            <div className="pattern-grid">
              {(["arcade", "leaf", "wing", "lattice", "solid"] as const).map(
                (pattern) => (
                  <button
                    key={pattern}
                    className={
                      (selectedPart?.cutwork?.pattern ?? "solid") === pattern
                        ? "active"
                        : ""
                    }
                    onClick={() => {
                      if (!selectedPart) return;
                      const next = {
                        ...project,
                        modules: project.modules.map((m) => {
                          if (m.id !== selectedPart.id) return m;
                          if (pattern === "solid") {
                            const { cutwork: _cutwork, ...solid } = m;
                            return solid as Mechanism;
                          }
                          return {
                            ...m,
                            cutwork: {
                              pattern,
                              detail: m.cutwork?.detail ?? 3,
                              web: m.cutwork?.web ?? 1.5,
                            },
                          } as Mechanism;
                        }),
                      };
                      commit(next);
                    }}
                  >
                    <span className={`pattern-glyph glyph-${pattern}`} />
                    {t(
                      pattern === "solid"
                        ? "Solid"
                        : pattern[0].toUpperCase() + pattern.slice(1),
                      pattern === "solid"
                        ? "Sólido"
                        : pattern === "leaf"
                          ? "Hoja"
                          : pattern === "wing"
                            ? "Ala"
                            : pattern === "lattice"
                              ? "Celosía"
                              : "Arcada",
                    )}
                  </button>
                ),
              )}
            </div>
            {selectedPart?.cutwork && (
              <div className="kinetic-surface-controls">
                <label>
                  <span>{t("Aperture density", "Densidad de huecos")}</span>
                  <input
                    type="range"
                    min="1"
                    max="6"
                    step="1"
                    value={selectedPart.cutwork.detail}
                    onChange={(event) =>
                      updateSurface("detail", Number(event.target.value))
                    }
                  />
                  <output>{selectedPart.cutwork.detail}</output>
                </label>
                <label>
                  <span>{t("Protected paper web", "Nervadura protegida")}</span>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.1"
                    value={selectedPart.cutwork.web}
                    onChange={(event) =>
                      updateSurface("web", Number(event.target.value))
                    }
                  />
                  <output>{selectedPart.cutwork.web.toFixed(1)} mm</output>
                </label>
              </div>
            )}
          </div>
          <div className="kinetic-inspector-section inspector-insight">
            <Sparkles size={17} />
            <p>
              <strong>{t("Try a contrast", "Prueba un contraste")}</strong>
              {t(
                "Select a second part and give it a different pattern. The motion stays shared while the surfaces tell a new story.",
                "Selecciona otra pieza y dale un patrón diferente. El movimiento sigue compartido mientras las superficies cuentan otra historia.",
              )}
            </p>
          </div>
          <div className="kinetic-inspector-actions">
            <button onClick={() => setStage("motion")}>
              <Play size={15} />
              {t(
                "Play the whole choreography",
                "Reproducir toda la coreografía",
              )}
            </button>
            <button className="primary" onClick={() => setStage("make")}>
              <FileOutput size={15} />
              {t("Prepare a cut plan", "Preparar plan de corte")}
            </button>
          </div>
        </aside>
      </main>
      <footer className="kinetic-footer">
        <span>
          plega<span className="brand-dot">.</span>{" "}
          {t("Paper in motion", "Papel en movimiento")}
        </span>
        <span>
          {t(
            "No account · Works offline · Dimensions in millimetres",
            "Sin cuenta · Funciona sin conexión · Medidas en milímetros",
          )}
        </span>
        <span>
          <button onClick={() => setShowSources(true)}>
            {t("Sources & limits", "Fuentes y límites")}
          </button>
        </span>
      </footer>
      {showLibrary && (
        <div
          className="kinetic-modal-backdrop"
          onClick={() => setShowLibrary(false)}
        >
          <section
            className="kinetic-modal kinetic-library"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kinetic-library-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="kinetic-kicker">
                  {t("WORKING COMPOSITIONS", "COMPOSICIONES ACTIVAS")}
                </span>
                <h2 id="kinetic-library-title">
                  {t(
                    "Choose a structure to transform",
                    "Elige una estructura para transformar",
                  )}
                </h2>
              </div>
              <button
                onClick={() => setShowLibrary(false)}
                aria-label={t("Close", "Cerrar")}
              >
                <X size={18} />
              </button>
            </header>
            <p>
              {t(
                "Each composition is an editable mechanical starting point. Loading one replaces the canvas; Undo restores your previous work.",
                "Cada composición es un punto de partida mecánico editable. Al cargarla se reemplaza el lienzo; Deshacer restaura tu trabajo anterior.",
              )}
            </p>
            <div className="kinetic-library-grid">
              {STARTERS.map((starter) => (
                <button key={starter.id} onClick={() => loadStarter(starter)}>
                  <span className="kinetic-library-thumb" aria-hidden="true">
                    {starter.project.modules.map((part, index) => (
                      <i
                        key={part.id}
                        style={{
                          background: part.color,
                          height: `${Math.max(10, Math.min(80, (part.kind === "P" ? part.params.a : part.params.h) * 1.2))}%`,
                          transform: `translateY(${index % 2 ? -7 : 7}px) skewY(${part.kind === "V" ? -18 : 0}deg)`,
                        }}
                      />
                    ))}
                  </span>
                  <strong>{starter.title[lang]}</strong>
                  <small>
                    {starter.project.modules.length} {t("parts", "piezas")} ·{" "}
                    {starter.project.card.W} × {starter.project.card.H} mm
                  </small>
                  <span>{starter.description[lang]}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {showSources && (
        <div
          className="kinetic-modal-backdrop"
          onClick={() => setShowSources(false)}
        >
          <section
            className="kinetic-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kinetic-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="kinetic-kicker">
                  {t("ABOUT THE WORKSHOP", "SOBRE EL TALLER")}
                </span>
                <h2 id="kinetic-modal-title">
                  {t(
                    "One model, three connected views.",
                    "Un modelo, tres vistas conectadas.",
                  )}
                </h2>
              </div>
              <button
                onClick={() => setShowSources(false)}
                aria-label={t("Close", "Cerrar")}
              >
                <X size={18} />
              </button>
            </header>
            <p>
              {t(
                "Plega is a deterministic paper mechanism workshop. The same dimensions drive the live object, the fold choreography, and the printable cut plan. Edits are checked across the full opening range before they are committed.",
                "Plega es un taller determinista de mecanismos de papel. Las mismas medidas conducen el objeto vivo, la coreografía del pliegue y el plan de corte imprimible. Las ediciones se comprueban durante toda la apertura antes de confirmarse.",
              )}
            </p>
            <div className="modal-columns">
              <div>
                <h3>{t("What is calculated", "Qué se calcula")}</h3>
                <ul>
                  <li>
                    {t(
                      "Rigid panel positions at every angle",
                      "Posiciones de paneles rígidos en cada ángulo",
                    )}
                  </li>
                  <li>
                    {t(
                      "Separated motion lanes and closure fit",
                      "Zonas de movimiento separadas y ajuste cerrado",
                    )}
                  </li>
                  <li>
                    {t(
                      "Cutwork with a protected material web",
                      "Calado con nervadura de material protegida",
                    )}
                  </li>
                  <li>
                    {t(
                      "Actual-size A4 / Letter export geometry",
                      "Geometría de exportación a tamaño real A4 / Carta",
                    )}
                  </li>
                </ul>
              </div>
              <div>
                <h3>{t("Limits", "Límites")}</h3>
                <p>
                  {t(
                    "The certificate covers the zero-thickness analytic model. Paper strength, adhesive behaviour, gravity and a physical assembly still require a real material test. No third-party artwork or templates are redistributed.",
                    "El certificado cubre el modelo analítico de espesor cero. La resistencia del papel, el adhesivo, la gravedad y el montaje físico requieren una prueba material. No se redistribuyen obras ni plantillas de terceros.",
                  )}
                </p>
                <a
                  href="https://github.com/fsantibanezleal/CAOS_Plega"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("Open source repository", "Repositorio de código abierto")}{" "}
                  <ArrowRight size={14} />
                </a>
              </div>
            </div>
            <footer>
              <button
                onClick={() => {
                  setShowSources(false);
                  setStage("make");
                }}
              >
                <FileOutput size={15} />
                {t("Go to the cut plan", "Ir al plan de corte")}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
