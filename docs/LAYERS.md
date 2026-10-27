# Слои территорий

Файлы `public/data/layers/<layer.id>.geojson`. Координаты в GeoJSON — `[lng, lat]`.

## Что готово (12 слоёв) — СХЕМАТИЧНЫЕ полигоны
`saka_wusun`, `yenisei_early`, `turkic_khaganates`, `yenisei_khaganate`, `karakhanid`, `kara_khitai`, `chagatai_ulus`, `moghulistan`, `kyrgyz_tianshan`, `dzungar`, `kokand`, `russian_turkestan`.
Это грубые контуры «на глаз» (10–13 вершин), а не научные границы. В свойствах `schematic: true` — показывать подпись «схематично». Улучшать: geojson.io, затем mapshaper.org (Simplify).

## Что нужно получить из данных базовой карты (3 слоя)
`kirghiz_ao`, `kirghiz_ssr`, `kyrgyzstan` — современные границы. Не рисовать вручную: брать полигон Кыргызстана (ISO `KGZ`) из Natural Earth / geoBoundaries, который уже лежит в проекте как подложка.

### Промпт для агента
«Слои `kirghiz_ao`, `kirghiz_ssr`, `kyrgyzstan` возьми не из bbox, а из полигона страны с ISO KGZ в данных базовой карты (admin-0). Сохрани как `public/data/layers/<id>.geojson` (скриптом `scripts/build-modern-layers.mjs`) с properties `{id,title,from,to}`. Остальные слои из `public/data/layers/` не трогай. Если файл есть — рисуй его, иначе прямоугольник из bbox. Удали рамку/подпись «схематично» для этих трёх слоёв.»

## Улучшение исторических границ (по желанию)
1. Открой geojson.io, загрузи нужный файл.
2. Поправь вершины по академическому атласу (см. README, раздел 11).
3. Сохрани поверх файла, оставив `properties`.
