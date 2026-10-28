import { useState, useEffect } from 'react';
import { eraForYear } from './lib/data';
import { RulerColumn } from './components/RulerColumn';
import { MapView } from './components/MapView';
import { Timeline } from './components/Timeline';
import { EventList } from './components/EventList';
import { EraChips } from './components/EraChips';
import { SearchBox } from './components/SearchBox';
import { LayersDebugModal } from './components/LayersDebugModal';
import { AboutModal } from './components/AboutModal';
import { useHashSync } from './hooks/useHashSync';
import { usePlayback } from './hooks/usePlayback';
import { useStore } from './store';

export default function App() {
  const {
    year,
    showModernBorders,
    toggleModernBorders,
    showAboutModal,
    setShowAboutModal,
  } = useStore();

  const isDebugAllowed =
    import.meta.env.DEV ||
    (typeof window !== 'undefined' &&
      (window.location.search.includes('debug=layers') ||
        window.location.hash.includes('debug=layers')));

  const [showDebugLayers, setShowDebugLayers] = useState(() => {
    return (
      isDebugAllowed &&
      (window.location.search.includes('debug=layers') ||
        window.location.hash.includes('debug=layers'))
    );
  });

  // Отслеживание изменений query params или hash для debug=layers и ?about
  useEffect(() => {
    const checkUrlParams = () => {
      const isDebug =
        window.location.search.includes('debug=layers') ||
        window.location.hash.includes('debug=layers');
      if (isDebug && isDebugAllowed) {
        setShowDebugLayers(true);
      }

      const isAbout =
        window.location.search.includes('about') ||
        window.location.hash.includes('about');
      if (isAbout) {
        setShowAboutModal(true);
      }
    };

    checkUrlParams();
    window.addEventListener('popstate', checkUrlParams);
    window.addEventListener('hashchange', checkUrlParams);
    return () => {
      window.removeEventListener('popstate', checkUrlParams);
      window.removeEventListener('hashchange', checkUrlParams);
    };
  }, [isDebugAllowed, setShowAboutModal]);

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
      <header className="absolute top-2.5 sm:top-3 inset-x-0 z-20 flex flex-col items-center gap-1 sm:gap-1.5 pointer-events-none px-2 sm:px-4">
        <div className="pointer-events-auto flex items-center gap-2 flex-wrap justify-center max-w-full">
          <SearchBox />

          <div className="bg-white/95 backdrop-blur-md px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-black/5 text-xs text-[#4A463F] flex items-center gap-1.5 sm:gap-2.5 max-w-[calc(100vw-1.5rem)] overflow-x-auto no-scrollbar">
            <button
              onClick={() => setShowAboutModal(true)}
              className="cursor-pointer min-h-[36px] sm:min-h-0 text-[11px] text-[#4A463F] hover:text-[#1F1E1D] transition-colors flex items-center gap-1 shrink-0 px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1E1D]"
              title="Нажмите, чтобы прочитать о проекте, источниках, лицензиях и точности дат"
              aria-label="О проекте, источниках и лицензиях"
            >
              <span className="hidden md:inline">Границы схематичны. Даты до XIX века приблизительны</span>
              <span className="hidden sm:inline md:hidden">Границы схематичны</span>
              <span className="text-xs">ℹ️</span>
              <span className="sm:hidden font-medium">О проекте</span>
            </button>
            {activeEra && (
              <span
                className="px-2 py-0.5 rounded-full text-white text-[10px] sm:text-[10.5px] font-medium shrink-0"
                style={{ backgroundColor: activeEra.color }}
              >
                {activeEra.title}
              </span>
            )}
            <button
              onClick={toggleModernBorders}
              className={`cursor-pointer min-h-[36px] sm:min-h-0 px-2.5 py-0.5 rounded-full text-[10.5px] sm:text-[11px] font-medium transition-all border shrink-0 flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1E1D] ${
                showModernBorders
                  ? 'bg-[#1F1E1D] text-white border-[#1F1E1D] shadow-sm'
                  : 'bg-black/5 text-[#4A463F] hover:bg-black/10 border-black/10'
              }`}
              title="Переключить отображение современных государственных границ"
              aria-label="Переключить отображение современных границ"
            >
              Границы: {showModernBorders ? 'Вкл' : 'Выкл'}
            </button>
            <button
              onClick={() => setShowAboutModal(true)}
              className="hidden sm:flex cursor-pointer min-h-[36px] sm:min-h-0 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all border bg-black/5 text-[#4A463F] hover:bg-black/10 hover:text-[#1F1E1D] border-black/10 items-center gap-1 shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1E1D]"
              title="О проекте, источниках, лицензиях и авторах фото"
              aria-label="Подробно о проекте"
            >
              <span>ℹ️</span>
              <span>О проекте</span>
            </button>
            {isDebugAllowed && (
              <button
                onClick={() => setShowDebugLayers(true)}
                className="cursor-pointer min-h-[36px] sm:min-h-0 px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium text-purple-800 hover:text-purple-950 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors shadow-xs shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-800"
                title="Открыть режим отладки слоёв GeoJSON (?debug=layers)"
                aria-label="Режим отладки слоёв GeoJSON"
              >
                ⚙️ Слои
              </button>
            )}
          </div>
        </div>

        {/* Чипы эпох (EraChips) */}
        <div className="pointer-events-auto mt-0.5 w-full flex justify-center">
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

      {/* 6. МОДАЛЬНОЕ ОКНО «О ПРОЕКТЕ» (?about / #about) */}
      {showAboutModal && (
        <AboutModal
          onClose={() => {
            setShowAboutModal(false);
            if (
              window.location.search.includes('about') ||
              window.location.hash.includes('about')
            ) {
              const url = new URL(window.location.href);
              url.searchParams.delete('about');
              const cleanHash = url.hash.replace(/[#&?]about(=true)?/g, '');
              window.history.replaceState(
                null,
                '',
                url.pathname + (url.search ? url.search : '') + (cleanHash !== '#' ? cleanHash : '')
              );
            }
          }}
        />
      )}
    </div>
  );
}
