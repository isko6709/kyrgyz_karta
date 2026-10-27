# План и шаблоны исторических слоёв территорий (GeoJSON)

В проекте определено 15 исторических слоёв в `src/data/events.json`.
Если файл `public/data/layers/<id>.geojson` отсутствует, приложение автоматически отображает прямоугольник из `bbox` с пометкой **«(схематично)»**.
Для отображения реальных исторических границ скопируйте соответствующий шаблон ниже, уточните координаты полигона и сохраните в файл `public/data/layers/<id>.geojson`.

> [!NOTE]
> Все координаты в GeoJSON файлах должны быть в формате WGS84: `[longitude, latitude]` (долгота, широта).

---

## 1. Сводная таблица слоёв

| # | ID | Название | Годы | Эпоха | BBox `[w, s, e, n]` | Статус файла |
|---|----|----------|------|-------|---------------------|--------------|
| 1 | `saka_wusun` | Саки и усуни | 700 до н.э. – 440 н.э. | ancient | `[69, 39, 82, 45]` | ⚠️ BBox (шаблон 1) |
| 2 | `yenisei_early` | Ранние кыргызы на Верхнем Енисее | 201 до н.э. – 840 н.э. | ancient / turkic | `[87, 51, 96, 56]` | ⚠️ BBox (шаблон 2) |
| 3 | `turkic_khaganates` | Тюркские каганаты | 552 – 766 | turkic | `[55, 35, 125, 55]` | ⚠️ BBox (шаблон 3) |
| 4 | `yenisei_khaganate` | Кыргызский каганат (великодержавие) | 840 – 924 | turkic | `[84, 48, 104, 57]` | ⚠️ BBox (шаблон 4) |
| 5 | `karakhanid` | Караханидский каганат | 940 – 1130 | karakhanid | `[62, 36, 85, 46]` | ⚠️ BBox (шаблон 5) |
| 6 | `kara_khitai` | Каракитаи (Западное Ляо) | 1130 – 1218 | karakhanid | `[63, 36, 92, 50]` | ⚠️ BBox (шаблон 6) |
| 7 | `chagatai_ulus` | Улус Чагатая | 1227 – 1347 | mongol | `[60, 35, 95, 50]` | ⚠️ BBox (шаблон 7) |
| 8 | `moghulistan` | Моголистан | 1347 – 1514 | mongol | `[70, 38, 95, 48]` | ⚠️ BBox (шаблон 8) |
| 9 | `kyrgyz_tianshan` | Кыргызы Тянь-Шаня (этническая территория) | 1500 – 1855 | tribes | `[70, 38, 80, 43]` | ⚠️ BBox (шаблон 9) |
| 10 | `dzungar` | Джунгарское ханство | 1635 – 1758 | tribes | `[75, 38, 100, 50]` | ⚠️ BBox (шаблон 10) |
| 11 | `kokand` | Кокандское ханство | 1709 – 1876 | tribes | `[64, 38, 78, 46]` | ⚠️ BBox (шаблон 11) |
| 12 | `russian_turkestan` | Российский Туркестан (Семиречье и Фергана) | 1855 – 1917 | russian | `[69, 39, 80, 44]` | ⚠️ BBox (шаблон 12) |
| 13 | `kirghiz_ao` | Каракиргизская АО / Киргизская АССР | 1924 – 1936 | soviet | `[69, 39, 80, 43.5]` | ⚠️ BBox (шаблон 13) |
| 14 | `kirghiz_ssr` | Киргизская ССР | 1936 – 1991 | soviet | `[69, 39, 80.5, 43.5]` | ⚠️ BBox (шаблон 14) |
| 15 | `kyrgyzstan` | Кыргызская Республика | 1991 – 2027 | modern | `[69, 39, 80.5, 43.5]` | ⚠️ BBox (шаблон 15) |

---

## 2. Готовые шаблоны GeoJSON для каждого слоя

### 1. `public/data/layers/saka_wusun.geojson`
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "saka_wusun",
        "title": "Саки и усуни",
        "description": "Зона кочевий саков Семиречья и государства усуней вокруг Иссык-Куля"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [[69.0, 39.0], [82.0, 39.0], [82.0, 45.0], [69.0, 45.0], [69.0, 39.0]]
        ]
      }
    }
  ]
}
```

### 2. `public/data/layers/yenisei_early.geojson`
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "yenisei_early",
        "title": "Ранние кыргызы на Верхнем Енисее",
        "description": "Минусинская котловина, долина Верхнего Енисея и предгорья Саян"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [[87.0, 51.0], [96.0, 51.0], [96.0, 56.0], [87.0, 56.0], [87.0, 51.0]]
        ]
      }
    }
  ]
}
```

### 3. `public/data/layers/turkic_khaganates.geojson`
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "turkic_khaganates",
        "title": "Тюркские каганаты",
        "description": "Тюркский и Западно-Тюркский каганаты; западный центр — Суяб в Чуйской долине"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [[55.0, 35.0], [125.0, 35.0], [125.0, 55.0], [55.0, 55.0], [55.0, 35.0]]
        ]
      }
    }
  ]
}
```

### 4. `public/data/layers/yenisei_khaganate.geojson`
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "yenisei_khaganate",
        "title": "Кыргызский каганат (великодержавие)",
        "description": "Период Кыргызского великодержавия (840–924 гг.): Енисей, Тува, Алтай и Монголия"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [[84.0, 48.0], [104.0, 48.0], [104.0, 57.0], [84.0, 57.0], [84.0, 48.0]]
        ]
      }
    }
  ]
}
```

### 5. `public/data/layers/karakhanid.geojson`
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "karakhanid",
        "title": "Караханидский каганат",
        "description": "Баласагун, Кашгар, Узген, Самарканд, Чуйская и Ферганская долины"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [[62.0, 36.0], [85.0, 36.0], [85.0, 46.0], [62.0, 46.0], [62.0, 36.0]]
        ]
      }
    }
  ]
}
```

### 6. `public/data/layers/kara_khitai.geojson`
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "kara_khitai",
        "title": "Каракитаи (Западное Ляо)",
        "description": "Государство Западное Ляо со столицей в Баласагуне (Чуйская долина)"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [[63.0, 36.0], [92.0, 36.0], [92.0, 50.0], [63.0, 50.0], [63.0, 36.0]]
        ]
      }
    }
  ]
}
```

### 7. `public/data/layers/chagatai_ulus.geojson`
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "chagatai_ulus",
        "title": "Улус Чагатая",
        "description": "Монгольский улус: Семиречье, Тянь-Шань, Мавераннахр, Восточный Туркестан"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [[60.0, 35.0], [95.0, 35.0], [95.0, 50.0], [60.0, 50.0], [60.0, 35.0]]
        ]
      }
    }
  ]
}
```

### 8. `public/data/layers/moghulistan.geojson`
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "moghulistan",
        "title": "Моголистан",
        "description": "Государство в восточной части Чагатайского улуса: Иссык-Куль, Или, Тянь-Шань, Кашгария"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [[70.0, 38.0], [95.0, 38.0], [95.0, 48.0], [70.0, 48.0], [70.0, 38.0]]
        ]
      }
    }
  ]
}
```

### 9. `public/data/layers/kyrgyz_tianshan.geojson`
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "kyrgyz_tianshan",
        "title": "Кыргызы Тянь-Шаня (этническая территория)",
        "description": "Территория расселения кыргызских племенных объединений (Оң, Сол, Ичкилик)"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [[70.0, 38.0], [80.0, 38.0], [80.0, 43.0], [70.0, 43.0], [70.0, 38.0]]
        ]
      }
    }
  ]
}
```

### 10. `public/data/layers/dzungar.geojson`
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "dzungar",
        "title": "Джунгарское ханство",
        "description": "Ойратское государство; эпоха военного давления на кыргызов Тянь-Шаня"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [[75.0, 38.0], [100.0, 38.0], [100.0, 50.0], [75.0, 50.0], [75.0, 38.0]]
        ]
      }
    }
  ]
}
```

### 11. `public/data/layers/kokand.geojson`
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "kokand",
        "title": "Кокандское ханство",
        "description": "Фергана, Чуйская долина, крепости Пишпек, Токмок, Куртка, юг Кыргызстана"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [[64.0, 38.0], [78.0, 38.0], [78.0, 46.0], [64.0, 46.0], [64.0, 38.0]]
        ]
      }
    }
  ]
}
```

### 12. `public/data/layers/russian_turkestan.geojson`
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "russian_turkestan",
        "title": "Российский Туркестан (Семиречье и Фергана)",
        "description": "Семиреченская и Ферганская области Туркестанского генерал-губернаторства"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [[69.0, 39.0], [80.0, 39.0], [80.0, 44.0], [69.0, 44.0], [69.0, 39.0]]
        ]
      }
    }
  ]
}
```

### 13. `public/data/layers/kirghiz_ao.geojson`
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "kirghiz_ao",
        "title": "Каракиргизская АО / Киргизская АО / АССР",
        "description": "Национально-территориальное размежевание 1924 г., автономия в составе РСФСР"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [[69.0, 39.0], [80.0, 39.0], [80.0, 43.5], [69.0, 43.5], [69.0, 39.0]]
        ]
      }
    }
  ]
}
```

### 14. `public/data/layers/kirghiz_ssr.geojson`
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "kirghiz_ssr",
        "title": "Киргизская ССР",
        "description": "Союзная республика в составе СССР (1936–1991 гг.)"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [[69.0, 39.0], [80.5, 39.0], [80.5, 43.5], [69.0, 43.5], [69.0, 39.0]]
        ]
      }
    }
  ]
}
```

### 15. `public/data/layers/kyrgyzstan.geojson`
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "kyrgyzstan",
        "title": "Кыргызская Республика",
        "description": "Суверенное государство (с 1991 г.)"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [[69.0, 39.0], [80.5, 39.0], [80.5, 43.5], [69.0, 43.5], [69.0, 39.0]]
        ]
      }
    }
  ]
}
```

---

## 3. Рекомендации по рисованию и упрощению границ

1. **Редактирование онлайн:** откройте [geojson.io](https://geojson.io/) или настольный QGIS.
2. **Импорт подложки:** загрузите нужный шаблон из этого файла, чтобы получить исходные рамки и метаданные `properties`.
3. **Отрисовка:** скорректируйте вершины полигона по историческим картам и атласам.
4. **Упрощение:** перед сохранением прогоните GeoJSON через [mapshaper.org](https://mapshaper.org/) (Simplify ~5–10%), чтобы файл весил < 100 КБ для быстрой загрузки.
5. **Проверка:** положите итоговый файл в `public/data/layers/<id>.geojson` и откройте карту с параметром `?debug=layers` (или нажмите кнопку «Слои» в шапке). Статус слоя мгновенно изменится на **«✅ GeoJSON»**.
