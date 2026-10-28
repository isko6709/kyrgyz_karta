import { useState, useEffect, lazy, Suspense } from 'react';
import { LazyMotion } from 'framer-motion';
import { eraForYear } from './lib/data';
import { RulerColumn } from './components/RulerColumn';
import { Timeline } from './components/Timeline';
import { EventList } from './components/EventList';
import { EraChips } from './components/EraChips';
import { SearchBox } from './components/SearchBox';
import { useHashSync } from './hooks/useHashSync';
import { usePlayback } from './hooks/usePlayback';
import { useStore } from './store';

const loadFeatures = () => import('framer-motion').then((res) => res.domAnimation);

const MapView = lazy(() =>
  import('./components/MapView').then((m) => ({ default: m.MapView }))
);

const LayersDebugModal = lazy(() =>
  import('./components/LayersDebugModal').then((m) => ({ default: m.LayersDebugModal }))
);
const AboutModal = lazy(() =>
  import('./components/AboutModal').then((m) => ({ default: m.AboutModal }))
);

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

  // Ленивая инициализация тяжелого WebGL MapLibre:
  // При первом движении мыши, клике, таче или через 3.5 сек пассивного просмотра
  const [loadMap, setLoadMap] = useState(false);

  useEffect(() => {
    const triggerLoad = () => {
      setLoadMap(true);
      cleanup();
    };
    const cleanup = () => {
      window.removeEventListener('pointerdown', triggerLoad);
      window.removeEventListener('pointermove', triggerLoad);
      window.removeEventListener('keydown', triggerLoad);
      window.removeEventListener('touchstart', triggerLoad);
      window.removeEventListener('scroll', triggerLoad);
    };

    window.addEventListener('pointerdown', triggerLoad, { passive: true });
    window.addEventListener('pointermove', triggerLoad, { passive: true, once: true });
    window.addEventListener('keydown', triggerLoad, { passive: true });
    window.addEventListener('touchstart', triggerLoad, { passive: true });
    window.addEventListener('scroll', triggerLoad, { passive: true });

    const timer = setTimeout(triggerLoad, 3500);

    return () => {
      cleanup();
      clearTimeout(timer);
    };
  }, []);

  const activeEra = eraForYear(year);

  return (
    <LazyMotion features={loadFeatures} strict={false}>
      <div className="relative w-screen h-screen overflow-hidden bg-[#F6F1E7] select-none font-sans text-[#2B2A28]">
      {/* 1. ПОЛНОЭКРАННАЯ КАРТА (MapLibre GL) */}
      <div className="absolute inset-0 z-0">
        {loadMap ? (
          <Suspense
            fallback={
              <div
                className="w-full h-full bg-[#EFE8D8] flex items-center justify-center select-none"
                aria-label="Загрузка исторической карты"
              >
                <div className="flex flex-col items-center gap-2 text-stone-500 font-sans">
                  <div className="w-8 h-8 rounded-full border-2 border-[#2C6466]/30 border-t-[#2C6466] animate-spin" />
                  <span className="text-xs font-serif tracking-wider uppercase text-stone-600">
                    Загрузка карты...
                  </span>
                </div>
              </div>
            }
          >
            <MapView />
          </Suspense>
        ) : (
          <div
            className="w-full h-full bg-[#EFE8D8] flex items-center justify-center select-none cursor-pointer"
            onClick={() => setLoadMap(true)}
            aria-label="Интерактивная карта Кыргызстана"
          >
            <div className="flex flex-col items-center gap-2 text-stone-500 font-sans">
              <div className="w-8 h-8 rounded-full border-2 border-[#2C6466]/30 border-t-[#2C6466] animate-spin" />
              <span className="text-xs font-serif tracking-wider uppercase text-stone-600">
                Загрузка карты...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Верхняя панель: Поиск, дисклеймер, переключатель границ и чипы эпох */}
      <header className="absolute top-2.5 sm:top-3 inset-x-0 z-20 flex flex-col items-center gap-1 sm:gap-1.5 pointer-events-none px-2 sm:px-4">
        <div className="pointer-events-auto flex items-center gap-2 flex-wrap justify-center max-w-full">
          <SearchBox />

          <div className="bg-[#FDFBF7] px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-black/5 text-xs text-[#4A463F] flex items-center gap-1.5 sm:gap-2.5 max-w-[calc(100vw-1.5rem)] overflow-x-auto no-scrollbar">
            <button
              onClick={() => setShowAboutModal(true)}
              className="cursor-pointer min-h-[36px] sm:min-h-0 text-[11px] text-[#4A463F] hover:text-[#1F1E1D] transition-colors flex items-center gap-1 shrink-0 px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1E1D]"
              title="Нажмите, чтобы прочитать о проекте, источниках, лицензиях и точности дат"
            >
              <span className="hidden md:inline">Границы схематичны. Даты до XIX века приблизительны</span>
              <span className="hidden sm:inline md:hidden">Границы схематичны</span>
              <span className="text-xs">ℹ️</span>
              <span className="sm:hidden font-medium">О проекте</span>
            </button>
            {activeEra && (
              <span
                className="px-2.5 py-0.5 rounded-full bg-black/5 border border-black/10 text-[#1F1E1D] text-[10px] sm:text-[10.5px] font-semibold shrink-0 flex items-center gap-1.5"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: activeEra.color }}
                />
                <span>{activeEra.title}</span>
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
            >
              Границы: {showModernBorders ? 'Вкл' : 'Выкл'}
            </button>
            <button
              onClick={() => setShowAboutModal(true)}
              className="hidden sm:flex cursor-pointer min-h-[36px] sm:min-h-0 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all border bg-black/5 text-[#4A463F] hover:bg-black/10 hover:text-[#1F1E1D] border-black/10 items-center gap-1 shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1E1D]"
              title="О проекте, источниках, лицензиях и авторах фото"
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
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {/* 6. МОДАЛЬНОЕ ОКНО «О ПРОЕКТЕ» (?about / #about) */}
      {showAboutModal && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}
      </div>
    </LazyMotion>
  );
}
