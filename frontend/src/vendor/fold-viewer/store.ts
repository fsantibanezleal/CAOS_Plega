import { getStepDuration } from './geometry';
import { loadFoldDocument, toViewerError } from './validation';
import type {
  FoldViewerCallbacks,
  FoldViewerProviderProps,
  FoldViewerSnapshot,
  PlaybackRate,
  ViewerPreferences,
  ViewMode,
} from './types';

const defaultPreferences: ViewerPreferences = {
  highContrast: false,
  plainBackground: false,
  reducedMotion: false,
  tactileDetails: false,
};

export class FoldViewerStore {
  private listeners = new Set<() => void>();
  private abort?: AbortController;
  private frame = 0;
  private previousTime = 0;
  private autoAdvance = false;
  private callbacks: FoldViewerCallbacks = {};
  private controlledStep = false;
  private controlledPlaying = false;
  private snapshot: FoldViewerSnapshot = {
    status: 'idle',
    document: null,
    error: null,
    stepIndex: 0,
    step: null,
    progress: 0,
    playing: false,
    playbackRate: 1,
    viewMode: 'animation',
    preferences: defaultPreferences,
    canRenderAnimation: false,
    diagnostic: null,
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): FoldViewerSnapshot => this.snapshot;
  getServerSnapshot = (): FoldViewerSnapshot => this.snapshot;

  configure(props: Omit<FoldViewerProviderProps, 'children' | 'source'>): void {
    this.autoAdvance = props.autoAdvance ?? false;
    this.callbacks = props;
    this.controlledStep = props.stepId !== undefined;
    this.controlledPlaying = props.playing !== undefined;
    const mergedPreferences = { ...defaultPreferences, ...props.preferences };
    const preferences = (
      Object.keys(mergedPreferences) as Array<keyof ViewerPreferences>
    ).every((key) => mergedPreferences[key] === this.snapshot.preferences[key])
      ? this.snapshot.preferences
      : mergedPreferences;
    const patch: Partial<FoldViewerSnapshot> = {
      playbackRate: props.playbackRate ?? this.snapshot.playbackRate,
      viewMode: props.viewMode ?? this.snapshot.viewMode,
      locale: props.locale,
      preferences,
    };
    if (props.playing !== undefined) patch.playing = props.playing;
    if (props.stepId && this.snapshot.document) {
      const index = this.snapshot.document.instructions.steps.findIndex(
        (step) => step.id === props.stepId,
      );
      if (index >= 0)
        Object.assign(patch, {
          stepIndex: index,
          step: this.snapshot.document.instructions.steps[index],
        });
    }
    this.update(patch);
    this.manageAnimation();
  }

  async load(
    source: FoldViewerProviderProps['source'],
    defaultStepId?: string,
    defaultPlaying?: boolean,
  ): Promise<void> {
    this.abort?.abort();
    this.abort = new AbortController();
    const active = this.abort;
    this.stopAnimation();
    this.update({
      status: 'loading',
      document: null,
      error: null,
      diagnostic: null,
      progress: 0,
      playing: false,
    });
    try {
      const document = await loadFoldDocument(source, active.signal);
      if (active.signal.aborted) return;
      const requested = defaultStepId
        ? document.instructions.steps.findIndex(
            (step) => step.id === defaultStepId,
          )
        : 0;
      const stepIndex = Math.max(0, requested);
      const authoredStep = document.instructions.steps[stepIndex] ?? null;
      const requiredTextExtension = document.extensions.find((extension) =>
        extension.requiredFor.includes('text'),
      );
      const requiredPlaybackExtension = document.extensions.find((extension) =>
        extension.requiredFor.includes('playback'),
      );
      const step = requiredTextExtension ? null : authoredStep;
      const hasMotion = Boolean(
        document.geometry &&
        authoredStep?.animation === 'resolved' &&
        authoredStep.runs.length,
      );
      const hasLocalLayers = authoredStep?.runs.some(
        (run) =>
          document.geometry?.operations.find(
            (operation) => operation.id === run.operation,
          )?.layers.length,
      );
      const diagnostic = requiredTextExtension
        ? `Instructions require unsupported extension ${requiredTextExtension.id}@${requiredTextExtension.version}.`
        : requiredPlaybackExtension
          ? `Playback requires unsupported extension ${requiredPlaybackExtension.id}@${requiredPlaybackExtension.version}.`
          : hasLocalLayers
            ? 'This step contains local layer relations; V0.1 renders only conservative layer hints.'
            : document.status === 'planned'
              ? 'This document contains planning metadata only.'
              : document.status === 'instructions'
                ? 'This document contains instructions without resolved animation.'
                : null;
      this.snapshot = {
        ...this.snapshot,
        status: 'ready',
        document,
        stepIndex,
        step,
        progress: 0,
        playing: defaultPlaying ?? false,
        canRenderAnimation: hasMotion && !requiredPlaybackExtension,
        diagnostic,
      };
      this.emit();
      this.callbacks.onLoad?.(document);
      this.manageAnimation();
    } catch (error) {
      if (active.signal.aborted) return;
      const viewerError = toViewerError(error);
      this.update({ status: 'error', error: viewerError, playing: false });
      this.callbacks.onError?.(viewerError);
    }
  }

  destroy(): void {
    this.abort?.abort();
    this.stopAnimation();
    this.listeners.clear();
  }

  play = (): void => {
    if (!this.snapshot.step || !this.snapshot.canRenderAnimation) return;
    if (this.snapshot.preferences.reducedMotion) {
      this.seek(1);
      return;
    }
    if (this.snapshot.progress >= 1) this.seek(0);
    this.setPlaying(true);
  };
  pause = (): void => this.setPlaying(false);
  togglePlayback = (): void =>
    this.snapshot.playing ? this.pause() : this.play();
  seek = (progress: number): void => {
    const next = Math.min(1, Math.max(0, progress));
    this.update({ progress: next });
    this.callbacks.onProgressChange?.(next);
  };
  next = (): void => this.selectIndex(this.snapshot.stepIndex + 1);
  previous = (): void => this.selectIndex(this.snapshot.stepIndex - 1);
  reset = (): void => {
    this.pause();
    this.seek(0);
  };
  setStep = (stepId: string): void => {
    const index =
      this.snapshot.document?.instructions.steps.findIndex(
        (step) => step.id === stepId,
      ) ?? -1;
    if (index >= 0) this.selectIndex(index);
  };
  setPlaybackRate = (playbackRate: PlaybackRate): void =>
    this.update({ playbackRate });
  setViewMode = (viewMode: ViewMode): void => this.update({ viewMode });
  setPreferences = (preferences: Partial<ViewerPreferences>): void => {
    this.update({
      preferences: { ...this.snapshot.preferences, ...preferences },
    });
    if (preferences.reducedMotion && this.snapshot.playing) this.pause();
  };

  private selectIndex(index: number): void {
    const document = this.snapshot.document;
    if (!document) return;
    const bounded = Math.min(
      document.instructions.steps.length - 1,
      Math.max(0, index),
    );
    const authoredStep = document.instructions.steps[bounded];
    const requiredTextExtension = document.extensions.find((extension) =>
      extension.requiredFor.includes('text'),
    );
    const requiredPlaybackExtension = document.extensions.find((extension) =>
      extension.requiredFor.includes('playback'),
    );
    const step = requiredTextExtension ? null : authoredStep;
    const canRenderAnimation = Boolean(
      document.geometry &&
      authoredStep.animation === 'resolved' &&
      authoredStep.runs.length &&
      !requiredPlaybackExtension,
    );
    const hasLocalLayers = authoredStep.runs.some(
      (run) =>
        document.geometry?.operations.find(
          (operation) => operation.id === run.operation,
        )?.layers.length,
    );
    const diagnostic = requiredTextExtension
      ? `Instructions require unsupported extension ${requiredTextExtension.id}@${requiredTextExtension.version}.`
      : requiredPlaybackExtension
        ? `Playback requires unsupported extension ${requiredPlaybackExtension.id}@${requiredPlaybackExtension.version}.`
        : hasLocalLayers
          ? 'This step contains local layer relations; V0.1 renders only conservative layer hints.'
          : null;
    if (!this.controlledStep)
      this.update({
        stepIndex: bounded,
        step,
        progress: 0,
        playing: false,
        canRenderAnimation,
        diagnostic,
      });
    this.callbacks.onStepChange?.(authoredStep, bounded);
  }

  private setPlaying(playing: boolean): void {
    if (!this.controlledPlaying) this.update({ playing });
    this.callbacks.onPlayingChange?.(playing);
    this.manageAnimation();
  }

  private manageAnimation(): void {
    if (
      this.snapshot.playing &&
      !this.frame &&
      typeof requestAnimationFrame !== 'undefined'
    ) {
      this.previousTime = 0;
      this.frame = requestAnimationFrame(this.tick);
    } else if (!this.snapshot.playing) this.stopAnimation();
  }

  private tick = (time: number): void => {
    this.frame = 0;
    if (!this.snapshot.playing || !this.snapshot.document) return;
    if (!this.previousTime) this.previousTime = time;
    const elapsed = time - this.previousTime;
    this.previousTime = time;
    const duration = getStepDuration(
      this.snapshot.document,
      this.snapshot.stepIndex,
    );
    const next =
      this.snapshot.progress +
      (elapsed * this.snapshot.playbackRate) / duration;
    if (next >= 1) {
      this.seek(1);
      this.setPlaying(false);
      if (
        this.autoAdvance &&
        this.snapshot.stepIndex <
          this.snapshot.document.instructions.steps.length - 1
      )
        this.next();
      return;
    }
    this.seek(next);
    this.frame = requestAnimationFrame(this.tick);
  };

  private stopAnimation(): void {
    if (this.frame && typeof cancelAnimationFrame !== 'undefined')
      cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.previousTime = 0;
  }

  private update(patch: Partial<FoldViewerSnapshot>): void {
    const next = { ...this.snapshot, ...patch };
    if (
      Object.keys(patch).every((key) =>
        Object.is(
          this.snapshot[key as keyof FoldViewerSnapshot],
          next[key as keyof FoldViewerSnapshot],
        ),
      )
    )
      return;
    this.snapshot = next;
    this.emit();
  }
  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
