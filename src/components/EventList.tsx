import { useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { events, eraForYear, layers } from '../lib/data';
import { useStore } from '../store';
import { EventCard, CATEGORY_CONFIG, CERTAINTY_CONFIG } from './EventCard';
import type { HistEvent } from '../types';

export function EventList() {
  const {
    year,
    selectedEventId,
    selectEvent,
    mobileSheetOpen,
    setMobileSheetOpen,
    activeEraId,
    flyTo,
    highlightedLayerId,
    setHighlightedLayerId,
  } = useStore();

  const listRef = useRef<HTMLDivElement>(null);
  const mobileSheetRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

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

  const selectedLinkedLayer = useMemo(() => {
    if (!selectedEvent?.layer) return null;
    return layers.find((l) => l.id === selectedEvent.layer) ?? null;
  }, [selectedEvent]);

  // Закрытие карточки по нажатию Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedEventId !== null || mobileSheetOpen) {
          selectEvent(null);
          setMobileSheetOpen(false);
        }
      }
    },
    [selectedEventId, mobileSheetOpen, selectEvent, setMobileSheetOpen]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // При выборе события на десктопе прокручиваем список наверх
  useEffect(() => {
    if (selectedEventId !== null && listRef.current) {
      listRef.current.scrollTo({ top: 0, behavior: shouldReduceMotion ? 'auto' : 'smooth' });
    }
  }, [selectedEventId, shouldReduceMotion]);

  const exactYearCount = useMemo(
    () =>
      events.filter((e) =>
        e.yearEnd !== undefined
          ? e.year <= year && year <= e.yearEnd
          : e.year === year
      ).length,
    [year]
  );

  const isMobileSheetOpen = selectedEventId !== null || mobileSheetOpen;

  const handleFlyToEvent = (ev: HistEvent) => {
    flyTo([ev.coords[1], ev.coords[0]], ev.zoom ?? 7, shouldReduceMotion ? 0 : 1200);
  };

  return (
    <>
      {/* 1. ДЕСКТОПНАЯ ПАНЕЛЬ (правая колонка: >= 768px) */}
      <section
        className="hidden md:flex absolute right-4 top-14 bottom-32 w-80 md:w-96 z-10 flex-col pointer-events-none"
        aria-label="Хроника исторических событий"
      >
        <div className="pointer-events-auto flex-1 flex flex-col bg-white/95 backdrop-blur-md rounded-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-black/5 p-4 overflow-hidden">
          {/* Шапка колонки */}
          <header className="flex items-center justify-between border-b border-black/10 pb-3">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#5E5951] font-semibold">
                Хроника событий
              </span>
              <h2 className="text-base font-serif font-bold text-[#1F1E1D] leading-tight">
                {exactYearCount > 0
                  ? `${exactYearCount} ${exactYearCount === 1 ? 'событие' : 'события'} (${year < 0 ? `${Math.abs(year)} до н.э.` : `${year} г.`})`
                  : activeEra?.title ?? 'Все эпохи'}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {selectedEventId !== null && (
                <button
                  onClick={() => selectEvent(null)}
                  className="cursor-pointer text-xs text-[#5E5951] hover:text-[#1F1E1D] px-2.5 py-1 rounded-md bg-black/5 hover:bg-black/10 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B2A28]"
                  title="Сбросить выбор события (Esc)"
                  aria-label="Сбросить выбранное событие"
                >
                  Сбросить
                </button>
              )}
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-black/5 text-[#1F1E1D]">
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

      {/* 2. МОБИЛЬНАЯ ВЕРСИЯ: АДАПТИВНЫЙ BOTTOM SHEET (360–430px) */}
      <AnimatePresence>
        {isMobileSheetOpen && (
          <div
            className="flex md:hidden fixed inset-0 z-40 pointer-events-auto flex-col justify-end"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-sheet-title"
          >
            {/* Затемняющий оверлей для закрытия по тапу вне карточки */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
              onClick={() => {
                selectEvent(null);
                setMobileSheetOpen(false);
              }}
              className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
              aria-hidden="true"
            />

            {/* Панель Bottom Sheet */}
            <motion.div
              ref={mobileSheetRef}
              initial={{ y: shouldReduceMotion ? 0 : '100%' }}
              animate={{ y: 0 }}
              exit={{ y: shouldReduceMotion ? 0 : '100%' }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-h-[76vh] bg-[#FDFBF7] text-[#1F1E1D] rounded-t-[24px] shadow-[0_-10px_36px_rgba(0,0,0,0.25)] border-t border-black/15 flex flex-col overflow-hidden"
            >
              {/* Ручка перетаскивания (Handle bar) с комфортной тач-зоной */}
              <div
                onClick={() => {
                  selectEvent(null);
                  setMobileSheetOpen(false);
                }}
                className="w-full pt-3 pb-1.5 flex flex-col items-center cursor-pointer select-none shrink-0"
                role="button"
                aria-label="Закрыть панель событий (свайп или тап)"
              >
                <div className="w-12 h-1.5 rounded-full bg-black/25" />
              </div>

              {/* ШАПКА BOTTOM SHEET: дата, категория, достоверность и кнопка закрытия */}
              <div className="px-4 py-2 border-b border-black/10 flex items-center justify-between gap-2 shrink-0 bg-white/70">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  {selectedEvent ? (
                    <>
                      {/* Бейдж категории */}
                      {(() => {
                        const cat = CATEGORY_CONFIG[selectedEvent.category] ?? {
                          label: selectedEvent.category,
                          color: '#4F8A8B',
                        };
                        return (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-[#1F1E1D] bg-black/5 border border-black/10 shrink-0"
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span>{cat.label}</span>
                          </span>
                        );
                      })()}

                      {/* Бейдж достоверности */}
                      {(() => {
                        const cert = CERTAINTY_CONFIG[selectedEvent.certainty] ?? CERTAINTY_CONFIG.high;
                        return (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold border shrink-0 ${cert.bgClass} ${cert.textClass} ${cert.borderClass}`}
                            title={cert.tooltip}
                          >
                            <span aria-hidden="true">{cert.icon}</span>
                            <span>{cert.label}</span>
                          </span>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-bold text-sm text-[#1F1E1D]">
                        Хроника событий ({year < 0 ? `${Math.abs(year)} до н.э.` : `${year} г.`})
                      </span>
                    </div>
                  )}
                </div>

                {/* Крупная зона закрытия: минимум 44x44px по правилам доступности */}
                <button
                  type="button"
                  onClick={() => {
                    selectEvent(null);
                    setMobileSheetOpen(false);
                  }}
                  className="cursor-pointer min-w-[44px] min-h-[44px] -mr-1 flex items-center justify-center rounded-full text-[#5E5951] hover:text-[#1F1E1D] hover:bg-black/5 active:bg-black/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B2A28]"
                  aria-label="Закрыть карточку события"
                  title="Закрыть карточку"
                >
                  <span className="text-lg font-bold leading-none">✕</span>
                </button>
              </div>

              {/* СОДЕРЖИМОЕ КАРТОЧКИ СОБЫТИЯ */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedEvent ? (
                  <article className="space-y-3">
                    {/* Дата события крупным контрастным шрифтом */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-serif font-bold text-[#2C6466] uppercase tracking-wider">
                        {selectedEvent.date}
                        {selectedEvent.planned && (
                          <span className="ml-2 text-[10px] text-amber-900 font-sans font-medium px-1.5 py-0.2 bg-amber-100 rounded border border-amber-300">
                            запланировано
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] text-[#5E5951] font-mono">
                        {selectedEvent.coords[0].toFixed(2)}° N, {selectedEvent.coords[1].toFixed(2)}° E
                      </span>
                    </div>

                    {/* Заголовок события */}
                    <h3
                      id="mobile-sheet-title"
                      className="text-base font-serif font-bold text-[#1F1E1D] leading-snug"
                    >
                      {selectedEvent.title}
                    </h3>

                    {/* Текст описания события с отличным контрастом (AA/AAA) */}
                    <p className="text-xs sm:text-sm text-[#3E3A33] leading-relaxed">
                      {selectedEvent.summary}
                    </p>

                    {/* Интерактивные кнопки действий (с крупными тач-зонами >= 44px) */}
                    <div className="pt-2 flex items-center gap-2 flex-wrap">
                      {/* Кнопка центрирования карты */}
                      <button
                        type="button"
                        onClick={() => handleFlyToEvent(selectedEvent)}
                        className="cursor-pointer min-h-[44px] px-4 py-2 rounded-xl bg-[#2C6466] text-white hover:bg-[#1E4D4F] active:bg-[#16383A] text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1E1D]"
                        aria-label={`Центрировать карту на месте события: ${selectedEvent.title}`}
                      >
                        <span>🎯</span>
                        <span>Показать на карте</span>
                      </button>

                      {/* Кнопка подсветки связанного слоя */}
                      {selectedLinkedLayer && (
                        <button
                          type="button"
                          onClick={() => {
                            setHighlightedLayerId(
                              highlightedLayerId === selectedLinkedLayer.id
                                ? null
                                : selectedLinkedLayer.id
                            );
                          }}
                          className={`cursor-pointer min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1E1D] ${
                            highlightedLayerId === selectedLinkedLayer.id
                              ? 'bg-[#2B2A28] text-white border-black ring-2 ring-[#2B2A28]/30 shadow-sm'
                              : 'bg-white text-[#1F1E1D] border-black/15 hover:bg-black/5'
                          }`}
                          aria-label={`Территория: ${selectedLinkedLayer.title}. Нажмите для подсветки границ на карте.`}
                        >
                          <span>🗺️</span>
                          <span className="truncate max-w-[160px]">
                            {selectedLinkedLayer.shortTitle || selectedLinkedLayer.title}
                          </span>
                        </button>
                      )}
                    </div>
                  </article>
                ) : null}

                {/* БЛОК: Другие события текущего года/эпохи для быстрого переключения */}
                <div className="pt-3 border-t border-black/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-wider text-[#5E5951] font-bold">
                      {selectedEvent ? 'Другие события хроники' : 'Все события периода'}
                    </span>
                    <span className="text-xs font-mono text-[#5E5951]">
                      {sortedEvents.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {sortedEvents.map((ev) => {
                      const isCurrent = selectedEventId === ev.id;
                      const cat = CATEGORY_CONFIG[ev.category] ?? {
                        label: ev.category,
                        color: '#4F8A8B',
                      };

                      return (
                        <button
                          key={`sheet-ev-${ev.id}`}
                          type="button"
                          onClick={() => {
                            selectEvent(ev.id);
                            handleFlyToEvent(ev);
                          }}
                          aria-pressed={isCurrent}
                          aria-label={`Выбрать событие: ${ev.date}, ${ev.title}`}
                          className={`cursor-pointer w-full text-left min-h-[44px] p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B2A28] ${
                            isCurrent
                              ? 'bg-white border-[#2C6466] ring-2 ring-[#2C6466]/30 shadow-xs'
                              : 'bg-white/80 hover:bg-white border-black/10'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span className="text-[10px] font-bold text-[#2C6466] shrink-0">
                                {ev.date}
                              </span>
                              <span className="text-xs font-semibold text-[#1F1E1D] truncate">
                                {ev.title}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs text-[#5E5951] shrink-0">→</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
