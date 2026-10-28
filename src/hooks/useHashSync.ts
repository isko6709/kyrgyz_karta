import { useEffect, useRef } from 'react';
import { events } from '../lib/data';
import { useStore } from '../store';

/**
 * Синхронизирует состояние приложения с URL-хэшем (#event=ID и #year=YYYY):
 * - Чтение при инициализации
 * - Плавное обновление через history.replaceState при смене года или события
 * - Реакция на hashchange (кнопки «Назад / Вперёд» в браузере)
 */
export function useHashSync() {
  const { year, selectedEventId, setYear, selectEvent } = useStore();
  const isInitializedRef = useRef(false);

  // 1. Чтение при начальной загрузке
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const eventParam = params.get('event');
    const yearParam = params.get('year');

    if (yearParam) {
      const parsedYear = parseInt(yearParam, 10);
      if (!isNaN(parsedYear)) {
        setYear(parsedYear);
      }
    }

    if (eventParam) {
      const eventId = parseInt(eventParam, 10);
      const ev = events.find((e) => e.id === eventId);
      if (ev) {
        selectEvent(ev.id);
      }
    }
  }, [selectEvent, setYear]);

  // 2. Обновление хэша при изменении выбранного года или события
  useEffect(() => {
    if (!isInitializedRef.current) return;

    const targetHash =
      selectedEventId !== null ? `year=${year}&event=${selectedEventId}` : `year=${year}`;

    const currentHash = window.location.hash.replace(/^#/, '');
    if (currentHash !== targetHash) {
      history.replaceState(null, '', `#${targetHash}`);
    }
  }, [year, selectedEventId]);

  // 3. Поддержка браузерной навигации hashchange
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#/, '');
      if (!hash) return;

      const params = new URLSearchParams(hash);
      const eventParam = params.get('event');
      const yearParam = params.get('year');

      if (yearParam) {
        const parsedYear = parseInt(yearParam, 10);
        if (!isNaN(parsedYear)) {
          setYear(parsedYear);
        }
      }

      if (eventParam) {
        const eventId = parseInt(eventParam, 10);
        const ev = events.find((e) => e.id === eventId);
        if (ev) {
          selectEvent(ev.id);
        }
      } else if (!eventParam && selectedEventId !== null) {
        selectEvent(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [selectEvent, setYear]);
}
