// Кусочно-линейная шкала: [год, позиция 0..1]. Эпохи занимают фиксированные доли ширины.
const stops: ReadonlyArray<readonly [number, number]> = [
  [-2000, 0.0], [552, 0.14], [924, 0.24], [1207, 0.32],
  [1500, 0.42], [1855, 0.55], [1917, 0.68], [1991, 0.84], [2027, 1.0],
];

export function toPos(year: number): number {
  if (year <= stops[0][0]) return 0;
  for (let i = 1; i < stops.length; i++) {
    const [y0, p0] = stops[i - 1], [y1, p1] = stops[i];
    if (year <= y1) return p0 + ((year - y0) / (y1 - y0)) * (p1 - p0);
  }
  return 1;
}

export function toYear(pos: number): number {
  if (pos <= 0) return stops[0][0];
  for (let i = 1; i < stops.length; i++) {
    const [y0, p0] = stops[i - 1], [y1, p1] = stops[i];
    if (pos <= p1) return Math.round(y0 + ((pos - p0) / (p1 - p0)) * (y1 - y0));
  }
  return stops[stops.length - 1][0];
}
