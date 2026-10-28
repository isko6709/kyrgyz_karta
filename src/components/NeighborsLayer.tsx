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

interface NeighborInfo {
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

  // Состояния для hover и click по соседям
  const [hoveredNeighbor, setHoveredNeighbor] = useState<NeighborInfo | null>(null);
  const [clickedNeighbor, setClickedNeighbor] = useState<NeighborInfo | null>(null);

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

  // Загрузка GeoJSON и переключение слотов (ленивая загрузка + кэш в contextCache)
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

      setHoveredNeighbor(null);

      if (currentActive === 'a') {
        // Заполняем слот B и делаем его активным (запускает crossfade 500 мс)
        setSlotB({ year: targetSnapshotYear, data });
        setActiveSlot('b');
      } else {
        // Заполняем слот A и делаем его активным (запускает crossfade 500 мс)
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

  // Обработка hover и click по соседним государствам
  useEffect(() => {
    if (!mapInstance || !showNeighbors) return;
    const map = mapInstance.getMap();

    const handleMouseMove = (e: MapLayerMouseEvent) => {
      // 1. Если курсор над фокусным слоем кыргызских земель, не показываем соседа
      const terrLayers = ['territories-fill', 'territories-labels'].filter((id) => Boolean(map.getLayer(id)));
      if (terrLayers.length > 0) {
        const terrFeatures = map.queryRenderedFeatures(e.point, { layers: terrLayers });
        if (terrFeatures.length > 0) {
          map.getCanvas().style.cursor = 'pointer';
          setHoveredNeighbor(null);
          return;
        }
      }

      // 2. Ищем фичи в активном слое соседей
      const activeFillId = activeSlotRef.current === 'a' ? 'context-a-fill' : 'context-b-fill';
      if (!map.getLayer(activeFillId)) {
        setHoveredNeighbor(null);
        return;
      }

      const features = map.queryRenderedFeatures(e.point, { layers: [activeFillId] });
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

    const handleMapClick = (e: MapLayerMouseEvent) => {
      // Проверяем клик по фокусным территориям
      const terrLayers = ['territories-fill', 'territories-labels'].filter((id) => Boolean(map.getLayer(id)));
      if (terrLayers.length > 0) {
        const terrFeatures = map.queryRenderedFeatures(e.point, { layers: terrLayers });
        if (terrFeatures.length > 0) {
          setClickedNeighbor(null);
          return;
        }
      }

      // Проверяем клик по соседним государствам
      const activeFillId = activeSlotRef.current === 'a' ? 'context-a-fill' : 'context-b-fill';
      if (!map.getLayer(activeFillId)) {
        setClickedNeighbor(null);
        return;
      }

      const features = map.queryRenderedFeatures(e.point, { layers: [activeFillId] });
      if (features.length > 0) {
        const feat = features[0];
        const name = (feat.properties?.NAME as string) || '';
        const subjecto = (feat.properties?.SUBJECTO as string) || '';
        if (name) {
          setClickedNeighbor({
            name,
            subjecto: subjecto && subjecto !== name ? subjecto : undefined,
            lng: e.lngLat.lng,
            lat: e.lngLat.lat,
          });
          setHoveredNeighbor(null);
          return;
        }
      }

      // Клик в пустое место
      setClickedNeighbor(null);
    };

    map.on('mousemove', handleMouseMove);
    map.on('mouseout', handleMouseLeave);
    map.on('click', handleMapClick);

    return () => {
      map.off('mousemove', handleMouseMove);
      map.off('mouseout', handleMouseLeave);
      map.off('click', handleMapClick);
      map.getCanvas().style.cursor = '';
    };
  }, [mapInstance, showNeighbors]);

  const isA = showNeighbors && activeSlot === 'a';
  const isB = showNeighbors && activeSlot === 'b';

  const snapshotYearFormatted =
    targetSnapshotYear > 0 ? `${targetSnapshotYear} г.` : `${Math.abs(targetSnapshotYear)} г. до н.э.`;

  return (
    <>
      {/* Слот A: GeoJSON-источник и слои */}
      <Source id="context-source-a" type="geojson" data={slotA.data ?? EMPTY_GEOJSON}>
        <Layer
          id="context-a-fill"
          type="fill"
          paint={{
            'fill-color': ['coalesce', ['get', 'color'], '#D4E2D4'],
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
      </Source>

      {/* Слот B: GeoJSON-источник и слои */}
      <Source id="context-source-b" type="geojson" data={slotB.data ?? EMPTY_GEOJSON}>
        <Layer
          id="context-b-fill"
          type="fill"
          paint={{
            'fill-color': ['coalesce', ['get', 'color'], '#D4E2D4'],
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
      </Source>

      {/* Закреплённая карточка соседа по клику */}
      {showNeighbors && clickedNeighbor && (
        <Popup
          longitude={clickedNeighbor.lng}
          latitude={clickedNeighbor.lat}
          closeButton={true}
          onClose={() => setClickedNeighbor(null)}
          anchor="bottom"
          offset={14}
        >
          <div className="select-none px-3 py-2 bg-white rounded-xl shadow-xl border border-black/10 text-center min-w-[170px]">
            <div className="flex items-center justify-between gap-2 border-b border-black/5 pb-1 mb-1.5">
              <span className="text-[10px] uppercase tracking-wider text-[#6B665E] font-semibold">
                Соседнее государство
              </span>
              <span className="text-[10px] font-mono text-[#5E5951] bg-[#F6F1E7] px-1.5 py-0.5 rounded border border-black/5">
                ~{snapshotYearFormatted}
              </span>
            </div>
            <div className="text-sm font-bold text-[#2B2A28]">
              {clickedNeighbor.name}
            </div>
            {clickedNeighbor.subjecto && (
              <div className="text-[11px] text-[#6B665E] mt-0.5 italic">
                (под властью: {clickedNeighbor.subjecto})
              </div>
            )}
            <div className="mt-1.5 pt-1 text-[9px] text-[#8C8275] border-t border-black/5">
              historical-basemaps
            </div>
          </div>
        </Popup>
      )}

      {/* Всплывающая подсказка с именем соседа при наведении (если не зафиксирован клик) */}
      {showNeighbors && !clickedNeighbor && hoveredNeighbor && (
        <Popup
          longitude={hoveredNeighbor.lng}
          latitude={hoveredNeighbor.lat}
          closeButton={false}
          closeOnClick={false}
          anchor="bottom"
          offset={12}
        >
          <div className="pointer-events-none select-none px-2.5 py-1 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-black/10 text-center">
            <span className="text-[9.5px] uppercase tracking-wider text-[#6B665E] font-semibold block">
              Соседнее государство
            </span>
            <span className="text-xs font-bold text-[#2B2A28]">
              {hoveredNeighbor.name}
            </span>
            {hoveredNeighbor.subjecto && (
              <span className="text-[9.5px] text-[#6B665E] block italic">
                (под властью: {hoveredNeighbor.subjecto})
              </span>
            )}
          </div>
        </Popup>
      )}
    </>
  );
}
