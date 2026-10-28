import { eras, eraForYear } from '../lib/data';
import { useStore } from '../store';

const ERA_MOBILE_TITLES: Record<string, string> = {
  ancient: 'Древность',
  turkic: 'Каганаты',
  karakhanid: 'Караханиды',
  mongol: 'Моголистан',
  tribes: 'Племена',
  russian: 'Росс. империя',
  soviet: 'СССР',
  modern: 'Кыргызстан',
};

export function EraChips() {
  const { year, setYear, activeEraId } = useStore();
  const currentEra = eraForYear(year);
  const selectedEraId = activeEraId || currentEra?.id;

  return (
    <nav
      className="flex items-center gap-1.5 overflow-x-auto max-w-full py-0.5 px-2 no-scrollbar select-none scroll-smooth"
      aria-label="Выбор исторической эпохи"
    >
      {eras.map((era) => {
        const isActive = selectedEraId === era.id;

        return (
          <button
            key={era.id}
            onClick={() => setYear(era.from)}
            aria-pressed={isActive}
            aria-label={`Эпоха: ${era.title}, переход к ${era.from < 0 ? Math.abs(era.from) + ' г. до н.э.' : era.from + ' году'}`}
            className={`cursor-pointer shrink-0 min-h-[32px] px-3 py-1 rounded-full text-xs sm:text-[13px] font-medium transition-all flex items-center gap-1.5 shadow-xs border focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1E1D] active:scale-95 whitespace-nowrap ${
              isActive
                ? 'bg-[#1F1E1D] text-white border-[#1F1E1D] shadow-md ring-2 ring-black/20 font-semibold'
                : 'bg-white/95 hover:bg-white text-[#1F1E1D] border-black/10 hover:border-black/20'
            }`}
            title={`${era.title} (${era.from < 0 ? Math.abs(era.from) + ' до н.э.' : era.from} – ${
              era.to < 0 ? Math.abs(era.to) + ' до н.э.' : era.to
            })`}
          >
            {/* Цветной маркер эпохи */}
            <span
              className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 ${isActive ? 'ring-1 ring-white/70 shadow-xs' : ''}`}
              style={{ backgroundColor: era.color }}
            />
            {/* Полное название на десктопе без обрезки точек, лаконичное на мобильных */}
            <span className="hidden sm:inline">{era.title}</span>
            <span className="sm:hidden">{ERA_MOBILE_TITLES[era.id] ?? era.title}</span>
          </button>
        );
      })}
    </nav>
  );
}
