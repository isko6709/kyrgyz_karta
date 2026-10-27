# Кыргызстан сквозь века — интерактивная карта истории

Светлая интерактивная карта: ползунок времени от **енисейских кыргызов (III в. до н.э.)** до **современного Кыргызстана (2026)**. Слева/сверху — карта с границами эпохи, справа — карточки событий. Референс по механике: histography.ru (таймлайн + карта), но **светлая тема** и акцент на читаемость.

> Это **стартовый комплект**: данные, структура папок, скрипт портретов и инструкции для ИИ-агентов. Код приложения (Vite/React) пишут агенты по этому README и `AGENTS.md`.

---

## 0. Быстрый старт

```bash
# 1. создать проект
npm create vite@latest kyrgyz-history -- --template react-ts
cd kyrgyz-history
npm i maplibre-gl react-map-gl zustand framer-motion
npm i -D tailwindcss @tailwindcss/vite sharp

# 2. распаковать kyrgyz-history-starter.zip и скопировать СОДЕРЖИМОЕ папки в проект (с заменой README.md)

# 3. в package.json добавить скрипты:
#    "sync:portraits": "node scripts/sync-portraits.mjs",
#    "portraits:fetch": "node scripts/portraits.mjs fetch",
#    "portraits:pick": "node scripts/portraits.mjs pick",
#    "portraits:crop": "node scripts/portraits.mjs crop",
#    "predev": "npm run sync:portraits",
#    "prebuild": "npm run sync:portraits"
# и в tsconfig.app.json: "resolveJsonModule": true

npm run dev
```

Дальше открой проект в Cursor / Claude Code и дай агенту: «Прочитай README.md и AGENTS.md и выполни промпт №1 из docs/PROMPTS.md».

### Как работают портреты

1. Список людей: `src/data/rulers.json` (66 записей, у каждой есть `id`).
2. Кладёшь фото в `public/portraits/` с именем **`<id>.webp`** (например `japarov.webp`, `timur.jpg`).
3. `npm run sync:portraits` пересобирает `src/data/portraits.json` и пишет, каких фото ещё нет.
4. Компонент `RulerAvatar` сам берёт нужный файл; если фото нет — показывает силуэт с подписью «условное изображение».
5. **Быстрый сбор фото:** `npm run portraits:fetch` скачивает по 3 кандидата (уже кроп 400×400) в `tmp-portraits/` и делает `tmp-portraits/index.html`; выбираешь лучшего — `npm run portraits:pick -- japarov 2`. Свой файл: `npm run portraits:crop -- ~/Downloads/x.jpg timur`. Подробности — `public/portraits/README.md`.
6. Чек-лист с поисковыми запросами для Wikimedia Commons: `docs/rulers_photo_checklist.csv`. Авторов и лицензии записывай в `public/portraits/credits.json`.

---

## 1. React или Next.js?

**Рекомендация: Vite + React + TypeScript (SPA).** Next.js не нужен.

| Критерий | Vite + React | Next.js |
|---|---|---|
| Данные | Статический JSON, бэкенда нет | Тот же JSON, но лишняя инфраструктура |
| Карта (MapLibre) | Работает только в браузере — идеально для SPA | Нужны `dynamic(..., { ssr: false })` и обходы SSR |
| Деплой на Vercel | Нулевая настройка (preset *Vite*) | Тоже просто, но сборка тяжелее |
| Скорость vibe-кодинга | Меньше «магии» — ИИ-агенты ошибаются реже | App Router/RSC/клиентские границы путают агентов |
| SEO | Слабее (один HTML) | Лучше |

**Когда переходить на Next.js:** если захочешь отдельные индексируемые страницы на каждое событие (`/events/battle-of-talas`), OG-картинки для шаринга, админку или API. Тогда данные из `events.json` перенесутся без изменений. Для MVP — Vite.

---

## 2. Стек

- **Vite + React 18 + TypeScript**
- **MapLibre GL JS** (`maplibre-gl` + `react-map-gl/maplibre`) — векторная карта, плавные `flyTo`, анимация прозрачности слоёв
- **Zustand** — глобальное состояние (текущий год, выбранное событие)
- **Tailwind CSS** — быстрая вёрстка светлой темы
- **Framer Motion** — переходы карточек и таймлайна
- **Деплой:** Vercel (статика)

```bash
npm create vite@latest kyrgyz-history -- --template react-ts
cd kyrgyz-history
npm i maplibre-gl react-map-gl zustand framer-motion
npm i -D tailwindcss @tailwindcss/vite
npm run dev
```

---

## 3. Базовая карта: важное решение

Современная карта с названиями городов **анахронична** на сюжете «Тюркский каганат, 552 г.». Варианты:

1. **Рекомендую для MVP:** собственный светлый «бумажный» стиль без современных подписей — подложка из Natural Earth (суша, реки, озёра, рельеф) + твои исторические полигоны. Natural Earth — public domain.
2. Готовый светлый стиль **OpenFreeMap «positron»** (бесплатно, без ключа) с отключением слоёв подписей/границ. Нужна атрибуция OSM/OpenMapTiles.
3. Переключатель «Показать современные границы» поверх подложки (по умолчанию выключен).

Историческим территориям — полупрозрачная заливка цветом эпохи (`eras[].color`) и тонкий контур.

---

## 4. Дизайн (светлая тема)

- Фон карты: `#F6F1E7` (тёплая бумага), вода: `#DCE8EE`, суша: `#EFE8D8`
- Текст: `#2B2A28`, вторичный: `#6B665E`, акцент: цвет текущей эпохи
- Карточки: белые `#FFFFFF`, тень `0 8px 30px rgba(0,0,0,.08)`, радиус 16px
- Шрифты с кириллицей: заголовки — **Lora** или **PT Serif**, текст — **Inter** или **Manrope**
- Цвета эпох — в `events.json → eras[].color`
- Бейджи достоверности: ✅ общепринято · ⚠️ источники расходятся · ❓ предмет споров (поле `certainty`)
- Мобильная версия: карта на весь экран, карточка события — *bottom sheet*, таймлайн — внизу

---

## 5. Модель данных

```ts
// src/types.ts
export type LatLng = [number, number]; // [lat, lng] — для MapLibre переворачивать в [lng, lat]!

export interface Era { id: string; title: string; from: number; to: number; color: string }

export interface Layer {
  id: string; title: string; from: number; to: number;
  bbox: [number, number, number, number]; // [west, south, east, north] — заглушка до появления GeoJSON
  note?: string;
}

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
  layer: string | null;    // id слоя территории, который включать
  certainty: 'high' | 'medium' | 'debated';
  planned?: boolean;
}
```

Загрузка: `import data from './data/events.json'` (Vite поддерживает JSON из коробки; включить `resolveJsonModule`).

---

## 6. Структура проекта

```
kyrgyz-history/
├─ README.md                      # этот файл
├─ AGENTS.md                      # правила для ИИ-агентов (читать первым)
├─ vercel.json
├─ docs/
│  ├─ PROMPTS.md                  # 20 промптов для vibe-кодинга
│  ├─ chronology.md               # хронология в читаемом виде
│  └─ rulers_photo_checklist.csv  # чек-лист фото: id, поисковый запрос, лицензия, статус
├─ scripts/
│  └─ sync-portraits.mjs          # public/portraits → src/data/portraits.json
├─ public/
│  ├─ portraits/                  # ← СЮДА КЛАСТЬ ФОТО: <id>.webp
│  │  ├─ _placeholder.svg
│  │  ├─ credits.json             # авторы и лицензии
│  │  └─ README.md
│  └─ data/layers/                # <layer.id>.geojson — полигоны территорий
└─ src/
   ├─ data/
   │  ├─ events.json              # 91 событие, 8 эпох, 15 слоёв территорий
   │  ├─ rulers.json              # 66 правителей и ключевых фигур
   │  └─ portraits.json           # генерируется скриптом, руками не править
   ├─ types.ts
   ├─ lib/
   │  ├─ portrait.ts              # getPortrait(id) с запасным силуэтом
   │  └─ timeScale.ts             # год ⇄ позиция на таймлайне
   ├─ components/
   │  ├─ RulerAvatar.tsx          # готовая аватарка (использовать везде)
   │  └─ …                        # MapView, Timeline, EventCard, EventList, EraChips, RulerColumn, SearchBox
   ├─ store.ts                    # zustand: year, selectedEventId, playing
   └─ App.tsx
```

## 7. Ключевые механики

**Таймлайн с неравномерной шкалой.** 2200 лет, но события сгущаются к XX веку. Линейный ползунок непригоден. Делай кусочно-линейную шкалу: каждой эпохе — фиксированная доля ширины.

```ts
// lib/timeScale.ts
const stops = [ // [year, position 0..1]
  [-2000, 0.00], [552, 0.14], [924, 0.24], [1207, 0.32],
  [1500, 0.42], [1855, 0.55], [1917, 0.68], [1991, 0.84], [2027, 1.00],
] as const;
// toPos(year) и toYear(pos) — линейная интерполяция между соседними stops
```

**Слои территорий.** Для года `Y` показываем слои, где `from <= Y <= to`; остальные плавно гасим (`fill-opacity` transition 600 мс). Пока нет GeoJSON — рисуй прямоугольник по `bbox` как заглушку и помечай «схематично».

**Выбор события.** Клик по метке/карточке → `flyTo({ center: [lng, lat], zoom, duration: 1400 })`, включить `layer`, подсветить маркер.

**Глубокие ссылки.** `#event=15` или `#year=840` в хэше — шаринг без роутера.

**Play-режим.** Кнопка воспроизведения последовательно проходит события по `year`, 4–6 сек на событие.

**Диапазоны.** Если есть `yearEnd`, на таймлайне рисуй полосу, а не точку.

**Будущие события.** `planned: true` — стилизовать пунктиром («запланировано»).

---

## 7а. Правители и портреты (левая колонка, как на histography)

Данные — `rulers.json`. Для текущего года `Y` показываем тех, у кого `from <= Y <= to`; рядом — название государства слоя (`layer` → `layers[].title`), как подпись «ДРЕВНЕРУССКОЕ ГОСУДАРСТВО» на референсе.

```ts
export interface Ruler {
  id: string; name: string; role: string; display: string;
  from: number | null; to: number | null;   // null — вне шкалы (эпический персонаж)
  era: string; layer: string | null;
  imageType: 'photo' | 'historical-art' | 'none';
  commonsQuery: string;                     // что искать на Wikimedia Commons
  certainty: 'high' | 'medium' | 'debated';
  legendary?: boolean; figureType?: 'culture'; note: string;
}
```

**Фото — главные правила:**
- Для эпохи каганатов (Барсбек, Ажо) **подлинных портретов не существует**. Показывай нейтральный силуэт или авторскую иллюстрацию с подписью «условное изображение». Не выдавай нарисованное лицо за портрет.
- Современные политики (Жапаров и др.): только фото со свободной лицензией с Wikimedia Commons. Открой страницу файла, сохрани автора и лицензию в `public/data/credits.json` и показывай в подписи.
- Старые картины и миниатюры (до ~1900 г.) чаще всего public domain, но проверяй страницу файла.
- Фото кладутся в `public/portraits/<id>.webp` (квадрат 400×400) — не хотлинкай с Commons. После добавления: `npm run sync:portraits`.

## 8. Полигоны территорий и ручная правка через geojson.io

Исторические границы **условны** — в интерфейсе обязательно подпись «границы схематичны».

### Режим отладки `?debug=layers`
Для проверки и инспекции всех слоёв откройте приложение с параметром `?debug=layers` (или нажмите кнопку **⚙️ Слои (?debug=layers)** в верхней панели в dev-режиме):
- **Сводная таблица 24 слоёв**: ID, название, источник (`historical-basemaps`, `override`, `schematic`), год снимка, число вершин, размер файла в КБ и статус.
- **Интерактивные кнопки видимости (`👁️ Вкл/Скрыт`)**: можно принудительно включить или скрыть любой исторический слой вне зависимости от выбранного года на таймлайне.
- **Красная обводка выбранного слоя (`🔴 Выбран / Фокус`)**: клик по слою фокусирует карту и выделяет его яркой красной обводкой (`line-width: 4.5px`) для детальной визуальной проверки геометрии.

### Приоритетная папка ручных оверрайдов (`public/data/layers-override/`)
- Файлы, помещённые в `public/data/layers-override/<id>.geojson`, имеют **наивысший приоритет** в приложении.
- Скрипт автоматической сборки границ `scripts/build-layers.mjs` **никогда не перезаписывает** файлы из `layers-override/`.
- В интерфейсе и отладчике такие слои автоматически помечаются фиолетовым бейджем `📁 override`.

### Пошаговая инструкция: как править границы вручную через geojson.io
1. **Откройте редактор**: перейдите на [geojson.io](https://geojson.io/).
2. **Загрузите существующий слой**: перетащите файл нужного слоя из `public/data/layers/<id>.geojson` в окно браузера (или нажмите **Open** → **File**).
3. **Отредактируйте полигон**:
   - Используйте инструмент редактирования вершин (клик по фигуре активирует маркеры вершин).
   - Подгоните контур под исторические карты, русла рек или горные хребты.
   - В панели свойств справа убедитесь, что в `properties` сохранены `id` и `title` слоя.
4. **Оптимизируйте размер** (рекомендуется): если у полигона тысячи вершин, откройте [mapshaper.org](https://mapshaper.org/), примените `Simplify` (5–10%), чтобы размер файла был до 100–150 КБ.
5. **Экспорт**: в меню geojson.io выберите **Save** → **GeoJSON**.
6. **Сохранение в проект**: переместите скачанный файл в папку `public/data/layers-override/<id>.geojson` (имя файла должно в точности совпадать с `id` слоя, например `kokand.geojson`).
7. **Проверка**: запустите `npm run dev` и перейдите на `http://localhost:5173/?debug=layers`. Слой мгновенно отобразится со статусом `📁 override`. Для пересборки отчёта выполните `npm run build:layers`.

---

## 9. Деплой на Vercel

Проект полностью готов к деплою в качестве статического SPA приложения на **Vercel**:

### Способ 1: Через веб-интерфейс Vercel (GitHub)
1. Залейте проект в ваш репозиторий на GitHub:
   ```bash
   git add .
   git commit -m "feat: complete interactive Kyrgyz history map"
   git push origin main
   ```
2. Откройте [vercel.com](https://vercel.com/) → нажмите **Add New...** → **Project**.
3. Выберите ваш репозиторий и нажмите **Import**.
4. Настройки сборки установятся автоматически:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Нажмите **Deploy**. Через 1–2 минуты сайт будет опубликован на бесплатном домене `.vercel.app`.

### Способ 2: Через Vercel CLI (терминал)
```bash
npm i -g vercel
vercel
# Для деплоя сразу в продакшн:
vercel --prod
```

### Локальная проверка перед деплоем
```bash
npm run build
npm run preview
```
Откройте локальный адрес (например, `http://localhost:4173/`), чтобы убедиться в отсутствии ошибок и проверить работу в продакшн-сборке.

В корне проекта настроен файл `vercel.json` с 404-безопасными rewrites на `index.html` и заголовками долговременного кэширования для статических ассетов (`/assets/`, `/data/`, `/portraits/`).

---

## 10. Промпты для vibe-кодинга

Полный список из 20 промптов — в `docs/PROMPTS.md`. Давай по одному, после каждого проверяй `npm run build` и результат в браузере.

## 11. Проверка фактов

Хронология составлена по памяти и открытым источникам; **перед публикацией сверь** даты и формулировки, особенно:

- события с `certainty: "medium"` и `"debated"` (этногенез кыргызов, масштаб Кыргызского каганата, место битвы при Таласе, потери 1916 г.);
- новейшие события 2025–2027 (проверь по официальным источникам и СМИ);
- координаты — условные маркеры, не точные адреса.

Где сверять: В. В. Бартольд «Киргизы: исторический очерк»; академическая «История Кыргызстана»; Мирза Хайдар «Тарих-и Рашиди»; материалы Национальной академии наук КР; «Кыргызская энциклопедия»; публикации по «Манасу» и караханидской эпохе.

---

## 12. Лицензии и атрибуция

- MapLibre GL JS — BSD-3
- Natural Earth — public domain
- Historical Basemaps — [aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps) (GNU GPLv3, A. Ourednik и контрибьюторы) — исторические границы и контекст соседей
- OpenStreetMap / OpenFreeMap — атрибуция обязательна (если используешь)
- Изображения (портреты, фото памятников) — только с Wikimedia Commons с проверкой лицензии, указывать автора

---

## 13. Roadmap

- [ ] MVP: карта + таймлайн + карточки + 15 слоёв-заглушек
- [ ] Реальные GeoJSON-территории для ключевых эпох
- [ ] Иллюстрации и портреты (Манас, Курманджан датка, Айтматов)
- [ ] Языки: кыргызский, английский
- [ ] Отдельные страницы событий и OG-превью (возможный переход на Next.js)
- [ ] Режим «Путь кыргызов»: анимация перемещений Енисей → Тянь-Шань
