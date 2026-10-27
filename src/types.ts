export type LatLng = [number, number]; // [lat, lng]. Для MapLibre переворачивать в [lng, lat]!

export interface Era { id: string; title: string; from: number; to: number; color: string }

export interface Layer {
  id: string; title: string; from: number; to: number;
  bbox: [number, number, number, number]; // [west, south, east, north] — заглушка до появления GeoJSON
  note?: string;
}

export type Certainty = 'high' | 'medium' | 'debated';

export interface HistEvent {
  id: number;
  year: number;            // отрицательные — до н.э.
  yearEnd?: number;
  date: string;            // готовая строка для показа
  era: string;
  category: 'state' | 'war' | 'culture' | 'trade' | 'society' | 'tragedy' | 'economy';
  title: string;
  summary: string;
  coords: LatLng;
  zoom: number;
  layer: string | null;
  certainty: Certainty;
  planned?: boolean;
}

export interface Ruler {
  id: string;              // = имя файла портрета в public/portraits
  name: string;
  role: string;
  display: string;
  from: number | null;     // null — вне шкалы (эпический персонаж)
  to: number | null;
  era: string;
  layer: string | null;
  imageType: 'photo' | 'historical-art' | 'none';
  commonsQuery: string;
  certainty: Certainty;
  legendary?: boolean;
  figureType?: 'culture' | 'ruler' | string;
  note: string;
}
