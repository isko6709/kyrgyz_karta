import { eras, eraForYear } from '../lib/data';
import { useStore } from '../store';

export function EraChips() {
  const { year, setYear, activeEraId } = useStore();
  const currentEra = eraForYear(year);
  const selectedEraId = activeEraId || currentEra?.id;

  return (
    <nav
      className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1 px-1 no-scrollbar select-none"
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
            className={`cursor-pointer shrink-0 min-h-[36px] sm:min-h-[32px] px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm border focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1E1D] ${
              isActive
                ? 'bg-[#1F1E1D] text-white border-[#1F1E1D] shadow-md scale-102 ring-2 ring-black/20'
                : 'bg-white/95 hover:bg-white text-[#1F1E1D] border-black/10 hover:border-black/20'
            }`}
            title={`${era.title} (${era.from < 0 ? Math.abs(era.from) + ' до н.э.' : era.from} – ${
              era.to < 0 ? Math.abs(era.to) + ' до н.э.' : era.to
            })`}
          >
            {/* Цветной маркер эпохи */}
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${isActive ? 'ring-1 ring-white/70 shadow-xs' : ''}`}
              style={{ backgroundColor: era.color }}
            />
            <span className="truncate max-w-[150px]">{era.title}</span>
          </button>
        );
      })}
    </nav>
  );
}
