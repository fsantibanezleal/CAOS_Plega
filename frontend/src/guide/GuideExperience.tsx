import { useEffect, useMemo, useRef, useState } from "react";
import {
  FoldViewer,
  type FoldDocument,
  type FoldViewerHandle,
} from "../vendor/fold-viewer";
import "../vendor/fold-viewer/styles.css";
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Play,
  RotateCcw,
  Search,
  Moon,
  Sun,
} from "lucide-react";
import { GUIDED } from "./guided";
import { foldFrame, type FoldRecipe } from "./foldEngine";
import manifest from "./lesson-manifest.json";
import LessonIllustration from "./LessonIllustration";
import "./experience.css";
import "./library.css";

type Language = "en" | "es";
type Area = "models" | "basics";
const copy = {
  en: {
    models: "Models",
    basics: "Fold basics",
    studio: "Paper studio",
    structures: "Structure atlas",
    library: "Origami library",
    libraryIntro:
      "Choose a model. Fold it from a square to its finished shape, with continuous 3D motion and a guide at every step.",
    sequence: "Play from start to finish",
    steps: "Construction steps",
    selectStep: "Choose any step to inspect and replay its movement.",
    companion: "Companion reference",
    companionText: "Optional reading alongside the animated lesson.",
    source: "Source and license",
    limitations:
      "Geometric reconstruction; physical folding and collision-free motion have not been certified.",
    basicsIntro:
      "Individual folding exercises. Complete model sequences are in the model library.",
    replay: "Replay fold",
    next: "Next step",
    previous: "Previous step",
    helper: "Elementary fold exercise",
    search: "Search models",
    all: "All models",
    animals: "Animals",
    plants: "Plants",
    useful: "Useful objects",
    transport: "Transport",
    decorations: "Decorations",
    animated: "complete animated models",
    movements: "movements",
    step: "Step",
    back: "Back to library",
    playStep: "Play this step",
    browse: "Browse models",
    empty: "No models match this search.",
    reset: "Clear filters",
    beginner: "Beginner",
    intermediate: "Intermediate",
    finished: "View finished model",
    unknown: "This model is not in the animated library.",
    progress: "Your construction",
    appearance: "Change color theme",
    help: "Drag to inspect · scroll or pinch to zoom · R to reset",
    pending:
      "Library expansion is in progress. Only complete sequences are counted here.",
  },
  es: {
    models: "Modelos",
    basics: "Pliegues básicos",
    studio: "Taller de papel",
    structures: "Atlas de estructuras",
    library: "Biblioteca de origami",
    libraryIntro:
      "Elige un modelo. Pasa del cuadrado a su forma final con movimiento 3D continuo y una guía para cada paso.",
    sequence: "Reproducir de principio a fin",
    steps: "Pasos de construcción",
    selectStep: "Elige cualquier paso para ver y repetir su movimiento.",
    companion: "Referencia complementaria",
    companionText: "Lectura opcional junto a la lección animada.",
    source: "Fuente y licencia",
    limitations:
      "Reconstrucción geométrica; no se han certificado el plegado físico ni la ausencia de colisiones.",
    basicsIntro:
      "Ejercicios de pliegues individuales. Las secuencias de modelos completos están en la biblioteca.",
    replay: "Repetir pliegue",
    next: "Paso siguiente",
    previous: "Paso anterior",
    helper: "Ejercicio de pliegue elemental",
    search: "Buscar modelos",
    all: "Todos los modelos",
    animals: "Animales",
    plants: "Plantas",
    useful: "Objetos útiles",
    transport: "Transporte",
    decorations: "Decoraciones",
    animated: "modelos completos animados",
    movements: "movimientos",
    step: "Paso",
    back: "Volver a la biblioteca",
    playStep: "Reproducir este paso",
    browse: "Explorar modelos",
    empty: "No hay modelos que coincidan con esta búsqueda.",
    reset: "Borrar filtros",
    beginner: "Principiante",
    intermediate: "Intermedio",
    finished: "Ver modelo terminado",
    unknown: "Este modelo no está en la biblioteca animada.",
    progress: "Tu construcción",
    appearance: "Cambiar tema de color",
    help: "Arrastra para explorar · rueda o pellizca para acercar · R para reiniciar",
    pending:
      "La biblioteca sigue creciendo. Aquí solo se cuentan secuencias completas.",
  },
};
const readPreference = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};
const modelFromUrl = () => {
  const model = new URLSearchParams(location.search).get("model");
  return model && !model.includes(":") ? model : null;
};
function BasicFold({
  recipe,
  language,
}: {
  recipe: FoldRecipe;
  language: Language;
}) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const animation = useRef<number | null>(null);
  const current = recipe.steps[step];
  const locale = language === "en" ? 0 : 1;
  const frame = foldFrame(recipe, step, progress);
  const [width, height] = recipe.paper;
  const margin = Math.max(width, height) * 0.15;
  const replay = () => {
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    setProgress(0);
    let started = 0;
    const tick = (time: number) => {
      if (!started) started = time;
      const value = Math.min(1, (time - started) / 1100);
      setProgress(value);
      if (value < 1) animation.current = requestAnimationFrame(tick);
    };
    animation.current = requestAnimationFrame(tick);
  };
  const move = (next: number) => {
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    setStep(Math.max(0, Math.min(recipe.steps.length - 1, next)));
    setProgress(0);
  };
  return (
    <div className="plega-basic-content">
      <div className="plega-basic-paper">
        <svg
          viewBox={`${-margin} ${-margin} ${width + margin * 2} ${height + margin * 2}`}
          role="img"
          aria-label={`${copy[language].helper}: ${recipe.name[locale]}`}
        >
          {frame.map((facet, index) => (
            <polygon
              key={index}
              points={facet.points.map((point) => point.join(",")).join(" ")}
              fill={facet.face ? "#fff6df" : "#e89164"}
              stroke="#3c342e"
              strokeWidth="0.7"
            />
          ))}
          <line
            x1={current.crease[0][0]}
            y1={current.crease[0][1]}
            x2={current.crease[1][0]}
            y2={current.crease[1][1]}
            stroke="#914330"
            strokeWidth="1"
            strokeDasharray="3 2"
          />
        </svg>
      </div>
      <div className="plega-basic-guide">
        <span className="plega-eyebrow">
          {copy[language].helper} · {step + 1} / {recipe.steps.length}
        </span>
        <h2>{current.title[locale]}</h2>
        <p>{current.instruction[locale]}</p>
        <p className="plega-check">{current.check[locale]}</p>
        <div className="plega-basic-controls">
          <button onClick={() => move(step - 1)} disabled={step === 0}>
            <ChevronLeft />
            {copy[language].previous}
          </button>
          <button onClick={replay}>
            <RotateCcw />
            {copy[language].replay}
          </button>
          <button
            onClick={() => move(step + 1)}
            disabled={step === recipe.steps.length - 1}
          >
            {copy[language].next}
            <ChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GuideExperience() {
  const params = new URLSearchParams(location.search);
  const [language, setLanguage] = useState<Language>(
    readPreference("plega-guide-language", "en") === "es" ? "es" : "en",
  );
  const [dark, setDark] = useState(
    readPreference("plega-guide-theme", "light") === "dark",
  );
  const [area, setArea] = useState<Area>(
    params.get("model")?.startsWith("guided:") ? "basics" : "models",
  );
  const [modelId, setModelId] = useState<string | null>(modelFromUrl);
  const [basicId, setBasicId] = useState(
    params.get("model")?.replace("guided:", "") || GUIDED[0].id,
  );
  const [document, setDocument] = useState<FoldDocument | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [sequence, setSequence] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const viewer = useRef<FoldViewerHandle>(null);
  const basic = GUIDED.find((r) => r.id === basicId) ?? GUIDED[0];
  const model = manifest.find((m) => m.id === modelId);
  const t = copy[language];
  const categories = [
    "all",
    "animals",
    "plants",
    "useful",
    "transport",
    "decorations",
  ] as const;
  const filtered = manifest.filter(
    (m) =>
      (category === "all" || m.category === category) &&
      `${m.title.en} ${m.title.es}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  const source = useMemo(
    () => ({ kind: "url" as const, url: model?.url ?? manifest[0].url }),
    [model?.url],
  );
  useEffect(() => {
    const pop = () => {
      setModelId(modelFromUrl());
      setArea(
        new URLSearchParams(location.search).get("model")?.startsWith("guided:")
          ? "basics"
          : "models",
      );
      setDocument(null);
      setStepIndex(0);
    };
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("plega-guide-language", language);
      localStorage.setItem("plega-guide-theme", dark ? "dark" : "light");
    } catch {
      /* preferences remain usable without storage */
    }
  }, [language, dark]);
  const navigate = (id: string | null, nextArea: Area = "models") => {
    viewer.current?.pause();
    setArea(nextArea);
    setModelId(id);
    setDocument(null);
    setStepIndex(0);
    setSequence(false);
    const url = new URL(location.href);
    if (id) url.searchParams.set("model", id);
    else url.searchParams.delete("model");
    history.pushState(null, "", url);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const play = (whole: boolean) => {
    if (!document) return;
    setSequence(whole);
    viewer.current?.pause();
    if (whole) viewer.current?.setStep(document.instructions.steps[0].id);
    else viewer.current?.seek(0);
    window.setTimeout(() => viewer.current?.play(), 0);
  };
  const selectStep = (id: string) => {
    setSequence(false);
    viewer.current?.setStep(id);
  };
  const current = document?.instructions.steps[stepIndex];
  return (
    <div className="plega-origami-app" data-theme={dark ? "dark" : "light"}>
      <header className="plega-header">
        <a
          className="plega-logo"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigate(null);
          }}
          aria-label="PLEGA home"
        >
          <span className="plega-logo-mark">P</span>
          <span>
            PLEGA <small>ORIGAMI</small>
          </span>
        </a>
        <nav aria-label="PLEGA areas">
          <button
            className={area === "models" ? "active" : ""}
            onClick={() => navigate(null)}
          >
            {t.models}
          </button>
          <button
            className={area === "basics" ? "active" : ""}
            onClick={() => navigate(`guided:${basic.id}`, "basics")}
          >
            {t.basics}
          </button>
          <a href="?sections=1">{t.structures}</a>
          <a href="?mechanism=1">{t.studio}</a>
        </nav>
        <button
          className="plega-language"
          aria-label={t.appearance}
          onClick={() => setDark(!dark)}
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          className="plega-language"
          onClick={() => setLanguage(language === "en" ? "es" : "en")}
        >
          {language.toUpperCase()}
        </button>
      </header>
      {area === "basics" ? (
        <main className="plega-basics-layout">
          <aside className="plega-library">
            <span className="plega-eyebrow">PLEGA / PRACTICE</span>
            <h1>
              {t.basics}
              <span>.</span>
            </h1>
            <p>{t.basicsIntro}</p>
            <div className="plega-basic-list">
              {GUIDED.map((recipe) => (
                <button
                  key={recipe.id}
                  className={recipe.id === basic.id ? "active" : ""}
                  onClick={() => {
                    setBasicId(recipe.id);
                    const url = new URL(location.href);
                    url.searchParams.set("model", `guided:${recipe.id}`);
                    history.replaceState(null, "", url);
                  }}
                >
                  {recipe.name[language === "en" ? 0 : 1]}
                  <ArrowRight size={15} />
                </button>
              ))}
            </div>
          </aside>
          <section className="plega-basics-stage">
            <BasicFold key={basic.id} recipe={basic} language={language} />
          </section>
        </main>
      ) : !modelId ? (
        <main className="plega-catalog">
          <div className="plega-catalog-intro">
            <div>
              <span className="plega-eyebrow">PLEGA / FOLD BY FOLD</span>
              <h1>
                {t.library}
                <span>.</span>
              </h1>
              <p>{t.libraryIntro}</p>
            </div>
            <div className="plega-count">
              <strong>{manifest.length.toString().padStart(2, "0")}</strong>
              <span>{t.animated}</span>
            </div>
          </div>
          <div className="plega-filterbar">
            <label className="plega-search">
              <Search size={18} />
              <input
                type="search"
                aria-label={t.search}
                placeholder={t.search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div
              className="plega-categories"
              aria-label={
                language === "en" ? "Model categories" : "Categorías de modelos"
              }
            >
              {categories.map((cat) => (
                <button
                  key={cat}
                  aria-pressed={category === cat}
                  className={category === cat ? "active" : ""}
                  onClick={() => setCategory(cat)}
                >
                  {t[cat]}{" "}
                  <small>
                    {cat === "all"
                      ? manifest.length
                      : manifest.filter((m) => m.category === cat).length}
                  </small>
                </button>
              ))}
            </div>
          </div>
          <div className="plega-model-grid">
            {filtered.map((item) => (
              <button
                key={item.id}
                className="plega-model-card"
                onClick={() => navigate(item.id)}
              >
                <div className="plega-model-preview">
                  <img src={item.preview} alt="" loading="lazy" />
                  <span>
                    {t[item.difficulty as "beginner" | "intermediate"]}
                  </span>
                </div>
                <div className="plega-model-info">
                  <small>
                    {t[item.category as (typeof categories)[number]]}
                  </small>
                  <h2>{item.title[language]}</h2>
                  <p>
                    {item.steps} {language === "en" ? "steps" : "pasos"} ·{" "}
                    {item.movements} {t.movements}
                  </p>
                  <ArrowRight size={19} />
                </div>
              </button>
            ))}
          </div>
          {!filtered.length && (
            <div className="plega-empty">
              <h2>{t.empty}</h2>
              <button
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                }}
              >
                {t.reset}
              </button>
            </div>
          )}
          <p className="plega-library-note">{t.pending}</p>
        </main>
      ) : !model ? (
        <main className="plega-empty">
          <h1>{t.unknown}</h1>
          <button onClick={() => navigate(null)}>{t.back}</button>
        </main>
      ) : (
        <main className="plega-lesson">
          <div className="plega-lesson-heading">
            <button className="plega-back" onClick={() => navigate(null)}>
              <ArrowLeft size={17} />
              {t.back}
            </button>
            <div>
              <span className="plega-eyebrow">
                {t[model.category as (typeof categories)[number]]} /{" "}
                {t[model.difficulty as "beginner" | "intermediate"]}
              </span>
              <h1>{model.title[language]}</h1>
            </div>
            <button
              className="plega-sequence-button"
              disabled={!document}
              onClick={() => play(true)}
            >
              <Play size={17} fill="currentColor" />
              {t.sequence}
            </button>
          </div>
          <div className="plega-lesson-layout">
            <section
              className="plega-workspace"
              aria-label={model.title[language]}
            >
              <div className="plega-viewer-wrap">
                <FoldViewer
                  key={model.id}
                  ref={viewer}
                  source={source}
                  locale={language}
                  autoAdvance={sequence}
                  width="100%"
                  height="100%"
                  onLoad={(doc) => {
                    setDocument(doc);
                    setStepIndex(0);
                  }}
                  onStepChange={(_, index) => setStepIndex(index)}
                  theme={{
                    accent: dark ? "#eca16d" : "#a44730",
                    background: dark ? "#252d2a" : "#f4eee4",
                    panel: dark ? "#303935" : "#fffaf1",
                    foreground: dark ? "#f2eadc" : "#322f28",
                    muted: dark ? "#bbc4bb" : "#70695e",
                    radius: "8px",
                  }}
                />
              </div>
              <div className="plega-view-hint">{t.help}</div>
              <div className="plega-lesson-actions">
                <button
                  disabled={!document}
                  onClick={() => {
                    if (document)
                      selectStep(document.instructions.steps.at(-1)!.id);
                    viewer.current?.seek(1);
                  }}
                >
                  {t.finished}
                  <ArrowRight size={15} />
                </button>
                <span>
                  {model.movements} {t.movements} · {model.steps}{" "}
                  {language === "en" ? "steps" : "pasos"}
                </span>
              </div>
              <div className="plega-sourcebar">
                <span>
                  {model.id === "crane"
                    ? "Fold Spec contributors"
                    : "FoldingAgent project contributors"}{" "}
                  · {model.license}
                </span>
                <a href={model.source} target="_blank" rel="noreferrer">
                  {t.source}
                  <ExternalLink size={14} />
                </a>
              </div>
              {model.id === "crane" && (
                <div className="plega-companion">
                  <BookOpen size={18} />
                  <div>
                    <strong>{t.companion}</strong>
                    <p>{t.companionText}</p>
                    <a
                      href="/guide/tavin/846.pdf"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {model.title[language]} PDF <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              )}
            </section>
            <aside className="plega-steps" aria-label={t.steps}>
              <span className="plega-eyebrow">
                {t.progress} / {String(stepIndex + 1).padStart(2, "0")} /{" "}
                {model.steps}
              </span>
              <progress
                value={stepIndex + 1}
                max={model.steps}
                aria-label={t.progress}
              />
              {current && document && (
                <div className="plega-step-detail" aria-live="polite">
                  <h2>{current.title[language] ?? current.title.en}</h2>
                  <p>{current.body[language] ?? current.body.en}</p>
                  <LessonIllustration
                    document={document}
                    stepIndex={stepIndex}
                    language={language}
                  />
                  <button
                    className="plega-step-play"
                    onClick={() => play(false)}
                  >
                    <RotateCcw size={17} />
                    {t.playStep}
                  </button>
                </div>
              )}
              <h2 className="plega-step-heading">{t.steps}</h2>
              <div className="plega-step-list">
                {document?.instructions.steps.map((step, index) => (
                  <button
                    key={step.id}
                    className={index === stepIndex ? "active" : ""}
                    aria-current={index === stepIndex ? "step" : undefined}
                    onClick={() => selectStep(step.id)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{step.title[language] ?? step.title.en}</strong>
                  </button>
                ))}
              </div>
              <p className="plega-limitations">{t.limitations}</p>
            </aside>
          </div>
        </main>
      )}
    </div>
  );
}
