// Сканирует public/portraits и строит src/data/portraits.json  { "<ruler id>": "/portraits/<file>" }
// Запуск: npm run sync:portraits  (также автоматически перед dev/build)
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, parse } from 'node:path';

const root = process.cwd();
const rulers = JSON.parse(readFileSync(join(root, 'src/data/rulers.json'), 'utf8')).rulers;
const dir = join(root, 'public/portraits');
const exts = new Set(['.webp', '.jpg', '.jpeg', '.png', '.avif']);

const files = existsSync(dir) ? readdirSync(dir) : [];
const byName = {};
for (const f of files) {
  const { name, ext } = parse(f);
  if (!exts.has(ext.toLowerCase()) || name.startsWith('_')) continue;
  if (byName[name]) console.warn(`⚠ Два файла для "${name}": ${byName[name]} и ${f}. Используется последний.`);
  byName[name] = `/portraits/${f}`;
}

const ids = new Set(rulers.map((r) => r.id));
const manifest = {};
for (const id of ids) if (byName[id]) manifest[id] = byName[id];

writeFileSync(join(root, 'src/data/portraits.json'), JSON.stringify(manifest, null, 2) + '\n');

const missing = rulers.filter((r) => !manifest[r.id] && r.imageType !== 'none').map((r) => r.id);
const orphans = Object.keys(byName).filter((n) => !ids.has(n));

console.log(`Портретов найдено: ${Object.keys(manifest).length} из ${rulers.length}`);
if (missing.length) console.log(`Ещё нужны фото (${missing.length}): ${missing.join(', ')}`);
if (orphans.length) console.warn(`⚠ Файлы без совпадающего id (проверь имя): ${orphans.join(', ')}`);
