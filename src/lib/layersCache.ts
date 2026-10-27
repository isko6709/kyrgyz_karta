import type { Feature, FeatureCollection } from 'geojson';

export type LayerLoadStatus = 'idle' | 'loading' | 'loaded' | 'missing' | 'error';

export interface LayerCacheEntry {
  status: LayerLoadStatus;
  data: FeatureCollection | Feature | null;
  error?: string;
}

const cache: Record<string, LayerCacheEntry> = {};
const pendingRequests: Record<string, Promise<FeatureCollection | Feature | null>> = {};

/**
 * Загружает GeoJSON-файл слоя с обработкой ошибок и дедупликацией сетевых запросов
 */
export async function loadLayerGeoJson(
  layerId: string
): Promise<FeatureCollection | Feature | null> {
  if (cache[layerId] && cache[layerId].status !== 'idle' && cache[layerId].status !== 'loading') {
    return cache[layerId].data;
  }

  if (layerId in pendingRequests) {
    return pendingRequests[layerId];
  }

  cache[layerId] = { status: 'loading', data: null };

  pendingRequests[layerId] = fetch(`/data/layers/${layerId}.geojson`)
    .then(async (res) => {
      if (!res.ok) {
        if (res.status === 404) {
          cache[layerId] = { status: 'missing', data: null };
          return null;
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      cache[layerId] = { status: 'loaded', data };
      return data;
    })
    .catch((err) => {
      // Если файл отсутствует или синтаксическая ошибка
      cache[layerId] = {
        status: 'missing',
        data: null,
        error: err instanceof Error ? err.message : String(err),
      };
      return null;
    })
    .finally(() => {
      delete pendingRequests[layerId];
    });

  return pendingRequests[layerId];
}

/**
 * Получить текущий кэш слоя (синхронно)
 */
export function getCachedLayer(layerId: string): LayerCacheEntry {
  return cache[layerId] || { status: 'idle', data: null };
}

/**
 * Проверить статус всех указанных слоёв
 */
export async function checkAllLayersStatus(layerIds: string[]): Promise<Record<string, LayerCacheEntry>> {
  await Promise.all(layerIds.map((id) => loadLayerGeoJson(id)));
  const result: Record<string, LayerCacheEntry> = {};
  for (const id of layerIds) {
    result[id] = getCachedLayer(id);
  }
  return result;
}
