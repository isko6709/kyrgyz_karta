import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import Map, { NavigationControl, Marker, type MapRef } from 'react-map-gl/maplibre';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useReducedMotion } from 'framer-motion';
import { useStore } from '../store';
import { events, eventsForYear, layersForYear, eraForYear } from '../lib/data';
import { getClosestSnapshotYear } from '../lib/contextCache';
import { CATEGORY_CONFIG } from './EventCard';
import { TerritoryLayers } from './TerritoryLayers';
import { NeighborsLayer } from './NeighborsLayer';

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
  const activeLayers = useMemo(() => layersForYear(year), [year]);
  const closestSnapshotYear = useMemo(() => getClosestSnapshotYear(year), [year]);
  const [legendOpen, setLegendOpen] = useState(true);

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

  return (
    <div
      className={`relative w-full h-full overflow-hidden bg-[#F6F1E7] ${className ?? ''}`}
      style={{ backgroundColor: '#F6F1E7' }}
    >
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
          position="bottom-left"
          visualizePitch={true}
          style={{
            marginBottom: '8rem',
            marginLeft: '21.5rem',
          }}
        />

        {/* Фоновый контекст соседних государств (historical-basemaps) */}
        <NeighborsLayer />

        {/* Слои исторических территорий текущего года */}
        <TerritoryLayers />

        {/* Маркеры событий на карте */}
        {activeEvents.map((ev) => {
          const isSelected = selectedEventId === ev.id;
          const cat = CATEGORY_CONFIG[ev.category] ?? {
            label: ev.category,
            color: '#4F8A8B',
          };

          return (
            <Marker
              key={ev.id}
              longitude={ev.coords[1]}
              latitude={ev.coords[0]}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                selectEvent(isSelected ? null : ev.id);
              }}
            >
              <div
                role="button"
                tabIndex={0}
                aria-label={`Событие на карте: ${ev.date}, ${ev.title}`}
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
                {/* Всплывающая плашка с названием при выборе или наведении */}
                {(isSelected || false) && (
                  <div className="absolute -top-10 flex flex-col items-center pointer-events-none whitespace-nowrap z-50">
                    <div className="px-2.5 py-1 rounded-lg bg-[#2B2A28] text-white text-[11px] font-medium shadow-xl flex items-center gap-1.5 border border-white/20">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
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

                {/* Сам значок маркера (булавка) */}
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
                  <div
                    className={`rounded-full ${isSelected ? 'w-3.5 h-3.5' : 'w-2 h-2'}`}
                    style={{ backgroundColor: cat.color }}
                  />
                </div>
              </div>
            </Marker>
          );
        })}
      </Map>

      {/* Панель переключателей карты и легенда (historical-basemaps) */}
      <div className="absolute top-16 left-4 md:left-[21.5rem] z-10 flex flex-col gap-1.5 pointer-events-auto">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Переключатель «Соседи» (по умолчанию включён) */}
          <button
            onClick={toggleNeighbors}
            aria-pressed={showNeighbors}
            aria-label="Переключить отображение соседних государств"
            className={`cursor-pointer px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm border transition-all flex items-center gap-1.5 backdrop-blur-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B2A28] ${
              showNeighbors
                ? 'bg-[#2B2A28] text-white border-black'
                : 'bg-white/95 text-[#5E5951] border-black/10 hover:bg-white hover:text-[#2B2A28]'
            }`}
          >
            <span>🗺️ Соседи</span>
            <span
              className={`text-[9.5px] px-1.5 py-0.5 rounded font-mono ${
                showNeighbors ? 'bg-white/20 text-white' : 'bg-black/5 text-[#5E5951]'
              }`}
            >
              {showNeighbors ? 'Вкл' : 'Выкл'}
            </span>
          </button>

          {/* Переключатель современных границ */}
          <button
            onClick={toggleModernBorders}
            aria-pressed={showModernBorders}
            aria-label="Переключить современные государственные границы"
            className={`cursor-pointer px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm border transition-all flex items-center gap-1.5 backdrop-blur-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B2A28] ${
              showModernBorders
                ? 'bg-[#2B2A28] text-white border-black'
                : 'bg-white/95 text-[#5E5951] border-black/10 hover:bg-white hover:text-[#2B2A28]'
            }`}
          >
            <span>🌐 Границы</span>
            <span
              className={`text-[9.5px] px-1.5 py-0.5 rounded font-mono ${
                showModernBorders ? 'bg-white/20 text-white' : 'bg-black/5 text-[#5E5951]'
              }`}
            >
              {showModernBorders ? 'Вкл' : 'Выкл'}
            </span>
          </button>

          {/* Кнопка сворачивания/разворачивания легенды */}
          <button
            onClick={() => setLegendOpen((v) => !v)}
            aria-label={legendOpen ? 'Свернуть легенду карты' : 'Развернуть легенду карты'}
            className="cursor-pointer px-2 py-1.5 rounded-full text-xs text-[#5E5951] bg-white/90 hover:bg-white border border-black/10 shadow-sm backdrop-blur-md transition-all flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B2A28]"
          >
            <span className="text-[11px]">{legendOpen ? '▲' : '▼ Легенда'}</span>
          </button>
        </div>

        {/* Информационная легенда и атрибуция (historical-basemaps) */}
        {legendOpen && (
          <div className="px-3 py-2 rounded-xl bg-white/95 backdrop-blur-md shadow-md border border-black/10 text-[11px] text-[#5E5951] max-w-xs space-y-1.5 animate-fadeIn">
            {/* Фокусное государство */}
            <div className="flex items-start gap-2">
              <span
                className="w-3.5 h-3.5 rounded shrink-0 border-2 border-[#2B2A28] shadow-sm mt-0.5"
                style={{ backgroundColor: activeEra?.color ?? '#4F8A8B', opacity: 0.85 }}
              />
              <div className="leading-snug">
                <span className="font-bold text-[#2B2A28] block">
                  Фокус: кыргызские земли
                </span>
                <span className="text-[10px] text-[#6B665E]">
                  Эпоха: {activeEra?.title ?? '—'} (прозрачность ~0.45)
                  {activeLayers.length > 1 && (
                    <span className="block text-[9.5px] text-[#8C8275] italic">
                      ({activeLayers.length} активных слоя, выделены отдельными контурами)
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Соседние государства */}
            {showNeighbors && (
              <div className="flex items-start gap-2 pt-1 border-t border-black/5">
                <span className="w-3.5 h-3.5 rounded shrink-0 border border-[#8C8275] bg-[#D4E2D4] opacity-80 shadow-sm mt-0.5" />
                <div className="leading-snug">
                  <span className="font-semibold text-[#2B2A28] block">
                    Соседние государства
                  </span>
                  <span className="text-[10px] text-[#6B665E] block">
                    Пастель (~0.18), снимок ~{closestSnapshotYear > 0 ? `${closestSnapshotYear} г.` : `${Math.abs(closestSnapshotYear)} г. до н.э.`}
                  </span>
                  <span className="text-[9.5px] text-[#8C8275] italic block">
                    Наведение или клик показывает название
                  </span>
                </div>
              </div>
            )}

            {/* Обязательная атрибуция по условиям лицензии */}
            <div className="text-[9.5px] leading-tight text-[#6B665E] pt-1.5 border-t border-black/10 flex items-center justify-between gap-1 flex-wrap">
              <div>
                Границы схематичны, источник:{' '}
                <a
                  href="https://github.com/aourednik/historical-basemaps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-[#2B2A28] font-medium"
                >
                  historical-basemaps
                </a>{' '}
                · <span className="text-[#8C8275]">GNU GPLv3</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAboutModal(true)}
                className="cursor-pointer text-[9.5px] text-[#2C6466] hover:underline font-semibold shrink-0"
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
