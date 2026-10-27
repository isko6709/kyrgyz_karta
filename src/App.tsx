import { useState, useEffect } from 'react';
import { eraForYear } from './lib/data';
import { RulerColumn } from './components/RulerColumn';
import { MapView } from './components/MapView';
import { Timeline } from './components/Timeline';
import { EventList } from './components/EventList';
import { EraChips } from './components/EraChips';
import { SearchBox } from './components/SearchBox';
import { LayersDebugModal } from './components/LayersDebugModal';
import { useHashSync } from './hooks/useHashSync';
import { usePlayback } from './hooks/usePlayback';
import { useStore } from './store';

export default function App() {
  const {
    year,
    showModernBorders,
    toggleModernBorders,
  } = useStore();

  const [showDebugLayers, setShowDebugLayers] = useState(() => {
    return (
      window.location.search.includes('debug=layers') ||
      window.location.hash.includes('debug=layers')
    );
  });

  // Отслеживание изменений query params или hash для debug=layers
  useEffect(() => {
    const checkDebugParam = () => {
      const isDebug =
        window.location.search.includes('debug=layers') ||
        window.location.hash.includes('debug=layers');
      if (isDebug) {
        setShowDebugLayers(true);
      }
    };

    window.addEventListener('popstate', checkDebugParam);
    window.addEventListener('hashchange', checkDebugParam);
    return () => {
      window.removeEventListener('popstate', checkDebugParam);
      window.removeEventListener('hashchange', checkDebugParam);
    };
  }, []);

  // Синхронизация URL хэш-ссылок (#event=ID, #year=YYYY)
  useHashSync();

  // Автовоспроизведение Play (каждые 5 сек по хронологии)
  usePlayback();

  const activeEra = eraForYear(year);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#F6F1E7] select-none font-sans text-[#2B2A28]">
      {/* 1. ПОЛНОЭКРАННАЯ КАРТА (MapLibre GL) */}
      <div className="absolute inset-0 z-0">
        <MapView />
      </div>

      {/* Верхняя панель: Поиск, дисклеймер, переключатель границ и чипы эпох */}
      <header className="absolute top-3 inset-x-0 z-20 flex flex-col items-center gap-1.5 pointer-events-none px-4">
        <div className="pointer-events-auto flex items-center gap-2.5 flex-wrap justify-center">
          <SearchBox />

          <div className="bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-black/5 text-xs text-[#6B665E] flex items-center gap-2.5">
            <span
              className="text-[11px] text-[#6B665E]"
              title="Историческое примечание: границы государств и племенных союзов приведены схематично, а даты до XIX века в источниках приблизительны"
            >
              <span className="hidden md:inline">Границы схематичны. Даты до XIX века приблизительны</span>
              <span className="md:hidden">Границы схематичны</span>
            </span>
            {activeEra && (
              <span
                className="px-2 py-0.5 rounded-full text-white text-[10.5px] font-medium"
                style={{ backgroundColor: activeEra.color }}
              >
                {activeEra.title}
              </span>
            )}
            <button
              onClick={toggleModernBorders}
              className={`cursor-pointer px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all border ${
                showModernBorders
                  ? 'bg-[#2B2A28] text-white border-[#2B2A28] shadow-sm'
                  : 'bg-black/5 text-[#6B665E] hover:bg-black/10 border-black/10'
              }`}
              title="Переключить отображение современных государственных границ"
            >
              Границы: {showModernBorders ? 'Вкл' : 'Выкл'}
            </button>
            <button
              onClick={() => setShowDebugLayers(true)}
              className="cursor-pointer px-2 py-0.5 rounded-full text-[10px] font-mono text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors"
              title="Открыть режим отладки слоёв GeoJSON (?debug=layers)"
            >
              Слои
            </button>
          </div>
        </div>

        {/* Чипы эпох (EraChips) */}
        <div className="pointer-events-auto mt-0.5">
          <EraChips />
        </div>
      </header>

      {/* 2. ЛЕВАЯ КОЛОНКА: ПРАВИТЕЛИ И ГОСУДАРСТВА */}
      <RulerColumn />

      {/* 3. ПРАВАЯ КОЛОНКА: КАРТОЧКИ СОБЫТИЙ */}
      <EventList />

      {/* 4. ТАЙМЛАЙН СНИЗУ */}
      <Timeline />

      {/* 5. МОДАЛЬНЫЙ РЕЖИМ ОТЛАДКИ GEOJSON СЛОЁВ (?debug=layers) */}
      {showDebugLayers && (
        <LayersDebugModal
          onClose={() => {
            setShowDebugLayers(false);
            if (window.location.search.includes('debug=layers')) {
              const url = new URL(window.location.href);
              url.searchParams.delete('debug');
              window.history.replaceState(null, '', url.pathname + url.hash);
            }
          }}
        />
      )}
    </div>
  );
}
