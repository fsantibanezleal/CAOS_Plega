import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  type CSSProperties,
} from 'react';
import {
  FoldAnnouncer,
  FoldControls,
  FoldInstructions,
  FoldViewport,
} from './components';
import { FoldViewerProvider, useFoldViewer } from './context';
import type {
  FoldViewerHandle,
  FoldViewerProps,
  FoldViewerTheme,
} from './types';

const defaultTheme: FoldViewerTheme = {
  accent: '#1768e5',
  background: '#f3f6f9',
  panel: '#ffffff',
  foreground: '#172033',
  muted: '#697386',
  radius: '14px',
};

function ViewerLayout({
  forwardedRef,
}: {
  forwardedRef: React.ForwardedRef<FoldViewerHandle>;
}) {
  const viewer = useFoldViewer();
  useImperativeHandle(
    forwardedRef,
    () => ({
      getSnapshot: () => viewer,
      play: viewer.play,
      pause: viewer.pause,
      togglePlayback: viewer.togglePlayback,
      seek: viewer.seek,
      next: viewer.next,
      previous: viewer.previous,
      reset: viewer.reset,
      setStep: viewer.setStep,
      setPlaybackRate: viewer.setPlaybackRate,
      setViewMode: viewer.setViewMode,
      setPreferences: viewer.setPreferences,
    }),
    [viewer],
  );
  return (
    <>
      <div className="fold-stage">
        <FoldViewport />
        <FoldInstructions />
      </div>
      <FoldControls />
      <FoldAnnouncer />
    </>
  );
}

export const FoldViewer = forwardRef<FoldViewerHandle, FoldViewerProps>(
  function FoldViewer(
    {
      source,
      width = '100%',
      height = 520,
      locale,
      stepId,
      defaultStepId,
      playing,
      defaultPlaying,
      playbackRate,
      autoAdvance,
      viewMode,
      preferences,
      theme,
      onError,
      onLoad,
      onStepChange,
      onPlayingChange,
      onProgressChange,
      className = '',
      style,
      ...props
    },
    ref,
  ) {
    const variables = useMemo(() => {
      const colors = { ...defaultTheme, ...theme };
      return {
        '--fold-accent': colors.accent,
        '--fold-background': colors.background,
        '--fold-panel': colors.panel,
        '--fold-foreground': colors.foreground,
        '--fold-muted': colors.muted,
        '--fold-radius': colors.radius,
        width,
        height,
        ...style,
      } as CSSProperties;
    }, [theme, width, height, style]);
    return (
      <div className={`fold-viewer ${className}`} style={variables} {...props}>
        <FoldViewerProvider
          source={source}
          locale={locale}
          stepId={stepId}
          defaultStepId={defaultStepId}
          playing={playing}
          defaultPlaying={defaultPlaying}
          playbackRate={playbackRate}
          autoAdvance={autoAdvance}
          viewMode={viewMode}
          preferences={preferences}
          onError={onError}
          onLoad={onLoad}
          onStepChange={onStepChange}
          onPlayingChange={onPlayingChange}
          onProgressChange={onProgressChange}
        >
          <ViewerLayout forwardedRef={ref} />
        </FoldViewerProvider>
      </div>
    );
  },
);
