import { useEffect, useState } from 'react';
import type { Feature, FeatureCollection } from 'geojson';

export type LayerLoadStatus = 'idle' | 'loading' | 'loaded' | 'missing' | 'error';
export type LayerSourceType =
  | 'historical-basemaps'
  | 'override'
  | 'schematic'
  | 'approximate-admin'
  | 'unknown';

export interface LayerCacheEntry {
  status: LayerLoadStatus;
  data: FeatureCollection | Feature | null;
  source?: LayerSourceType;
  snapshotYear?: number | null;
  vertices?: number;
  sizeKb?: number;
  isOverride?: boolean;
  error?: string;
}

const cache: Record<string, LayerCacheEntry> = {};
const pendingRequests: Record<string, Promise<FeatureCollection | Feature | null>> = {};
type LayerCacheListener = (layerId: string) => void;
const cacheListeners = new Set<LayerCacheListener>();

export function subscribeLayerCache(cb: LayerCacheListener): () => void {
  cacheListeners.add(cb);
  return () => {
    cacheListeners.delete(cb);
  };
}

function notifyCacheUpdate(layerId: string) {
  for (const listener of cacheListeners) {
    try {
      listener(layerId);
    } catch {}
  }
}

/**
 * Подсчёт общего количества вершин во всех кольцах полигонов
 */
export function countGeometryVertices(geom: unknown): number {
  if (!geom || typeof geom !== 'object') return 0;
  const g = geom as { type?: string; coordinates?: unknown };
  if (g.type === 'Polygon' && Array.isArray(g.coordinates)) {
    return (g.coordinates as number[][][]).reduce(
      (acc, ring) => acc + (Array.isArray(ring) ? ring.length : 0),
      0
    );
  }
  if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
    return (g.coordinates as number[][][][]).reduce(
      (acc, poly) =>
        acc +
        (Array.isArray(poly)
          ? poly.reduce((rAcc, ring) => rAcc + (Array.isArray(ring) ? ring.length : 0), 0)
          : 0),
      0
    );
  }
  return 0;
}

/**
 * Загружает GeoJSON-файл слоя с поддержкой ручных оверрайдов (layers-override)
 * 1. Проверяет /data/layers-override/<id>.geojson (высший приоритет)
 * 2. Если нет (404), загружает /data/layers/<id>.geojson
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

  pendingRequests[layerId] = (async () => {
    try {
      // 1. Попытка загрузить из папки ручных оверрайдов (layers-override)
      let isOverride = false;
      let res: Response | null = null;
      try {
        const overrideRes = await fetch(`/data/layers-override/${layerId}.geojson`);
        const ct = overrideRes.headers.get('content-type') || '';
        // В Vite/SPA 404 возвращает 200 OK с index.html (text/html)
        if (overrideRes.ok && !ct.includes('text/html')) {
          const text = await overrideRes.clone().text();
          if (text.trim().startsWith('{')) {
            res = overrideRes;
            isOverride = true;
          }
        }
      } catch {
        // Оверрайд не найден, продолжаем загрузку базового слоя
      }

      // 2. Базовый путь
      if (!res) {
        res = await fetch(`/data/layers/${layerId}.geojson`);
      }

      if (!res.ok) {
        if (res.status === 404) {
          cache[layerId] = { status: 'missing', data: null, isOverride: false };
          notifyCacheUpdate(layerId);
          return null;
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const ct = res.headers.get('content-type') || '';
      if (ct.includes('text/html')) {
        // Vite SPA вернул index.html вместо geojson
        cache[layerId] = { status: 'missing', data: null, isOverride: false };
        notifyCacheUpdate(layerId);
        return null;
      }

      const text = await res.text();
      if (!text.trim().startsWith('{')) {
        cache[layerId] = { status: 'missing', data: null, isOverride: false };
        notifyCacheUpdate(layerId);
        return null;
      }

      const sizeKb = Math.max(1, Math.round(new Blob([text]).size / 1024));
      const data = JSON.parse(text) as FeatureCollection | Feature;

      // Анализ фичи и свойств
      const feat: Feature | null =
        data.type === 'FeatureCollection' && data.features.length > 0
          ? data.features[0]
          : data.type === 'Feature'
          ? (data as Feature)
          : null;

      let source: LayerSourceType = 'historical-basemaps';
      let snapshotYear: number | null = null;
      let vertices = 0;

      if (feat) {
        vertices = countGeometryVertices(feat.geometry);
        snapshotYear = (feat.properties?.snapshotYear as number | null) ?? null;

        if (isOverride) {
          source = 'override';
          if (feat.properties) feat.properties.source = 'override';
        } else if (
          feat.properties?.approximate === true ||
          feat.properties?.type === 'approximate-admin'
        ) {
          source = 'approximate-admin';
        } else if (feat.properties?.schematic === true) {
          source = 'schematic';
        } else if (feat.properties?.source) {
          source = feat.properties.source as LayerSourceType;
        }
      }

      cache[layerId] = {
        status: 'loaded',
        data,
        source,
        snapshotYear,
        vertices,
        sizeKb,
        isOverride,
      };

      notifyCacheUpdate(layerId);
      return data;
    } catch (err) {
      cache[layerId] = {
        status: 'missing',
        data: null,
        error: err instanceof Error ? err.message : String(err),
      };
      notifyCacheUpdate(layerId);
      return null;
    } finally {
      delete pendingRequests[layerId];
    }
  })();

  return pendingRequests[layerId];
}

/**
 * Получить текущий кэш слоя (синхронно)
 */
export function getCachedLayer(layerId: string): LayerCacheEntry {
  return cache[layerId] || { status: 'idle', data: null };
}

/**
 * Проверяет, отсутствует ли реальный полигон у слоя
 */
export function isLayerWithoutPolygon(entry: LayerCacheEntry | null | undefined): boolean {
  if (!entry) return true;
  if (entry.status === 'missing' || entry.status === 'error') return true;
  if (entry.status === 'loaded') {
    if (!entry.data) return true;
    if (entry.data.type === 'FeatureCollection' && entry.data.features.length === 0) return true;
  }
  return false;
}

/**
 * React-хук для реактивного отслеживания загрузки и статуса слоя
 */
export function useLayerCacheEntry(layerId: string | null | undefined): LayerCacheEntry | null {
  const [entry, setEntry] = useState<LayerCacheEntry>(() =>
    layerId ? getCachedLayer(layerId) : { status: 'idle', data: null }
  );

  useEffect(() => {
    if (!layerId) return;

    // Инициируем загрузку, если статус idle
    const current = getCachedLayer(layerId);
    if (current.status === 'idle') {
      loadLayerGeoJson(layerId);
    }
    setEntry(current);

    return subscribeLayerCache((updatedId) => {
      if (updatedId === layerId) {
        setEntry(getCachedLayer(layerId));
      }
    });
  }, [layerId]);

  return layerId ? entry : null;
}

/**
 * Проверить статус всех указанных слоёв с получением метаданных
 */
export async function checkAllLayersStatus(
  layerIds: string[]
): Promise<Record<string, LayerCacheEntry>> {
  await Promise.all(layerIds.map((id) => loadLayerGeoJson(id)));
  const result: Record<string, LayerCacheEntry> = {};
  for (const id of layerIds) {
    result[id] = getCachedLayer(id);
  }
  return result;
}
