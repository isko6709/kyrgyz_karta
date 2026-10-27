import { useEffect, useMemo } from 'react';
import { events } from '../lib/data';
import { useStore } from '../store';

/**
 * Управляет режимом автовоспроизведения (Play):
 * - Автоматически переходит по событиям по хронологическому порядку
 * - 5 секунд на каждое событие (5000 мс)
 * - Пауза по клику на кнопку Play или любое интерактивное действие
 */
export function usePlayback() {
  const { playing, selectedEventId, selectEvent } = useStore();
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.year - b.year),
    []
  );

  useEffect(() => {
    if (!playing) return;

    const timer = setInterval(() => {
      let nextIndex = 0;
      const currentSelectedId = useStore.getState().selectedEventId;

      if (currentSelectedId !== null) {
        const curIdx = sortedEvents.findIndex((e) => e.id === currentSelectedId);
        if (curIdx !== -1) {
          nextIndex = (curIdx + 1) % sortedEvents.length;
        }
      } else {
        const currentYear = useStore.getState().year;
        const foundIdx = sortedEvents.findIndex((e) => e.year >= currentYear);
        nextIndex = foundIdx !== -1 ? foundIdx : 0;
      }

      const nextEv = sortedEvents[nextIndex];
      if (nextEv) {
        selectEvent(nextEv.id);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [playing, selectedEventId, selectEvent, sortedEvents]);
}
