import { useEffect, useState, useMemo } from 'react';
import { Source, Layer, Popup, useMap } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import { layers, layersForYear, eraForYear, eventsForYear } from '../lib/data';
import { useStore } from '../store';
import { loadLayerGeoJson, getCachedLayer, subscribeLayerCache } from '../lib/layersCache';
import { computeGeometryArea } from '../lib/contextCache';

/**
 * Вычисляет приближенную площадь замкнутого контура (ring)
 */
function computeRingArea(ring: number[][]): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const p1 = ring[j];
    const p2 = ring[i];
    area += (p1[0] * p2[1] - p2[0] * p1[1]);
  }
  return Math.abs(area / 2);
}

/**
 * Вычисляет визуальный центр (центроид или bbox-центр) замкнутого кольца
 */
function getRingCenter(ring: number[][]): [number, number] {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const p1 = ring[j];
    const p2 = ring[i];
    const f = (p1[0] * p2[1] - p2[0] * p1[1]);
    area += f;
    cx += (p1[0] + p2[0]) * f;
    cy += (p1[1] + p2[1]) * f;
  }
  area = area / 2;
  if (Math.abs(area) < 1e-6) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return [(minX + maxX) / 2, (minY + maxY) / 2];
  }
  cx = cx / (6 * area);
  cy = cy / (6 * area);
  return [cx, cy];
}

/**
 * Преобразует HEX-цвет в [H, S, L]
 */
function hexToHsl(hex: string): [number, number, number] {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  const r = (num >> 16) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

/**
 * Генерирует гармоничный цвет для слоёв одной эпохи, чтобы два фокусных слоя
 * не сливались и не скрывали друг друга
 */
function getLayerColor(baseEraColor: string, index: number, total: number): string {
  if (total <= 1 || index === 0) return baseEraColor;
  try {
    const [h, s, l] = hexToHsl(baseEraColor);
    const newHue = (h + index * 32) % 360;
    const newLight = Math.min(62, Math.max(38, l + (index % 2 === 1 ? 6 : -6)));
    return `hsl(${newHue}, ${s}%, ${newLight}%)`;
  } catch {
    return baseEraColor;
  }
}

/**
 * Генерирует контрастный контур для каждого слоя
 */
function getLayerBorderColor(index: number, isHighlighted: boolean): string {
  if (isHighlighted) return '#1A1918';
  return index === 0 ? '#2B2A28' : '#3E342B';
}

interface HoveredTerritory {
  id: string;
  fullTitle: string;
  years: string;
  note?: string;
  isSchematic: boolean;
  isApproximate: boolean;
  lng: number;
  lat: number;
}

export function TerritoryLayers() {
  const { current: mapInstance } = useMap();
  const year = useStore((s) => s.year);
  const highlightedLayerId = useStore((s) => s.highlightedLayerId);
  const debugSelectedLayerId = useStore((s) => s.debugSelectedLayerId);
  const debugForcedLayerIds = useStore((s) => s.debugForcedLayerIds);

  const [hoveredTerritory, setHoveredTerritory] = useState<HoveredTerritory | null>(null);

  const activeLayers = useMemo(() => {
    const base = layersForYear(year);
    if (debugForcedLayerIds.length === 0) return base;
    const baseIds = new Set(base.map((l) => l.id));
    const forced = layers.filter(
      (l) => debugForcedLayerIds.includes(l.id) && !baseIds.has(l.id)
    );
    return [...base, ...forced];
  }, [year, debugForcedLayerIds]);

  const activeEra = useMemo(() => eraForYear(year), [year]);
  const eraColor = activeEra?.color ?? '#4F8A8B';

  const [cacheRevision, setCacheRevision] = useState(0);

  // Загружаем GeoJSON для активных слоёв с кэшированием и реактивной перерисовкой
  useEffect(() => {
    for (const l of activeLayers) {
      const entry = getCachedLayer(l.id);
      if (entry.status === 'idle') {
        loadLayerGeoJson(l.id);
      }
    }

    const unsubscribe = subscribeLayerCache((layerId) => {
      if (activeLayers.some((l) => l.id === layerId)) {
        setCacheRevision((r) => r + 1);
      }
    });

    return unsubscribe;
  }, [activeLayers]);

  // Интерактивность при наведении на полигоны или подписи слоя (всплывающая подсказка с полным названием)
  useEffect(() => {
    if (!mapInstance) return;
    const map = mapInstance.getMap();

    const handleMouseMove = (e: MapLayerMouseEvent) => {
      const interactiveLayers = ['territories-labels', 'territories-fill'].filter((id) =>
        Boolean(map.getLayer(id))
      );
      if (interactiveLayers.length === 0) {
        setHoveredTerritory(null);
        return;
      }

      const features = map.queryRenderedFeatures(e.point, { layers: interactiveLayers });
      if (features.length > 0) {
        const feat = features[0];
        const id = feat.properties?.id as string | undefined;
        const fullTitle =
          (feat.properties?.fullTitle as string) ||
          (feat.properties?.title as string) ||
          '';
        const years = (feat.properties?.years as string) || '';
        const note = (feat.properties?.note as string) || undefined;
        const isSchematic = Boolean(feat.properties?.isSchematic);
        const isApproximate = Boolean(feat.properties?.isApproximate);

        if (id && fullTitle) {
          map.getCanvas().style.cursor = 'pointer';
          setHoveredTerritory({
            id,
            fullTitle,
            years,
            note,
            isSchematic,
            isApproximate,
            lng: e.lngLat.lng,
            lat: e.lngLat.lat,
          });
          return;
        }
      }

      setHoveredTerritory(null);
    };

    const handleMouseLeave = () => {
      setHoveredTerritory(null);
    };

    map.on('mousemove', handleMouseMove);
    map.on('mouseout', handleMouseLeave);

    return () => {
      map.off('mousemove', handleMouseMove);
      map.off('mouseout', handleMouseLeave);
    };
  }, [mapInstance]);

  // Собираем единый GeoJSON FeatureCollection со всеми активными территориями
  const geojson = useMemo<FeatureCollection>(() => {
    const features: Feature[] = [];

    for (let i = 0; i < activeLayers.length; i++) {
      const l = activeLayers[i];
      const isHighlighted = l.id === highlightedLayerId;
      const isDebugSelected = l.id === debugSelectedLayerId;
      const cachedEntry = getCachedLayer(l.id);
      const cached = cachedEntry.status === 'loaded' ? cachedEntry.data : null;

      const layerColor = getLayerColor(eraColor, i, activeLayers.length);
      const borderColor = getLayerBorderColor(i, isHighlighted);

      let isSchematic = false;
      let isApproximate = false;
      let rawGeom: unknown = null;

      if (cached) {
        const feat =
          cached.type === 'FeatureCollection' && cached.features.length > 0
            ? cached.features[0]
            : cached.type === 'Feature'
            ? cached
            : null;

        if (feat) {
          rawGeom = feat.geometry;
          isApproximate = Boolean(
            feat.properties?.approximate === true ||
              feat.properties?.type === 'approximate-admin'
          );
          isSchematic = Boolean(feat.properties?.schematic !== false && !isApproximate);
        }
      }

      if (l.id === 'kirghiz_ao' || l.id === 'kirghiz_ssr' || l.id === 'kyrgyzstan') {
        isSchematic = false;
        isApproximate = false;
      }

      // Строгое правило: если у слоя нет геометрии, НЕ рисуем никаких прямоугольников!
      if (!rawGeom) {
        continue;
      }

      const area = Math.round(computeGeometryArea(rawGeom) * 10) / 10;
      // Приоритет по площади: крупные государства первыми в очереди collision
      const sortKey = 10000000 - Math.min(10000000, Math.round(area * 100));
      // При zoom < 4 отображаем только крупные территории (area >= 20)
      const isMajor = area >= 20;

      const shortTitle = (l.shortTitle || l.title).toUpperCase();
      const mapLabel = shortTitle;
      const years = `${l.from < 0 ? `${Math.abs(l.from)} до н.э.` : l.from}–${l.to < 0 ? `${Math.abs(l.to)} до н.э.` : l.to} гг.`;

      const commonProps = {
        id: l.id,
        title: l.title,
        fullTitle: l.title,
        shortTitle,
        mapLabel,
        years,
        note: l.note || '',
        color: layerColor,
        borderColor,
        isFallback: false,
        isHighlighted,
        isDebugSelected,
        isSchematic,
        isApproximate,
        area,
        sortKey,
        isMajor,
        layerIndex: i,
      };

      if (cached) {
        if (cached.type === 'FeatureCollection') {
          for (const f of cached.features) {
            features.push({
              ...f,
              properties: {
                ...f.properties,
                ...commonProps,
              },
            });
          }
        } else if (cached.type === 'Feature') {
          features.push({
            ...cached,
            properties: {
              ...cached.properties,
              ...commonProps,
            },
          });
        }
      }
    }

    return {
      type: 'FeatureCollection',
      features,
    };
  }, [activeLayers, eraColor, highlightedLayerId, debugSelectedLayerId, cacheRevision]);

  // Собираем отдельный GeoJSON для текстовых подписей: строго ОДНА точка (Point) на каждое
  // государство на его крупнейшем полигоне с защитой от коллизий с маркерами событий
  const labelsGeojson = useMemo<FeatureCollection>(() => {
    const labelFeatures: Feature[] = [];
    const activeEventsList = eventsForYear(year);

    for (let i = 0; i < activeLayers.length; i++) {
      const l = activeLayers[i];
      const isHighlighted = l.id === highlightedLayerId;
      const cachedEntry = getCachedLayer(l.id);
      const cached = cachedEntry.status === 'loaded' ? cachedEntry.data : null;

      if (!cached) continue;

      const feat =
        cached.type === 'FeatureCollection' && cached.features.length > 0
          ? cached.features[0]
          : cached.type === 'Feature'
          ? cached
          : null;

      if (!feat || !feat.geometry) continue;

      const geom = feat.geometry as { type: string; coordinates: unknown };
      let bestRing: number[][] | null = null;

      if (geom.type === 'Polygon') {
        const rings = geom.coordinates as number[][][];
        if (rings && rings.length > 0) {
          bestRing = rings[0];
        }
      } else if (geom.type === 'MultiPolygon') {
        const polygons = geom.coordinates as number[][][][];
        if (polygons && polygons.length > 0) {
          let maxArea = -1;
          for (const poly of polygons) {
            if (poly && poly.length > 0) {
              const a = computeRingArea(poly[0]);
              if (a > maxArea) {
                maxArea = a;
                bestRing = poly[0];
              }
            }
          }
        }
      }

      if (!bestRing || bestRing.length < 3) continue;

      let [lng, lat] = getRingCenter(bestRing);

      // Проверка наложения на маркеры событий: сдвигаем подпись по широте, чтобы маркер не закрывал текст
      for (const ev of activeEventsList) {
        const evLat = ev.coords[0];
        const evLng = ev.coords[1];
        const dLng = Math.abs(lng - evLng);
        const dLat = Math.abs(lat - evLat);
        if (dLng < 1.5 && dLat < 0.95) {
          if (evLat >= lat) {
            lat -= 0.85;
          } else {
            lat += 0.85;
          }
        }
      }

      const area = Math.round(computeGeometryArea(geom) * 10) / 10;
      const sortKey = 10000000 - Math.min(10000000, Math.round(area * 100));
      const isMajor = area >= 20;
      const shortTitle = (l.shortTitle || l.title).toUpperCase();

      labelFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        properties: {
          id: l.id,
          title: l.title,
          shortTitle,
          mapLabel: shortTitle,
          isMajor,
          isHighlighted,
          sortKey,
        },
      });
    }

    return {
      type: 'FeatureCollection',
      features: labelFeatures,
    };
  }, [activeLayers, year, highlightedLayerId, cacheRevision]);

  return (
    <>
      {/* 1. Полигоны заливки и контуров */}
      <Source id="territories-source" type="geojson" data={geojson}>
        {/* Заливка фокусного государства: fill-opacity ~0.45, при подсветке 0.65 */}
        <Layer
          id="territories-fill"
          type="fill"
          paint={{
            'fill-color': ['get', 'color'],
            'fill-opacity': [
              'case',
              ['==', ['get', 'isHighlighted'], true],
              0.65,
              0.45,
            ],
            'fill-opacity-transition': { duration: 500, delay: 0 },
          }}
        />

        {/* Контур государства: заметно толще фонового (2.6..3.6 px vs 0.8 px) */}
        <Layer
          id="territories-line"
          type="line"
          paint={{
            'line-color': ['get', 'borderColor'],
            'line-width': [
              'case',
              ['==', ['get', 'isHighlighted'], true],
              3.6,
              2.6,
            ],
            'line-opacity': 0.95,
            'line-opacity-transition': { duration: 500, delay: 0 },
          }}
        />

        {/* Красная обводка выбранного слоя в режиме отладки ?debug=layers */}
        <Layer
          id="territories-debug-selected-line"
          type="line"
          paint={{
            'line-color': '#EF4444',
            'line-width': 4.5,
            'line-opacity': [
              'case',
              ['==', ['get', 'isDebugSelected'], true],
              1.0,
              0.0,
            ],
          }}
        />
      </Source>

      {/* 2. Строго единичные подписи государств на крупнейшем полигоне (без дубликатов и с читаемым ореолом) */}
      <Source id="territories-labels-source" type="geojson" data={labelsGeojson}>
        <Layer
          id="territories-labels"
          type="symbol"
          layout={{
            'text-field': ['get', 'mapLabel'],
            'text-font': ['Noto Sans Bold'],
            'text-size': [
              'step',
              ['zoom'],
              ['case', ['get', 'isMajor'], 11, 0],
              4,
              ['case', ['get', 'isHighlighted'], 13, 11],
            ],
            'text-transform': 'uppercase',
            'text-letter-spacing': 0.08,
            'text-max-width': 12,
            'text-padding': 8,
            'symbol-avoid-edges': true,
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'symbol-sort-key': ['coalesce', ['get', 'sortKey'], 10000000],
          }}
          paint={{
            'text-color': '#1F1E1D',
            'text-halo-color': 'rgba(255, 255, 255, 0.98)',
            'text-halo-width': 3.0,
            'text-halo-blur': 1.0,
            'text-opacity': 0.95,
          }}
        />
      </Source>

      {/* Всплывающая подсказка с полным названием, эпохой и примечаниями при наведении */}
      {hoveredTerritory && (
        <Popup
          longitude={hoveredTerritory.lng}
          latitude={hoveredTerritory.lat}
          closeButton={false}
          closeOnClick={false}
          anchor="bottom"
          offset={14}
        >
          <div className="pointer-events-none select-none px-3 py-2 bg-white/98 backdrop-blur-md rounded-xl shadow-xl border border-black/10 max-w-xs text-center">
            <div className="flex items-center justify-between gap-2 border-b border-black/5 pb-1 mb-1">
              <span className="text-[10px] uppercase tracking-wider text-[#6B665E] font-semibold">
                Историческая территория
              </span>
              <span className="text-[10px] font-mono text-[#5E5951] bg-[#F6F1E7] px-1.5 py-0.5 rounded border border-black/5">
                {hoveredTerritory.years}
              </span>
            </div>
            <div className="text-xs font-bold text-[#2B2A28] leading-snug">
              {hoveredTerritory.fullTitle}
            </div>
            {hoveredTerritory.note && (
              <div className="text-[10.5px] text-[#5E5951] mt-1 border-t border-black/5 pt-1 text-left">
                {hoveredTerritory.note}
              </div>
            )}
            <div className="mt-1.5 pt-1 text-[9px] text-[#2C6466] font-medium border-t border-black/5">
              {hoveredTerritory.id === highlightedLayerId ? '✓ Слой подсвечен' : 'Кликните для подсветки границ'}
            </div>
          </div>
        </Popup>
      )}
    </>
  );
}
