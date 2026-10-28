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
 * Вычисляет приближенную площадь замкнутого кольца координат
 */
function computeRingArea(coords: [number, number][]): number {
  let area = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = coords[i];
    const p2 = coords[i + 1];
    area += (p2[0] - p1[0]) * (p1[1] + p2[1]);
  }
  return Math.abs(area) / 2;
}

/**
 * Вычисляет площадь геометрии в квадратных градусах
 */
export function computeGeometryArea(geometry: unknown): number {
  if (!geometry || typeof geometry !== 'object') return 0;
  const g = geometry as { type?: string; coordinates?: unknown };
  if (g.type === 'Polygon' && Array.isArray(g.coordinates) && Array.isArray(g.coordinates[0])) {
    return computeRingArea(g.coordinates[0] as [number, number][]);
  }
  if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
    return (g.coordinates as [number, number][][][]).reduce(
      (sum: number, poly) => sum + (Array.isArray(poly) && Array.isArray(poly[0]) ? computeRingArea(poly[0]) : 0),
      0
    );
  }
  return 0;
}

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
      if (data && Array.isArray(data.features)) {
        for (const feat of data.features) {
          if (!feat.properties) feat.properties = {};
          const area = Math.round(computeGeometryArea(feat.geometry) * 10) / 10;
          feat.properties.area = area;
          // Чем больше площадь, тем меньше sort_key (наивысший приоритет размещения в MapLibre)
          feat.properties.sort_key = 10000000 - Math.min(10000000, Math.round(area * 100));
          // Крупными государствами для zoom < 4 считаем полигоны с площадью >= 70 кв. градусов
          feat.properties.is_major = area >= 70;
        }
      }
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
