import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const eventsPath = path.join(rootDir, 'src/data/events.json');
const layersDir = path.join(rootDir, 'public/data/layers');

const MODERN_LAYER_IDS = ['kirghiz_ao', 'kirghiz_ssr', 'kyrgyzstan'];

async function fetchKgzGeometry() {
  const url =
    'https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/KGZ/ADM0/geoBoundaries-KGZ-ADM0_simplified.geojson';
  console.log(`Загрузка геометрии KGZ с ${url}...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Ошибка загрузки: HTTP ${res.status}`);
  }
  const geojson = await res.json();
  const feature = geojson.features ? geojson.features[0] : geojson;
  if (!feature || !feature.geometry) {
    throw new Error('В полученном GeoJSON нет геометрии');
  }

  // Округлим координаты до 5 знаков (~1 метр точности) для оптимизации размера
  function roundCoords(coords) {
    if (typeof coords[0] === 'number') {
      return [
        Math.round(coords[0] * 100000) / 100000,
        Math.round(coords[1] * 100000) / 100000,
      ];
    }
    return coords.map(roundCoords);
  }

  return {
    type: feature.geometry.type,
    coordinates: roundCoords(feature.geometry.coordinates),
  };
}

async function main() {
  await fs.mkdir(layersDir, { recursive: true });

  const rawEvents = await fs.readFile(eventsPath, 'utf8');
  const eventsData = JSON.parse(rawEvents);
  const layersMeta = eventsData.layers || [];

  const geometry = await fetchKgzGeometry();

  for (const id of MODERN_LAYER_IDS) {
    const meta = layersMeta.find((l) => l.id === id) || {
      id,
      title: id,
      from: 1924,
      to: 2027,
    };

    const outGeoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            id: meta.id,
            title: meta.title,
            from: meta.from,
            to: meta.to,
            schematic: false,
          },
          geometry,
        },
      ],
    };

    const targetFile = path.join(layersDir, `${id}.geojson`);
    await fs.writeFile(targetFile, JSON.stringify(outGeoJson, null, 2), 'utf8');
    console.log(`Создан слой: ${targetFile}`);
  }

  console.log('Готово! Все современные слои сгенерированы.');
}

main().catch((err) => {
  console.error('Ошибка создания современных слоев:', err);
  process.exit(1);
});
