import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type DetailsHTMLAttributes,
  type HTMLAttributes,
} from 'react';
import { useFoldViewer } from './context';
import { localize } from './localization';
import { FoldThreeRenderer } from './renderer';
import type { PlaybackRate, ViewMode } from './types';

function Icon({
  name,
}: {
  name: 'play' | 'pause' | 'previous' | 'next' | 'reset' | 'settings';
}) {
  const paths = {
    play: <path d="m8 5 11 7-11 7Z" />,
    pause: (
      <>
        <path d="M8 5v14" />
        <path d="M16 5v14" />
      </>
    ),
    previous: (
      <>
        <path d="m15 18-6-6 6-6" />
        <path d="M5 5v14" />
      </>
    ),
    next: (
      <>
        <path d="m9 18 6-6-6-6" />
        <path d="M19 5v14" />
      </>
    ),
    reset: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export function FoldViewport({
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const {
    status,
    error,
    document,
    stepIndex,
    step,
    progress,
    preferences,
    viewMode,
    canRenderAnimation,
    diagnostic,
    locale,
  } = useFoldViewer();
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<FoldThreeRenderer | null>(null);
  const [webglError, setWebglError] = useState(false);
  const tactile =
    document && step
      ? [
          step.tactile?.orientation,
          ...(step.tactile?.locate ?? []),
          ...(step.tactile?.check ?? []),
          ...(step.tactile?.recovery ?? []),
        ]
          .filter(Boolean)
          .map((item) => localize(item, locale, document.defaultLocale))
      : [];

  useEffect(() => {
    if (
      !canvas.current ||
      status !== 'ready' ||
      !document ||
      viewMode === 'text' ||
      !canRenderAnimation
    )
      return;
    try {
      renderer.current = new FoldThreeRenderer(canvas.current);
    } catch {
      setWebglError(true);
    }
    return () => {
      renderer.current?.dispose();
      renderer.current = null;
    };
  }, [document, status, viewMode, canRenderAnimation]);

  useEffect(() => {
    if (document)
      renderer.current?.update(document, stepIndex, progress, preferences);
  }, [document, stepIndex, progress, preferences]);

  const fallback = viewMode === 'text' || !canRenderAnimation || webglError;
  return (
    <div className={`fold-viewport ${className}`} {...props}>
      {status === 'loading' && (
        <div className="fold-status" role="status">
          <span className="fold-spinner" />
          Loading fold…
        </div>
      )}
      {status === 'error' && (
        <div className="fold-status fold-status--error" role="alert">
          <strong>Unable to open this fold</strong>
          <span>{error?.message}</span>
        </div>
      )}
      {status === 'ready' && fallback && (
        <div
          className="fold-text-view"
          role="region"
          aria-label="Text instruction"
        >
          <span className="fold-eyebrow">Text view</span>
          <h3>
            {localize(step?.title, locale, document?.defaultLocale ?? 'en')}
          </h3>
          <p>{localize(step?.body, locale, document?.defaultLocale ?? 'en')}</p>
          {preferences.tactileDetails && tactile.length > 0 && (
            <div className="fold-tactile">
              <strong>Tactile details</strong>
              {tactile.map((text, index) => (
                <p key={index}>{text}</p>
              ))}
            </div>
          )}
          {(webglError || diagnostic) && (
            <p className="fold-diagnostic">
              {webglError
                ? 'WebGL is unavailable. The instruction remains available as text.'
                : diagnostic}
            </p>
          )}
        </div>
      )}
      <canvas
        ref={canvas}
        hidden={fallback || status !== 'ready'}
        tabIndex={0}
        aria-label="Interactive fold model. Drag or use arrow keys to rotate, scroll to zoom, and press R to reset the view."
      />
      {!fallback && status === 'ready' && (
        <button
          className="fold-view-reset"
          type="button"
          onClick={() => renderer.current?.resetView()}
          aria-label="Reset 3D view"
        >
          <Icon name="reset" />
        </button>
      )}
      {!fallback && diagnostic && (
        <div className="fold-render-note" role="note">
          {diagnostic}
        </div>
      )}
    </div>
  );
}

export function FoldInstructions({
  className = '',
  ...props
}: HTMLAttributes<HTMLElement>) {
  const { document, step, stepIndex, locale, preferences, viewMode } =
    useFoldViewer();
  if (!document || !step || viewMode === 'text') return null;
  const tactile = [
    step.tactile?.orientation,
    ...(step.tactile?.locate ?? []),
    ...(step.tactile?.check ?? []),
    ...(step.tactile?.recovery ?? []),
  ]
    .filter(Boolean)
    .map((item) => localize(item, locale, document.defaultLocale));
  return (
    <article className={`fold-instructions ${className}`} {...props}>
      <div className="fold-step-meta">
        <span>Step {stepIndex + 1}</span>
        <span>{document.instructions.steps.length} total</span>
      </div>
      <h2>{localize(step.title, locale, document.defaultLocale)}</h2>
      <p>{localize(step.body, locale, document.defaultLocale)}</p>
      {preferences.tactileDetails && tactile.length > 0 && (
        <div className="fold-tactile">
          <strong>Tactile details</strong>
          {tactile.map((text, index) => (
            <p key={index}>{text}</p>
          ))}
        </div>
      )}
    </article>
  );
}

function ModeToggle({
  mode,
  setMode,
}: {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
}) {
  return (
    <div className="fold-segmented" role="group" aria-label="Viewer mode">
      {(['animation', 'text'] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => setMode(value)}
        >
          {value === 'animation' ? 'Animation' : 'Text'}
        </button>
      ))}
    </div>
  );
}

export function FoldSettings({
  className = '',
  ...props
}: DetailsHTMLAttributes<HTMLDetailsElement>) {
  const { preferences, setPreferences } = useFoldViewer();
  const options: Array<[keyof typeof preferences, string]> = [
    ['highContrast', 'High contrast paper'],
    ['plainBackground', 'Plain background'],
    ['reducedMotion', 'Reduce motion'],
    ['tactileDetails', 'Show tactile details'],
  ];
  return (
    <details className={`fold-settings ${className}`} {...props}>
      <summary aria-label="Viewer settings">
        <Icon name="settings" />
        <span>Settings</span>
      </summary>
      <div className="fold-settings-panel">
        <strong>Viewer settings</strong>
        {options.map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>
            <input
              type="checkbox"
              checked={preferences[key]}
              onChange={(event) =>
                setPreferences({ [key]: event.target.checked })
              }
            />
          </label>
        ))}
      </div>
    </details>
  );
}

export function FoldControls({
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const {
    document,
    stepIndex,
    progress,
    playing,
    playbackRate,
    viewMode,
    canRenderAnimation,
    togglePlayback,
    seek,
    previous,
    next,
    setPlaybackRate,
    setViewMode,
    reset,
  } = useFoldViewer();
  const rangeId = useId();
  const last = (document?.instructions.steps.length ?? 1) - 1;
  return (
    <div className={`fold-controls ${className}`} {...props}>
      <button
        className="fold-icon-button"
        type="button"
        onClick={previous}
        disabled={stepIndex <= 0}
        aria-label="Previous step"
      >
        <Icon name="previous" />
      </button>
      <button
        className="fold-play-button"
        type="button"
        onClick={togglePlayback}
        disabled={!canRenderAnimation}
        aria-label={
          playing
            ? 'Pause animation'
            : progress >= 1
              ? 'Replay animation'
              : 'Play animation'
        }
      >
        <Icon name={playing ? 'pause' : 'play'} />
        <span>{playing ? 'Pause' : progress >= 1 ? 'Replay' : 'Play'}</span>
      </button>
      <button
        className="fold-icon-button"
        type="button"
        onClick={next}
        disabled={stepIndex >= last}
        aria-label="Next step"
      >
        <Icon name="next" />
      </button>
      <label className="fold-scrubber" htmlFor={rangeId}>
        <span className="fold-sr-only">Step progress</span>
        <input
          id={rangeId}
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={progress}
          onChange={(event) => seek(Number(event.target.value))}
          disabled={!canRenderAnimation}
          style={
            { '--fold-progress': `${progress * 100}%` } as React.CSSProperties
          }
        />
      </label>
      <label className="fold-speed">
        <span className="fold-sr-only">Playback speed</span>
        <select
          value={playbackRate}
          onChange={(event) =>
            setPlaybackRate(Number(event.target.value) as PlaybackRate)
          }
        >
          {[0.5, 1, 1.5, 2].map((rate) => (
            <option key={rate} value={rate}>
              {rate}×
            </option>
          ))}
        </select>
      </label>
      <ModeToggle mode={viewMode} setMode={setViewMode} />
      <button
        className="fold-icon-button fold-reset-button"
        type="button"
        onClick={reset}
        aria-label="Reset step"
      >
        <Icon name="reset" />
      </button>
      <FoldSettings />
    </div>
  );
}

export function FoldAnnouncer() {
  const { document, step, stepIndex, locale } = useFoldViewer();
  const message = useMemo(
    () =>
      document && step
        ? `Step ${stepIndex + 1}: ${localize(step.title, locale, document.defaultLocale)}`
        : '',
    [document, step, stepIndex, locale],
  );
  return (
    <div className="fold-sr-only" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
