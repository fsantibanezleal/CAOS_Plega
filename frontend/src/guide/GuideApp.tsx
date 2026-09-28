import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ExternalLink,
  Filter,
  Heart,
  Layers3,
  Maximize2,
  Minus,
  Moon,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sun,
  X,
} from "lucide-react";
import commonsData from "../../../data/guide/commons-diagrams.json";
import communityData from "../../../data/guide/community-tutorials.json";
import clubData from "../../../data/guide/origami-club-index.json";
import planData from "../../../data/guide/origami-plan-index.json";
import planHealth from "../../../data/guide/origami-plan-health.json";
import tavinData from "../../../data/guide/tavin-diagrams.json";
import { GUIDED } from "./guided";
import { foldFrame, type FoldRecipe } from "./foldEngine";
import "./guide.css";

type Language = "en" | "es";
type Kind = "guided" | "diagram" | "external";
type CatalogItem = {
  id: string;
  title: string;
  category: string;
  kind: Kind;
  source: string;
  sourceUrl?: string;
  asset?: string;
  download?: string;
  license?: string;
  licenseUrl?: string;
  author?: string;
  recipe?: FoldRecipe;
  format?: string;
};

const availablePlanUrls = new Set(
  planHealth.records
    .filter((record) => record.available)
    .map((record) => record.url),
);
const items: CatalogItem[] = [
  ...GUIDED.map((recipe) => ({
    id: `guided:${recipe.id}`,
    title: recipe.name[0],
    category: recipe.category,
    kind: "guided" as Kind,
    source: "PLEGA",
    recipe,
  })),
  ...commonsData.records.map((record) => ({
    id: `diagram:${record.asset}`,
    title: record.title,
    category: "Open diagrams",
    kind: "diagram" as Kind,
    source: "Wikimedia Commons",
    sourceUrl: record.sourcePage,
    asset: record.asset,
    license: record.license,
    licenseUrl: record.licenseUrl,
    author: record.author,
    format: "Illustrated sheet",
  })),
  ...tavinData.records.map((record) => ({
    id: `tavin:${record.asset}`,
    title: record.title,
    category: record.category,
    kind: "diagram" as Kind,
    source: "Tavin's Origami",
    sourceUrl: record.sourceFile,
    asset: record.asset,
    download: record.download,
    license: record.license,
    licenseUrl: record.licenseUrl,
    author: record.author,
    format: "Illustrated PDF sheet",
  })),
  ...clubData.entries.map((record) => ({
    id: `club:${record.planUrl}`,
    title: record.title,
    category: record.category,
    kind: "external" as Kind,
    source: "Origami Club",
    sourceUrl: record.planUrl,
    format: "Diagram at source",
  })),
  ...communityData.entries.map((record) => ({
    id: `community:${record.planUrl}`,
    title: record.title,
    category: record.category,
    kind: "external" as Kind,
    source: record.source,
    sourceUrl: record.planUrl,
    format: "Tutorial at source",
  })),
  ...planData.entries
    .filter((record) => availablePlanUrls.has(record.planUrl))
    .map((record) => ({
      id: `directory:${record.planUrl}`,
      title: record.title,
      category: record.category,
      kind: "external" as Kind,
      source: "Origami Resource Center",
      sourceUrl: record.planUrl,
      format: "File link at source",
    })),
];
const labels = {
  en: {
    guide: "Folding guide",
    sections: "Structure atlas",
    studio: "Paper studio",
    search: "Search models, folds, subjects…",
    all: "All formats",
    guided: "Animated lessons",
    diagram: "Illustrated plans",
    external: "External plans",
    category: "All categories",
    results: "results",
    favorites: "Saved",
    explore: "Explore",
    source: "Source",
    allSources: "All sources",
    steps: "steps",
    step: "Step",
    of: "of",
    play: "Play fold",
    pause: "Pause",
    next: "Next fold",
    previous: "Previous fold",
    replay: "Replay",
    playAll: "Play sequence",
    download: "Download diagram",
    visit: "Open at source",
    noResults: "No matching plans. Try another word or category.",
    start: "Choose a model to begin",
    hand: "Fold with the guide",
    sourceGuide:
      "This external plan opens at its listed source. Availability and rights belong to the creator; PLEGA does not copy its content.",
    diagramGuide:
      "Read this complete illustrated sheet in its original order. Zoom to inspect details; the sheet is not represented as a verified animation.",
    guidedGuide:
      "The paper motion below follows the described elementary folds. Compare the fold and the alignment check before continuing.",
    rights: "Rights & source",
    catalog: "Library",
    legend:
      "Original animated lessons · licensed illustrated sheets · external plan links",
    allCount: "catalog entries",
    zoom: "Zoom diagram",
    paper: "Paper",
    close: "Close",
    check: "Check your fold",
    progress: "Your place is saved on this device",
    boundary:
      "Animation is a geometric guide to elementary folds, not a physical assembly certificate.",
    linkOnly: "External link",
    licensed: "Licensed sheet",
    original: "Original lesson",
  },
  es: {
    guide: "Guía de plegado",
    sections: "Atlas de estructuras",
    studio: "Taller de papel",
    search: "Buscar modelos, pliegues, temas…",
    all: "Todos los formatos",
    guided: "Lecciones animadas",
    diagram: "Planos ilustrados",
    external: "Planes externos",
    category: "Todas las categorías",
    results: "resultados",
    favorites: "Guardados",
    explore: "Explorar",
    source: "Fuente",
    allSources: "Todas las fuentes",
    steps: "pasos",
    step: "Paso",
    of: "de",
    play: "Animar pliegue",
    pause: "Pausar",
    next: "Siguiente pliegue",
    previous: "Pliegue anterior",
    replay: "Repetir",
    playAll: "Reproducir secuencia",
    download: "Descargar diagrama",
    visit: "Abrir en origen",
    noResults: "No hay planes coincidentes. Prueba otra palabra o categoría.",
    start: "Elige un modelo para comenzar",
    hand: "Pliega con la guía",
    sourceGuide:
      "Este plan externo se abre en la fuente indicada. Su disponibilidad y derechos corresponden al creador; PLEGA no copia el contenido.",
    diagramGuide:
      "Lee la lámina completa en su orden original. Amplía para ver detalles; no se presenta como una animación verificada.",
    guidedGuide:
      "El movimiento del papel sigue los pliegues elementales descritos. Compara el pliegue y la comprobación antes de continuar.",
    rights: "Derechos y fuente",
    catalog: "Biblioteca",
    legend:
      "Lecciones originales animadas · láminas con licencia · enlaces externos",
    allCount: "entradas del catálogo",
    zoom: "Ampliar diagrama",
    paper: "Papel",
    close: "Cerrar",
    check: "Comprueba tu pliegue",
    progress: "Tu posición se guarda en este dispositivo",
    boundary:
      "La animación representa pliegues elementales; no certifica el armado físico.",
    linkOnly: "Enlace externo",
    licensed: "Lámina con licencia",
    original: "Lección original",
  },
};

function readStore<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readStore(key, initial));
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}
const kindLabel = (kind: Kind, lang: Language) =>
  kind === "guided"
    ? labels[lang].original
    : kind === "diagram"
      ? labels[lang].licensed
      : labels[lang].linkOnly;

function FoldStage({
  recipe,
  stepIndex,
  progress,
  color,
}: {
  recipe: FoldRecipe;
  stepIndex: number;
  progress: number;
  color: string;
}) {
  const facets = useMemo(
    () => foldFrame(recipe, stepIndex, progress),
    [recipe, stepIndex, progress],
  );
  const [width, height] = recipe.paper;
  const line = recipe.steps[stepIndex].crease;
  const expansion = Math.max(width, height) * 0.14;
  return (
    <svg
      className="guide-paper-svg"
      viewBox={`${-expansion} ${-expansion} ${width + 2 * expansion} ${height + 2 * expansion}`}
      role="img"
      aria-label={`Animated fold ${stepIndex + 1}: ${recipe.steps[stepIndex].title[0]}`}
    >
      <defs>
        <filter id="fold-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity=".2" />
        </filter>
      </defs>
      <rect
        x={-expansion}
        y={-expansion}
        width={width + 2 * expansion}
        height={height + 2 * expansion}
        fill="transparent"
      />
      {facets.map((facet, index) => (
        <polygon
          key={index}
          points={facet.points.map((p) => p.join(",")).join(" ")}
          fill={facet.face ? "#f7f3ed" : color}
          stroke="#1b3245"
          strokeWidth=".55"
          strokeLinejoin="round"
          filter="url(#fold-shadow)"
        />
      ))}
      <line
        x1={line[0][0]}
        y1={line[0][1]}
        x2={line[1][0]}
        y2={line[1][1]}
        stroke="#ed5b47"
        strokeWidth="1.3"
        strokeDasharray="3 2"
      />
      <circle cx={line[0][0]} cy={line[0][1]} r="1.8" fill="#ed5b47" />
      <circle cx={line[1][0]} cy={line[1][1]} r="1.8" fill="#ed5b47" />
    </svg>
  );
}

export default function GuideApp() {
  const [lang, setLang] = usePersisted<Language>("plega-guide-language", "en");
  const [dark, setDark] = usePersisted<boolean>("plega-guide-dark", false);
  const [favorites, setFavorites] = usePersisted<string[]>(
    "plega-guide-favorites",
    [],
  );
  const [places, setPlaces] = usePersisted<Record<string, number>>(
    "plega-guide-places",
    {},
  );
  const [selectedId, setSelectedId] = useState(
    () =>
      new URLSearchParams(location.search).get("model") || "guided:blintz-base",
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [source, setSource] = useState("all");
  const [kind, setKind] = useState<Kind | "all" | "saved">("all");
  const [visibleCount, setVisibleCount] = useState(40);
  const [step, setStep] = useState(0);
  const [foldProgress, setFoldProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playSequence, setPlaySequence] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [paperColor, setPaperColor] = useState("#d6ef79");
  const [mobileCatalog, setMobileCatalog] = useState(false);
  const timer = useRef<number | null>(null);
  const chosen = items.find((item) => item.id === selectedId) ?? items[0];
  const t = labels[lang];
  const stepInfo = chosen.recipe?.steps[step];
  const categories = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.category))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [],
  );
  const sources = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.source))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [],
  );
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return items.filter(
      (item) =>
        (kind === "all" ||
          (kind === "saved"
            ? favorites.includes(item.id)
            : item.kind === kind)) &&
        (category === "all" || item.category === category) &&
        (source === "all" || item.source === source) &&
        (!needle ||
          `${item.title} ${item.category} ${item.source}`
            .toLocaleLowerCase()
            .includes(needle)),
    );
  }, [query, category, source, kind, favorites]);

  useEffect(() => {
    document.documentElement.dataset.guideTheme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    const remembered = places[chosen.id] ?? 0;
    setStep(
      Math.min(remembered, Math.max(0, (chosen.recipe?.steps.length ?? 1) - 1)),
    );
    setFoldProgress(0);
    setPlaying(false);
    setPlaySequence(false);
    setZoom(1);
  }, [chosen.id]); // the saved position is read only when a model is selected
  useEffect(() => {
    if (chosen.recipe)
      setPlaces((current) =>
        current[chosen.id] === step
          ? current
          : { ...current, [chosen.id]: step },
      );
  }, [chosen.id, chosen.recipe, step, setPlaces]);
  useEffect(() => {
    if (!playing || !chosen.recipe) return;
    let previous = performance.now();
    const tick = (now: number) => {
      const delta = (now - previous) / 1100;
      previous = now;
      setFoldProgress((value) => Math.min(1, value + delta));
      timer.current = requestAnimationFrame(tick);
    };
    timer.current = requestAnimationFrame(tick);
    return () => {
      if (timer.current !== null) cancelAnimationFrame(timer.current);
    };
  }, [playing, chosen.id, step]);
  useEffect(() => {
    if (foldProgress < 1 || !playing) return;
    if (
      playSequence &&
      chosen.recipe &&
      step < chosen.recipe.steps.length - 1
    ) {
      const timeout = window.setTimeout(() => {
        setStep((value) => value + 1);
        setFoldProgress(0);
      }, 500);
      return () => clearTimeout(timeout);
    }
    setPlaying(false);
    setPlaySequence(false);
  }, [foldProgress, playing, playSequence, chosen.recipe, step]);
  useEffect(() => {
    setVisibleCount(40);
  }, [query, category, source, kind]);

  const select = (item: CatalogItem) => {
    // A shorter recipe must not render with the previous recipe's step index.
    // Its saved position is restored by the selection effect after this render.
    setStep(0);
    setFoldProgress(0);
    setPlaying(false);
    setPlaySequence(false);
    setSelectedId(item.id);
    setMobileCatalog(false);
    const url = new URL(location.href);
    url.searchParams.set("model", item.id);
    history.replaceState(null, "", url);
  };
  const moveStep = (next: number) => {
    if (!chosen.recipe) return;
    setStep(Math.max(0, Math.min(chosen.recipe.steps.length - 1, next)));
    setFoldProgress(0);
    setPlaying(true);
    setPlaySequence(false);
  };
  const toggleFavorite = (id: string) =>
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  const activeFavorite = favorites.includes(chosen.id);

  return (
    <div className="guide-app" data-theme={dark ? "dark" : "light"}>
      <header className="guide-topbar">
        <a className="guide-brand" href="/" aria-label="PLEGA home">
          <span className="guide-brand-mark">P</span>
          <span>
            PLEGA <small>/ FOLD LIBRARY</small>
          </span>
        </a>
        <nav aria-label="PLEGA areas">
          <a className="active" href="/">
            {t.guide}
          </a>
          <a href="?sections=1">{t.sections}</a>
          <a href="?mechanism=1">{t.studio}</a>
        </nav>
        <div className="guide-top-actions">
          <button
            onClick={() => setLang(lang === "en" ? "es" : "en")}
            aria-label="Change language"
          >
            {lang.toUpperCase()} <ChevronDown size={13} />
          </button>
          <button
            className="guide-icon"
            onClick={() => setDark(!dark)}
            aria-label={dark ? "Light theme" : "Dark theme"}
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>
      <div className="guide-mobile-bar">
        <button onClick={() => setMobileCatalog(true)}>
          <Filter size={16} /> {t.catalog}{" "}
          <span>{items.length.toLocaleString()}</span>
        </button>
        <span>{chosen.title}</span>
      </div>
      <main className="guide-grid">
        <aside
          className={`guide-library ${mobileCatalog ? "open" : ""}`}
          aria-label={t.catalog}
        >
          <div className="guide-library-intro">
            <div className="guide-kicker">
              PLEGA / FIELD GUIDE{" "}
              <button
                className="guide-mobile-close"
                onClick={() => setMobileCatalog(false)}
                aria-label={t.close}
              >
                <X size={19} />
              </button>
            </div>
            <h1>
              {t.catalog}
              <span>.</span>
            </h1>
            <p>{t.legend}</p>
            <div className="guide-total">
              <strong>{items.length.toLocaleString(lang)}</strong>
              <span>{t.allCount}</span>
            </div>
          </div>
          <div className="guide-filters">
            <label className="guide-search">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.search}
                aria-label={t.search}
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </label>
            <div className="guide-selects">
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
                aria-label="Plan format"
              >
                <option value="all">{t.all}</option>
                <option value="guided">{t.guided}</option>
                <option value="diagram">{t.diagram}</option>
                <option value="external">{t.external}</option>
                <option value="saved">
                  {t.favorites} ({favorites.length})
                </option>
              </select>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Category"
              >
                <option value="all">{t.category}</option>
                {categories.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                aria-label="Plan source"
              >
                <option value="all">{t.allSources}</option>
                {sources.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="guide-result-count">
              {results.length.toLocaleString(lang)} {t.results}
            </div>
          </div>
          <div className="guide-list" role="list">
            {results.length === 0 ? (
              <p className="guide-empty">{t.noResults}</p>
            ) : (
              results.slice(0, visibleCount).map((item) => (
                <button
                  role="listitem"
                  key={item.id}
                  className={`guide-list-item ${chosen.id === item.id ? "selected" : ""}`}
                  onClick={() => select(item)}
                >
                  <span className={`guide-item-art ${item.kind}`}>
                    {item.asset ? (
                      <img src={item.asset} alt="" loading="lazy" />
                    ) : item.kind === "guided" ? (
                      <span className="guide-art-fold" />
                    ) : (
                      <BookOpen size={20} />
                    )}
                  </span>
                  <span className="guide-item-copy">
                    <b>{item.title}</b>
                    <small>
                      {item.category} · {kindLabel(item.kind, lang)}
                    </small>
                  </span>
                  <ArrowRight size={15} />
                </button>
              ))
            )}
            {results.length > visibleCount && (
              <button
                className="guide-more"
                onClick={() => setVisibleCount((count) => count + 50)}
              >
                + {Math.min(50, results.length - visibleCount)} more
              </button>
            )}
          </div>
          <div className="guide-library-foot">
            {t.original}: {GUIDED.length} · {t.licensed}:{" "}
            {commonsData.records.length + tavinData.records.length} ·{" "}
            {t.linkOnly}:{" "}
            {clubData.entries.length +
              communityData.entries.length +
              availablePlanUrls.size}
          </div>
        </aside>
        <section className="guide-main" aria-label={t.hand}>
          <div className="guide-title-row">
            <div>
              <div className="guide-kicker">
                {chosen.category.toUpperCase()} /{" "}
                {kindLabel(chosen.kind, lang).toUpperCase()}
              </div>
              <h2>
                {chosen.recipe?.name[lang === "en" ? 0 : 1] ?? chosen.title}
              </h2>
              <p>
                {chosen.recipe?.summary[lang === "en" ? 0 : 1] ??
                  `${chosen.source} · ${chosen.format ?? ""}`}
              </p>
            </div>
            <button
              className={`guide-favorite ${activeFavorite ? "active" : ""}`}
              onClick={() => toggleFavorite(chosen.id)}
              aria-pressed={activeFavorite}
              aria-label={t.favorites}
            >
              <Heart
                size={19}
                fill={activeFavorite ? "currentColor" : "none"}
              />
            </button>
          </div>
          <div className={`guide-stage ${chosen.kind}`}>
            {chosen.recipe ? (
              <>
                <div className="guide-stage-tag">
                  {t.step} {step + 1} {t.of} {chosen.recipe.steps.length}
                  <span className="guide-stage-live" />
                </div>
                <FoldStage
                  recipe={chosen.recipe}
                  stepIndex={step}
                  progress={foldProgress}
                  color={paperColor}
                />
                <div className="guide-stage-foot">
                  <span>
                    {t.paper} ·{" "}
                    {chosen.recipe.paper[0] === chosen.recipe.paper[1]
                      ? "square"
                      : "rectangle"}
                  </span>
                  <div className="guide-swatches">
                    {[
                      "#d6ef79",
                      "#f7b3a9",
                      "#a9d9eb",
                      "#e9cdf3",
                      "#f5dda5",
                    ].map((color) => (
                      <button
                        key={color}
                        aria-label={`Paper color ${color}`}
                        aria-pressed={paperColor === color}
                        style={{ background: color }}
                        onClick={() => setPaperColor(color)}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : chosen.asset ? (
              <>
                <div className="guide-stage-tag">
                  {t.licensed} · {chosen.license}
                </div>
                <div className="guide-diagram-scroll">
                  <img
                    src={chosen.asset}
                    alt={`Complete origami diagram: ${chosen.title}`}
                    style={{ width: `${zoom * 100}%` }}
                  />
                </div>
                <div className="guide-zoom">
                  <button
                    onClick={() => setZoom(Math.max(1, zoom - 0.25))}
                    aria-label="Zoom out"
                  >
                    <Minus size={17} />
                  </button>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.25"
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    aria-label={t.zoom}
                  />
                  <button
                    onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                    aria-label="Zoom in"
                  >
                    <Plus size={17} />
                  </button>
                  <output>{Math.round(zoom * 100)}%</output>
                </div>
              </>
            ) : (
              <div className="guide-external-stage">
                <div className="guide-external-graphic">
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div className="guide-external-copy">
                  <span className="guide-kicker">EXTERNAL FOLDING PLAN</span>
                  <h3>{chosen.title}</h3>
                  <p>{t.sourceGuide}</p>
                  <a
                    className="guide-primary"
                    href={chosen.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t.visit} <ExternalLink size={17} />
                  </a>
                </div>
              </div>
            )}
          </div>
          {chosen.recipe && (
            <div className="guide-playback">
              <div className="guide-timeline-head">
                <span>
                  {String(step + 1).padStart(2, "0")} /{" "}
                  {String(chosen.recipe.steps.length).padStart(2, "0")}
                </span>
                <b>{stepInfo?.title[lang === "en" ? 0 : 1]}</b>
              </div>
              <div className="guide-step-progress">
                {chosen.recipe.steps.map((_, index) => (
                  <button
                    key={index}
                    className={
                      index === step ? "current" : index < step ? "done" : ""
                    }
                    onClick={() => moveStep(index)}
                    aria-label={`${t.step} ${index + 1}`}
                  >
                    <span />
                  </button>
                ))}
              </div>
              <div className="guide-controls">
                <button
                  onClick={() => moveStep(step - 1)}
                  disabled={step === 0}
                >
                  <ArrowLeft size={16} /> {t.previous}
                </button>
                <button
                  className="guide-control-main"
                  onClick={() => {
                    if (foldProgress >= 1) setFoldProgress(0);
                    setPlaying(!playing);
                    setPlaySequence(false);
                  }}
                >
                  {playing ? <Pause size={18} /> : <Play size={18} />}
                  {playing ? t.pause : t.play}
                </button>
                <button
                  onClick={() => {
                    setStep(0);
                    setFoldProgress(0);
                    setPlaying(true);
                    setPlaySequence(true);
                  }}
                >
                  <RotateCcw size={16} /> {t.playAll}
                </button>
                <button
                  onClick={() => moveStep(step + 1)}
                  disabled={step === chosen.recipe.steps.length - 1}
                >
                  {t.next} <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </section>
        <aside className="guide-instructions" aria-label="Instructions">
          <div className="guide-instructions-inner">
            <div className="guide-side-kicker">
              <Layers3 size={17} /> {t.hand}
            </div>
            {chosen.recipe && stepInfo ? (
              <>
                <div className="guide-step-number">
                  {String(step + 1).padStart(2, "0")}
                </div>
                <h3>{stepInfo.title[lang === "en" ? 0 : 1]}</h3>
                <p className="guide-lead">
                  {stepInfo.instruction[lang === "en" ? 0 : 1]}
                </p>
                <div className="guide-check">
                  <Check size={17} />
                  <div>
                    <b>{t.check}</b>
                    <p>{stepInfo.check[lang === "en" ? 0 : 1]}</p>
                  </div>
                </div>
                <p className="guide-quiet">{t.guidedGuide}</p>
                <p className="guide-boundary">{t.boundary}</p>
              </>
            ) : chosen.asset ? (
              <>
                <div className="guide-step-number">
                  <Maximize2 size={30} />
                </div>
                <h3>{chosen.title}</h3>
                <p className="guide-lead">{t.diagramGuide}</p>
                <a
                  className="guide-primary"
                  href={chosen.download ?? chosen.asset}
                  download
                >
                  {t.download} <ArrowRight size={17} />
                </a>
                <div className="guide-rights">
                  <b>{t.rights}</b>
                  <p>{chosen.author}</p>
                  <a href={chosen.sourceUrl} target="_blank" rel="noreferrer">
                    {chosen.source} <ExternalLink size={13} />
                  </a>
                  <a href={chosen.licenseUrl} target="_blank" rel="noreferrer">
                    {chosen.license} <ExternalLink size={13} />
                  </a>
                </div>
              </>
            ) : (
              <>
                <div className="guide-step-number">
                  <ExternalLink size={30} />
                </div>
                <h3>{chosen.title}</h3>
                <p className="guide-lead">{t.sourceGuide}</p>
                <div className="guide-rights">
                  <b>{t.source}</b>
                  <p>
                    {chosen.source} · {chosen.format}
                  </p>
                  <a href={chosen.sourceUrl} target="_blank" rel="noreferrer">
                    {t.visit} <ExternalLink size={13} />
                  </a>
                </div>
              </>
            )}
            <div className="guide-side-footer">
              <span>PLEGA / {t.progress}</span>
              <a href="?sections=1">
                {t.explore} {t.sections} <ArrowRight size={13} />
              </a>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
