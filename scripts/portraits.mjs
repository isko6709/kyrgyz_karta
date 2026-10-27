// Быстрый сбор портретов из Wikimedia Commons.
//   npm run portraits:fetch            → качает по 3 кандидата для всех, у кого ещё нет фото (imageType != none)
//   npm run portraits:fetch -- japarov timur   → только для этих id
//   открой tmp-portraits/index.html, выбери лучшего
//   npm run portraits:pick -- japarov 2        → кандидат №2 станет public/portraits/japarov.webp (+ credits.json)
//   npm run portraits:crop -- ~/Downloads/x.jpg timur --author "Имя" --license "PD" --source "https://..."
// Нужен Node 18+ и пакет sharp (npm i -D sharp). Перед запуском: export COMMONS_UA="KyrgyzHistoryMap/1.0 (твоя@почта)"
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { join, parse } from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const UA = process.env.COMMONS_UA || 'KyrgyzHistoryMap/1.0 (укажи COMMONS_UA с твоей почтой)';
const rulers = JSON.parse(readFileSync(join(root, 'src/data/rulers.json'), 'utf8')).rulers;
const pDir = join(root, 'public/portraits');
const tDir = join(root, 'tmp-portraits');
const creditsPath = join(pDir, 'credits.json');
const strip = (h = '') => h.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BAD = /signature|flag|coat of arms|logo|map|stamp|banknote|coin|grave|tomb/i;

async function api(params) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ format: 'json', ...params });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  return res.json();
}

async function candidates(query) {
  const data = await api({
    action: 'query', generator: 'search', gsrsearch: `${query} filetype:bitmap`, gsrnamespace: '6',
    gsrlimit: '15', prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '800',
  });
  const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  return pages
    .map((p) => {
      const i = p.imageinfo?.[0]; if (!i) return null;
      const m = i.extmetadata ?? {};
      return { title: p.title, thumb: i.thumburl || i.url, w: i.width, h: i.height, mime: i.mime,
        page: i.descriptionurl, author: strip(m.Artist?.value) || 'unknown', license: strip(m.LicenseShortName?.value) || 'unknown' };
    })
    .filter((c) => c && ['image/jpeg', 'image/png'].includes(c.mime) && c.w >= 400 && c.h >= 400 && !BAD.test(c.title));
}

const square = (input, out) =>
  sharp(input).rotate().resize(400, 400, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 80 }).toFile(out);

const readCredits = () => (existsSync(creditsPath) ? JSON.parse(readFileSync(creditsPath, 'utf8')) : {});
const writeCredit = (id, c) => { const all = readCredits(); all[id] = c; writeFileSync(creditsPath, JSON.stringify(all, null, 2) + '\n'); };

async function fetchCmd(ids) {
  mkdirSync(tDir, { recursive: true });
  const have = new Set(existsSync(pDir) ? readdirSync(pDir).map((f) => parse(f).name) : []);
  const want = (ids.length ? rulers.filter((r) => ids.includes(r.id)) : rulers.filter((r) => r.imageType !== 'none' && !have.has(r.id)));
  const sheet = [];
  for (const r of want) {
    try {
      const list = (await candidates(r.commonsQuery)).slice(0, 3);
      const dir = join(tDir, r.id); mkdirSync(dir, { recursive: true });
      const meta = [];
      for (let n = 0; n < list.length; n++) {
        const buf = Buffer.from(await (await fetch(list[n].thumb, { headers: { 'User-Agent': UA } })).arrayBuffer());
        await square(buf, join(dir, `${n + 1}.webp`));
        meta.push(list[n]); await sleep(400);
      }
      writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
      sheet.push({ r, meta });
      console.log(`${r.id}: кандидатов ${meta.length}`);
    } catch (e) { console.warn(`${r.id}: ошибка — ${e.message}`); }
    await sleep(600);
  }
  const html = `<meta charset="utf-8"><style>body{font:14px sans-serif;background:#F6F1E7;padding:16px}.p{display:flex;gap:16px;margin:0 0 24px;flex-wrap:wrap;align-items:flex-start}.c{width:200px}.c img{width:200px;height:200px;object-fit:cover;border-radius:8px}h3{width:100%;margin:0}small{color:#6B665E}</style>` +
    sheet.map(({ r, meta }) => `<div class="p"><h3>${r.id} — ${r.name} <small>(${r.display})</small></h3>` +
      (meta.length ? meta.map((m, n) => `<div class="c"><img src="${r.id}/${n + 1}.webp"><b>${n + 1}</b> <small>${m.license}<br>${m.author.slice(0, 60)}<br><a href="${m.page}" target="_blank">Commons</a></small></div>`).join('') : '<small>ничего не найдено — ищи вручную</small>') + '</div>').join('');
  writeFileSync(join(tDir, 'index.html'), html);
  console.log('Открой tmp-portraits/index.html, выбери лучшего: npm run portraits:pick -- <id> <номер>');
}

function pickCmd(id, n) {
  const src = join(tDir, id, `${n}.webp`); const metaPath = join(tDir, id, 'meta.json');
  if (!existsSync(src)) throw new Error(`нет ${src}`);
  copyFileSync(src, join(pDir, `${id}.webp`));
  const m = JSON.parse(readFileSync(metaPath, 'utf8'))[Number(n) - 1];
  writeCredit(id, { author: m.author, license: m.license, source: m.page });
  console.log(`${id}.webp сохранён, credits.json обновлён. Запусти: npm run sync:portraits`);
}

async function cropCmd(file, id, flags) {
  await square(file, join(pDir, `${id}.webp`));
  if (flags.author || flags.license || flags.source) writeCredit(id, { author: flags.author ?? '', license: flags.license ?? '', source: flags.source ?? '' });
  console.log(`${id}.webp сохранён (400×400). Запусти: npm run sync:portraits`);
}

const [cmd, ...rest] = process.argv.slice(2);
const flags = {}; const pos = [];
for (let i = 0; i < rest.length; i++) { if (rest[i].startsWith('--')) flags[rest[i].slice(2)] = rest[++i]; else pos.push(rest[i]); }
if (cmd === 'fetch') await fetchCmd(pos);
else if (cmd === 'pick') pickCmd(pos[0], pos[1]);
else if (cmd === 'crop') await cropCmd(pos[0], pos[1], flags);
else console.log('Команды: fetch [id...] | pick <id> <n> | crop <файл> <id> [--author --license --source]');
