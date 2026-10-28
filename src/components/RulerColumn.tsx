import { useMemo } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import { rulersForYear, layersForYear, layers, events } from '../lib/data';
import { useStore } from '../store';
import { RulerAvatar } from './RulerAvatar';
import { useLayerCacheEntry, isLayerWithoutPolygon } from '../lib/layersCache';
import type { Ruler } from '../types';

export function RulerColumn() {
  const shouldReduceMotion = useReducedMotion();
  const {
    year,
    highlightedLayerId,
    setHighlightedLayerId,
    setMobileSheetOpen,
  } = useStore();

  const activeRulers = useMemo(() => rulersForYear(year), [year]);
  const activeLayers = useMemo(() => layersForYear(year), [year]);
  const exactYearCount = useMemo(
    () =>
      events.filter((e) =>
        e.yearEnd !== undefined
          ? e.year <= year && year <= e.yearEnd
          : e.year === year
      ).length,
    [year]
  );

  // Сортировка слоёв по приоритету:
  // 1. Слой, выбранный пользователем (highlightedLayerId)
  // 2. Слой, к которому относится хотя бы один активный правитель
  // 3. Более поздний / актуальный слой по году начала (from)
  const sortedLayers = useMemo(() => {
    const rulerLayerIds = new Set(
      activeRulers.map((r) => r.layer).filter(Boolean)
    );

    return [...activeLayers].sort((a, b) => {
      // 1. Пользовательская подсветка
      if (a.id === highlightedLayerId && b.id !== highlightedLayerId) return -1;
      if (b.id === highlightedLayerId && a.id !== highlightedLayerId) return 1;

      // 2. Слой активных правителей
      const aHasRuler = rulerLayerIds.has(a.id);
      const bHasRuler = rulerLayerIds.has(b.id);
      if (aHasRuler && !bHasRuler) return -1;
      if (!aHasRuler && bHasRuler) return 1;

      // 3. Позднейший слой
      return b.from - a.from;
    });
  }, [activeLayers, activeRulers, highlightedLayerId]);

  const primaryLayer = sortedLayers[0] ?? null;
  const otherLayers = sortedLayers.slice(1);

  const primaryLayerEntry = useLayerCacheEntry(primaryLayer?.id);
  const isPrimaryWithoutPolygon = primaryLayer ? isLayerWithoutPolygon(primaryLayerEntry) : false;

  const handleRulerClick = (ruler: Ruler) => {
    if (!ruler.layer) return;
    setHighlightedLayerId(highlightedLayerId === ruler.layer ? null : ruler.layer);
  };

  return (
    <>
      {/* 1. Десктопная колонка (слева) */}
      <aside
        className="hidden md:flex absolute left-4 top-14 bottom-32 w-72 md:w-80 z-10 flex-col pointer-events-none"
        aria-label="Правители и исторические деятели"
      >
        <div className="pointer-events-auto flex-1 flex flex-col bg-[#FDFBF7] rounded-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-black/5 p-4 overflow-hidden">
          {/* Шапка: Название государства ЗАГЛАВНЫМИ БУКВАМИ и второстепенные слои */}
          <header className="border-b border-black/10 pb-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#5E5951] font-semibold">
                Государство / Слой
              </span>
              {primaryLayer && (
                <span className="text-[10px] text-[#5E5951]">
                  {primaryLayer.from < 0 ? `${Math.abs(primaryLayer.from)} до н.э.` : primaryLayer.from}–
                  {primaryLayer.to < 0 ? `${Math.abs(primaryLayer.to)} до н.э.` : primaryLayer.to}
                </span>
              )}
            </div>

            {/* Главное название государства ЗАГЛАВНЫМИ БУКВАМИ */}
            <h2 className="text-base md:text-[17px] font-serif font-bold tracking-wide text-[#2B2A28] uppercase leading-tight mt-1">
              {primaryLayer ? primaryLayer.title.toUpperCase() : 'КЫРГЫЗСКИЕ ЗЕМЛИ'}
            </h2>

            {/* Статус границ: если границы неизвестны/не восстановлены */}
            {primaryLayer && isPrimaryWithoutPolygon && (
              <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-amber-50/90 border border-amber-300 text-[11px] text-amber-900 flex items-center gap-1.5 shadow-xs">
                <span aria-hidden="true" className="text-xs">⚠️</span>
                <span className="font-medium leading-tight">Границы неизвестны или не восстановлены</span>
              </div>
            )}

            {/* Дополнительные слои мелким интерактивным списком */}
            {otherLayers.length > 0 && (
              <div className="mt-2 pt-2 border-t border-black/5">
                <span className="text-[9.5px] uppercase tracking-wider text-[#5E5951] font-semibold block mb-1">
                  Также в этот период:
                </span>
                <ul className="space-y-0.5">
                  {otherLayers.map((l) => {
                    const isHighlighted = l.id === highlightedLayerId;
                    return (
                      <li key={l.id}>
                        <button
                          onClick={() =>
                            setHighlightedLayerId(isHighlighted ? null : l.id)
                          }
                          aria-pressed={isHighlighted}
                          aria-label={`${l.title}: ${l.from < 0 ? `${Math.abs(l.from)} до н.э.` : l.from}–${l.to < 0 ? `${Math.abs(l.to)} до н.э.` : l.to}. Нажмите для подсветки на карте`}
                          className={`cursor-pointer w-full text-left flex items-center justify-between text-xs px-2 py-1.5 min-h-[28px] my-0.5 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B2A28] ${
                            isHighlighted
                              ? 'bg-[#2C6466]/15 text-[#2B2A28] font-semibold ring-1 ring-[#2C6466]/30'
                              : 'text-[#1F1E1D] hover:bg-black/5'
                          }`}
                          title={l.note ? `${l.title}: ${l.note}` : l.title}
                        >
                          <span className="truncate">{l.title}</span>
                          <span className="text-[9.5px] text-[#4A463F] font-medium shrink-0 ml-1.5">
                            {l.from < 0 ? `${Math.abs(l.from)} до н.э.` : l.from}–
                            {l.to < 0 ? `${Math.abs(l.to)} до н.э.` : l.to}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </header>

          {/* Список правителей текущего года */}
          <div
            className="flex-1 overflow-y-auto mt-3 pr-1 space-y-3"
            tabIndex={0}
            aria-label="Список исторических деятелей и правителей"
          >
            <div className="flex items-center justify-between text-xs text-[#5E5951] pb-1 border-b border-black/5">
              <span>Правители и деятели ({activeRulers.length})</span>
              <span>{year < 0 ? `${Math.abs(year)} г. до н.э.` : `${year} г.`}</span>
            </div>

            {activeRulers.length === 0 ? (
              <div className="text-center py-12 px-2 text-xs text-[#5E5951]">
                <p className="font-serif text-sm text-[#2B2A28]">Нет зафиксированных деятелей</p>
                <p className="mt-1 leading-relaxed">
                  для {year < 0 ? `${Math.abs(year)} г. до н.э.` : `${year} года`}.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 justify-items-center pt-1">
                <AnimatePresence initial={false}>
                  {activeRulers.map((ruler) => {
                    const isLayerActive =
                      ruler.layer !== null && ruler.layer === highlightedLayerId;
                    const isCulture = ruler.figureType === 'culture';
                    const linkedLayer = ruler.layer ? layers.find((l) => l.id === ruler.layer) : null;

                    return (
                      <m.button
                        key={ruler.id}
                        layout={!shouldReduceMotion}
                        initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.92 }}
                        transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                        onClick={() => handleRulerClick(ruler)}
                        aria-pressed={isLayerActive}
                        aria-label={`${ruler.name}, ${isCulture ? 'деятель культуры' : 'правитель'}, ${ruler.display}.${linkedLayer ? ` Государство: ${linkedLayer.title}. Подсветить территорию` : ''}`}
                        className={`cursor-pointer w-full p-2 rounded-xl transition-all flex flex-col items-center border text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B2A28] ${
                          isLayerActive
                            ? 'bg-white border-[#2C6466] ring-2 ring-[#2C6466]/30 shadow-md scale-102'
                            : 'bg-[#FDFBF7]/60 border-black/5 hover:bg-white hover:border-black/15 hover:shadow-sm'
                        }`}
                        title={
                          linkedLayer
                            ? `${ruler.name} (${ruler.display})\nГосударство: ${linkedLayer.title}\nНажмите для подсветки территории`
                            : `${ruler.name} (${ruler.display})`
                        }
                      >
                        {/* Аватарка через штатный компонент (внутри getPortrait) */}
                        <RulerAvatar ruler={ruler} size={60} />

                        {/* Бейдж: деятели культуры показываются отдельным бейджем, а не как правители */}
                        {isCulture ? (
                          <span className="mt-1 px-2 py-0.5 rounded-full text-[9.5px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 shadow-xs flex items-center gap-1">
                            📜 Деятель культуры
                          </span>
                        ) : (
                          <span className="mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium text-[#5E5951] bg-black/5">
                            Правитель
                          </span>
                        )}

                        {/* Роль деятеля */}
                        <p className="mt-0.5 text-[10px] text-[#5E5951] leading-tight line-clamp-2 px-1 font-normal">
                          {ruler.role}
                        </p>

                        {/* Годы правления / активности под аватаром */}
                        <span className="mt-1 text-[11px] font-semibold text-[#2B2A28]">
                          {ruler.from !== null && ruler.to !== null
                            ? `${ruler.from < 0 ? Math.abs(ruler.from) + ' до н.э.' : ruler.from} – ${
                                ruler.to < 0 ? Math.abs(ruler.to) + ' до н.э.' : ruler.to
                              }`
                            : ruler.display}
                        </span>

                        {/* Индикатор подсветки слоя */}
                        {ruler.layer && (
                          <span
                            className={`mt-1 text-[9.5px] px-1.5 py-0.2 rounded-full font-medium transition-colors ${
                              isLayerActive
                                ? 'bg-[#2C6466] text-white'
                                : 'text-[#5E5951] hover:text-[#2B2A28]'
                            }`}
                          >
                            {isLayerActive ? '● Слой подсвечен' : 'Слой на карте'}
                          </span>
                        )}
                      </m.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 2. Мобильная версия: правители и плашка государства над таймлайном */}
      <aside
        className="flex md:hidden absolute bottom-[7.25rem] inset-x-0 z-20 pointer-events-none px-3"
        aria-label="Правители и хроника (мобильная версия)"
      >
        <div className="pointer-events-auto w-full flex flex-col gap-1.5">
          {/* Верхняя строка: Название государства (слева) + Кнопка открытия хроники событий (справа) */}
          <div className="flex items-center justify-between gap-2">
            {/* Плашка названия государства на мобильных с возможностью подсветки */}
            <button
              onClick={() => {
                if (primaryLayer) {
                  setHighlightedLayerId(highlightedLayerId === primaryLayer.id ? null : primaryLayer.id);
                }
              }}
              aria-label={`${primaryLayer ? (primaryLayer.shortTitle || primaryLayer.title) : 'Кыргызские земли'}: нажать для подсветки на карте`}
              className={`cursor-pointer min-h-[40px] px-3 py-1 rounded-full shadow-sm border text-left text-xs transition-all flex items-center gap-1.5 max-w-[62%] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1E1D] ${
                primaryLayer && highlightedLayerId === primaryLayer.id
                  ? 'bg-[#2C6466] text-white border-[#2C6466]'
                  : 'bg-[#FDFBF7] text-[#1F1E1D] border-black/10 hover:border-black/20'
              }`}
            >
              <span className="font-serif font-bold uppercase truncate">
                {primaryLayer ? (primaryLayer.shortTitle || primaryLayer.title) : 'Кыргызские земли'}
              </span>
              {isPrimaryWithoutPolygon && (
                <span className="text-[10px] text-amber-800 bg-amber-100/90 px-1.5 py-0.2 rounded border border-amber-300 shrink-0 font-sans font-normal" title="Границы неизвестны или не восстановлены">
                  ⚠️ Без границ
                </span>
              )}
              {otherLayers.length > 0 && (
                <span className="text-[10px] opacity-75 shrink-0">
                  +{otherLayers.length}
                </span>
              )}
            </button>

            {/* Кнопка открытия Bottom Sheet с событиями */}
            <button
              type="button"
              onClick={() => setMobileSheetOpen(true)}
              aria-label={`Хроника: открыть список событий (${exactYearCount})`}
              className="cursor-pointer min-h-[40px] px-3.5 py-1.5 rounded-full bg-[#FDFBF7] shadow-sm border border-black/10 text-xs font-semibold text-[#1F1E1D] flex items-center gap-1.5 active:scale-95 transition-all shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1E1D]"
            >
              <span className="text-sm">📋</span>
              <span>Хроника</span>
              {exactYearCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#2C6466] text-white text-[10px] font-mono">
                  {exactYearCount}
                </span>
              )}
            </button>
          </div>

          {/* Нижняя строка: Горизонтальный скролл правителей (крупные тач-зоны min-h 46px) */}
          {activeRulers.length > 0 && (
            <div
              className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5"
              role="region"
              aria-label="Список правителей текущего периода"
            >
              <AnimatePresence initial={false}>
                {activeRulers.map((ruler) => {
                  const isLayerActive =
                    ruler.layer !== null && ruler.layer === highlightedLayerId;
                  const isCulture = ruler.figureType === 'culture';

                  return (
                    <m.button
                      key={`mob-${ruler.id}`}
                      layout={!shouldReduceMotion}
                      initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.9 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
                      onClick={() => handleRulerClick(ruler)}
                      aria-pressed={isLayerActive}
                      aria-label={`${ruler.name}: ${isCulture ? 'деятель культуры' : 'правитель'}. ${ruler.layer ? 'Подсветить территорию' : ''}`}
                      className={`cursor-pointer shrink-0 min-h-[46px] flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-[#FDFBF7] shadow-sm border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1E1D] ${
                        isLayerActive
                          ? 'border-[#2C6466] ring-2 ring-[#2C6466]/30'
                          : 'border-black/10 hover:border-black/20'
                      }`}
                    >
                      <RulerAvatar ruler={ruler} size={36} compact={true} />
                      <div className="text-left">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-semibold text-[#1F1E1D] leading-tight truncate max-w-[120px]">
                            {ruler.name}
                          </span>
                          {isCulture ? (
                            <span className="shrink-0 px-1.5 py-0.2 rounded text-[8.5px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                              📜 Культура
                            </span>
                          ) : (
                            <span className="shrink-0 px-1 py-0.2 rounded text-[8px] font-medium text-[#4A463F] bg-black/5">
                              Правитель
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#4A463F]">
                          {ruler.from !== null && ruler.to !== null
                            ? `${ruler.from < 0 ? Math.abs(ruler.from) + ' до н.э.' : ruler.from}–${
                                ruler.to < 0 ? Math.abs(ruler.to) + ' до н.э.' : ruler.to
                              }`
                            : ruler.display}
                        </div>
                      </div>
                    </m.button>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
