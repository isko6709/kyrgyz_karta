import { useEffect, useState, useRef } from 'react';
import { Source, Layer, Popup, useMap } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { useStore } from '../store';
import { getClosestSnapshotYear, loadContextGeoJson, getCachedContext } from '../lib/contextCache';

const EMPTY_GEOJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

interface HoveredNeighbor {
  name: string;
  subjecto?: string;
  lng: number;
  lat: number;
}

export function NeighborsLayer() {
  const { current: mapInstance } = useMap();
  const year = useStore((s) => s.year);
  const showNeighbors = useStore((s) => s.showNeighbors);

  const targetSnapshotYear = getClosestSnapshotYear(year);

  // Двойная буферизация для плавного crossfade 500 мс без мерцания
  const [slotA, setSlotA] = useState<{ year: number | null; data: FeatureCollection | null }>({
    year: null,
    data: null,
  });
  const [slotB, setSlotB] = useState<{ year: number | null; data: FeatureCollection | null }>({
    year: null,
    data: null,
  });
  const [activeSlot, setActiveSlot] = useState<'a' | 'b'>('a');
  const [hoveredNeighbor, setHoveredNeighbor] = useState<HoveredNeighbor | null>(null);

  const activeSlotRef = useRef(activeSlot);
  const slotARef = useRef(slotA);
  const slotBRef = useRef(slotB);

  useEffect(() => {
    activeSlotRef.current = activeSlot;
  }, [activeSlot]);

  useEffect(() => {
    slotARef.current = slotA;
  }, [slotA]);

  useEffect(() => {
    slotBRef.current = slotB;
  }, [slotB]);

  // Загрузка GeoJSON и переключение слотов
  useEffect(() => {
    let isCancelled = false;

    // Сначала проверяем кэш синхронно
    const cached = getCachedContext(targetSnapshotYear);
    const applyData = (data: FeatureCollection | null) => {
      if (isCancelled || !data) return;

      const currentActive = activeSlotRef.current;
      const currentYearInActive = currentActive === 'a' ? slotARef.current.year : slotBRef.current.year;

      if (currentYearInActive === targetSnapshotYear) {
        // Уже отображается в активном слоте
        return;
      }

      if (currentActive === 'a') {
        // Заполняем слот B и делаем его активным
        setSlotB({ year: targetSnapshotYear, data });
        setActiveSlot('b');
      } else {
        // Заполняем слот A и делаем его активным
        setSlotA({ year: targetSnapshotYear, data });
        setActiveSlot('a');
      }
    };

    if (cached) {
      applyData(cached);
    } else {
      loadContextGeoJson(targetSnapshotYear).then(applyData);
    }

    return () => {
      isCancelled = true;
    };
  }, [targetSnapshotYear]);

  // Обработка hover / click по соседям
  useEffect(() => {
    if (!mapInstance || !showNeighbors) return;
    const map = mapInstance.getMap();

    const layerIds = ['context-a-fill', 'context-b-fill'];

    const handleMouseMove = (e: MapLayerMouseEvent) => {
      // Ищем фичи под курсором в активных слоях соседей
      const features = map.queryRenderedFeatures(e.point, { layers: layerIds });
      if (features.length > 0) {
        const feat = features[0];
        const name = (feat.properties?.NAME as string) || '';
        const subjecto = (feat.properties?.SUBJECTO as string) || '';
        if (name) {
          map.getCanvas().style.cursor = 'pointer';
          setHoveredNeighbor({
            name,
            subjecto: subjecto && subjecto !== name ? subjecto : undefined,
            lng: e.lngLat.lng,
            lat: e.lngLat.lat,
          });
          return;
        }
      }
      map.getCanvas().style.cursor = '';
      setHoveredNeighbor(null);
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = '';
      setHoveredNeighbor(null);
    };

    map.on('mousemove', handleMouseMove);
    map.on('mouseout', handleMouseLeave);

    return () => {
      map.off('mousemove', handleMouseMove);
      map.off('mouseout', handleMouseLeave);
      map.getCanvas().style.cursor = '';
    };
  }, [mapInstance, showNeighbors]);

  const isA = showNeighbors && activeSlot === 'a';
  const isB = showNeighbors && activeSlot === 'b';

  return (
    <>
      {/* Слот A */}
      <Source id="context-source-a" type="geojson" data={slotA.data ?? EMPTY_GEOJSON}>
        <Layer
          id="context-a-fill"
          type="fill"
          paint={{
            'fill-color': ['get', 'color'],
            'fill-opacity': isA ? 0.18 : 0,
            'fill-opacity-transition': { duration: 500, delay: 0 },
          }}
        />
        <Layer
          id="context-a-line"
          type="line"
          paint={{
            'line-color': '#8C8275',
            'line-width': 0.8,
            'line-opacity': isA ? 0.45 : 0,
            'line-opacity-transition': { duration: 500, delay: 0 },
          }}
        />
        <Layer
          id="context-a-labels"
          type="symbol"
          maxzoom={6}
          layout={{
            'text-field': ['get', 'NAME'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 10.5,
            'text-transform': 'uppercase',
            'text-letter-spacing': 0.08,
            'text-max-width': 8,
            'text-allow-overlap': false,
          }}
          paint={{
            'text-color': '#5E5951',
            'text-halo-color': 'rgba(255, 255, 255, 0.85)',
            'text-halo-width': 1.2,
            'text-opacity': isA ? 0.8 : 0,
            'text-opacity-transition': { duration: 500, delay: 0 },
          }}
        />
      </Source>

      {/* Слот B */}
      <Source id="context-source-b" type="geojson" data={slotB.data ?? EMPTY_GEOJSON}>
        <Layer
          id="context-b-fill"
          type="fill"
          paint={{
            'fill-color': ['get', 'color'],
            'fill-opacity': isB ? 0.18 : 0,
            'fill-opacity-transition': { duration: 500, delay: 0 },
          }}
        />
        <Layer
          id="context-b-line"
          type="line"
          paint={{
            'line-color': '#8C8275',
            'line-width': 0.8,
            'line-opacity': isB ? 0.45 : 0,
            'line-opacity-transition': { duration: 500, delay: 0 },
          }}
        />
        <Layer
          id="context-b-labels"
          type="symbol"
          maxzoom={6}
          layout={{
            'text-field': ['get', 'NAME'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 10.5,
            'text-transform': 'uppercase',
            'text-letter-spacing': 0.08,
            'text-max-width': 8,
            'text-allow-overlap': false,
          }}
          paint={{
            'text-color': '#5E5951',
            'text-halo-color': 'rgba(255, 255, 255, 0.85)',
            'text-halo-width': 1.2,
            'text-opacity': isB ? 0.8 : 0,
            'text-opacity-transition': { duration: 500, delay: 0 },
          }}
        />
      </Source>

      {/* Всплывающая подсказка с именем соседа при наведении */}
      {showNeighbors && hoveredNeighbor && (
        <Popup
          longitude={hoveredNeighbor.lng}
          latitude={hoveredNeighbor.lat}
          closeButton={false}
          closeOnClick={false}
          anchor="bottom"
          offset={12}
        >
          <div className="pointer-events-none select-none px-2 py-1 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-black/10 text-center">
            <span className="text-[10px] uppercase tracking-wider text-[#5E5951] font-semibold block">
              Соседнее государство
            </span>
            <span className="text-xs font-bold text-[#2B2A28]">
              {hoveredNeighbor.name}
            </span>
            {hoveredNeighbor.subjecto && (
              <span className="text-[10px] text-[#5E5951] block italic">
                (под властью: {hoveredNeighbor.subjecto})
              </span>
            )}
          </div>
        </Popup>
      )}
    </>
  );
}
