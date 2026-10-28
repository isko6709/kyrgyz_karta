import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import Map, { NavigationControl, Marker, Popup, type MapRef } from 'react-map-gl/maplibre';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useReducedMotion } from 'framer-motion';
import { useStore } from '../store';
import { events, eventsForYear, eraForYear, layers } from '../lib/data';
import { CATEGORY_CONFIG } from './EventCard';
import { TerritoryLayers } from './TerritoryLayers';
import { NeighborsLayer } from './NeighborsLayer';
import type { HistEvent } from '../types';

/**
 * Определяет историческую роль точки на карте (столица, город, битва, памятник)
 */
export function getEventPointType(ev: HistEvent): { label: string; icon: string } {
  const text = `${ev.title} ${ev.summary}`.toLowerCase();
  if (text.includes('столиц') || text.includes('ставка')) {
    return { label: 'Столица / Ставка', icon: '🏛️' };
  }
  if (text.includes('город') || text.includes('крепост') || text.includes('укреплен') || text.includes('поселен')) {
    return { label: 'Исторический город', icon: '🏰' };
  }
  if (ev.category === 'war' || text.includes('битв') || text.includes('сражен') || text.includes('поход') || text.includes('разгром') || text.includes('восстан')) {
    return { label: 'Сражение / Восстание', icon: '⚔️' };
  }
  if (ev.category === 'trade' || text.includes('шёлковый') || text.includes('торгов') || text.includes('караван')) {
    return { label: 'Торговый узел / Путь', icon: '🐫' };
  }
  if (ev.category === 'culture' || text.includes('минарет') || text.includes('комплекс') || text.includes('надпис') || text.includes('петроглиф') || text.includes('памятник') || text.includes('мавзолей')) {
    return { label: 'Памятник культуры', icon: '📜' };
  }
  if (ev.category === 'state') {
    return { label: 'Государственный центр', icon: '🏛️' };
  }
  return { label: CATEGORY_CONFIG[ev.category]?.label ?? 'Историческое событие', icon: '📍' };
}

// Настройка Web Worker для MapLibre GL JS v5+ в среде Vite/SPA
maplibregl.setWorkerUrl(maplibreWorkerUrl);

// Координаты центра Кыргызстана в формате MapLibre [lng, lat]
const KYRGYZSTAN_CENTER = {
  longitude: 74.7661,
  latitude: 41.2044,
  zoom: 5,
};

// Путь к нашей локальной светлой исторической подложке (суша #EFE8D8, вода #DCE8EE, без современных подписей)
const HISTORICAL_STYLE = '/data/base/style.json';

const BOUNDARY_LAYERS = ['boundary_2', 'boundary_3', 'boundary_disputed'];

export interface MapViewProps {
  className?: string;
  onMapLoad?: (map: MapRef) => void;
}

export function MapView({ className, onMapLoad }: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const isLoadedRef = useRef(false);
  const prevSelectedIdRef = useRef<number | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const {
    year,
    selectedEventId,
    selectEvent,
    showModernBorders,
    toggleModernBorders,
    showNeighbors,
    toggleNeighbors,
    highlightedLayerId,
    setHighlightedLayerId,
    targetFlyTo,
    setShowAboutModal,
  } = useStore();
  const activeEra = useMemo(() => eraForYear(year), [year]);
  const [mapMounted, setMapMounted] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Отложенный монтаж WebGL MapLibre до освобождения основного потока (устраняет блокировку FCP/TBT)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = (
        window as unknown as {
          requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
          cancelIdleCallback: (id: number) => void;
        }
      ).requestIdleCallback(() => setMapMounted(true), { timeout: 150 });

      return () => {
        if ('cancelIdleCallback' in window) {
          (
            window as unknown as { cancelIdleCallback: (id: number) => void }
          ).cancelIdleCallback(idleId);
        }
      };
    } else {
      const timer = setTimeout(() => setMapMounted(true), 30);
      return () => clearTimeout(timer);
    }
  }, []);

  // Синхронизация видимости современных границ
  const applyBorderVisibility = useCallback(
    (visible: boolean) => {
      const map = mapRef.current?.getMap();
      if (!map) return;
      const targetVisibility = visible ? 'visible' : 'none';

      for (const layerId of BOUNDARY_LAYERS) {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', targetVisibility);
        }
      }
    },
    []
  );

  useEffect(() => {
    applyBorderVisibility(showModernBorders);
  }, [showModernBorders, applyBorderVisibility]);

  // Плавный полёт (flyTo) при выборе события или снятии выбора с учётом prefers-reduced-motion
  useEffect(() => {
    if (!isLoadedRef.current || !mapRef.current) return;
    const map = mapRef.current.getMap();
    if (!map) return;

    const animDuration = shouldReduceMotion ? 0 : 1400;

    if (selectedEventId !== null) {
      const ev = events.find((e) => e.id === selectedEventId);
      if (ev) {
        // [lat, lng] -> [lng, lat] для MapLibre
        map.flyTo({
          center: [ev.coords[1], ev.coords[0]],
          zoom: ev.zoom ?? 7,
          duration: animDuration,
          essential: true,
        });
      }
    } else if (prevSelectedIdRef.current !== null) {
      // Возврат к общему виду при снятии выбора
      map.flyTo({
        center: [KYRGYZSTAN_CENTER.longitude, KYRGYZSTAN_CENTER.latitude],
        zoom: KYRGYZSTAN_CENTER.zoom,
        duration: animDuration,
        essential: true,
      });
    }

    prevSelectedIdRef.current = selectedEventId;
  }, [selectedEventId, shouldReduceMotion]);

  // Плавный полёт (flyTo) по явному запросу (поиск, клик по региону и т.д.)
  useEffect(() => {
    if (!isLoadedRef.current || !mapRef.current || !targetFlyTo) return;
    const map = mapRef.current.getMap();
    if (!map) return;

    const animDuration = shouldReduceMotion ? 0 : (targetFlyTo.duration ?? 1400);

    map.flyTo({
      center: targetFlyTo.center,
      zoom: targetFlyTo.zoom ?? 7,
      duration: animDuration,
      essential: true,
    });
  }, [targetFlyTo, shouldReduceMotion]);

  // Список активных событий для отображения маркеров
  const activeEvents = useMemo(() => {
    const list = eventsForYear(year);
    // Если есть выбранное событие, которого нет в точном списке года, добавляем его
    if (selectedEventId !== null && !list.some((e) => e.id === selectedEventId)) {
      const selected = events.find((e) => e.id === selectedEventId);
      if (selected) list.push(selected);
    }
    return list;
  }, [year, selectedEventId]);

  // Данные выбранного события для детального информационного попапа
  const selectedEvent = useMemo(
    () => (selectedEventId !== null ? events.find((e) => e.id === selectedEventId) ?? null : null),
    [selectedEventId]
  );
  const selectedEventLinkedLayer = useMemo(
    () => (selectedEvent?.layer ? layers.find((l) => l.id === selectedEvent.layer) ?? null : null),
    [selectedEvent]
  );
  const selectedEventPointType = useMemo(
    () => (selectedEvent ? getEventPointType(selectedEvent) : null),
    [selectedEvent]
  );

  return (
    <div
      className={`relative w-full h-full overflow-hidden bg-[#F6F1E7] ${className ?? ''}`}
      style={{ backgroundColor: '#F6F1E7' }}
    >
      {mapMounted && (
        <Map
        ref={mapRef}
        mapLib={maplibregl}
        initialViewState={KYRGYZSTAN_CENTER}
        mapStyle={HISTORICAL_STYLE}
        style={{ width: '100%', height: '100%', backgroundColor: '#F6F1E7' }}
        minZoom={2}
        maxZoom={18}
        onError={(e) => {
          console.error('MAPLIBRE MAP ERROR:', e);
          (window as unknown as { __MAP_ERROR__: unknown }).__MAP_ERROR__ = e;
        }}
        onClick={(e) => {
          const map = mapRef.current?.getMap();
          if (!map) return;

          // 1. Проверяем клик по фокусным слоям территорий (заливка или подпись)
          const activeTerrLayers = ['territories-fill', 'territories-labels'].filter((id) =>
            Boolean(map.getLayer(id))
          );
          if (activeTerrLayers.length > 0) {
            const terr = map.queryRenderedFeatures(e.point, { layers: activeTerrLayers });
            if (terr.length > 0) {
              const clickedId = terr[0].properties?.id as string | undefined;
              if (clickedId) {
                setHighlightedLayerId(clickedId === highlightedLayerId ? null : clickedId);
                return;
              }
            }
          }

          // 2. Клик по фону карты снимает выбор события и подсветку слоя
          if ((e.originalEvent.target as HTMLElement).tagName === 'CANVAS') {
            if (selectedEventId !== null) selectEvent(null);
            if (highlightedLayerId !== null) setHighlightedLayerId(null);
          }
        }}
        onLoad={() => {
          isLoadedRef.current = true;
          setMapLoaded(true);
          applyBorderVisibility(showModernBorders);
          if (mapRef.current && onMapLoad) {
            onMapLoad(mapRef.current);
          }
        }}
        onStyleData={() => {
          applyBorderVisibility(showModernBorders);
        }}
      >
        {/* Элементы управления масштабом */}
        <NavigationControl
          position={isMobileScreen ? 'top-right' : 'bottom-left'}
          visualizePitch={true}
          style={
            isMobileScreen
              ? { marginTop: '5.75rem', marginRight: '0.5rem' }
              : { marginBottom: '8rem', marginLeft: '21.5rem' }
          }
        />

        {/* Фоновый контекст соседних государств и слои территорий (подключаются после инициализации карты) */}
        {mapLoaded && (
          <>
            <NeighborsLayer />
            <TerritoryLayers />
          </>
        )}

        {/* Маркеры событий, городов и столиц на карте */}
        {activeEvents.map((ev) => {
          const isSelected = selectedEventId === ev.id;
          const cat = CATEGORY_CONFIG[ev.category] ?? {
            label: ev.category,
            color: '#4F8A8B',
          };
          const pointType = getEventPointType(ev);

          return (
            <Marker
              key={ev.id}
              longitude={ev.coords[1]}
              latitude={ev.coords[0]}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                // Клик по маркеру выбирает событие без переключения года/эпохи!
                selectEvent(isSelected ? null : ev.id);
              }}
            >
              <div
                role="button"
                tabIndex={0}
                aria-label={`${pointType.label}: ${ev.date}, ${ev.title}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    selectEvent(isSelected ? null : ev.id);
                  }
                }}
                className={`group relative flex flex-col items-center cursor-pointer select-none transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B2A28] rounded-full ${
                  isSelected ? 'z-50 scale-110' : 'z-20 hover:scale-125'
                }`}
              >
                {/* Всплывающая плашка при наведении (если не открыт подробный попап) */}
                {!isSelected && (
                  <div className="absolute -top-9 hidden group-hover:flex flex-col items-center pointer-events-none whitespace-nowrap z-50 animate-fadeIn">
                    <div className="px-2.5 py-1 rounded-lg bg-[#2B2A28] text-white text-[11px] font-medium shadow-xl flex items-center gap-1.5 border border-white/20">
                      <span>{pointType.icon}</span>
                      <span>{ev.date}: {ev.title}</span>
                    </div>
                    {/* Треугольный указатель вниз */}
                    <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-[#2B2A28]" />
                  </div>
                )}

                {/* Пульсирующее кольцо подсветки для выбранного маркера */}
                {isSelected && (
                  <span
                    className="absolute -top-1 -left-1 w-8 h-8 rounded-full opacity-75 animate-ping pointer-events-none"
                    style={{ backgroundColor: cat.color }}
                  />
                )}

                {/* Сам значок маркера с иконкой типа при выборе */}
                <div
                  className={`flex items-center justify-center rounded-full transition-all shadow-md ${
                    isSelected
                      ? 'w-7 h-7 bg-white ring-4 shadow-xl'
                      : 'w-4 h-4 bg-white/95 ring-2 ring-black/15 group-hover:ring-black/40'
                  }`}
                  style={{
                    borderColor: cat.color,
                    ...(isSelected ? { ringColor: `${cat.color}60` } : {}),
                  }}
                >
                  {isSelected ? (
                    <span className="text-xs leading-none select-none">{pointType.icon}</span>
                  ) : (
                    <div
                      className="rounded-full w-2 h-2"
                      style={{ backgroundColor: cat.color }}
                    />
                  )}
                </div>
              </div>
            </Marker>
          );
        })}

        {/* Информационный попап выбранного события/города/столицы на карте (без сброса года и эпохи) */}
        {selectedEvent && selectedEventPointType && (
          <Popup
            longitude={selectedEvent.coords[1]}
            latitude={selectedEvent.coords[0]}
            closeButton={true}
            closeOnClick={false}
            onClose={() => selectEvent(null)}
            anchor="bottom"
            offset={28}
          >
            <div className="p-3 bg-[#FDFBF7] rounded-xl shadow-xl border border-black/10 max-w-[280px] sm:max-w-xs text-left select-none animate-fadeIn">
              {/* Бейдж типа (Столица, Город, Сражение, Памятник) и дата */}
              <div className="flex items-center justify-between gap-1.5 mb-1.5 flex-wrap">
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 shadow-xs"
                  style={{
                    backgroundColor: `${CATEGORY_CONFIG[selectedEvent.category]?.color ?? '#2C6466'}15`,
                    color: CATEGORY_CONFIG[selectedEvent.category]?.color ?? '#2C6466',
                    border: `1px solid ${CATEGORY_CONFIG[selectedEvent.category]?.color ?? '#2C6466'}35`,
                  }}
                >
                  <span>{selectedEventPointType.icon}</span>
                  <span>{selectedEventPointType.label}</span>
                </span>
                <span className="text-[11px] font-serif font-bold text-[#2C6466]">
                  {selectedEvent.date}
                </span>
              </div>

              {/* Название события или города/столицы */}
              <h3 className="font-serif font-bold text-sm text-[#1F1E1D] leading-snug">
                {selectedEvent.title}
              </h3>

              {/* Описание того, что это за место или что здесь произошло */}
              <p className="mt-1.5 text-xs text-[#5E5951] leading-relaxed line-clamp-4">
                {selectedEvent.summary}
              </p>

              {/* Привязанное государство / слой */}
              {selectedEventLinkedLayer && (
                <div className="mt-2 pt-1.5 border-t border-black/5 flex items-center justify-between text-[10.5px]">
                  <span className="text-[#8C8275]">Государство:</span>
                  <span className="font-semibold text-[#1F1E1D]">
                    {selectedEventLinkedLayer.title}
                  </span>
                </div>
              )}
            </div>
          </Popup>
        )}
      </Map>
      )}

      {/* Компактная кнопка «Слои и легенда» в левом нижнем углу над кнопками зума */}
      <div className="hidden md:flex absolute bottom-[12.5rem] left-[21.5rem] z-10 flex-col items-start gap-2 pointer-events-auto">
        <button
          onClick={() => setLegendOpen((v) => !v)}
          aria-expanded={legendOpen}
          aria-label="Легенда и слои карты"
          className={`cursor-pointer min-h-[34px] px-3 py-1.5 rounded-full text-xs font-semibold shadow-md border transition-all flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1E1D] active:scale-95 ${
            legendOpen
              ? 'bg-[#1F1E1D] text-white border-black'
              : 'bg-[#FDFBF7]/95 hover:bg-white text-[#2B2A28] border-black/10'
          }`}
        >
          <span>🗺️</span>
          <span>Слои и легенда</span>
          <span className="text-[10px] opacity-60">{legendOpen ? '▲' : '▼'}</span>
        </button>

        {/* Раскрывающаяся компактная легенда без технических параметров */}
        {legendOpen && (
          <div className="p-3.5 rounded-2xl bg-[#FDFBF7]/98 backdrop-blur-md shadow-xl border border-black/10 text-xs text-[#4A463F] w-72 space-y-2.5 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-black/5 pb-1.5">
              <span className="text-[10.5px] font-bold text-[#1F1E1D] uppercase tracking-wider">
                Обозначения на карте
              </span>
              <button
                onClick={() => setLegendOpen(false)}
                className="cursor-pointer text-[#8C8275] hover:text-[#1F1E1D] text-sm leading-none p-0.5 rounded hover:bg-black/5"
                aria-label="Закрыть легенду"
              >
                ✕
              </button>
            </div>

            {/* Фокусное государство */}
            <div className="flex items-start gap-2.5">
              <span
                className="w-3.5 h-3.5 rounded shrink-0 border-2 border-[#2B2A28] shadow-xs mt-0.5"
                style={{ backgroundColor: activeEra?.color ?? '#4F8A8B' }}
              />
              <div className="leading-snug">
                <span className="font-semibold text-[#1F1E1D] block">
                  Кыргызские земли
                </span>
                <span className="text-[11px] text-[#5E5951]">
                  {activeEra?.title ?? 'Исторический период'}
                </span>
              </div>
            </div>

            {/* Соседние государства с переключателем */}
            <div className="flex items-center justify-between pt-2 border-t border-black/5">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded shrink-0 border border-[#5E5951] bg-[#D4E2D4] shadow-xs" />
                <span className="font-medium text-[#1F1E1D]">
                  Соседние государства
                </span>
              </div>
              <button
                onClick={toggleNeighbors}
                aria-pressed={showNeighbors}
                className={`cursor-pointer px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all ${
                  showNeighbors
                    ? 'bg-[#1F1E1D] text-white border-black shadow-xs'
                    : 'bg-white text-[#5E5951] border-black/15 hover:bg-stone-50'
                }`}
              >
                {showNeighbors ? 'Вкл' : 'Выкл'}
              </button>
            </div>

            {/* Современные границы с переключателем */}
            <div className="flex items-center justify-between pt-2 border-t border-black/5">
              <div className="flex items-center gap-2">
                <span className="text-xs">🌐</span>
                <span className="font-medium text-[#1F1E1D]">
                  Современные границы КР
                </span>
              </div>
              <button
                onClick={toggleModernBorders}
                aria-pressed={showModernBorders}
                className={`cursor-pointer px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all ${
                  showModernBorders
                    ? 'bg-[#1F1E1D] text-white border-black shadow-xs'
                    : 'bg-white text-[#5E5951] border-black/15 hover:bg-stone-50'
                }`}
              >
                {showModernBorders ? 'Вкл' : 'Выкл'}
              </button>
            </div>

            {/* Лаконичная атрибуция без технических терминов */}
            <div className="text-[10px] leading-tight text-[#8C8275] pt-2 border-t border-black/10 flex items-center justify-between">
              <span>historical-basemaps · GPLv3</span>
              <button
                type="button"
                onClick={() => setShowAboutModal(true)}
                className="cursor-pointer text-[#2C6466] hover:underline font-semibold"
              >
                О проекте →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
