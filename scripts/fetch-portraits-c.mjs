import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const rulersFile = path.join(rootDir, 'src/data/rulers.json');
const portraitsDir = path.join(rootDir, 'public/portraits');
const creditsFile = path.join(portraitsDir, 'credits.json');
const reportFile = path.join(rootDir, 'docs/portraits-report.md');

const UA = 'KyrgyzHistoryMap/1.0 (https://github.com/aurednik/historical-basemaps; educational history project)';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ALLOWED_LICENSES = [
  'pd',
  'public domain',
  'cc0',
  'cc-by',
  'cc by',
  'cc-by-sa',
  'cc by-sa',
  'gfdl',
  'free',
  'fal',
];

const FORBIDDEN_LICENSES = ['fair use', 'fairuse', '-nc-', 'non-commercial', 'noncommercial', '-nd-'];

function isFreeLicense(licStr) {
  if (!licStr) return false;
  const s = licStr.toLowerCase();
  for (const f of FORBIDDEN_LICENSES) {
    if (s.includes(f)) return false;
  }
  for (const a of ALLOWED_LICENSES) {
    if (s.includes(a)) return true;
  }
  return false;
}

function cleanHtml(html = '') {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// 1. Поиск сущности в Wikidata
async function searchWikidata(query, lang = 'ru') {
  const url =
    'https://www.wikidata.org/w/api.php?' +
    new URLSearchParams({
      action: 'wbsearchentities',
      search: query,
      language: lang,
      limit: '5',
      format: 'json',
    });
  const data = await fetchJson(url);
  return data.search || [];
}

// 2. Получение деталей сущности (P31, P18, P373, sitelinks)
async function getEntityDetails(entityId) {
  const url =
    'https://www.wikidata.org/w/api.php?' +
    new URLSearchParams({
      action: 'wbgetentities',
      ids: entityId,
      props: 'claims|sitelinks|labels|descriptions',
      format: 'json',
    });
  const data = await fetchJson(url);
  return data.entities ? data.entities[entityId] : null;
}

// 3. Получение изображения из статьи Википедии (pageimages)
async function getWikiPageImage(wikiLang, title) {
  const domain = `${wikiLang}.wikipedia.org`;
  const url =
    `https://${domain}/w/api.php?` +
    new URLSearchParams({
      action: 'query',
      titles: title,
      prop: 'pageimages',
      piprop: 'original',
      format: 'json',
    });
  const data = await fetchJson(url);
  const pages = Object.values(data.query?.pages || {});
  if (pages.length > 0 && pages[0].original?.source) {
    // Извлекаем имя файла из URL
    const srcUrl = pages[0].original.source;
    const parts = srcUrl.split('/');
    const rawName = decodeURIComponent(parts[parts.length - 1]);
    return rawName;
  }
  return null;
}

// 4. Получение метаданных и лицензии файла с Wikimedia Commons
async function getCommonsFileInfo(fileName) {
  const cleanTitle = fileName.startsWith('File:') ? fileName : `File:${fileName}`;
  const url =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      titles: cleanTitle,
      prop: 'imageinfo',
      iiprop: 'url|size|mime|extmetadata',
      iiurlwidth: '1000',
      format: 'json',
    });
  const data = await fetchJson(url);
  const pages = Object.values(data.query?.pages || {});
  if (pages.length === 0 || !pages[0].imageinfo || pages[0].imageinfo.length === 0) {
    return null;
  }
  const info = pages[0].imageinfo[0];
  const meta = info.extmetadata || {};

  const license = cleanHtml(meta.LicenseShortName?.value || meta.License?.value || '');
  const author = cleanHtml(meta.Artist?.value || meta.Author?.value || 'Не указан');
  const pageUrl = info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(cleanTitle)}`;
  const thumbUrl = info.thumburl || info.url;

  return {
    title: cleanTitle,
    license,
    author: author.slice(0, 100),
    source: pageUrl,
    thumbUrl,
    mime: info.mime,
    width: info.width,
    height: info.height,
  };
}

async function processRuler(ruler) {
  console.log(`\nОбработка: [${ruler.id}] ${ruler.name} (${ruler.display})...`);

  // Попробуем найти в Wikidata по имени и commonsQuery
  const queries = [ruler.name, ruler.commonsQuery.replace(/portrait|miniature|photo|Khan/gi, '').trim()];
  let chosenFile = null;

  for (const q of queries) {
    if (!q) continue;
    await sleep(1000); // Вежливость к API (1 запрос в секунду)
    const results = await searchWikidata(q, 'ru');
    if (results.length === 0) {
      await sleep(1000);
      const enResults = await searchWikidata(q, 'en');
      results.push(...enResults);
    }

    for (const item of results) {
      await sleep(1000);
      const details = await getEntityDetails(item.id);
      if (!details) continue;

      // Проверка 1: Это человек? (P31 = Q5)
      const p31Claims = details.claims?.P31 || [];
      const isHuman = p31Claims.some((c) => c.mainsnak?.datavalue?.value?.id === 'Q5');
      if (!isHuman) continue;

      // Проверка 2: Изображение в P18
      const p18Claims = details.claims?.P18 || [];
      if (p18Claims.length > 0) {
        chosenFile = p18Claims[0].mainsnak?.datavalue?.value;
        break;
      }

      // Если нет P18, проверяем статьи Википедии
      const sitelinks = details.sitelinks || {};
      for (const wiki of ['ruwiki', 'enwiki', 'kywiki']) {
        if (sitelinks[wiki]?.title) {
          await sleep(1000);
          const wikiLang = wiki.replace('wiki', '');
          const pageImg = await getWikiPageImage(wikiLang, sitelinks[wiki].title);
          if (pageImg) {
            chosenFile = pageImg;
            break;
          }
        }
      }

      if (chosenFile) break;
    }

    if (chosenFile) break;
  }

  if (!chosenFile) {
    console.log(`❌ [${ruler.id}] Не найдено свободное изображение в Wikidata/Wikipedia.`);
    return {
      id: ruler.id,
      name: ruler.name,
      status: 'skipped',
      reason: 'Не найдено свободное изображение в P18 / статьях Википедии',
      license: '—',
      link: ruler.commonsQuery ? `https://commons.wikimedia.org/wiki/Special:Search?search=${encodeURIComponent(ruler.commonsQuery)}` : '—',
    };
  }

  console.log(`Найдено изображение: ${chosenFile}. Запрос метаданных...`);
  await sleep(1000);
  const fileInfo = await getCommonsFileInfo(chosenFile);

  if (!fileInfo) {
    return {
      id: ruler.id,
      name: ruler.name,
      status: 'skipped',
      reason: `Файл ${chosenFile} не найден на Commons`,
      license: '—',
      link: '—',
    };
  }

  // Проверка свободной лицензии
  if (!isFreeLicense(fileInfo.license)) {
    console.log(`⚠️ [${ruler.id}] Лицензия отклонена: "${fileInfo.license}". Разрешены только свободные (PD, CC-BY, CC-BY-SA).`);
    return {
      id: ruler.id,
      name: ruler.name,
      status: 'skipped',
      reason: `Несвободная лицензия: ${fileInfo.license}`,
      license: fileInfo.license || 'Unknown',
      link: fileInfo.source,
    };
  }

  // Скачивание и кадрирование (sharp, 400x400)
  try {
    console.log(`Скачивание превью: ${fileInfo.thumbUrl}...`);
    const imgRes = await fetch(fileInfo.thumbUrl, { headers: { 'User-Agent': UA } });
    if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    const targetWebp = path.join(portraitsDir, `${ruler.id}.webp`);
    await sharp(buffer)
      .rotate()
      .resize(400, 400, {
        fit: 'cover',
        position: sharp.strategy.attention, // авто-фокус на лицах/главном объекте
      })
      .webp({ quality: 85 })
      .toFile(targetWebp);

    console.log(`✅ [${ruler.id}] Портрет успешно сохранён в ${targetWebp}`);

    return {
      id: ruler.id,
      name: ruler.name,
      status: 'found',
      license: fileInfo.license,
      author: fileInfo.author,
      source: fileInfo.source,
      file: `${ruler.id}.webp`,
    };
  } catch (err) {
    console.error(`Ошибка обработки изображения [${ruler.id}]:`, err.message);
    return {
      id: ruler.id,
      name: ruler.name,
      status: 'skipped',
      reason: `Ошибка обработки/скачивания: ${err.message}`,
      license: fileInfo.license,
      link: fileInfo.source,
    };
  }
}

async function main() {
  await fs.mkdir(portraitsDir, { recursive: true });

  const rulersData = JSON.parse(await fs.readFile(rulersFile, 'utf8'));
  const existingFiles = new Set(
    fsSync.existsSync(portraitsDir)
      ? fsSync.readdirSync(portraitsDir).map((f) => path.parse(f).name)
      : []
  );

  let credits = {};
  if (fsSync.existsSync(creditsFile)) {
    try {
      credits = JSON.parse(await fs.readFile(creditsFile, 'utf8'));
    } catch {
      credits = {};
    }
  }

  const needPortraits = rulersData.rulers.filter(
    (r) => r.imageType !== 'none' && !existingFiles.has(r.id)
  );

  console.log(`Нуждаются в заполнении портретов: ${needPortraits.length} правителей.`);

  const results = [];

  for (const ruler of needPortraits) {
    const res = await processRuler(ruler);
    results.push(res);

    if (res.status === 'found') {
      credits[res.id] = {
        author: res.author || 'Не указан',
        license: res.license || 'Свободная',
        source: res.source,
      };
      await fs.writeFile(creditsFile, JSON.stringify(credits, null, 2) + '\n', 'utf8');
    }
  }

  // Запуск sync:portraits
  console.log('\nСинхронизация портретов (sync-portraits.mjs)...');
  const { execSync } = await import('node:child_process');
  execSync('node scripts/sync-portraits.mjs', { stdio: 'inherit' });

  // Формирование docs/portraits-report.md
  let reportMd = `# Отчёт по портретам исторических деятелей

Дата обработки: ${new Date().toISOString().split('T')[0]}
Правило проверки лицензий: Разрешены только свободные лицензии Wikimedia Commons (PD, CC0, CC BY, CC BY-SA). Fair use, NC, ND отклоняются.

## Таблица результатов автозаполнения

| # | ID | Имя / Титул | Статус | Лицензия | Ссылка / Причина |
|---|----|-------------|--------|----------|-------------------|
`;

  results.forEach((r, idx) => {
    const statusBadge = r.status === 'found' ? '✅ Найдено' : '⚠️ Пропущено (заглушка)';
    const lic = r.license || '—';
    const linkOrReason =
      r.status === 'found'
        ? `[Wikimedia Commons](${r.source})`
        : `${r.reason} ([Поиск](${r.link}))`;
    reportMd += `| ${idx + 1} | \`${r.id}\` | ${r.name} | ${statusBadge} | ${lic} | ${linkOrReason} |\n`;
  });

  const foundCount = results.filter((r) => r.status === 'found').length;
  const skippedCount = results.filter((r) => r.status !== 'found').length;

  reportMd += `
## Итоги

- **Всего обработано**: ${results.length}
- **Успешно найдено и сохранено**: ${foundCount}
- **Пропущено / оставлена штатная заглушка**: ${skippedCount}

### Примечание по пропущенным деятелям
Для части советских и современных деятелей (например, Абсамат Масалиев и др.) подлинные портреты в открытых источниках либо находятся под защитой авторских прав, либо отсутствуют под свободной лицензией. В строгом соответствии с лицензионной политикой проекта сторонние изображения без лицензии не использовались; для них отображается качественная штатная заглушка \`_placeholder.svg\` с подписью «условное изображение».
`;

  await fs.writeFile(reportFile, reportMd, 'utf8');
  console.log(`\nОтчёт сохранён в ${reportFile}`);
}

main().catch((err) => {
  console.error('Критическая ошибка автозаполнения портретов:', err);
  process.exit(1);
});
