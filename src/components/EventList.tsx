import { useMemo, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { events, eraForYear } from '../lib/data';
import { useStore } from '../store';
import { EventCard } from './EventCard';
import type { HistEvent } from '../types';

export function EventList() {
  const { year, selectedEventId, selectEvent, activeEraId } = useStore();
  const listRef = useRef<HTMLDivElement>(null);
  const mobileListRef = useRef<HTMLDivElement>(null);

  // Состояние мобильного bottom sheet: 'peek' (свернуто) | 'mid' (половина) | 'full' (полный экран)
  const [sheetMode, setSheetMode] = useState<'peek' | 'mid' | 'full'>('peek');

  const activeEra = eraForYear(year);

  // Выбираем события, ближайшие к текущему году, с приоритетом текущей эпохи
  const sortedEvents = useMemo(() => {
    const list = [...events];

    const getDistance = (ev: HistEvent): number => {
      if (ev.yearEnd !== undefined) {
        if (ev.year <= year && year <= ev.yearEnd) return 0;
        return Math.min(Math.abs(ev.year - year), Math.abs(ev.yearEnd - year));
      }
      return Math.abs(ev.year - year);
    };

    list.sort((a, b) => {
      if (a.id === selectedEventId) return -1;
      if (b.id === selectedEventId) return 1;

      const distA = getDistance(a);
      const distB = getDistance(b);

      if (distA === 0 && distB !== 0) return -1;
      if (distB === 0 && distA !== 0) return 1;

      const inEraA = a.era === activeEraId;
      const inEraB = b.era === activeEraId;
      if (inEraA && !inEraB) return -1;
      if (!inEraA && inEraB) return 1;

      if (distA !== distB) return distA - distB;
      return a.year - b.year;
    });

    const result = list.slice(0, 14);

    if (selectedEventId !== null && !result.some((e) => e.id === selectedEventId)) {
      const selected = events.find((e) => e.id === selectedEventId);
      if (selected) result.unshift(selected);
    }

    return result;
  }, [year, selectedEventId, activeEraId]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [selectedEventId]
  );

  // При выборе события на мобильном автоматически открываем режим mid
  useEffect(() => {
    if (selectedEventId !== null) {
      queueMicrotask(() => {
        setSheetMode((prev) => (prev === 'peek' ? 'mid' : prev));
      });
      if (listRef.current) listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      if (mobileListRef.current) mobileListRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedEventId]);

  const exactYearCount = useMemo(
    () =>
      events.filter((e) =>
        e.yearEnd !== undefined
          ? e.year <= year && year <= e.yearEnd
          : e.year === year
      ).length,
    [year]
  );

  // Высота мобильного bottom sheet в зависимости от положения
  const sheetHeightClass = {
    peek: 'h-16',
    mid: 'h-[50vh]',
    full: 'h-[85vh]',
  }[sheetMode];

  return (
    <>
      {/* 1. ДЕСКТОПНАЯ ПАНЕЛЬ (правая колонка) */}
      <section className="hidden md:flex absolute right-4 top-14 bottom-32 w-80 md:w-96 z-10 flex-col pointer-events-none">
        <div className="pointer-events-auto flex-1 flex flex-col bg-white/95 backdrop-blur-md rounded-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-black/5 p-4 overflow-hidden">
          {/* Шапка колонки */}
          <header className="flex items-center justify-between border-b border-black/10 pb-3">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#6B665E] font-semibold">
                Хроника событий
              </span>
              <h2 className="text-base font-serif font-bold text-[#2B2A28] leading-tight">
                {exactYearCount > 0
                  ? `${exactYearCount} ${exactYearCount === 1 ? 'событие' : 'события'} (${year < 0 ? `${Math.abs(year)} до н.э.` : `${year} г.`})`
                  : activeEra?.title ?? 'Все эпохи'}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {selectedEventId !== null && (
                <button
                  onClick={() => selectEvent(null)}
                  className="cursor-pointer text-[11px] text-[#6B665E] hover:text-[#2B2A28] px-2 py-0.5 rounded bg-black/5 hover:bg-black/10"
                  title="Сбросить выбор события"
                >
                  Сбросить
                </button>
              )}
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-black/5 text-[#2B2A28]">
                {sortedEvents.length}
              </span>
            </div>
          </header>

          {/* Прокручиваемый список карточек событий */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto mt-3 pr-1 space-y-3"
            tabIndex={0}
            aria-label="Список исторических событий"
          >
            <AnimatePresence initial={false}>
              {sortedEvents.map((ev) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  isSelected={selectedEventId === ev.id}
                  onSelect={(id) => selectEvent(selectedEventId === id ? null : id)}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* 2. МОБИЛЬНАЯ ВЕРСИЯ: BOTTOM SHEET (3 положения: peek, mid, full) */}
      <section
        className="flex md:hidden fixed inset-x-0 bottom-0 z-30 pointer-events-none flex-col justify-end"
        aria-label="События (мобильная панель)"
      >
        <div
          className={`pointer-events-auto w-full bg-white/98 backdrop-blur-xl rounded-t-[20px] shadow-[0_-8px_32px_rgba(0,0,0,0.18)] border-t border-black/10 flex flex-col transition-all duration-300 ease-out ${sheetHeightClass}`}
        >
          {/* Ручка перетаскивания и кнопка изменения положения */}
          <div
            onClick={() => {
              // Циклическое переключение положений по тапу на шапку/ручку
              setSheetMode((cur) =>
                cur === 'peek' ? 'mid' : cur === 'mid' ? 'full' : 'peek'
              );
            }}
            className="w-full pt-2 pb-1.5 flex flex-col items-center cursor-pointer select-none border-b border-black/5 shrink-0"
            role="button"
            aria-label="Изменить размер панели событий"
          >
            <div className="w-12 h-1 rounded-full bg-black/25 mb-1.5" />

            {/* Компактная полоса заголовка */}
            <div className="w-full px-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate">
                <span className="font-serif font-bold text-[#2B2A28] truncate">
                  {selectedEvent ? selectedEvent.title : `Хроника (${year < 0 ? `${Math.abs(year)} до н.э.` : `${year} г.`})`}
                </span>
                {selectedEvent && (
                  <span className="text-[10px] font-medium text-[#4F8A8B] shrink-0">
                    {selectedEvent.date}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSheetMode((cur) =>
                      cur === 'full' ? 'mid' : cur === 'mid' ? 'full' : 'mid'
                    );
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-black/5 text-[#2B2A28]"
                >
                  {sheetMode === 'full' ? 'Свернуть' : 'Развернуть'}
                </button>
                {sheetMode !== 'peek' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSheetMode('peek');
                    }}
                    className="p-1 rounded text-xs text-[#6B665E] hover:text-[#2B2A28]"
                    title="Скрыть вниз"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Содержимое карточек при положениях mid и full */}
          {sheetMode !== 'peek' && (
            <div
              ref={mobileListRef}
              className="flex-1 overflow-y-auto p-3 space-y-2.5"
            >
              <AnimatePresence initial={false}>
                {sortedEvents.map((ev) => (
                  <EventCard
                    key={`mob-card-${ev.id}`}
                    event={ev}
                    isSelected={selectedEventId === ev.id}
                    onSelect={(id) => selectEvent(selectedEventId === id ? null : id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
