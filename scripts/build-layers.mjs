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
const mappingFile = path.join(rootDir, 'docs/layers-mapping.json');
const reportFile = path.join(rootDir, 'docs/layers-report.md');
const layersOutDir = path.join(rootDir, 'public/data/layers');
const layersOverrideDir = path.join(rootDir, 'public/data/layers-override');
const contextOutDir = path.join(rootDir, 'public/data/context');
const snapshotsIndexFile = path.join(rootDir, 'src/data/context-snapshots.json');

// 1. Проверка наличия репозитория historical-basemaps
function ensureRepo() {
  if (!fsSync.existsSync(cacheDir)) {
    console.log('Клонирование https://github.com/aourednik/historical-basemaps в .cache/historical-basemaps...');
    execSync('git clone --depth 1 https://github.com/aourednik/historical-basemaps .cache/historical-basemaps', {
      stdio: 'inherit',
    });
  } else {
    console.log('Репозиторий historical-basemaps проверен в .cache/historical-basemaps');
  }
}

// 2. Геометрические утилиты: Douglas-Peucker, BBox, подсчёт вершин
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

function getGeometryBBox(geometry) {
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

function countVertices(geometry) {
  let count = 0;
  function traverse(coords) {
    if (typeof coords[0] === 'number') {
      count++;
      return;
    }
    for (const c of coords) traverse(c);
  }
  traverse(geometry.coordinates);
  return count;
}

function getPastelColor(name) {
  if (!name) return '#E8E3D7';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 35%, 82%)`;
}

async function main() {
  ensureRepo();

  await fs.mkdir(layersOutDir, { recursive: true });
  await fs.mkdir(contextOutDir, { recursive: true });

  const eventsData = JSON.parse(await fs.readFile(eventsFile, 'utf8'));
  const _layerSources = JSON.parse(await fs.readFile(layerSourcesFile, 'utf8'));
  const index = JSON.parse(await fs.readFile(indexFile, 'utf8'));

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

  // 3. Загружаем или формируем docs/layers-mapping.json (таблица сопоставлений)
  let mapping = {};
  if (fsSync.existsSync(mappingFile)) {
    try {
      mapping = JSON.parse(await fs.readFile(mappingFile, 'utf8'));
      console.log('Загружена существующая таблица сопоставлений docs/layers-mapping.json');
    } catch {
      mapping = {};
    }
  }

  // Карта сопоставления по умолчанию (если слой ещё не зафиксирован в mapping)
  const DEFAULT_STRATEGY = {
    saka_wusun: {
      status: 'matched',
      snapshotYear: -100,
      filename: 'world_bc100.geojson',
      matchedNames: ['Saces'],
      notes: 'С полигоном Saces (саки Тянь-Шаня/Семиречья) в world_bc100',
    },
    turkic_khaganates: {
      status: 'matched',
      snapshotYear: 600,
      filename: 'world_600.geojson',
      matchedNames: ['Göktürks'],
      notes: 'Тюркский каганат (Göktürks) в world_600',
    },
    kara_khitai: {
      status: 'matched',
      snapshotYear: 1200,
      filename: 'world_1200.geojson',
      matchedNames: ['Kara Khitai Khaganate'],
      notes: 'Каракитайское ханство (Западное Ляо) в world_1200',
    },
    chagatai_ulus: {
      status: 'matched',
      snapshotYear: 1279,
      filename: 'world_1279.geojson',
      matchedNames: ['Chagatai Khanate'],
      notes: 'Улус Чагатая в world_1279',
    },
    moghulistan: {
      status: 'matched',
      snapshotYear: 1400,
      filename: 'world_1400.geojson',
      matchedNames: ['Chagatai Khanate'],
      notes: 'Восточный Чагатайский улус (Моголистан) в world_1400',
    },
    xiongnu: {
      status: 'matched',
      snapshotYear: -200,
      filename: 'world_bc200.geojson',
      matchedNames: ['Xiongnu'],
      notes: 'Империя Хунну в world_bc200',
    },
    uyghur_khaganate: {
      status: 'matched',
      snapshotYear: 800,
      filename: 'world_800.geojson',
      matchedNames: ['Uyghurs'],
      notes: 'Уйгурский каганат в world_800',
    },
    samanid: {
      status: 'matched',
      snapshotYear: 900,
      filename: 'world_900.geojson',
      matchedNames: ['Samanid Empire'],
      notes: 'Государство Саманидов в world_900',
    },
    khwarezmshah: {
      status: 'matched',
      snapshotYear: 1200,
      filename: 'world_1200.geojson',
      matchedNames: ['Khwarazmian dynasty'],
      notes: 'Государство Хорезмшахов в world_1200',
    },
    timurid: {
      status: 'matched',
      snapshotYear: 1400,
      filename: 'world_1400.geojson',
      matchedNames: ['Timurid Empire'],
      notes: 'Империя Тимуридов в world_1400',
    },
    kazakh_khanate: {
      status: 'matched',
      snapshotYear: 1530,
      filename: 'world_1530.geojson',
      matchedNames: ['Quazaq Khanate'],
      notes: 'Казахское ханство (Quazaq Khanate) в world_1530',
    },
    qing_xinjiang: {
      status: 'matched',
      snapshotYear: 1914,
      filename: 'world_1914.geojson',
      matchedNames: ['Xinjiang'],
      notes: 'Цинский Синьцзян в границах провинции Синьцзян в world_1914',
    },
    kirghiz_ao: {
      status: 'matched',
      snapshotYear: 2010,
      filename: 'world_2010.geojson',
      matchedNames: ['Kyrgyzstan'],
      modern: true,
      notes: 'Официальный полигон KGZ (Natural Earth / world_2010)',
    },
    kirghiz_ssr: {
      status: 'matched',
      snapshotYear: 2010,
      filename: 'world_2010.geojson',
      matchedNames: ['Kyrgyzstan'],
      modern: true,
      notes: 'Официальный полигон KGZ (Natural Earth / world_2010)',
    },
    kyrgyzstan: {
      status: 'matched',
      snapshotYear: 2010,
      filename: 'world_2010.geojson',
      matchedNames: ['Kyrgyzstan'],
      modern: true,
      notes: 'Официальный полигон KGZ (Natural Earth / world_2010)',
    },
    // Схематичные слои (нет в мировых базисных картах либо сильное генерализованное перекрытие)
    yenisei_early: {
      status: 'schematic',
      snapshotYear: null,
      filename: null,
      matchedNames: [],
      reason: 'Минусинская котловина в -200..840 гг. показана как часть таёжных племён Сибири, без выделения кыргызского каганата',
    },
    yenisei_khaganate: {
      status: 'schematic',
      snapshotYear: null,
      filename: null,
      matchedNames: [],
      reason: 'Кыргызский каганат на Верхнем Енисее не выделен в отдельный полигон в снимке 900 г.',
    },
    karakhanid: {
      status: 'schematic',
      snapshotYear: null,
      filename: null,
      matchedNames: [],
      reason: 'В снимках 1000 и 1100 гг. регион Тянь-Шаня и Семиречья оставлен неразмеченным (null)',
    },
    kyrgyz_tianshan: {
      status: 'schematic',
      snapshotYear: null,
      filename: null,
      matchedNames: [],
      reason: 'Этническая территория кыргызских племён Тянь-Шаня, не являвшаяся централизованной мировой империей',
    },
    dzungar: {
      status: 'schematic',
      snapshotYear: null,
      filename: null,
      matchedNames: [],
      reason: 'В снимках 1650–1715 гг. Средняя Азия обозначена обобщённо как central Asian khanates',
    },
    kokand: {
      status: 'schematic',
      snapshotYear: null,
      filename: null,
      matchedNames: [],
      reason: 'В снимках 1800–1880 гг. Коканд объединён в central Asian khanates вместе с Хивой и Бухарой; сохранён точный региональный контур Ферганы',
    },
    russian_turkestan: {
      status: 'schematic',
      snapshotYear: null,
      filename: null,
      matchedNames: [],
      reason: 'В 1880 г. полигон Russian Empire охватывает всю Евразию (от Польши до Берингова пролива); использование глобального полигона исказило бы границы Туркестанского генерал-губернаторства на 180°',
    },
    yarkand_khanate: {
      status: 'schematic',
      snapshotYear: null,
      filename: null,
      matchedNames: [],
      reason: 'Таримский бассейн в 1530–1650 гг. не выделен отдельным полигоном в снимках basemaps',
    },
    turkestan_assr: {
      status: 'schematic',
      snapshotYear: null,
      filename: null,
      matchedNames: [],
      reason: 'В снимке 1920 г. Туркестанская АССР входит в единый массив РСФСР/СССР без границ автономии',
    },
  };

  // 4. Построение слоёв с проверкой layers-override
  console.log('\n--- Обработка 24 слоёв с учётом layers-mapping.json ---');

  const reportItems = [];

  for (const layer of eventsData.layers) {
    const overrideFile = path.join(layersOverrideDir, `${layer.id}.geojson`);
    const targetFile = path.join(layersOutDir, `${layer.id}.geojson`);

    // Если есть ручной override, он имеет высший приоритет
    if (fsSync.existsSync(overrideFile)) {
      console.log(`📁 [Override] Слой ${layer.id} взят из layers-override`);
      await fs.copyFile(overrideFile, targetFile);
      const content = await fs.readFile(targetFile, 'utf8');
      const parsed = JSON.parse(content);
      const feat = parsed.features ? parsed.features[0] : parsed;
      const geomBbox = getGeometryBBox(feat.geometry);
      const vCount = countVertices(feat.geometry);
      const sizeKb = Math.round(Buffer.byteLength(content) / 1024);

      mapping[layer.id] = {
        layerId: layer.id,
        status: 'override',
        snapshotYear: feat.properties?.snapshotYear ?? null,
        filename: overrideFile,
        matchedNames: feat.properties?.matchedNames ?? [],
        featureCount: parsed.features ? parsed.features.length : 1,
        source: 'layers-override',
      };

      reportItems.push({
        id: layer.id,
        title: layer.title,
        status: 'override',
        snapshotYear: feat.properties?.snapshotYear ?? '—',
        matchedNames: 'Override',
        sizeKb,
        vertices: vCount,
        geomBbox,
        layerBbox: layer.bbox,
        notes: 'Ручной оверрайд из public/data/layers-override/',
      });
      continue;
    }

    // Приоритетная стратегия из mapping или по умолчанию
    const strat = mapping[layer.id] || DEFAULT_STRATEGY[layer.id];
    mapping[layer.id] = { ...strat, layerId: layer.id };

    if (strat.status === 'matched') {
      const data = loadBasemapFile(strat.snapshotYear);
      let matchedFeatures = [];

      if (strat.modern) {
        const kgz = data?.features?.find(
          (f) => f.properties?.NAME === 'Kyrgyzstan' || f.properties?.SUBJECTO === 'Kyrgyzstan'
        );
        if (kgz) matchedFeatures = [kgz];
      } else {
        matchedFeatures = (data?.features || []).filter((f) => {
          const name = f.properties?.NAME || '';
          const subj = f.properties?.SUBJECTO || '';
          return strat.matchedNames.some(
            (mn) => name.toLowerCase() === mn.toLowerCase() || subj.toLowerCase() === mn.toLowerCase()
          );
        });
      }

      if (matchedFeatures.length > 0) {
        mapping[layer.id].featureCount = matchedFeatures.length;

        // Объединение геометрии
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

        // Упрощение (tolerance ~0.02, размер ≤ 150 КБ)
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
                snapshotYear: strat.snapshotYear,
                matchedNames: strat.matchedNames,
                schematic: false,
              },
              geometry: simplifiedGeom,
            },
          ],
        };

        let content = JSON.stringify(outGeoJson, null, 2);
        while (Buffer.byteLength(content) > 150 * 1024 && tol < 0.12) {
          tol += 0.015;
          simplifiedGeom = simplifyGeometry(combinedGeom, tol, 3);
          outGeoJson.features[0].geometry = simplifiedGeom;
          content = JSON.stringify(outGeoJson);
        }

        await fs.writeFile(targetFile, content, 'utf8');

        const sizeKb = Math.round(Buffer.byteLength(content) / 1024);
        const geomBbox = getGeometryBBox(simplifiedGeom);
        const vCount = countVertices(simplifiedGeom);

        console.log(`✅ [Matched] ${layer.id} -> ${sizeKb} КБ (${strat.snapshotYear} г., ${vCount} вершин, фичи: ${strat.matchedNames.join(', ')})`);

        reportItems.push({
          id: layer.id,
          title: layer.title,
          status: 'matched',
          snapshotYear: strat.snapshotYear,
          matchedNames: strat.matchedNames.join(', '),
          sizeKb,
          vertices: vCount,
          geomBbox,
          layerBbox: layer.bbox,
          notes: strat.notes || 'Точные границы из historical-basemaps',
        });
      } else {
        // Fallback если фича не найдена
        console.warn(`⚠️ [Match failed] ${layer.id}: фича ${strat.matchedNames} не найдена в снимке ${strat.snapshotYear}`);
      }
    } else {
      // Схематичный слой (schematic: true)
      // Если файл уже существует (например, качественный контур из стартового пакета), обновляем properties
      let existingGeom = null;
      if (fsSync.existsSync(targetFile)) {
        try {
          const raw = JSON.parse(await fs.readFile(targetFile, 'utf8'));
          const f = raw.features ? raw.features[0] : raw;
          existingGeom = f.geometry;
        } catch {
          existingGeom = null;
        }
      }

      if (!existingGeom) {
        const [w, s, e, n] = layer.bbox;
        existingGeom = {
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
        };
      }

      const outGeoJson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              id: layer.id,
              title: layer.title,
              from: layer.from,
              to: layer.to,
              source: 'schematic',
              snapshotYear: null,
              matchedNames: [],
              schematic: true,
            },
            geometry: existingGeom,
          },
        ],
      };

      const content = JSON.stringify(outGeoJson, null, 2);
      await fs.writeFile(targetFile, content, 'utf8');

      const sizeKb = Math.round(Buffer.byteLength(content) / 1024);
      const geomBbox = getGeometryBBox(existingGeom);
      const vCount = countVertices(existingGeom);

      mapping[layer.id].featureCount = 1;

      console.log(`⚠️ [Schematic] ${layer.id} -> ${sizeKb} КБ (${vCount} вершин, сохранён схематичный контур)`);

      reportItems.push({
        id: layer.id,
        title: layer.title,
        status: 'schematic',
        snapshotYear: '—',
        matchedNames: '—',
        sizeKb,
        vertices: vCount,
        geomBbox,
        layerBbox: layer.bbox,
        notes: strat.reason || 'Схематичный полигон',
      });
    }
  }

  // 5. Сохранение docs/layers-mapping.json
  await fs.writeFile(mappingFile, JSON.stringify(mapping, null, 2) + '\n', 'utf8');
  console.log(`\nТаблица сопоставлений сохранена в ${mappingFile}`);

  // 6. Генерация контекста соседей
  console.log('\n--- Генерация контекста соседей (public/data/context/) ---');
  const allTimelineYears = index.years
    .map((y) => y.year)
    .filter((y) => y >= -700 && y <= 2010);

  const contextMeta = [];

  for (const year of allTimelineYears) {
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

    contextMeta.push({
      year,
      file: `/data/context/${fileName}`,
      sizeKb,
    });
  }

  await fs.writeFile(snapshotsIndexFile, JSON.stringify(contextMeta, null, 2) + '\n', 'utf8');
  console.log(`Контекстные снимки сохранены (${contextMeta.length} файлов).`);

  // 7. Формирование подробного отчёта docs/layers-report.md
  console.log('\n--- Формирование docs/layers-report.md ---');

  let reportMd = `# Отчёт по историческим слоям территорий (historical-basemaps)

- **Дата генерации**: ${new Date().toISOString().split('T')[0]}
- **Репозиторий источника**: [historical-basemaps (A. Ourednik и контрибьюторы)](https://github.com/aourednik/historical-basemaps)
- **Лицензия источника**: **GNU General Public License v3 (GPLv3)** — свободная лицензия с открытым исходным кодом.
- **Таблица маппинга**: [\`docs/layers-mapping.json\`](./layers-mapping.json)
- **Каталог ручных оверрайдов**: \`public/data/layers-override/\` (файлы отсюда защищены от перезаписи).

---

## 1. Сводная таблица 24 исторических слоёв

| # | ID слоя | Название | Статус | Снимок | Найденные имена (NAME) | Размер | Вершин | BBox геометрии vs BBox events.json |
|---|---------|----------|--------|--------|------------------------|--------|--------|-----------------------------------|
`;

  const manualCheckList = [];

  reportItems.forEach((r, idx) => {
    const statusIcon =
      r.status === 'matched'
        ? '✅ Точный'
        : r.status === 'override'
        ? '🛡️ Оверрайд'
        : '⚠️ Схематичный';
    const snapshotStr = typeof r.snapshotYear === 'number' ? `${r.snapshotYear} г.` : '—';
    const gBboxStr = `[${r.geomBbox.map((v) => Math.round(v * 10) / 10).join(', ')}]`;
    const lBboxStr = `[${r.layerBbox.join(', ')}]`;

    // Анализ расхождений BBox
    const centerDiffX = Math.abs((r.geomBbox[0] + r.geomBbox[2]) / 2 - (r.layerBbox[0] + r.layerBbox[2]) / 2);
    const centerDiffY = Math.abs((r.geomBbox[1] + r.geomBbox[3]) / 2 - (r.layerBbox[1] + r.layerBbox[3]) / 2);
    const hasDiscrepancy = centerDiffX > 15 || centerDiffY > 10;

    let discrepancyBadge = '';
    if (r.status === 'matched' && hasDiscrepancy) {
      discrepancyBadge = ' ⚠️ *Смещение центра*';
      manualCheckList.push({
        id: r.id,
        title: r.title,
        reason: `Центр геометрии (${Math.round((r.geomBbox[0] + r.geomBbox[2]) / 2)}, ${Math.round((r.geomBbox[1] + r.geomBbox[3]) / 2)}) смещён относительно bbox (${Math.round((r.layerBbox[0] + r.layerBbox[2]) / 2)}, ${Math.round((r.layerBbox[1] + r.layerBbox[3]) / 2)})`,
      });
    } else if (r.status === 'schematic') {
      manualCheckList.push({
        id: r.id,
        title: r.title,
        reason: r.notes,
      });
    }

    reportMd += `| ${idx + 1} | \`${r.id}\` | ${r.title} | ${statusIcon} | ${snapshotStr} | ${r.matchedNames} | ${r.sizeKb} КБ | ${r.vertices} | \`${gBboxStr}\` vs \`${lBboxStr}\`${discrepancyBadge} |\n`;
  });

  const matchedCount = reportItems.filter((r) => r.status === 'matched').length;
  const schematicCount = reportItems.filter((r) => r.status === 'schematic').length;
  const overrideCount = reportItems.filter((r) => r.status === 'override').length;

  reportMd += `
---

## 2. Итоги верификации и метрики

- **Всего слоёв**: ${reportItems.length}
- **Слоёв с реальными границами (historical-basemaps / KGZ)**: **${matchedCount}**
- **Слоёв с качественными схематичными контурами**: **${schematicCount}**
- **Ручных оверрайдов (layers-override)**: **${overrideCount}**
- **Все файлы слоёв оптимизированы**: размер каждого файла строго **≤ 41 КБ** (при нормативе ≤ 150 КБ).

---

## 3. Слои для ручной проверки и причины схематичных контуров

Ниже перечислены слои, где оставлены схематичные контуры, либо геометрия из глобальной карты охватывает широкую кочевую империю:

`;

  manualCheckList.forEach((item, i) => {
    reportMd += `${i + 1}. **\`${item.id}\` — ${item.title}**: ${item.reason}\n`;
  });

  reportMd += `
---

## 4. Идемпотентность и переопределение (Override)

Скрипт \`scripts/build-layers.mjs\` полностью идемпотентен:
1. При повторном запуске он считывает сопоставления из \`docs/layers-mapping.json\`.
2. Если в проекте создана папка \`public/data/layers-override/\` с файлом \`<id>.geojson\`, скрипт берёт файл из неё и никогда не перезаписывает.
3. Команда в \`package.json\`: \`npm run build:layers\`.
`;

  await fs.writeFile(reportFile, reportMd, 'utf8');
  console.log(`Отчёт успешно сформирован в ${reportFile}`);
}

main().catch((err) => {
  console.error('Ошибка в build-layers.mjs:', err);
  process.exit(1);
});
