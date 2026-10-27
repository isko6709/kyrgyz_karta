import { useEffect, useState, useMemo } from 'react';
import { Source, Layer, Marker } from 'react-map-gl/maplibre';
import type { Feature, FeatureCollection } from 'geojson';
import { layers, layersForYear, eraForYear } from '../lib/data';
import { useStore } from '../store';
import { loadLayerGeoJson, getCachedLayer } from '../lib/layersCache';

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
    // Мягкий гармоничный сдвиг по цветовому кругу
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
  // Базовый тёмно-графитовый и тёмно-умбровый контуры для различения границ
  return index === 0 ? '#2B2A28' : '#3E342B';
}

export function TerritoryLayers() {
  const year = useStore((s) => s.year);
  const highlightedLayerId = useStore((s) => s.highlightedLayerId);
  const setHighlightedLayerId = useStore((s) => s.setHighlightedLayerId);
  const debugSelectedLayerId = useStore((s) => s.debugSelectedLayerId);
  const debugForcedLayerIds = useStore((s) => s.debugForcedLayerIds);

  const activeLayers = useMemo(() => {
    const base = layersForYear(year);
    if (debugForcedLayerIds.length === 0) return base;
    // В режиме отладки добавляем принудительно включённые слои
    const baseIds = new Set(base.map((l) => l.id));
    const forced = layers.filter(
      (l) => debugForcedLayerIds.includes(l.id) && !baseIds.has(l.id)
    );
    return [...base, ...forced];
  }, [year, debugForcedLayerIds]);

  const activeEra = useMemo(() => eraForYear(year), [year]);
  const eraColor = activeEra?.color ?? '#4F8A8B';

  // Локальный счётчик обновлений кэша для ре-рендера при ленивой загрузке
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

    for (let i = 0; i < activeLayers.length; i++) {
      const l = activeLayers[i];
      const isHighlighted = l.id === highlightedLayerId;
      const isDebugSelected = l.id === debugSelectedLayerId;
      const cachedEntry = getCachedLayer(l.id);
      const cached = cachedEntry.status === 'loaded' ? cachedEntry.data : null;

      const layerColor = getLayerColor(eraColor, i, activeLayers.length);
      const borderColor = getLayerBorderColor(i, isHighlighted);

      if (cached) {
        if (cached.type === 'FeatureCollection') {
          for (const f of cached.features) {
            features.push({
              ...f,
              properties: {
                ...f.properties,
                id: l.id,
                title: l.title,
                color: layerColor,
                borderColor,
                isFallback: false,
                isHighlighted,
                isDebugSelected,
                layerIndex: i,
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
              color: layerColor,
              borderColor,
              isFallback: false,
              isHighlighted,
              isDebugSelected,
              layerIndex: i,
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
            color: layerColor,
            borderColor,
            isFallback: true,
            isHighlighted,
            isDebugSelected,
            layerIndex: i,
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
  }, [activeLayers, eraColor, highlightedLayerId, debugSelectedLayerId]);

  // Список подписей активных территорий текущего года (заглавными буквами)
  // с защитой от наложения меток друг на друга
  const territoryLabels = useMemo(() => {
    const rawLabels = activeLayers.map((l, index) => {
      const [west, south, east, north] = l.bbox;
      let isSchematic = false;
      if (l.id !== 'kirghiz_ao' && l.id !== 'kirghiz_ssr' && l.id !== 'kyrgyzstan') {
        const cachedEntry = getCachedLayer(l.id);
        if (cachedEntry.status !== 'loaded') {
          isSchematic = true;
        } else if (cachedEntry.data) {
          const d = cachedEntry.data;
          if (d.type === 'FeatureCollection' && d.features.length > 0) {
            isSchematic = d.features[0].properties?.schematic !== false;
          } else if (d.type === 'Feature') {
            isSchematic = d.properties?.schematic !== false;
          }
        }
      }

      return {
        id: l.id,
        title: l.title.toUpperCase(),
        isSchematic,
        color: getLayerColor(eraColor, index, activeLayers.length),
        lng: (west + east) / 2,
        lat: (south + north) / 2,
        isHighlighted: l.id === highlightedLayerId,
      };
    });

    // Разносим центры меток по вертикали/горизонтали, если они слишком близко
    for (let i = 0; i < rawLabels.length; i++) {
      for (let j = i + 1; j < rawLabels.length; j++) {
        const dLng = Math.abs(rawLabels[i].lng - rawLabels[j].lng);
        const dLat = Math.abs(rawLabels[i].lat - rawLabels[j].lat);
        if (dLng < 4.5 && dLat < 2.5) {
          rawLabels[i].lat += 0.8;
          rawLabels[j].lat -= 0.8;
        }
      }
    }

    return rawLabels;
  }, [activeLayers, eraColor, highlightedLayerId]);

  return (
    <>
      <Source id="territories-source" type="geojson" data={geojson}>
        {/* Заливка фокусного государства: fill-opacity ~0.45, два слоя не скрывают друг друга */}
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

        {/* Контур фокусного государства: заметно толще соседних (2.6..3.6 px vs 0.8 px) */}
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

      {/* Подписи фокусных государств заглавными буквами с бейджами и возможностью выбора */}
      {territoryLabels.map((m) => (
        <Marker key={`marker-territory-${m.id}`} longitude={m.lng} latitude={m.lat} anchor="center">
          <button
            type="button"
            aria-label={`Территория: ${m.title}. Нажмите для подсветки границ`}
            onClick={(e) => {
              e.stopPropagation();
              setHighlightedLayerId(m.isHighlighted ? null : m.id);
            }}
            className="cursor-pointer select-none text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B2A28] rounded-xl transition-transform hover:scale-105 active:scale-95"
          >
            <span
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold tracking-wider uppercase shadow-md border backdrop-blur-md transition-all flex items-center gap-1.5 ${
                m.isHighlighted
                  ? 'bg-[#2B2A28] text-white border-white/20 ring-2 ring-[#2B2A28]/40 shadow-xl'
                  : 'bg-white/95 text-[#2B2A28] border-black/15 hover:bg-white hover:border-black/30'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/20"
                style={{ backgroundColor: m.color }}
              />
              <span>{m.title}</span>
              {m.isSchematic && (
                <span className="text-[9.5px] text-[#6B665E] font-normal lowercase italic tracking-normal">
                  (схематично)
                </span>
              )}
            </span>
          </button>
        </Marker>
      ))}
    </>
  );
}
