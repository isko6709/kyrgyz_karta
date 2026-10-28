import { create } from 'zustand';
import { events, eraForYear } from './lib/data';

export interface FlyToOptions {
  center: [number, number]; // [lng, lat]
  zoom?: number;
  duration?: number;
}

export interface AppState {
  year: number;
  selectedEventId: number | null;
  playing: boolean;
  activeEraId: string;
  search: string;
  showModernBorders: boolean;
  showNeighbors: boolean;
  highlightedLayerId: string | null;
  targetFlyTo: FlyToOptions | null;
  mobileSheetOpen: boolean;
  debugMode: boolean;
  debugSelectedLayerId: string | null;
  debugForcedLayerIds: string[];
  showAboutModal: boolean;

  setYear: (year: number) => void;
  selectEvent: (id: number | null, shouldChangeYear?: boolean) => void;
  setMobileSheetOpen: (open: boolean) => void;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  setSearch: (search: string) => void;
  setActiveEraId: (eraId: string) => void;
  toggleModernBorders: () => void;
  setShowModernBorders: (show: boolean) => void;
  toggleNeighbors: () => void;
  setShowNeighbors: (show: boolean) => void;
  setHighlightedLayerId: (id: string | null) => void;
  setDebugMode: (debugMode: boolean) => void;
  setDebugSelectedLayerId: (id: string | null) => void;
  toggleDebugForcedLayer: (id: string) => void;
  setDebugForcedLayers: (ids: string[]) => void;
  setShowAboutModal: (show: boolean) => void;
  flyTo: (center: [number, number], zoom?: number, duration?: number) => void;
}

const INITIAL_YEAR = 840;
const initialEra = eraForYear(INITIAL_YEAR);

export const useStore = create<AppState>((set, get) => ({
  year: INITIAL_YEAR,
  selectedEventId: null,
  playing: false,
  activeEraId: initialEra ? initialEra.id : 'turkic',
  search: '',
  showModernBorders: false,
  showNeighbors: true,
  highlightedLayerId: null,
  targetFlyTo: null,
  mobileSheetOpen: false,
  debugMode:
    typeof window !== 'undefined' &&
    (window.location.search.includes('debug=layers') ||
      window.location.hash.includes('debug=layers')),
  debugSelectedLayerId: null,
  debugForcedLayerIds: [],
  showAboutModal:
    typeof window !== 'undefined' &&
    (window.location.search.includes('about') ||
      window.location.hash.includes('about')),

  setYear: (year: number) => {
    const era = eraForYear(year);
    set((state) => {
      // Проверяем, остаётся ли выбранное событие актуальным в новом году
      let nextSelected = state.selectedEventId;
      if (nextSelected !== null) {
        const ev = events.find((e) => e.id === nextSelected);
        if (ev) {
          const inRange =
            ev.yearEnd !== undefined
              ? ev.year <= year && year <= ev.yearEnd
              : ev.year === year;
          if (!inRange) nextSelected = null;
        } else {
          nextSelected = null;
        }
      }

      return {
        year,
        activeEraId: era ? era.id : state.activeEraId,
        selectedEventId: nextSelected,
      };
    });
  },

  selectEvent: (id: number | null, shouldChangeYear = false) => {
    if (id === null) {
      set({ selectedEventId: null, mobileSheetOpen: false });
      return;
    }
    const event = events.find((e) => e.id === id);
    if (event) {
      const currentYear = get().year;
      const isWithinCurrentYear =
        event.yearEnd !== undefined
          ? event.year <= currentYear && currentYear <= event.yearEnd
          : event.year === currentYear;

      // Меняем год и эпоху только если это явно запрошено (например, поиск по истории).
      // При клике по точкам на карте текущий год и эпоха НЕ СБРАСЫВАЮТСЯ!
      if (shouldChangeYear && !isWithinCurrentYear) {
        const era = eraForYear(event.year);
        set({
          selectedEventId: id,
          mobileSheetOpen: true,
          year: event.year,
          activeEraId: event.era || (era ? era.id : 'turkic'),
        });
      } else {
        set({
          selectedEventId: id,
          mobileSheetOpen: true,
        });
      }
    } else {
      set({ selectedEventId: id, mobileSheetOpen: true });
    }
  },

  setMobileSheetOpen: (mobileSheetOpen: boolean) => set({ mobileSheetOpen }),

  togglePlay: () => set((state) => ({ playing: !state.playing })),
  setPlaying: (playing: boolean) => set({ playing }),
  setSearch: (search: string) => set({ search }),
  setActiveEraId: (activeEraId: string) => set({ activeEraId }),
  toggleModernBorders: () =>
    set((state) => ({ showModernBorders: !state.showModernBorders })),
  setShowModernBorders: (showModernBorders: boolean) =>
    set({ showModernBorders }),
  toggleNeighbors: () =>
    set((state) => ({ showNeighbors: !state.showNeighbors })),
  setShowNeighbors: (showNeighbors: boolean) =>
    set({ showNeighbors }),
  setHighlightedLayerId: (highlightedLayerId: string | null) =>
    set({ highlightedLayerId }),
  setDebugMode: (debugMode: boolean) => set({ debugMode }),
  setDebugSelectedLayerId: (debugSelectedLayerId: string | null) =>
    set({ debugSelectedLayerId }),
  toggleDebugForcedLayer: (id: string) =>
    set((state) => ({
      debugForcedLayerIds: state.debugForcedLayerIds.includes(id)
        ? state.debugForcedLayerIds.filter((x) => x !== id)
        : [...state.debugForcedLayerIds, id],
    })),
  setDebugForcedLayers: (debugForcedLayerIds: string[]) =>
    set({ debugForcedLayerIds }),
  setShowAboutModal: (showAboutModal: boolean) => set({ showAboutModal }),
  flyTo: (center: [number, number], zoom = 7, duration = 1400) =>
    set({ targetFlyTo: { center, zoom, duration } }),
}));

export const useAppStore = useStore;
