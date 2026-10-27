import { useEffect, useRef, useCallback, useMemo } from 'react';
import Map, { NavigationControl, Marker, type MapRef } from 'react-map-gl/maplibre';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useReducedMotion } from 'framer-motion';
import { useStore } from '../store';
import { events, eventsForYear } from '../lib/data';
import { CATEGORY_CONFIG } from './EventCard';
import { TerritoryLayers } from './TerritoryLayers';

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

  const { year, selectedEventId, selectEvent, showModernBorders, targetFlyTo } = useStore();

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
        onClick={(e) => {
          // Клик по фону карты снимает выбор события
          if ((e.originalEvent.target as HTMLElement).tagName === 'CANVAS') {
            if (selectedEventId !== null) selectEvent(null);
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
    </div>
  );
}
