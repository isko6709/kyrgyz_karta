import { useState, useRef, useEffect, useMemo } from 'react';
import { events, rulers, layers } from '../lib/data';
import { useStore } from '../store';
import { CATEGORY_CONFIG } from './EventCard';
import type { HistEvent, Ruler } from '../types';

export function SearchBox() {
  const { search, setSearch, setYear, selectEvent, setHighlightedLayerId, flyTo } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const query = search.trim().toLowerCase();

  // Поиск по событиям (title и summary)
  const matchedEvents = useMemo<HistEvent[]>(() => {
    if (!query) return [];
    return events
      .filter(
        (e) =>
          e.title.toLowerCase().includes(query) ||
          e.summary.toLowerCase().includes(query) ||
          e.date.toLowerCase().includes(query)
      )
      .slice(0, 8);
  }, [query]);

  // Поиск по правителям (name, role, display, note)
  const matchedRulers = useMemo<Ruler[]>(() => {
    if (!query) return [];
    return rulers
      .filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.role.toLowerCase().includes(query) ||
          r.display.toLowerCase().includes(query) ||
          r.note.toLowerCase().includes(query)
      )
      .slice(0, 6);
  }, [query]);

  const hasResults = matchedEvents.length > 0 || matchedRulers.length > 0;

  // Закрытие при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Выбор события: ставит год, выбирает событие и вызывает flyTo
  const handleSelectEvent = (ev: HistEvent) => {
    setYear(ev.year);
    selectEvent(ev.id);
    flyTo([ev.coords[1], ev.coords[0]], ev.zoom ?? 7, 1400);
    setIsOpen(false);
  };

  // Выбор правителя: ставит год и вызывает flyTo к его территории
  const handleSelectRuler = (ruler: Ruler) => {
    if (ruler.from !== null) {
      setYear(ruler.from);
    }
    if (ruler.layer) {
      setHighlightedLayerId(ruler.layer);
      const linkedLayer = layers.find((l) => l.id === ruler.layer);
      if (linkedLayer) {
        const [w, s, e, n] = linkedLayer.bbox;
        const centerLng = (w + e) / 2;
        const centerLat = (s + n) / 2;
        flyTo([centerLng, centerLat], 6, 1400);
      }
    } else {
      flyTo([74.7661, 41.2044], 6, 1400);
    }
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-64 md:w-80 select-none">
      {/* Поле ввода поиска */}
      <div className="relative flex items-center">
        <span className="absolute left-3 text-xs text-[#6B665E] pointer-events-none">
          🔍
        </span>
        <input
          type="text"
          value={search}
          role="combobox"
          aria-expanded={isOpen && hasResults}
          aria-controls="search-results-list"
          aria-autocomplete="list"
          aria-label="Поиск по историческим событиям и правителям"
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
              setSearch('');
            }
          }}
          placeholder="Поиск событий и ханов..."
          className="w-full pl-8 pr-7 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-black/15 shadow-sm text-xs text-[#2B2A28] placeholder-[#5E5951] focus:outline-none focus:ring-2 focus:ring-[#2C6466]/40 focus:border-[#2C6466]"
        />
        {search && (
          <button
            onClick={() => {
              setSearch('');
              setIsOpen(false);
            }}
            aria-label="Очистить поисковый запрос"
            className="cursor-pointer absolute right-2.5 text-xs text-[#5E5951] hover:text-[#2B2A28] focus:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-full"
            title="Очистить"
          >
            ✕
          </button>
        )}
      </div>

      {/* Выпадающий список результатов */}
      {isOpen && query && (
        <div
          id="search-results-list"
          role="listbox"
          aria-label="Результаты поиска"
          className="absolute top-full mt-1.5 left-0 right-0 max-h-96 overflow-y-auto bg-white/98 backdrop-blur-md rounded-[16px] shadow-[0_12px_36px_rgba(0,0,0,0.15)] border border-black/10 p-2 z-50"
        >
          {!hasResults ? (
            <div className="py-6 text-center text-xs text-[#5E5951]">
              Ничего не найдено по запросу «{search}»
            </div>
          ) : (
            <div className="space-y-3">
              {/* События */}
              {matchedEvents.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-[#5E5951]">
                    События ({matchedEvents.length})
                  </div>
                  <div className="space-y-1">
                    {matchedEvents.map((ev) => {
                      const cat = CATEGORY_CONFIG[ev.category];
                      return (
                        <button
                          key={ev.id}
                          role="option"
                          aria-selected={false}
                          onClick={() => handleSelectEvent(ev)}
                          className="cursor-pointer w-full text-left p-2 rounded-xl hover:bg-[#F6F1E7] transition-colors flex flex-col gap-0.5 border border-transparent hover:border-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B2A28]"
                        >
                          <div className="flex items-center justify-between text-[10.5px]">
                            <span className="font-semibold text-[#2C6466]">{ev.date}</span>
                            <span
                              className="px-1.5 py-0.2 rounded text-[9.5px] font-medium"
                              style={{ color: cat?.color ?? '#2B2A28', backgroundColor: cat?.bg ?? '#eee' }}
                            >
                              {cat?.label}
                            </span>
                          </div>
                          <span className="text-xs font-medium text-[#2B2A28] leading-snug">
                            {ev.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Правители */}
              {matchedRulers.length > 0 && (
                <div className="pt-1 border-t border-black/5">
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-[#5E5951]">
                    Правители и деятели ({matchedRulers.length})
                  </div>
                  <div className="space-y-1">
                    {matchedRulers.map((ruler) => (
                      <button
                        key={ruler.id}
                        role="option"
                        aria-selected={false}
                        onClick={() => handleSelectRuler(ruler)}
                        className="cursor-pointer w-full text-left p-2 rounded-xl hover:bg-[#F6F1E7] transition-colors flex items-center justify-between gap-2 border border-transparent hover:border-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B2A28]"
                      >
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-semibold text-[#2B2A28] truncate">
                              {ruler.name}
                            </span>
                            {ruler.figureType === 'culture' && (
                              <span className="shrink-0 px-1 py-0.2 rounded text-[8.5px] font-medium bg-amber-100 text-amber-900 border border-amber-200">
                                Культура
                              </span>
                            )}
                          </div>
                          <span className="text-[10.5px] text-[#5E5951] truncate">
                            {ruler.role}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-[#5E5951] shrink-0">
                          {ruler.display}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
