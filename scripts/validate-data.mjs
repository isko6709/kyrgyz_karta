#!/usr/bin/env node
/**
 * scripts/validate-data.mjs
 * Автоматическая валидация данных истории Кыргызстана:
 * 1. Уникальность id в events, rulers, layers, eras
 * 2. Существование era и layer у всех записей events и rulers
 * 3. Корректность временных диапазонов: from <= to, year <= yearEnd
 * 4. Допустимость значений certainty: 'high' | 'medium' | 'debated'
 * 5. Наличие GeoJSON файла (базового или оверрайда) или пометки schematic для каждого слоя
 * 6. Соответствие файлов портретов в public/portraits/ списку id правителей (и запрет портретов для imageType: "none")
 * 7. Координаты в допустимых пределах (lat: [-90, 90], lng: [-180, 180], bbox)
 *
 * При ошибках выводит подробный отчёт и завершает процесс с кодом 1.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const root = process.cwd();
const errors = [];
const warnings = [];

// Цветовые коды ANSI для вывода в консоль
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function addError(category, entityId, message) {
  errors.push({ category, entityId, message });
}

function addWarning(category, entityId, message) {
  warnings.push({ category, entityId, message });
}

// -------------------------------------------------------------
// 1. Загрузка исходных файлов
// -------------------------------------------------------------
const eventsPath = join(root, 'src/data/events.json');
const rulersPath = join(root, 'src/data/rulers.json');
const portraitsDir = join(root, 'public/portraits');

if (!existsSync(eventsPath)) {
  console.error(`${RED}ОШИБКА: Файл ${eventsPath} не найден!${RESET}`);
  process.exit(1);
}
if (!existsSync(rulersPath)) {
  console.error(`${RED}ОШИБКА: Файл ${rulersPath} не найден!${RESET}`);
  process.exit(1);
}

let eventsJson;
let rulersJson;

try {
  eventsJson = JSON.parse(readFileSync(eventsPath, 'utf8'));
} catch (e) {
  console.error(`${RED}ОШИБКА: Синтаксическая ошибка в ${eventsPath}: ${e.message}${RESET}`);
  process.exit(1);
}

try {
  rulersJson = JSON.parse(readFileSync(rulersPath, 'utf8'));
} catch (e) {
  console.error(`${RED}ОШИБКА: Синтаксическая ошибка в ${rulersPath}: ${e.message}${RESET}`);
  process.exit(1);
}

const eras = eventsJson.eras || [];
const layers = eventsJson.layers || [];
const events = eventsJson.events || [];
const rulers = rulersJson.rulers || [];

const VALID_CERTAINTIES = new Set(['high', 'medium', 'debated']);
const VALID_IMAGE_TYPES = new Set(['photo', 'historical-art', 'none']);
const VALID_CATEGORIES = new Set(['state', 'war', 'culture', 'trade', 'society', 'tragedy', 'economy']);

// -------------------------------------------------------------
// 2. Валидация эпох (eras)
// -------------------------------------------------------------
const eraIds = new Set();
for (const era of eras) {
  if (!era.id || typeof era.id !== 'string') {
    addError('Эпохи', era.id || 'unknown', 'У эпохи отсутствует строковый id');
    continue;
  }
  if (eraIds.has(era.id)) {
    addError('Эпохи', era.id, `Дублирующийся id эпохи: "${era.id}"`);
  }
  eraIds.add(era.id);

  if (typeof era.from !== 'number' || typeof era.to !== 'number') {
    addError('Эпохи', era.id, `from и to должны быть числами (получено from=${era.from}, to=${era.to})`);
  } else if (era.from > era.to) {
    addError('Эпохи', era.id, `Некорректный интервал: from (${era.from}) > to (${era.to})`);
  }

  if (!era.title || typeof era.title !== 'string') {
    addError('Эпохи', era.id, 'Отсутствует или некорректно поле title');
  }
  if (!era.color || typeof era.color !== 'string') {
    addError('Эпохи', era.id, 'Отсутствует или некорректно поле color');
  }
}

// -------------------------------------------------------------
// 3. Валидация слоёв территорий (layers)
// -------------------------------------------------------------
const layerIds = new Set();
for (const layer of layers) {
  if (!layer.id || typeof layer.id !== 'string') {
    addError('Слои', layer.id || 'unknown', 'У слоя отсутствует строковый id');
    continue;
  }
  if (layerIds.has(layer.id)) {
    addError('Слои', layer.id, `Дублирующийся id слоя: "${layer.id}"`);
  }
  layerIds.add(layer.id);

  if (typeof layer.from !== 'number' || typeof layer.to !== 'number') {
    addError('Слои', layer.id, `from и to должны быть числами (получено from=${layer.from}, to=${layer.to})`);
  } else if (layer.from > layer.to) {
    addError('Слои', layer.id, `Некорректный интервал: from (${layer.from}) > to (${layer.to})`);
  }

  // Проверка shortTitle
  if (layer.shortTitle && typeof layer.shortTitle === 'string') {
    if (layer.shortTitle.length > 22) {
      addError('Слои', layer.id, `shortTitle превышает 22 символа: "${layer.shortTitle}" (${layer.shortTitle.length} симв.)`);
    }
  }

  // Проверка bbox: [west, south, east, north]
  if (!Array.isArray(layer.bbox) || layer.bbox.length !== 4) {
    addError('Слои', layer.id, `bbox должен быть массивом из 4 чисел [west, south, east, north]`);
  } else {
    const [w, s, e, n] = layer.bbox;
    if ([w, s, e, n].some((c) => typeof c !== 'number' || Number.isNaN(c))) {
      addError('Слои', layer.id, `Координаты bbox должны быть числами: [${w}, ${s}, ${e}, ${n}]`);
    } else {
      if (w < -180 || w > 180 || e < -180 || e > 180) {
        addError('Слои', layer.id, `Долгота bbox вне диапазона [-180, 180]: west=${w}, east=${e}`);
      }
      if (s < -90 || s > 90 || n < -90 || n > 90) {
        addError('Слои', layer.id, `Широта bbox вне диапазона [-90, 90]: south=${s}, north=${n}`);
      }
      if (w > e) {
        addError('Слои', layer.id, `Некорректный bbox: west (${w}) > east (${e})`);
      }
      if (s > n) {
        addError('Слои', layer.id, `Некорректный bbox: south (${s}) > north (${n})`);
      }
    }
  }

  // Проверка наличия GeoJSON-файла или пометки schematic
  const overrideFile = join(root, 'public/data/layers-override', `${layer.id}.geojson`);
  const baseFile = join(root, 'public/data/layers', `${layer.id}.geojson`);
  const fileExists = existsSync(overrideFile) || existsSync(baseFile);

  const isMarkedSchematicInNote =
    typeof layer.note === 'string' && layer.note.toLowerCase().includes('схематич');
  const isMarkedSchematicField = layer.schematic === true;

  if (fileExists) {
    // Проверяем валидность файла
    const filePath = existsSync(overrideFile) ? overrideFile : baseFile;
    try {
      const geojson = JSON.parse(readFileSync(filePath, 'utf8'));
      if (!geojson || (geojson.type !== 'FeatureCollection' && geojson.type !== 'Feature')) {
        addError('Слои (GeoJSON)', layer.id, `Файл ${filePath} не является валидным Feature или FeatureCollection`);
      }
    } catch (err) {
      addError('Слои (GeoJSON)', layer.id, `Синтаксическая ошибка в GeoJSON ${filePath}: ${err.message}`);
    }
  } else {
    // Если файла нет, слой обязан быть явно помечен как схематичный
    if (!isMarkedSchematicInNote && !isMarkedSchematicField) {
      addError(
        'Слои (GeoJSON)',
        layer.id,
        `Отсутствует файл GeoJSON (public/data/layers/${layer.id}.geojson) и нет явной пометки "схематично" в note`
      );
    }
  }
}

// -------------------------------------------------------------
// 4. Валидация событий (events)
// -------------------------------------------------------------
const eventIds = new Set();
for (const ev of events) {
  if (typeof ev.id !== 'number') {
    addError('События', ev.id || 'unknown', `id события должен быть числом, получено: ${typeof ev.id}`);
    continue;
  }
  if (eventIds.has(ev.id)) {
    addError('События', ev.id, `Дублирующийся id события: ${ev.id}`);
  }
  eventIds.add(ev.id);

  // Проверка эпохи
  if (!ev.era || typeof ev.era !== 'string') {
    addError('События', ev.id, `У события отсутствует поле era`);
  } else if (!eraIds.has(ev.era)) {
    addError('События', ev.id, `Событие ссылается на несуществующую эпоху: "${ev.era}"`);
  }

  // Проверка слоя
  if (ev.layer !== null && ev.layer !== undefined) {
    if (typeof ev.layer !== 'string') {
      addError('События', ev.id, `Поле layer должно быть строкой или null, получено: ${typeof ev.layer}`);
    } else if (!layerIds.has(ev.layer)) {
      addError('События', ev.id, `Событие ссылается на несуществующий слой: "${ev.layer}"`);
    }
  }

  // Проверка дат: year <= yearEnd
  if (typeof ev.year !== 'number') {
    addError('События', ev.id, `Поле year должно быть числом, получено: ${ev.year}`);
  }
  if (ev.yearEnd !== undefined) {
    if (typeof ev.yearEnd !== 'number') {
      addError('События', ev.id, `Поле yearEnd должно быть числом, получено: ${ev.yearEnd}`);
    } else if (ev.year > ev.yearEnd) {
      addError('События', ev.id, `Некорректный интервал: year (${ev.year}) > yearEnd (${ev.yearEnd})`);
    }
  }

  // Проверка certainty
  if (!ev.certainty || !VALID_CERTAINTIES.has(ev.certainty)) {
    addError(
      'События',
      ev.id,
      `Недопустимое значение certainty: "${ev.certainty}". Допустимо: ${Array.from(VALID_CERTAINTIES).join(', ')}`
    );
  }

  // Проверка category
  if (!ev.category || !VALID_CATEGORIES.has(ev.category)) {
    addError(
      'События',
      ev.id,
      `Недопустимая категория: "${ev.category}". Допустимо: ${Array.from(VALID_CATEGORIES).join(', ')}`
    );
  }

  // Проверка координат: coords: [lat, lng]
  if (!Array.isArray(ev.coords) || ev.coords.length !== 2) {
    addError('События', ev.id, `coords должен быть массивом из 2 чисел [lat, lng]`);
  } else {
    const [lat, lng] = ev.coords;
    if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
      addError('События', ev.id, `Координаты должны быть числами: [${lat}, ${lng}]`);
    } else {
      if (lat < -90 || lat > 90) {
        addError('События', ev.id, `Широта (lat) вне диапазона [-90, 90]: ${lat}`);
      }
      if (lng < -180 || lng > 180) {
        addError('События', ev.id, `Долгота (lng) вне диапазона [-180, 180]: ${lng}`);
      }
      // Предупреждение о перепутанных lat/lng для региона Кыргызстана и сопредельной Центральной Азии
      if (lat > 65 && lng < 45) {
        addWarning('События', ev.id, `Подозрительные координаты [lat=${lat}, lng=${lng}] — возможно перепутаны широта и долгота`);
      }
    }
  }
}

// -------------------------------------------------------------
// 5. Валидация правителей и исторических фигур (rulers)
// -------------------------------------------------------------
const rulerIds = new Set();
const rulersWithNoneImage = new Set();

for (const r of rulers) {
  if (!r.id || typeof r.id !== 'string') {
    addError('Правители', r.id || 'unknown', 'У правителя отсутствует строковый id');
    continue;
  }
  if (rulerIds.has(r.id)) {
    addError('Правители', r.id, `Дублирующийся id правителя: "${r.id}"`);
  }
  rulerIds.add(r.id);

  // Проверка эпохи
  if (!r.era || typeof r.era !== 'string') {
    addError('Правители', r.id, `У правителя отсутствует поле era`);
  } else if (!eraIds.has(r.era)) {
    addError('Правители', r.id, `Правитель ссылается на несуществующую эпоху: "${r.era}"`);
  }

  // Проверка слоя
  if (r.layer !== null && r.layer !== undefined) {
    if (typeof r.layer !== 'string') {
      addError('Правители', r.id, `Поле layer должно быть строкой или null, получено: ${typeof r.layer}`);
    } else if (!layerIds.has(r.layer)) {
      addError('Правители', r.id, `Правитель ссылается на несуществующий слой: "${r.layer}"`);
    }
  }

  // Проверка дат: from <= to
  if (r.from !== null && r.from !== undefined && typeof r.from !== 'number') {
    addError('Правители', r.id, `Поле from должно быть числом или null, получено: ${r.from}`);
  }
  if (r.to !== null && r.to !== undefined && typeof r.to !== 'number') {
    addError('Правители', r.id, `Поле to должно быть числом или null, получено: ${r.to}`);
  }
  if (typeof r.from === 'number' && typeof r.to === 'number' && r.from > r.to) {
    addError('Правители', r.id, `Некорректный интервал: from (${r.from}) > to (${r.to})`);
  }

  // Проверка certainty
  if (!r.certainty || !VALID_CERTAINTIES.has(r.certainty)) {
    addError(
      'Правители',
      r.id,
      `Недопустимое значение certainty: "${r.certainty}". Допустимо: ${Array.from(VALID_CERTAINTIES).join(', ')}`
    );
  }

  // Проверка imageType
  if (!r.imageType || !VALID_IMAGE_TYPES.has(r.imageType)) {
    addError(
      'Правители',
      r.id,
      `Недопустимое значение imageType: "${r.imageType}". Допустимо: ${Array.from(VALID_IMAGE_TYPES).join(', ')}`
    );
  } else if (r.imageType === 'none') {
    rulersWithNoneImage.add(r.id);
  }
}

// -------------------------------------------------------------
// 6. Валидация файлов портретов (public/portraits/)
// -------------------------------------------------------------
const PORTRAIT_EXTENSIONS = new Set(['.webp', '.jpg', '.jpeg', '.png', '.avif']);
const IGNORABLE_FILES = new Set(['_placeholder.svg', 'credits.json', 'README.md']);

if (existsSync(portraitsDir)) {
  const files = readdirSync(portraitsDir);
  for (const f of files) {
    if (f.startsWith('_') || IGNORABLE_FILES.has(f)) continue;

    const ext = extname(f).toLowerCase();
    if (!PORTRAIT_EXTENSIONS.has(ext)) continue;

    const rulerId = basename(f, ext);

    // 1. Проверяем, существует ли правитель с таким id
    if (!rulerIds.has(rulerId)) {
      addError(
        'Портреты',
        f,
        `Файл портрета "${f}" не соответствует ни одному id из rulers.json (orphan-файл)`
      );
    }

    // 2. Проверяем запрет портретов для imageType: "none"
    if (rulersWithNoneImage.has(rulerId)) {
      addError(
        'Портреты',
        f,
        `Для деятеля "${rulerId}" задан imageType: "none" (подлинных изображений не существует). Файл "${f}" должен быть удалён согласно правилам проекта.`
      );
    }
  }
} else {
  addError('Портреты', 'public/portraits', 'Каталог public/portraits не найден!');
}

// -------------------------------------------------------------
// 7. Итоговый структурированный отчёт
// -------------------------------------------------------------
console.log(`\n${BOLD}=== ВАЛИДАЦИЯ ДАННЫХ ИСТОРИИ КЫРГЫЗСТАНА ===${RESET}`);
console.log(`Проверено:`);
console.log(`  • Эпох (eras):       ${CYAN}${eras.length}${RESET}`);
console.log(`  • Слоёв (layers):    ${CYAN}${layers.length}${RESET}`);
console.log(`  • Событий (events):  ${CYAN}${events.length}${RESET}`);
console.log(`  • Деятелей (rulers): ${CYAN}${rulers.length}${RESET}`);
console.log(`-----------------------------------------------`);

if (warnings.length > 0) {
  console.log(`\n${YELLOW}${BOLD}⚠ ПРЕДУПРЕЖДЕНИЯ (${warnings.length}):${RESET}`);
  for (const w of warnings) {
    console.log(`  ${YELLOW}⚠ [${w.category}] ${w.entityId}: ${w.message}${RESET}`);
  }
}

if (errors.length > 0) {
  console.log(`\n${RED}${BOLD}✖ НАЙДЕНЫ ОШИБКИ ВАЛИДАЦИИ (${errors.length}):${RESET}`);
  // Группировка ошибок по категориям для читаемости
  const byCategory = {};
  for (const err of errors) {
    if (!byCategory[err.category]) byCategory[err.category] = [];
    byCategory[err.category].push(err);
  }

  for (const [category, list] of Object.entries(byCategory)) {
    console.log(`\n${RED}${BOLD}  [${category}] — ${list.length} ошибок:${RESET}`);
    for (const item of list) {
      console.log(`    ${RED}• ID "${item.entityId}": ${item.message}${RESET}`);
    }
  }

  console.log(`\n${RED}${BOLD}✖ Валидация не пройдена. Исправьте ошибки в файлах данных перед сборкой.${RESET}\n`);
  process.exit(1);
} else {
  console.log(`\n${GREEN}${BOLD}✓ Все проверки успешно пройдены! Ошибок не обнаружено.${RESET}\n`);
  process.exit(0);
}
