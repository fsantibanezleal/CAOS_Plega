import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  CircleHelp,
  Grid3X3,
  Layers3,
  Maximize2,
  Moon,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  Sun,
  Waypoints,
} from "lucide-react";
import {
  familyLabels,
  ORIGAMI_PROJECTS,
  type FoldFamily,
  type OrigamiProject,
} from "./catalog";
import { OrigamiCanvas, type OrigamiViewMode } from "./OrigamiCanvas";
import "./origami.css";

type Page = "atlas" | "lab";
const families: (FoldFamily | "all")[] = [
  "all",
  "tessellation",
  "base",
  "radial",
  "polyhedron",
  "sculpture",
];
const stepAt = (project: OrigamiProject, amount: number) => {
  let index = 0;
  project.steps.forEach((step, stepIndex) => {
    if (step.amount <= amount) index = stepIndex;
  });
  return index;
};

function PatternThumbnail({ project }: { project: OrigamiProject }) {
  const lines =
    project.family === "radial"
      ? Array.from({ length: project.columns }, (_, i) => {
          const angle = (i / project.columns) * Math.PI * 2;
          return (
            <line
              key={i}
              x1="90"
              y1="58"
              x2={90 + Math.cos(angle) * 65}
              y2={58 + Math.sin(angle) * 65}
            />
          );
        })
      : Array.from(
          { length: Math.min(project.rows, 6) * Math.min(project.columns, 8) },
          (_, i) => {
            const row = Math.floor(i / Math.min(project.columns, 8));
            const col = i % Math.min(project.columns, 8);
            const x = 22 + col * (136 / Math.min(project.columns, 8));
            const y = 18 + row * (80 / Math.min(project.rows, 6));
            return (
              <path key={i} d={`M ${x} ${y} l 17 12 l -17 12 l -17 -12 Z`} />
            );
          },
        );
  return (
    <svg
      className="origami-card-pattern"
      viewBox="0 0 180 116"
      aria-hidden="true"
    >
      <rect width="180" height="116" rx="8" fill={project.palette[0]} />
      <g className="pattern-mountain" stroke={project.palette[1]}>
        {lines}
      </g>
      <g className="pattern-valley">
        <path d="M 90 8 V 108 M 8 58 H 172" />
        {project.family === "radial" && <circle cx="90" cy="58" r="26" />}
      </g>
    </svg>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className="origami-icon-button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function OrigamiAtlas() {
  const [page, setPage] = useState<Page>("atlas");
  const [family, setFamily] = useState<FoldFamily | "all">("all");
  const [projectId, setProjectId] = useState("miura-field");
  const [progress, setProgress] = useState(64);
  const [mode, setMode] = useState<OrigamiViewMode>("folded");
  const [selectedSection, setSelectedSection] = useState("cell");
  const [activeStep, setActiveStep] = useState(2);
  const [playing, setPlaying] = useState(false);
  const [dark, setDark] = useState(
    () => localStorage.getItem("plega-theme") === "dark",
  );
  const project =
    ORIGAMI_PROJECTS.find((item) => item.id === projectId) ??
    ORIGAMI_PROJECTS[0];
  const visibleProjects = useMemo(
    () =>
      family === "all"
        ? ORIGAMI_PROJECTS
        : ORIGAMI_PROJECTS.filter((item) => item.family === family),
    [family],
  );
  const selectProject = (next: OrigamiProject) => {
    setProjectId(next.id);
    setSelectedSection(next.sections[0].id);
    setActiveStep(0);
    setProgress(0);
  };
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("plega-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () =>
        setProgress((value) => {
          const next = value + 2;
          if (next >= 100) {
            setPlaying(false);
            setActiveStep(project.steps.length - 1);
            return 100;
          }
          setActiveStep(stepAt(project, next));
          return next;
        }),
      45,
    );
    return () => window.clearInterval(timer);
  }, [playing, project.steps]);
  const setFold = (value: number) => {
    const next = Math.max(0, Math.min(100, value));
    setProgress(next);
    setActiveStep(stepAt(project, next));
  };

  return (
    <div className="origami-shell">
      <header className="origami-header">
        <button
          className="origami-brand"
          onClick={() => setPage("atlas")}
          aria-label="Plega fold atlas home"
        >
          <span className="origami-brand-mark">✳</span>
          <span>
            plega<span className="origami-dot">.</span>
          </span>
        </button>
        <span className="origami-header-rule" />
        <span className="origami-header-title">
          FOLD ATLAS / SPATIAL PAPER STUDIES
        </span>
        <nav className="origami-header-nav" aria-label="Primary navigation">
          <button
            className={page === "atlas" ? "active" : ""}
            onClick={() => setPage("atlas")}
          >
            <Grid3X3 size={15} /> Atlas
          </button>
          <button
            className={page === "lab" ? "active" : ""}
            onClick={() => setPage("lab")}
          >
            <Orbit size={15} /> Lab
          </button>
          <IconButton
            label={dark ? "Use light theme" : "Use dark theme"}
            onClick={() => setDark((value) => !value)}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </IconButton>
        </nav>
      </header>

      {page === "atlas" ? (
        <main className="origami-atlas-page">
          <section className="origami-atlas-hero">
            <div>
              <span className="origami-eyebrow">PLEGA / ORIGAMI SECTIONS</span>
              <h1>One sheet. Many ways to move.</h1>
              <p>
                Explore paper as a connected system of vertices, creases, facets
                and layers. Choose a study, open its lab, and move through the
                fold instead of paging through a catalogue.
              </p>
            </div>
            <div className="origami-hero-note">
              <span>08</span>
              <small>
                different constructions
                <br />
                one continuous sheet
              </small>
            </div>
          </section>
          <div
            className="origami-family-bar"
            role="tablist"
            aria-label="Filter origami families"
          >
            {families.map((item) => (
              <button
                key={item}
                className={family === item ? "active" : ""}
                onClick={() => setFamily(item)}
              >
                {familyLabels[item]}
              </button>
            ))}
          </div>
          <section className="origami-atlas-grid">
            {visibleProjects.map((item) => (
              <button
                key={item.id}
                className="origami-project-card"
                onClick={() => {
                  selectProject(item);
                  setPage("lab");
                }}
              >
                <PatternThumbnail project={item} />
                <div className="origami-card-copy">
                  <span>
                    {item.familyLabel} · {item.difficulty}
                  </span>
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                  <strong>
                    Open the sectioned lab <ChevronRight size={15} />
                  </strong>
                </div>
              </button>
            ))}
          </section>
          <section className="origami-atlas-footer">
            <div>
              <Waypoints size={18} />
              <span>
                <b>Sections are the interface.</b> Click a visible facet or
                choose its named crease group. The same selection updates the 3D
                model, crease map, step sequence and notes.
              </span>
            </div>
            <button
              onClick={() => {
                setPage("lab");
                setProjectId("miura-field");
              }}
            >
              Start with Miura field <ArrowRight size={16} />
            </button>
          </section>
        </main>
      ) : (
        <main className="origami-lab-page">
          <aside className="origami-lab-rail">
            <button className="origami-back" onClick={() => setPage("atlas")}>
              <ArrowLeft size={15} /> All studies
            </button>
            <div className="origami-rail-heading">
              <span className="origami-eyebrow">CURRENT STUDY</span>
              <h1>{project.title}</h1>
              <p>{project.subtitle}</p>
            </div>
            <div className="origami-study-list">
              {ORIGAMI_PROJECTS.map((item) => (
                <button
                  key={item.id}
                  className={item.id === project.id ? "active" : ""}
                  onClick={() => selectProject(item)}
                >
                  <PatternThumbnail project={item} />
                  <span>
                    <b>{item.title}</b>
                    <small>{item.familyLabel}</small>
                  </span>
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
            <div className="origami-limits">
              <CircleHelp size={16} />
              <span>
                <b>Model boundary</b> Authored fold geometry illustrates
                relationships. It is not a physical stiffness or stress
                simulation.
              </span>
            </div>
          </aside>
          <section className="origami-lab-main">
            <div className="origami-lab-titlebar">
              <div>
                <span className="origami-eyebrow">
                  {project.familyLabel.toUpperCase()} / {project.rows} ×{" "}
                  {project.columns} STUDY
                </span>
                <h2>{project.principle}</h2>
              </div>
              <div className="origami-title-actions">
                <button
                  onClick={() =>
                    setMode(mode === "folded" ? "exploded" : "folded")
                  }
                >
                  <Maximize2 size={15} />{" "}
                  {mode === "exploded" ? "Join layers" : "Separate layers"}
                </button>
                <button onClick={() => setFold(0)}>
                  <RotateCcw size={15} /> Reset
                </button>
              </div>
            </div>
            <div className="origami-visual-grid">
              <div className="origami-scene-card">
                <div className="origami-scene-tools">
                  <div>
                    <span className="origami-live-dot" /> LIVE FOLD /{" "}
                    {Math.round(progress)}%
                  </div>
                  <div className="origami-view-switch">
                    <button
                      className={mode === "pattern" ? "active" : ""}
                      onClick={() => setMode("pattern")}
                    >
                      Crease map
                    </button>
                    <button
                      className={mode === "folded" ? "active" : ""}
                      onClick={() => setMode("folded")}
                    >
                      Folded
                    </button>
                    <button
                      className={mode === "exploded" ? "active" : ""}
                      onClick={() => setMode("exploded")}
                    >
                      Exploded
                    </button>
                  </div>
                </div>
                <OrigamiCanvas
                  project={project}
                  progress={progress / 100}
                  mode={mode}
                  selectedSection={selectedSection}
                  onSelect={setSelectedSection}
                />
                <div className="origami-scene-hint">
                  Drag to orbit · click a facet to inspect · Home to fit
                </div>
              </div>
              <aside className="origami-section-card">
                <div className="origami-section-heading">
                  <span className="origami-eyebrow">
                    SECTIONS / {project.sections.length}
                  </span>
                  <h3>Choose what the fold is doing</h3>
                  <p>{project.description}</p>
                </div>
                <div className="origami-sections">
                  {project.sections.map((section, index) => (
                    <button
                      key={section.id}
                      className={selectedSection === section.id ? "active" : ""}
                      onClick={() => setSelectedSection(section.id)}
                    >
                      <span className="origami-section-index">
                        0{index + 1}
                      </span>
                      <span>
                        <b>{section.label}</b>
                        <small>
                          {section.role} · {section.description}
                        </small>
                      </span>
                      <ChevronRight size={14} />
                    </button>
                  ))}
                </div>
                <div className="origami-selection-note">
                  <Layers3 size={15} />
                  <span>
                    <b>
                      {
                        project.sections.find(
                          (item) => item.id === selectedSection,
                        )?.label
                      }
                    </b>{" "}
                    is highlighted in the model and crease map.
                  </span>
                </div>
              </aside>
            </div>
            <div className="origami-sequence">
              <div className="origami-sequence-top">
                <div>
                  <span className="origami-eyebrow">FOLD SEQUENCE</span>
                  <h3>Move through the construction</h3>
                </div>
                <button
                  className="origami-play"
                  onClick={() => setPlaying((value) => !value)}
                >
                  {playing ? <Pause size={16} /> : <Play size={16} />}{" "}
                  {playing ? "Pause" : "Play sequence"}
                </button>
              </div>
              <div className="origami-step-row">
                {project.steps.map((step, index) => (
                  <button
                    key={step.label}
                    className={activeStep === index ? "active" : ""}
                    onClick={() => {
                      setActiveStep(index);
                      setFold(step.amount);
                    }}
                  >
                    <span>0{index + 1}</span>
                    <b>{step.label}</b>
                    <small>{step.detail}</small>
                  </button>
                ))}
              </div>
              <div className="origami-fold-control">
                <span>Flat</span>
                <input
                  aria-label="Fold progress"
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={(event) => {
                    setPlaying(false);
                    setFold(Number(event.target.value));
                  }}
                />
                <span>Formed</span>
                <output>{Math.round(progress)}%</output>
              </div>
            </div>
          </section>
          <aside className="origami-lab-notes">
            <div className="origami-notes-heading">
              <BookOpen size={16} />
              <span>FIELD NOTES</span>
            </div>
            <h3>{project.steps[activeStep].label}</h3>
            <p>{project.steps[activeStep].detail}</p>
            <div className="origami-note-rule" />
            <h4>What changes now</h4>
            <p>
              At {Math.round(progress)}% fold, the{" "}
              <b>
                {
                  project.sections.find((item) => item.id === selectedSection)
                    ?.label
                }
              </b>{" "}
              section is connected to the motion. Select another section to move
              the focus without resetting the study.
            </p>
            <div className="origami-note-stat">
              <span>FACETS</span>
              <b>{project.rows * project.columns * 2}</b>
            </div>
            <div className="origami-note-stat">
              <span>FOLD FAMILY</span>
              <b>{project.familyLabel}</b>
            </div>
            <a
              href="https://github.com/edemaine/fold/blob/main/doc/spec.md"
              target="_blank"
              rel="noreferrer"
            >
              FOLD interchange reference <ArrowRight size={14} />
            </a>
          </aside>
        </main>
      )}
    </div>
  );
}
