import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const cacheDir = path.join(rootDir, '.cache/historical-basemaps');
const geoDir = path.join(cacheDir, 'geojson');
const indexFile = path.join(cacheDir, 'index.json');
const eventsFile = path.join(rootDir, 'src/data/events.json');
const layerSourcesFile = path.join(rootDir, 'src/data/layer-sources.json');
const layersOutDir = path.join(rootDir, 'public/data/layers');
const contextOutDir = path.join(rootDir, 'public/data/context');
const layersReportFile = path.join(rootDir, 'docs/layers-report.md');
const snapshotsIndexFile = path.join(rootDir, 'src/data/context-snapshots.json');

// --- 1. Проверка и клонирование репозитория ---
function ensureRepo() {
  if (!fsSync.existsSync(cacheDir)) {
    console.log('Клонирование historical-basemaps в .cache/historical-basemaps...');
    execSync('git clone --depth 1 https://github.com/aourednik/historical-basemaps .cache/historical-basemaps', {
      stdio: 'inherit',
    });
  } else {
    console.log('Репозиторий historical-basemaps найден в .cache/');
  }
}

// --- 2. Геометрические утилиты (Douglas-Peucker) ---
function getSqSegDist(p, p1, p2) {
  let x = p1[0], y = p1[1];
  let dx = p2[0] - x, dy = p2[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = p2[0];
      y = p2[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

function simplifyDPStep(points, first, last, sqTolerance, simplified) {
  let maxSqDist = sqTolerance;
  let index = -1;
  for (let i = first + 1; i < last; i++) {
    const sqDist = getSqSegDist(points[i], points[first], points[last]);
    if (sqDist > maxSqDist) {
      index = i;
      maxSqDist = sqDist;
    }
  }
  if (maxSqDist > sqTolerance) {
    if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
    simplified.push(points[index]);
    if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
  }
}

function simplifyRing(points, tolerance = 0.02, decimals = 4) {
  const mult = Math.pow(10, decimals);
  if (points.length <= 4) {
    return points.map((p) => [Math.round(p[0] * mult) / mult, Math.round(p[1] * mult) / mult]);
  }
  const sqTolerance = tolerance * tolerance;
  const simplified = [points[0]];
  simplifyDPStep(points, 0, points.length - 1, sqTolerance, simplified);
  simplified.push(points[points.length - 1]);
  if (simplified.length < 4) {
    return points.map((p) => [Math.round(p[0] * mult) / mult, Math.round(p[1] * mult) / mult]);
  }
  return simplified.map((p) => [Math.round(p[0] * mult) / mult, Math.round(p[1] * mult) / mult]);
}

function simplifyGeometry(geom, tol = 0.02, decimals = 4) {
  if (!geom || !geom.coordinates) return geom;
  if (geom.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geom.coordinates.map((ring) => simplifyRing(ring, tol, decimals)),
    };
  }
  if (geom.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geom.coordinates.map((poly) => poly.map((ring) => simplifyRing(ring, tol, decimals))),
    };
  }
  return geom;
}

function getFeatureBBox(geometry) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  function traverse(coords) {
    if (typeof coords[0] === 'number') {
      const [x, y] = coords;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      return;
    }
    for (const c of coords) traverse(c);
  }
  traverse(geometry.coordinates);
  return [minX, minY, maxX, maxY];
}

function bboxesOverlap(b1, b2, buffer = 15) {
  // b1: [minX, minY, maxX, maxY], b2: [west, south, east, north]
  return !(b1[2] < b2[0] - buffer || b1[0] > b2[2] + buffer || b1[3] < b2[1] - buffer || b1[1] > b2[3] + buffer);
}

// Стабильный пастельный цвет по имени государства
function getPastelColor(name) {
  if (!name) return '#E8E3D7';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 35%, 82%)`;
}

// --- 3. Основной процесс сборки ---
async function main() {
  ensureRepo();

  await fs.mkdir(layersOutDir, { recursive: true });
  await fs.mkdir(contextOutDir, { recursive: true });

  const eventsData = JSON.parse(await fs.readFile(eventsFile, 'utf8'));
  const layerSources = JSON.parse(await fs.readFile(layerSourcesFile, 'utf8'));
  const index = JSON.parse(await fs.readFile(indexFile, 'utf8'));

  const availableYears = index.years.map((y) => y.year).sort((a, b) => a - b);

  function getClosestAvailableYear(targetYear) {
    let best = availableYears[0];
    let minDiff = Infinity;
    for (const ay of availableYears) {
      const diff = Math.abs(ay - targetYear);
      if (diff < minDiff) {
        minDiff = diff;
        best = ay;
      }
    }
    return best;
  }

  const fileCache = {};
  function loadBasemapFile(year) {
    if (fileCache[year]) return fileCache[year];
    const item = index.years.find((y) => y.year === year);
    if (!item) return null;
    const fp = path.join(geoDir, item.filename);
    if (!fsSync.existsSync(fp)) return null;
    const data = JSON.parse(fsSync.readFileSync(fp, 'utf8'));
    fileCache[year] = data;
    return data;
  }

  const reports = [];

  console.log('\n--- Обработка 24 слоев территорий ---');

  for (const layer of eventsData.layers) {
    const cfg = layerSources.layers[layer.id];
    const targetFile = path.join(layersOutDir, `${layer.id}.geojson`);

    if (!cfg) {
      reports.push({
        id: layer.id,
        title: layer.title,
        status: 'warning',
        reason: 'Конфигурация источника отсутствует в layer-sources.json',
      });
      continue;
    }

    // Современные слои — официальный полигон KGZ
    if (cfg.modern) {
      const data2010 = loadBasemapFile(2010);
      const kgzFeature = data2010?.features?.find(
        (f) => f.properties?.NAME === 'Kyrgyzstan' || f.properties?.SUBJECTO === 'Kyrgyzstan'
      );

      if (kgzFeature) {
        const simplifiedGeom = simplifyGeometry(kgzFeature.geometry, 0.015, 4);
        const outGeoJson = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {
                id: layer.id,
                title: layer.title,
                source: 'historical-basemaps (world_2010)',
                snapshotYear: 2010,
                schematic: false,
              },
              geometry: simplifiedGeom,
            },
          ],
        };
        const content = JSON.stringify(outGeoJson, null, 2);
        await fs.writeFile(targetFile, content, 'utf8');
        const sizeKb = Math.round(Buffer.byteLength(content) / 1024);
        console.log(`✅ [Modern KGZ] ${layer.id} -> ${sizeKb} КБ (snapshot 2010)`);
        reports.push({
          id: layer.id,
          title: layer.title,
          status: 'success',
          snapshotYear: 2010,
          sourceNames: 'Kyrgyzstan',
          fileSizeKb: sizeKb,
          schematic: false,
        });
      } else {
        // Оставляем существующий файл
        reports.push({
          id: layer.id,
          title: layer.title,
          status: 'fallback',
          reason: 'Полигон Kyrgyzstan не найден в world_2010',
          schematic: false,
        });
      }
      continue;
    }

    // Исторические слои: поиск по preferred years и nameMatch
    let matchedFeatures = [];
    let matchedYear = null;

    for (const py of cfg.years) {
      const cy = getClosestAvailableYear(py);
      const data = loadBasemapFile(cy);
      if (!data) continue;

      const matches = data.features.filter((f) => {
        const name = (f.properties?.NAME || '').toLowerCase();
        const subjecto = (f.properties?.SUBJECTO || '').toLowerCase();

        const textMatch = cfg.nameMatch.some((m) => {
          const ml = m.toLowerCase();
          // Точное совпадение слова для коротких строк ('hun', 'turk')
          if (ml === 'hun') {
            return /\bhuns?\b/i.test(name) || /\bhuns?\b/i.test(subjecto);
          }
          if (ml === 'turk') {
            return /\bturks?\b/i.test(name) || /\bturks?\b/i.test(subjecto) || name.includes('göktürk');
          }
          // Опечатка/вариант в датасете: 'Khwarazmian'
          if (ml.startsWith('khwarez') || ml.startsWith('khorez')) {
            return name.includes('khwaraz') || subjecto.includes('khwaraz');
          }
          return name.includes(ml) || subjecto.includes(ml);
        });

        if (!textMatch) return false;

        // Фильтр пересечения с регионом слоя
        const featBbox = getFeatureBBox(f.geometry);
        return bboxesOverlap(featBbox, layer.bbox, 15);
      });

      if (matches.length > 0) {
        matchedFeatures = matches;
        matchedYear = cy;
        break;
      }
    }

    if (matchedFeatures.length > 0) {
      // Объединяем геометрию
      const allPolys = [];
      for (const f of matchedFeatures) {
        if (f.geometry.type === 'Polygon') {
          allPolys.push(f.geometry.coordinates);
        } else if (f.geometry.type === 'MultiPolygon') {
          allPolys.push(...f.geometry.coordinates);
        }
      }

      const combinedGeom =
        allPolys.length === 1
          ? { type: 'Polygon', coordinates: allPolys[0] }
          : { type: 'MultiPolygon', coordinates: allPolys };

      let tol = 0.02;
      let simplifiedGeom = simplifyGeometry(combinedGeom, tol, 4);
      let outGeoJson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              id: layer.id,
              title: layer.title,
              source: 'historical-basemaps',
              snapshotYear: matchedYear,
              schematic: false,
            },
            geometry: simplifiedGeom,
          },
        ],
      };
      let content = JSON.stringify(outGeoJson, null, 2);
      while (Buffer.byteLength(content) > 150 * 1024 && tol < 0.1) {
        tol += 0.015;
        simplifiedGeom = simplifyGeometry(combinedGeom, tol, 3);
        outGeoJson.features[0].geometry = simplifiedGeom;
        content = JSON.stringify(outGeoJson);
      }

      await fs.writeFile(targetFile, content, 'utf8');
      const sizeKb = Math.round(Buffer.byteLength(content) / 1024);
      const namesStr = matchedFeatures.map((f) => f.properties.NAME).join(', ');
      console.log(`✅ [Basemap] ${layer.id} -> ${sizeKb} КБ (snapshot ${matchedYear}: ${namesStr})`);

      reports.push({
        id: layer.id,
        title: layer.title,
        status: 'success',
        snapshotYear: matchedYear,
        sourceNames: namesStr,
        fileSizeKb: sizeKb,
        schematic: false,
      });
    } else {
      // Фича не найдена: если файл уже есть, сохраняем, иначе создаем прямоугольник из bbox
      const fileExists = fsSync.existsSync(targetFile);
      if (!fileExists) {
        const [w, s, e, n] = layer.bbox;
        const bboxGeoJson = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {
                id: layer.id,
                title: layer.title,
                from: layer.from,
                to: layer.to,
                schematic: true,
              },
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [w, s],
                    [e, s],
                    [e, n],
                    [w, n],
                    [w, s],
                  ],
                ],
              },
            },
          ],
        };
        await fs.writeFile(targetFile, JSON.stringify(bboxGeoJson, null, 2), 'utf8');
      }

      console.log(`⚠️ [Fallback BBox/Schematic] ${layer.id} (не найдено совпадений по [${cfg.nameMatch.join(', ')}])`);
      reports.push({
        id: layer.id,
        title: layer.title,
        status: 'schematic',
        reason: `В снимках [${cfg.years.join(', ')}] датасета нет отдельного полигона для [${cfg.nameMatch.join(', ')}]`,
        schematic: true,
      });
    }
  }

  // --- 4. Генерация контекста соседей (world_<год>.geojson) ---
  console.log('\n--- Генерация контекста соседей (public/data/context/) ---');

  const contextSnapshots = [];
  // Берем снимки для нашей хронологии: от -700 до 2010
  const timelineYears = availableYears.filter((y) => y >= -700 && y <= 2010);

  for (const year of timelineYears) {
    const rawData = loadBasemapFile(year);
    if (!rawData) continue;

    const simplifiedFeatures = rawData.features
      .filter((f) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'))
      .map((f) => {
        const name = f.properties?.NAME || '';
        return {
          type: 'Feature',
          properties: {
            NAME: name,
            SUBJECTO: f.properties?.SUBJECTO || name,
            color: getPastelColor(name),
          },
          geometry: simplifyGeometry(f.geometry, 0.04, 3),
        };
      });

    const contextGeoJson = {
      type: 'FeatureCollection',
      features: simplifiedFeatures,
    };

    const fileName = `world_${year}.geojson`;
    const outFile = path.join(contextOutDir, fileName);
    const content = JSON.stringify(contextGeoJson);
    await fs.writeFile(outFile, content, 'utf8');
    const sizeKb = Math.round(Buffer.byteLength(content) / 1024);

    contextSnapshots.push({
      year,
      file: `/data/context/${fileName}`,
      sizeKb,
    });
  }

  await fs.writeFile(snapshotsIndexFile, JSON.stringify(contextSnapshots, null, 2), 'utf8');
  console.log(`Сгенерировано ${contextSnapshots.length} контекстных снимков соседей.`);

  // --- 5. Генерация отчёта docs/layers-report.md ---
  let reportMd = `# Отчёт по слоям территорий и датасету historical-basemaps

Дата генерации: ${new Date().toISOString().split('T')[0]}
Источник данных: [historical-basemaps](https://github.com/aourednik/historical-basemaps) (автор A. Ourednik и контрибьюторы, лицензия GNU GPLv3).

## 1. Сводная таблица 24 слоёв

| # | ID | Название | Статус границы | Снимок | Исходные полигоны / Причина | Размер |
|---|----|----------|----------------|--------|------------------------------|--------|
`;

  reports.forEach((r, idx) => {
    const statusBadge =
      r.status === 'success'
        ? '✅ Точные границы'
        : '⚠️ Схематичный полигон';
    const snapshot = r.snapshotYear !== undefined ? `${r.snapshotYear} г.` : '—';
    const desc = r.sourceNames ? r.sourceNames : r.reason || 'BBox';
    const size = r.fileSizeKb ? `${r.fileSizeKb} КБ` : '< 2 КБ';
    reportMd += `| ${idx + 1} | \`${r.id}\` | ${r.title} | ${statusBadge} | ${snapshot} | ${desc} | ${size} |\n`;
  });

  reportMd += `
## 2. Итоги обработки

- **Всего слоёв в проекте**: ${reports.length}
- **Слоёв с реальными границами из historical-basemaps / KGZ**: ${reports.filter((r) => r.status === 'success').length}
- **Схематичных слоёв (сохранены полигоны / BBox)**: ${reports.filter((r) => r.status !== 'success').length}

## 3. Причины для схематичных слоёв

В глобальном датасете historical-basemaps ряд государств и племён Центральной Азии:
1. **Ранние кыргызы (\`yenisei_early\`, \`yenisei_khaganate\`)**: в мировых базисных картах Минусинская котловина показана как часть таёжных охотников-собирателей Сибири, без выделения кыргызского каганата.
2. **Караханиды (\`karakhanid\`)**: в снимках 1000 и 1100 гг. регион Тянь-Шаня и Семиречья оставлен неразмеченным (null).
3. **Ханства Нового времени (\`kokand\`, \`dzungar\`, \`kazakh_khanate\`, \`yarkand_khanate\`)**: в снимках 1530–1815 гг. Средняя Азия обозначена обобщённо как «central Asian khanates» либо перекрыта соседними империями.
4. Для этих слоёв в соответствии с правилами сохранены аккуратные схематичные контуры с пометкой **«(схематично)»**.

## 4. Контекст соседей

Сгенерировано ${contextSnapshots.length} упрощённых снимков мира (от -700 до 2010 г.) в папке \`public/data/context/\`. 
Каждый снимок оптимизирован до ~150–280 КБ и подгружается лениво в зависимости от выбранного года.
`;

  await fs.writeFile(layersReportFile, reportMd, 'utf8');
  console.log(`\nОтчёт сохранён в ${layersReportFile}`);
  console.log('Готово!');
}

main().catch((err) => {
  console.error('Ошибка в build-layers.mjs:', err);
  process.exit(1);
});
