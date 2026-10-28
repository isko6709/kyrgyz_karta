import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { toPos, toYear } from '../lib/timeScale';
import { events, eras, eraForYear } from '../lib/data';
import { useStore } from '../store';
import type { HistEvent } from '../types';

function formatYear(year: number): string {
  if (year < 0) {
    return `${Math.abs(year)} г. до н.э.`;
  }
  return `${year} г.`;
}

// Короткие названия эпох для компактного отображения на сегментах
const ERA_SHORT_TITLES: Record<string, string> = {
  ancient: 'Древность',
  turkic: 'Каганаты',
  karakhanid: 'Караханиды',
  mongol: 'Моголистан',
  tribes: 'Племена',
  russian: 'Росс. имп.',
  soviet: 'СССР',
  modern: 'Кыргызстан',
};

export function Timeline() {
  const { year, setYear, selectedEventId, selectEvent, playing, togglePlay } = useStore();
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredEvent, setHoveredEvent] = useState<HistEvent | null>(null);

  // Вычисление года из координаты X события мыши/пальца
  const updateYearFromPointer = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const rawPos = (clientX - rect.left) / rect.width;
      const clampedPos = Math.max(0, Math.min(1, rawPos));
      const targetYear = toYear(clampedPos);
      setYear(targetYear);
    },
    [setYear]
  );

  // Pointer Down с захватом курсора/пальца
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateYearFromPointer(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateYearFromPointer(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Игнорируем
    }
  };

  // Клавиатурное управление: ← → (±1 год, с Shift — ±25 лет)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? 25 : 1;
        setYear(Math.max(-2000, year - step));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 25 : 1;
        setYear(Math.min(2026, year + step));
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        setYear(Math.max(-2000, year - 50));
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        setYear(Math.min(2026, year + 50));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setYear(-2000);
      } else if (e.key === 'End') {
        e.preventDefault();
        setYear(2026);
      } else if (e.key === ' ' && target === document.body) {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [year, setYear, togglePlay]);

  const currentPos = toPos(year);
  const activeEra = eraForYear(year);

  // Разделяем события на интервальные (полосы) и точечные
  const { intervalEvents, pointEvents } = useMemo(() => {
    const intervals: HistEvent[] = [];
    const points: HistEvent[] = [];
    for (const ev of events) {
      if (ev.yearEnd !== undefined && ev.yearEnd > ev.year) {
        intervals.push(ev);
      } else {
        points.push(ev);
      }
    }
    return { intervalEvents: intervals, pointEvents: points };
  }, []);

  // Ключевые точки шкалы для подписей (полный список для десктопа)
  const keyStops = [
    { year: -2000, label: '2000 до н.э.', mobile: true },
    { year: 552, label: '552', mobile: true },
    { year: 924, label: '924', mobile: false },
    { year: 1207, label: '1207', mobile: true },
    { year: 1500, label: '1500', mobile: false },
    { year: 1855, label: '1855', mobile: true },
    { year: 1917, label: '1917', mobile: false },
    { year: 1991, label: '1991', mobile: true },
    { year: 2026, label: '2026', mobile: true },
  ];

  return (
    <footer
      className="absolute bottom-0 inset-x-0 h-28 sm:h-28 z-20 bg-white/95 backdrop-blur-md border-t border-black/10 px-3 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-1.5 md:gap-6 pointer-events-auto select-none shadow-[0_-4px_20px_rgba(0,0,0,0.04)]"
      role="region"
      aria-label="Временная шкала истории"
    >
      {/* Левая группа: Play, Текущий год и кнопки шага (адаптировано под тач) */}
      <div className="flex items-center justify-between md:justify-start gap-2 sm:gap-3.5 shrink-0 pt-1 md:pt-0">
        <div className="flex items-center gap-2">
          {/* Кнопка Play с зоной касания не менее 44x44px */}
          <button
            onClick={togglePlay}
            className={`cursor-pointer min-h-[44px] min-w-[44px] px-3.5 py-2 text-xs rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B2A28] ${
              playing
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-black/5 hover:bg-black/10 text-[#2B2A28]'
            }`}
            title={playing ? 'Пауза (Пробел)' : 'Воспроизведение (Пробел)'}
            aria-label={playing ? 'Пауза хроники' : 'Воспроизведение хроники'}
          >
            <span aria-hidden="true">{playing ? '⏸' : '▶'}</span>
            <span className="hidden sm:inline">{playing ? 'Пауза' : 'Play'}</span>
          </button>

          {/* Отображение текущего года */}
          <div className="flex flex-col">
            <span className="hidden sm:inline text-[9.5px] uppercase tracking-wider text-[#4A463F] font-semibold leading-none">
              Текущий год
            </span>
            <span className="font-serif text-lg sm:text-2xl font-bold text-[#1F1E1D] leading-none">
              {formatYear(year)}
            </span>
          </div>
        </div>

        {/* Кнопки быстрого шага с комфортными тач-зонами (min-h 44px) */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setYear(Math.max(-2000, year - 1))}
            className="cursor-pointer min-h-[44px] min-w-[36px] sm:min-w-[34px] px-2 py-1 text-xs rounded-lg bg-black/5 hover:bg-black/10 active:bg-black/15 font-semibold text-[#1F1E1D] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1E1D]"
            title="-1 год (Клавиша ←)"
            aria-label="Назад на 1 год"
          >
            -1
          </button>
          <button
            onClick={() => setYear(Math.min(2026, year + 1))}
            className="cursor-pointer min-h-[44px] min-w-[36px] sm:min-w-[34px] px-2 py-1 text-xs rounded-lg bg-black/5 hover:bg-black/10 active:bg-black/15 font-semibold text-[#1F1E1D] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1E1D]"
            title="+1 год (Клавиша →)"
            aria-label="Вперёд на 1 год"
          >
            +1
          </button>
          <button
            onClick={() => setYear(Math.max(-2000, year - 25))}
            className="cursor-pointer min-h-[44px] min-w-[40px] sm:min-w-[36px] px-2 py-1 text-xs rounded-lg bg-black/5 hover:bg-black/10 active:bg-black/15 font-medium text-[#4A463F] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1E1D]"
            title="-25 лет (Shift + ←)"
            aria-label="Назад на 25 лет"
          >
            -25
          </button>
          <button
            onClick={() => setYear(Math.min(2026, year + 25))}
            className="cursor-pointer min-h-[44px] min-w-[40px] sm:min-w-[36px] px-2 py-1 text-xs rounded-lg bg-black/5 hover:bg-black/10 active:bg-black/15 font-medium text-[#4A463F] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1E1D]"
            title="+25 лет (Shift + →)"
            aria-label="Вперёд на 25 лет"
          >
            +25
          </button>
        </div>
      </div>

      {/* Центральная часть: Эпохи, Метки событий и Слайдер */}
      <div className="flex-1 flex flex-col justify-center max-w-4xl px-0 md:px-2 pb-1 md:pb-0">
        {/* 1. Сегменты эпох с подписями */}
        <div className="relative h-3.5 sm:h-4 w-full flex rounded-t-md overflow-hidden border-x border-t border-black/10 shadow-inner">
          {eras.map((era) => {
            const p0 = toPos(era.from);
            const p1 = toPos(era.to);
            const width = Math.max(0.01, p1 - p0) * 100;
            const left = p0 * 100;
            const isActive = activeEra?.id === era.id;

            return (
              <button
                key={era.id}
                onClick={() => setYear(era.from)}
                title={`${era.title} (${formatYear(era.from)} – ${formatYear(era.to)})`}
                aria-label={`Эпоха: ${era.title}, переход к ${formatYear(era.from)}`}
                className={`absolute top-0 bottom-0 flex items-center justify-center cursor-pointer transition-all border-r border-white/20 px-0.5 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:z-20 ${
                  isActive ? 'opacity-100 z-10' : 'opacity-65 hover:opacity-90'
                }`}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  backgroundColor: era.color,
                }}
              >
                <span className="text-[8.5px] sm:text-[9px] text-white font-medium truncate pointer-events-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
                  {ERA_SHORT_TITLES[era.id] ?? era.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* 2. Интерактивная дорожка ползунка с увеличенной зоной касания */}
        <div
          ref={trackRef}
          tabIndex={0}
          role="slider"
          aria-label="Выбор года на временной шкале"
          aria-valuemin={-2000}
          aria-valuemax={2026}
          aria-valuenow={year}
          aria-valuetext={formatYear(year)}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onLostPointerCapture={() => setIsDragging(false)}
          className={`relative h-7 sm:h-7 flex items-center cursor-pointer select-none touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 bg-[#EFE8D8] border-x border-b border-black/15 rounded-b-md shadow-inner overflow-visible ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          {/* Полосы для событий с yearEnd */}
          {intervalEvents.map((ev) => {
            const p0 = toPos(ev.year);
            const p1 = toPos(ev.yearEnd ?? ev.year);
            const left = Math.min(p0, p1) * 100;
            const width = Math.max(0.6, Math.abs(p1 - p0) * 100);
            const isSelected = selectedEventId === ev.id;
            const isPlanned = ev.planned === true;

            return (
              <div
                key={`interval-${ev.id}`}
                role="button"
                tabIndex={0}
                aria-label={`Период события: ${ev.date}, ${ev.title}${isPlanned ? ' (планируемое)' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  selectEvent(ev.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    selectEvent(ev.id);
                  }
                }}
                onPointerEnter={() => setHoveredEvent(ev)}
                onPointerLeave={() => setHoveredEvent(null)}
                className={`absolute top-1.5 h-2 rounded transition-all cursor-pointer after:absolute after:-inset-y-2 after:inset-x-0 after:content-[''] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1E1D] focus-visible:z-30 ${
                  isPlanned
                    ? 'border-2 border-dashed border-[#C0825A] bg-[#C0825A]/25'
                    : isSelected
                    ? 'bg-[#1F1E1D] border border-black z-10 scale-y-125'
                    : 'bg-[#5E5951]/40 hover:bg-[#1F1E1D]/70 border border-black/10'
                }`}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                }}
                title={`${ev.date}: ${ev.title}${isPlanned ? ' (планируемое)' : ''}`}
              />
            );
          })}

          {/* Точки одиночных событий */}
          {pointEvents.map((ev) => {
            const left = toPos(ev.year) * 100;
            const isSelected = selectedEventId === ev.id;
            const isPlanned = ev.planned === true;

            return (
              <div
                key={`point-${ev.id}`}
                role="button"
                tabIndex={0}
                aria-label={`Событие: ${ev.date}, ${ev.title}${isPlanned ? ' (планируемое)' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  selectEvent(ev.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    selectEvent(ev.id);
                  }
                }}
                onPointerEnter={() => setHoveredEvent(ev)}
                onPointerLeave={() => setHoveredEvent(null)}
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full cursor-pointer transition-all after:absolute after:-inset-3 after:content-[''] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1E1D] focus-visible:z-30 ${
                  isPlanned
                    ? 'w-2.5 h-2.5 border-2 border-dashed border-[#D9A441] bg-white'
                    : isSelected
                    ? 'w-3.5 h-3.5 bg-[#1F1E1D] ring-2 ring-white z-10 scale-125 shadow-sm'
                    : 'w-2 h-2 sm:w-1.5 sm:h-1.5 bg-[#2C6466] hover:bg-[#1F1E1D] hover:scale-150'
                }`}
                style={{ left: `${left}%` }}
                title={`${ev.date}: ${ev.title}${isPlanned ? ' (планируемое)' : ''}`}
              />
            );
          })}

          {/* Бегунок текущего года (Thumb) с увеличенной тач-зоной на мобильных */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center transition-transform z-20 pointer-events-none after:absolute after:-inset-3.5 after:content-[''] ${
              isDragging ? 'scale-110' : ''
            }`}
            style={{ left: `${currentPos * 100}%` }}
          >
            {/* Круглый маркер */}
            <div
              className="w-6 h-6 sm:w-5 sm:h-5 rounded-full bg-white border-2 shadow-[0_2px_8px_rgba(0,0,0,0.3)] flex items-center justify-center"
              style={{ borderColor: activeEra?.color ?? '#2B2A28' }}
            >
              <div
                className="w-2.5 h-2.5 sm:w-2 sm:h-2 rounded-full"
                style={{ backgroundColor: activeEra?.color ?? '#2B2A28' }}
              />
            </div>

            {/* Всплывающая плашка года или события над бегунком */}
            <div className="absolute -top-7 pointer-events-none whitespace-nowrap px-2 py-0.5 rounded-md bg-[#2B2A28] text-white text-[11px] font-medium shadow-md">
              {hoveredEvent
                ? `${hoveredEvent.date}: ${hoveredEvent.title}`
                : formatYear(year)}
            </div>
          </div>
        </div>

        {/* 3. Метки ключевых годов по шкале (высокий контраст AA/AAA) */}
        <div className="relative h-3 mt-0.5 text-[8.5px] sm:text-[9.5px] text-[#3E3A33] font-medium">
          {keyStops.map((stop) => {
            const pos = toPos(stop.year);
            const isEdgeLeft = pos < 0.05;
            const isEdgeRight = pos > 0.95;
            return (
              <span
                key={stop.year}
                onClick={() => setYear(stop.year)}
                className={`absolute top-0 cursor-pointer hover:text-black transition-colors ${
                  !stop.mobile ? 'hidden sm:inline' : 'inline'
                }`}
                style={{
                  left: `${pos * 100}%`,
                  transform: isEdgeLeft
                    ? 'translateX(0)'
                    : isEdgeRight
                    ? 'translateX(-100%)'
                    : 'translateX(-50%)',
                }}
              >
                {stop.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Правая группа: эпоха (скрыта на экранах < 1024px) */}
      <div className="hidden lg:flex flex-col items-end min-w-[170px] text-right">
        <div className="text-[10px] uppercase tracking-wider text-[#4A463F] font-semibold">
          Эпоха
        </div>
        <div className="text-xs font-semibold text-[#1F1E1D] truncate max-w-[200px]">
          {activeEra?.title ?? '—'}
        </div>
        <div className="text-[10px] text-[#5E5951] mt-0.5">
          Клавиши: <kbd className="px-1 py-0.2 bg-black/5 rounded">←</kbd>{' '}
          <kbd className="px-1 py-0.2 bg-black/5 rounded">→</kbd> (Shift: ±25)
        </div>
      </div>
    </footer>
  );
}
