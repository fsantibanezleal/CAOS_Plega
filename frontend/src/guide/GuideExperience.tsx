import { useRef, useState } from "react";
import {
  FoldViewer,
  type FoldDocument,
  type FoldViewerHandle,
} from "../vendor/fold-viewer";
import "../vendor/fold-viewer/styles.css";
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Play,
  RotateCcw,
} from "lucide-react";
import { GUIDED } from "./guided";
import { foldFrame, type FoldRecipe } from "./foldEngine";
import "./experience.css";

type Language = "en" | "es";
type Area = "models" | "basics";
const CRANE_SOURCE = {
  kind: "url" as const,
  url: "/lessons/crane/crane.fold.json",
};
const copy = {
  en: {
    models: "Models",
    basics: "Fold basics",
    studio: "Paper studio",
    structures: "Structure atlas",
    library: "Origami library",
    libraryIntro: "Only complete models with authored motion appear here.",
    modelCount: "complete animated model",
    crane: "Paper crane",
    craneSummary:
      "Follow a flat square through 44 teaching steps to the finished crane.",
    sequence: "Play from start to finish",
    steps: "Step navigator",
    selectStep: "Choose a step to inspect its movement and instruction.",
    companion: "Companion reference",
    companionText:
      "The diagram is optional reading. The animation is the lesson.",
    source: "Source and license",
    limitations:
      "Authored geometric motion; physical folding and collision-free movement have not been certified.",
    basicsIntro:
      "Practice individual folds here. These exercises are separate from the model library.",
    replay: "Replay fold",
    next: "Next step",
    previous: "Previous step",
    helper: "Elementary fold exercise",
    missing:
      "The requested thousand complete animations are not yet available. PLEGA counts only fully animated models.",
  },
  es: {
    models: "Modelos",
    basics: "Pliegues básicos",
    studio: "Taller de papel",
    structures: "Atlas de estructuras",
    library: "Biblioteca de origami",
    libraryIntro:
      "Aquí solo aparecen modelos completos con movimiento definido.",
    modelCount: "modelo completo animado",
    crane: "Grulla de papel",
    craneSummary:
      "Sigue un cuadrado plano durante 44 pasos hasta la grulla terminada.",
    sequence: "Reproducir de principio a fin",
    steps: "Navegador de pasos",
    selectStep: "Elige un paso para ver su movimiento e instrucción.",
    companion: "Referencia complementaria",
    companionText:
      "El diagrama es lectura opcional. La animación es la lección.",
    source: "Fuente y licencia",
    limitations:
      "Movimiento geométrico definido; no se ha certificado el plegado físico ni la ausencia de colisiones.",
    basicsIntro:
      "Practica pliegues individuales aquí. Estos ejercicios no forman parte de la biblioteca de modelos.",
    replay: "Repetir pliegue",
    next: "Paso siguiente",
    previous: "Paso anterior",
    helper: "Ejercicio de pliegue elemental",
    missing:
      "Aún no están disponibles los mil modelos completos animados solicitados. PLEGA solo cuenta modelos totalmente animados.",
  },
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
  const [language, setLanguage] = useState<Language>("en");
  const [area, setArea] = useState<Area>(
    params.get("model")?.startsWith("guided:") ? "basics" : "models",
  );
  const [basicId, setBasicId] = useState(
    params.get("model")?.replace("guided:", "") || GUIDED[0].id,
  );
  const [document, setDocument] = useState<FoldDocument | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const viewer = useRef<FoldViewerHandle>(null);
  const basic = GUIDED.find((recipe) => recipe.id === basicId) ?? GUIDED[0];
  const t = copy[language];
  const selectArea = (next: Area) => {
    setArea(next);
    const url = new URL(location.href);
    url.searchParams.set(
      "model",
      next === "models" ? "crane" : `guided:${basic.id}`,
    );
    history.replaceState(null, "", url);
  };
  const playSequence = () => {
    viewer.current?.reset();
    window.setTimeout(() => viewer.current?.play(), 0);
  };
  return (
    <div className="plega-origami-app">
      <header className="plega-header">
        <a className="plega-logo" href="/" aria-label="PLEGA home">
          <span className="plega-logo-mark">P</span>
          <span>
            PLEGA <small>ORIGAMI</small>
          </span>
        </a>
        <nav aria-label="PLEGA areas">
          <button
            className={area === "models" ? "active" : ""}
            onClick={() => selectArea("models")}
          >
            {t.models}
          </button>
          <button
            className={area === "basics" ? "active" : ""}
            onClick={() => selectArea("basics")}
          >
            {t.basics}
          </button>
          <a href="?sections=1">{t.structures}</a>
          <a href="?mechanism=1">{t.studio}</a>
        </nav>
        <button
          className="plega-language"
          onClick={() => setLanguage(language === "en" ? "es" : "en")}
        >
          {language.toUpperCase()}
        </button>
      </header>
      {area === "models" ? (
        <main className="plega-layout">
          <aside className="plega-library" aria-label={t.library}>
            <span className="plega-eyebrow">PLEGA / ANIMATED ORIGAMI</span>
            <h1>
              {t.library}
              <span>.</span>
            </h1>
            <p>{t.libraryIntro}</p>
            <div className="plega-count">
              <strong>01</strong>
              <span>{t.modelCount}</span>
            </div>
            <div className="plega-model-card">
              <span className="plega-model-glyph">鶴</span>
              <span>
                <strong>{t.crane}</strong>
                <small>
                  44 {language === "en" ? "steps" : "pasos"} · Fold Spec
                </small>
              </span>
              <ArrowRight size={17} />
            </div>
            <p className="plega-library-note">{t.missing}</p>
          </aside>
          <section className="plega-workspace" aria-label={t.crane}>
            <div className="plega-workspace-heading">
              <div>
                <span className="plega-eyebrow">01 / COMPLETE MODEL</span>
                <h2>{t.crane}</h2>
                <p>{t.craneSummary}</p>
              </div>
              <button className="plega-sequence-button" onClick={playSequence}>
                <Play size={17} fill="currentColor" />
                {t.sequence}
              </button>
            </div>
            <div className="plega-viewer-wrap">
              <FoldViewer
                ref={viewer}
                source={CRANE_SOURCE}
                locale={language}
                autoAdvance
                width="100%"
                height="100%"
                onLoad={setDocument}
                onStepChange={(_, index) => setStepIndex(index)}
                theme={{
                  accent: "#b64d32",
                  background: "#f6efe3",
                  panel: "#fffaf1",
                  foreground: "#342a25",
                  muted: "#655950",
                  radius: "0px",
                }}
              />
            </div>
            <div className="plega-sourcebar">
              <span>Fold Spec contributors · MIT</span>
              <a
                href="https://github.com/FoldLab/fold-spec/tree/main/examples/crane"
                target="_blank"
                rel="noreferrer"
              >
                {t.source}
                <ExternalLink size={14} />
              </a>
            </div>
          </section>
          <aside className="plega-steps" aria-label={t.steps}>
            <span className="plega-eyebrow">THE FOLD / 44 STEPS</span>
            <h2>{t.steps}</h2>
            <p>{t.selectStep}</p>
            {document?.instructions.steps[stepIndex] && (
              <div className="plega-step-detail" aria-live="polite">
                <span className="plega-eyebrow">
                  {language === "en" ? "STEP" : "PASO"} {stepIndex + 1} /{" "}
                  {document.instructions.steps.length}
                </span>
                <h3>
                  {document.instructions.steps[stepIndex].title[language] ??
                    document.instructions.steps[stepIndex].title.en}
                </h3>
                <p>
                  {document.instructions.steps[stepIndex].body[language] ??
                    document.instructions.steps[stepIndex].body.en}
                </p>
              </div>
            )}
            <div className="plega-step-list">
              {document?.instructions.steps.map((step, index) => (
                <button
                  key={step.id}
                  className={index === stepIndex ? "active" : ""}
                  onClick={() => {
                    viewer.current?.setStep(step.id);
                    if (window.matchMedia("(max-width: 780px)").matches)
                      window.document
                        .querySelector(".plega-workspace")
                        ?.scrollIntoView({ behavior: "smooth" });
                  }}
                  aria-current={index === stepIndex ? "step" : undefined}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{step.title[language] ?? step.title.en}</strong>
                </button>
              ))}
            </div>
            <div className="plega-companion">
              <BookOpen size={18} />
              <div>
                <strong>{t.companion}</strong>
                <p>{t.companionText}</p>
                <a href="/guide/tavin/846.pdf" target="_blank" rel="noreferrer">
                  {t.crane} PDF <ExternalLink size={13} />
                </a>
              </div>
            </div>
            <p className="plega-limitations">{t.limitations}</p>
          </aside>
        </main>
      ) : (
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
      )}
    </div>
  );
}
