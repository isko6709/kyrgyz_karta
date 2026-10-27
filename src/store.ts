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
  highlightedLayerId: string | null;
  targetFlyTo: FlyToOptions | null;

  setYear: (year: number) => void;
  selectEvent: (id: number | null) => void;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  setSearch: (search: string) => void;
  setActiveEraId: (eraId: string) => void;
  toggleModernBorders: () => void;
  setShowModernBorders: (show: boolean) => void;
  setHighlightedLayerId: (id: string | null) => void;
  flyTo: (center: [number, number], zoom?: number, duration?: number) => void;
}

const INITIAL_YEAR = 840;
const initialEra = eraForYear(INITIAL_YEAR);

export const useStore = create<AppState>((set) => ({
  year: INITIAL_YEAR,
  selectedEventId: null,
  playing: false,
  activeEraId: initialEra ? initialEra.id : 'turkic',
  search: '',
  showModernBorders: false,
  highlightedLayerId: null,
  targetFlyTo: null,

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

  selectEvent: (id: number | null) => {
    if (id === null) {
      set({ selectedEventId: null });
      return;
    }
    const event = events.find((e) => e.id === id);
    if (event) {
      const era = eraForYear(event.year);
      set({
        selectedEventId: id,
        year: event.year,
        activeEraId: event.era || (era ? era.id : 'turkic'),
      });
    } else {
      set({ selectedEventId: id });
    }
  },

  togglePlay: () => set((state) => ({ playing: !state.playing })),
  setPlaying: (playing: boolean) => set({ playing }),
  setSearch: (search: string) => set({ search }),
  setActiveEraId: (activeEraId: string) => set({ activeEraId }),
  toggleModernBorders: () =>
    set((state) => ({ showModernBorders: !state.showModernBorders })),
  setShowModernBorders: (showModernBorders: boolean) =>
    set({ showModernBorders }),
  setHighlightedLayerId: (highlightedLayerId: string | null) =>
    set({ highlightedLayerId }),
  flyTo: (center: [number, number], zoom = 7, duration = 1400) =>
    set({ targetFlyTo: { center, zoom, duration } }),
}));

export const useAppStore = useStore;
