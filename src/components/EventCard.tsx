import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { HistEvent } from '../types';
import { layers } from '../lib/data';
import { CATEGORY_CONFIG, CERTAINTY_CONFIG } from '../lib/categories';
import { useLayerCacheEntry, isLayerWithoutPolygon } from '../lib/layersCache';

export { CATEGORY_CONFIG, CERTAINTY_CONFIG };

export interface EventCardProps {
  event: HistEvent;
  isSelected: boolean;
  onSelect: (id: number) => void;
}

export function EventCard({ event, isSelected, onSelect }: EventCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const cat = CATEGORY_CONFIG[event.category] ?? {
    label: event.category,
    color: '#5C5851',
    bg: '#F3F4F6',
  };
  const cert = CERTAINTY_CONFIG[event.certainty] ?? CERTAINTY_CONFIG.high;
  const linkedLayer = event.layer ? layers.find((l) => l.id === event.layer) : null;
  const layerEntry = useLayerCacheEntry(event.layer);
  const layerWithoutPolygon = event.layer ? isLayerWithoutPolygon(layerEntry) : false;

  return (
    <m.article
      layout={!shouldReduceMotion}
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -8 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: 'easeOut' }}
      tabIndex={0}
      role="button"
      title="Нажмите для показа события на карте"
      aria-expanded={isSelected}
      onClick={() => onSelect(event.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(event.id);
        }
      }}
      className={`relative cursor-pointer rounded-[14px] p-3.5 transition-colors border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B2A28] ${
        isSelected
          ? 'bg-white border-[#2C6466] shadow-md ring-2 ring-[#2C6466]/20'
          : 'bg-[#FDFBF7] border-black/5 hover:bg-white hover:border-black/15 hover:shadow-sm'
      }`}
    >
      {/* Шапка карточки: категория, дата и бейдж достоверности с тултипом */}
      <header className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
        <div className="flex items-center gap-1.5">
          {/* Цветная точка категории */}
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
            style={{ backgroundColor: cat.color }}
            title={`Категория: ${cat.label}`}
          />
          <span className="text-[11px] font-medium text-[#5C5851] uppercase tracking-wider">
            {cat.label}
          </span>
        </div>

        {/* Бейдж достоверности с тултипом */}
        <div
          className="relative group/cert shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <span
            tabIndex={0}
            role="note"
            aria-label={`Достоверность: ${cert.label}. ${cert.tooltip}`}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium border cursor-help transition-all ${cert.bgClass} ${cert.textClass} ${cert.borderClass}`}
          >
            <span aria-hidden="true">{cert.icon}</span>
            <span>{cert.label}</span>
          </span>

          {/* Всплывающая подсказка тултипа */}
          <div
            role="tooltip"
            className="pointer-events-none absolute right-0 top-full mt-1.5 z-40 hidden group-hover/cert:block group-focus-within/cert:block w-56 p-2 rounded-lg bg-[#2B2A28] text-white text-[11px] leading-tight shadow-xl border border-white/10 text-left backdrop-blur-sm opacity-95 transition-opacity"
          >
            <div className="font-semibold mb-1 flex items-center gap-1">
              <span>{cert.icon}</span>
              <span>{cert.label}</span>
            </div>
            <div className="text-white/80 text-[10.5px] font-sans font-normal leading-relaxed">
              {cert.tooltip}
            </div>
          </div>
        </div>
      </header>

      {/* Дата и заголовок */}
      <hgroup>
        <span className="block text-xs font-serif font-bold text-[#2C6466]">
          {event.date}
          {event.planned && (
            <span className="ml-1.5 text-[10px] text-amber-800 font-sans font-medium px-1.5 py-0.2 bg-amber-50 rounded border border-amber-200">
              планируемое
            </span>
          )}
        </span>
        <h3 className="text-sm font-semibold text-[#2B2A28] leading-snug mt-0.5">
          {event.title}
        </h3>
      </hgroup>

      {/* Описание события (summary) */}
      <p
        className={`mt-1.5 text-xs text-[#6B665E] leading-relaxed transition-all ${
          isSelected ? 'line-clamp-none text-[#2B2A28]' : 'line-clamp-2'
        }`}
      >
        {event.summary}
      </p>

      {/* Раскрывающийся блок подробностей при выборе события */}
      <AnimatePresence>
        {isSelected && (
          <m.footer
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 pt-2.5 border-t border-black/10 flex flex-col gap-1.5 text-[11px] text-[#6B665E]"
          >
            {linkedLayer && (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-[#2B2A28]">Территория:</span>
                  <span className="truncate">{linkedLayer.title}</span>
                </div>
                {layerWithoutPolygon && (
                  <div className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 mt-0.5 flex items-center gap-1 font-sans">
                    <span>⚠️</span>
                    <span>Границы неизвестны или не восстановлены (показан маркер события)</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="font-medium text-[#2B2A28]">Координаты:</span>
              <span>
                {event.coords[0].toFixed(2)}° N, {event.coords[1].toFixed(2)}° E
              </span>
            </div>
            <div className="text-[10px] text-[#4F8A8B] italic mt-0.5">
              Нажмите ещё раз, чтобы свернуть карточку
            </div>
          </m.footer>
        )}
      </AnimatePresence>
    </m.article>
  );
}
