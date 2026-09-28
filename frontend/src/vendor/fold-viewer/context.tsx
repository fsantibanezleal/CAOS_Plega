import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import { FoldViewerStore } from './store';
import type {
  FoldViewerActions,
  FoldViewerProviderProps,
  FoldViewerSnapshot,
} from './types';

const ViewerContext = createContext<FoldViewerStore | null>(null);

export function FoldViewerProvider({
  source,
  children,
  ...options
}: FoldViewerProviderProps) {
  const storeRef = useRef<FoldViewerStore | null>(null);
  if (!storeRef.current) storeRef.current = new FoldViewerStore();
  const store = storeRef.current;

  useEffect(() => {
    store.configure(options);
  });
  useEffect(() => {
    void store.load(source, options.defaultStepId, options.defaultPlaying);
  }, [store, source]);
  useEffect(() => () => store.destroy(), [store]);

  return (
    <ViewerContext.Provider value={store}>{children}</ViewerContext.Provider>
  );
}

export function useFoldViewer(): FoldViewerSnapshot & FoldViewerActions {
  const store = useContext(ViewerContext);
  if (!store)
    throw new Error('useFoldViewer must be used inside FoldViewerProvider');
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  return {
    ...snapshot,
    play: store.play,
    pause: store.pause,
    togglePlayback: store.togglePlayback,
    seek: store.seek,
    next: store.next,
    previous: store.previous,
    reset: store.reset,
    setStep: store.setStep,
    setPlaybackRate: store.setPlaybackRate,
    setViewMode: store.setViewMode,
    setPreferences: store.setPreferences,
  };
}
