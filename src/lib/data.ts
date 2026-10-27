import eventsData from '../data/events.json';
import rulersData from '../data/rulers.json';
import type { Era, HistEvent, Layer, Ruler } from '../types';

export const events: HistEvent[] = eventsData.events as HistEvent[];
export const eras: Era[] = eventsData.eras as Era[];
export const layers: Layer[] = eventsData.layers as Layer[];
export const rulers: Ruler[] = rulersData.rulers as Ruler[];

/**
 * Возвращает события для указанного года.
 * Если у события задан yearEnd, проверяется попадание года в диапазон [year, yearEnd].
 * Иначе проверяется точное совпадение ev.year === year.
 * Отрицательные значения соответствуют годам до н.э.
 */
export function eventsForYear(year: number): HistEvent[] {
  return events.filter((e) =>
    e.yearEnd !== undefined
      ? e.year <= year && year <= e.yearEnd
      : e.year === year
  );
}

/**
 * Возвращает правителей и деятелей, активных в указанном году (from <= year <= to).
 * Персонажи вне шкалы (from / to === null, например эпический Манас) пропускаются.
 */
export function rulersForYear(year: number): Ruler[] {
  return rulers.filter(
    (r): r is Ruler & { from: number; to: number } =>
      r.from !== null && r.to !== null && r.from <= year && year <= r.to
  );
}

/**
 * Преобразует координаты из формата данных [lat, lng] в формат MapLibre [lng, lat].
 */
export function toLngLat(coords: [number, number]): [number, number] {
  return [coords[1], coords[0]];
}

/**
 * Возвращает слои территорий для указанного года (from <= year <= to).
 */
export function layersForYear(year: number): Layer[] {
  return layers.filter((l) => l.from <= year && year <= l.to);
}

/**
 * Возвращает эпоху для указанного года.
 * На стыках эпох отдаётся предпочтение наступающей эпохе.
 * Годы до н.э. отрицательные.
 */
export function eraForYear(year: number): Era | undefined {
  if (eras.length === 0) return undefined;
  const match = [...eras].reverse().find((e) => year >= e.from && year <= e.to);
  if (match) return match;
  if (year < eras[0].from) return eras[0];
  if (year > eras[eras.length - 1].to) return eras[eras.length - 1];
  return undefined;
}
