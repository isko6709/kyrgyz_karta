# Портреты правителей

Кидай сюда фото. **Имя файла = `id` из `src/data/rulers.json`.**

```
public/portraits/
  japarov.webp
  genghis-khan.webp
  timur.jpg
  kurmanjan-datka.webp
  _placeholder.svg      # запасной силуэт (не переименовывать)
  credits.json          # авторы и лицензии
```

## Правила
- Допустимые форматы: `.webp` (лучше всего), `.jpg`, `.jpeg`, `.png`, `.avif`.
- Квадрат 400×400 px, лицо по центру, до ~80 КБ.
- Список всех id и поисковые запросы: `docs/rulers_photo_checklist.csv` (колонки `id`, `commons_search`, `file`).
- После добавления файлов выполни `npm run sync:portraits` — он обновит `src/data/portraits.json`, и аватарки появятся в приложении.
- Для каждого файла впиши автора и лицензию в `credits.json`:

```json
{
  "japarov": { "author": "…", "license": "CC BY 4.0", "source": "https://commons.wikimedia.org/…" }
}
```

## Что нельзя
- Не хотлинкать картинки с чужих сайтов — только локальные файлы.
- Не подписывать выдуманный/сгенерированный портрет как подлинный. Для эпохи каганатов (`imageType: "none"`) подлинных портретов нет — приложение само показывает силуэт и подпись «условное изображение».

## Самый быстрый способ

```bash
npm i -D sharp
export COMMONS_UA="KyrgyzHistoryMap/1.0 (твоя@почта)"   # Windows PowerShell: $env:COMMONS_UA="..."
npm run portraits:fetch                     # кандидаты для всех, у кого нет фото
# открой tmp-portraits/index.html, проверь, что на фото именно тот человек
npm run portraits:pick -- japarov 2         # взять кандидата №2
npm run portraits:crop -- ~/Downloads/foto.jpg timur --author "Автор" --license "PD" --source "https://..."
npm run sync:portraits
```

Скрипт берёт только файлы Commons (свободные лицензии), режет в квадрат 400×400, сохраняет в WebP и сам пишет автора и лицензию в `credits.json`. **Всегда проверяйте глазами, что на фото тот человек**: поиск по имени иногда находит однофамильцев.
