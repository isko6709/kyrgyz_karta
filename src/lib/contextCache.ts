import type { FeatureCollection } from 'geojson';
import snapshots from '../data/context-snapshots.json';

export interface SnapshotMeta {
  year: number;
  file: string;
  sizeKb: number;
}

const availableSnapshots: SnapshotMeta[] = snapshots as SnapshotMeta[];
const cache: Record<number, FeatureCollection | null> = {};
const pendingRequests: Record<number, Promise<FeatureCollection | null>> = {};

/**
 * Находит ближайший год контекстного снимка для заданного года хронологии
 */
export function getClosestSnapshotYear(year: number): number {
  if (availableSnapshots.length === 0) return 2010;
  let best = availableSnapshots[0].year;
  let minDiff = Infinity;
  for (const s of availableSnapshots) {
    const diff = Math.abs(s.year - year);
    if (diff < minDiff) {
      minDiff = diff;
      best = s.year;
    }
  }
  return best;
}

/**
 * Загружает и кэширует контекстный GeoJSON-снимок (соседи)
 */
export async function loadContextGeoJson(snapshotYear: number): Promise<FeatureCollection | null> {
  if (snapshotYear in cache) {
    return cache[snapshotYear];
  }

  if (snapshotYear in pendingRequests) {
    return pendingRequests[snapshotYear];
  }

  const s = availableSnapshots.find((item) => item.year === snapshotYear);
  const url = s ? s.file : `/data/context/world_${snapshotYear}.geojson`;

  pendingRequests[snapshotYear] = fetch(url)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = (await res.json()) as FeatureCollection;
      cache[snapshotYear] = data;
      return data;
    })
    .catch((err) => {
      console.warn(`Не удалось загрузить контекстный снимок ${snapshotYear}:`, err);
      cache[snapshotYear] = null;
      return null;
    })
    .finally(() => {
      delete pendingRequests[snapshotYear];
    });

  return pendingRequests[snapshotYear];
}

/**
 * Синхронное получение уже закэшированного снимка
 */
export function getCachedContext(snapshotYear: number): FeatureCollection | null {
  return cache[snapshotYear] ?? null;
}
