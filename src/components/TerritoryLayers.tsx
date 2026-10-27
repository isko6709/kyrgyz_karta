import { useEffect, useState, useMemo } from 'react';
import { Source, Layer, Marker } from 'react-map-gl/maplibre';
import type { Feature, FeatureCollection } from 'geojson';
import { layersForYear, eraForYear } from '../lib/data';
import { useStore } from '../store';
import { loadLayerGeoJson, getCachedLayer } from '../lib/layersCache';

export function TerritoryLayers() {
  const year = useStore((s) => s.year);
  const highlightedLayerId = useStore((s) => s.highlightedLayerId);
  const activeLayers = useMemo(() => layersForYear(year), [year]);
  const activeEra = useMemo(() => eraForYear(year), [year]);
  const eraColor = activeEra?.color ?? '#4F8A8B';

  // Локальный счётчик обновлений кэша для ре-рендера
  const [, setCacheRevision] = useState(0);

  // Загружаем GeoJSON для активных слоёв с кэшированием и обработкой ошибок
  useEffect(() => {
    let active = true;

    for (const l of activeLayers) {
      const entry = getCachedLayer(l.id);
      if (entry.status === 'idle') {
        loadLayerGeoJson(l.id).then(() => {
          if (active) {
            setCacheRevision((r) => r + 1);
          }
        });
      }
    }

    return () => {
      active = false;
    };
  }, [activeLayers]);

  // Собираем единый GeoJSON FeatureCollection со всеми активными территориями
  const geojson = useMemo<FeatureCollection>(() => {
    const features: Feature[] = [];

    for (const l of activeLayers) {
      const isHighlighted = l.id === highlightedLayerId;
      const cachedEntry = getCachedLayer(l.id);
      const cached = cachedEntry.status === 'loaded' ? cachedEntry.data : null;

      if (cached) {
        if (cached.type === 'FeatureCollection') {
          for (const f of cached.features) {
            features.push({
              ...f,
              properties: {
                ...f.properties,
                id: l.id,
                title: l.title,
                color: eraColor,
                isFallback: false,
                isHighlighted,
              },
            });
          }
        } else if (cached.type === 'Feature') {
          features.push({
            ...cached,
            properties: {
              ...cached.properties,
              id: l.id,
              title: l.title,
              color: eraColor,
              isFallback: false,
              isHighlighted,
            },
          });
        }
      } else {
        // Заглушка: прямоугольник из bbox [west, south, east, north]
        const [west, south, east, north] = l.bbox;
        features.push({
          type: 'Feature',
          id: l.id,
          properties: {
            id: l.id,
            title: l.title,
            color: eraColor,
            isFallback: true,
            isHighlighted,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [west, south],
                [east, south],
                [east, north],
                [west, north],
                [west, south],
              ],
            ],
          },
        });
      }
    }

    return {
      type: 'FeatureCollection',
      features,
    };
  }, [activeLayers, eraColor, highlightedLayerId]);

  // Список слоёв-заглушек для показа подписи «схематично»
  const fallbackMarkers = useMemo(() => {
    return activeLayers
      .filter((l) => getCachedLayer(l.id).status !== 'loaded')
      .map((l) => {
        const [west, south, east, north] = l.bbox;
        return {
          id: l.id,
          title: l.title,
          lng: (west + east) / 2,
          lat: (south + north) / 2,
          isHighlighted: l.id === highlightedLayerId,
        };
      });
  }, [activeLayers, highlightedLayerId]);

  return (
    <>
      <Source id="territories-source" type="geojson" data={geojson}>
        <Layer
          id="territories-fill"
          type="fill"
          paint={{
            'fill-color': ['get', 'color'],
            'fill-opacity': [
              'case',
              ['==', ['get', 'isHighlighted'], true],
              0.38,
              0.18,
            ],
            'fill-opacity-transition': { duration: 600, delay: 0 },
          }}
        />
        <Layer
          id="territories-line"
          type="line"
          paint={{
            'line-color': [
              'case',
              ['==', ['get', 'isHighlighted'], true],
              '#2B2A28',
              ['get', 'color'],
            ],
            'line-width': [
              'case',
              ['==', ['get', 'isHighlighted'], true],
              3.0,
              1.5,
            ],
            'line-opacity': [
              'case',
              ['==', ['get', 'isHighlighted'], true],
              1.0,
              0.7,
            ],
            'line-opacity-transition': { duration: 600, delay: 0 },
          }}
        />
      </Source>

      {/* Подписи «схематично» по центру каждого bbox */}
      {fallbackMarkers.map((m) => (
        <Marker key={`marker-bbox-${m.id}`} longitude={m.lng} latitude={m.lat} anchor="center">
          <div className="pointer-events-none select-none text-center">
            <span
              className="px-2 py-0.5 rounded text-[11px] font-medium tracking-wide shadow-sm border border-black/10 backdrop-blur-sm"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                color: '#2B2A28',
              }}
            >
              {m.title} <span className="text-[10px] text-[#5E5951] italic">(схематично)</span>
            </span>
          </div>
        </Marker>
      ))}
    </>
  );
}
