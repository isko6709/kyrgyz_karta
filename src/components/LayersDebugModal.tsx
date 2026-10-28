import { useState, useEffect } from 'react';
import { layers, eras } from '../lib/data';
import { checkAllLayersStatus, type LayerCacheEntry } from '../lib/layersCache';
import { useStore } from '../store';
import type { Layer } from '../types';

export function LayersDebugModal({ onClose }: { onClose: () => void }) {
  const {
    setYear,
    setHighlightedLayerId,
    flyTo,
    debugSelectedLayerId,
    setDebugSelectedLayerId,
    debugForcedLayerIds,
    toggleDebugForcedLayer,
    setDebugForcedLayers,
  } = useStore();

  const [statuses, setStatuses] = useState<Record<string, LayerCacheEntry>>({});
  const [loading, setLoading] = useState(true);
  const [filterSource, setFilterSource] = useState<string>('all');
  const [isMinimized, setIsMinimized] = useState(false);

  const checkStatus = async () => {
    setLoading(true);
    const layerIds = layers.map((l) => l.id);
    const results = await checkAllLayersStatus(layerIds);
    setStatuses(results);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    checkAllLayersStatus(layers.map((l) => l.id)).then((results) => {
      if (active) {
        setStatuses(results);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Выбор и фокусировка слоя с красной обводкой
  const handleSelectLayer = (layer: Layer) => {
    const isAlreadySelected = debugSelectedLayerId === layer.id;
    if (isAlreadySelected) {
      setDebugSelectedLayerId(null);
    } else {
      setDebugSelectedLayerId(layer.id);
      setHighlightedLayerId(layer.id);
      setYear(layer.from);

      // Обязательно делаем слой видимым
      if (!debugForcedLayerIds.includes(layer.id)) {
        toggleDebugForcedLayer(layer.id);
      }

      const [w, s, e, n] = layer.bbox;
      flyTo([(w + e) / 2, (s + n) / 2], 5.5, 1200);
    }
  };

  // Переключение видимости всех слоёв разом
  const handleToggleAllVisibility = () => {
    if (debugForcedLayerIds.length === layers.length) {
      setDebugForcedLayers([]);
    } else {
      setDebugForcedLayers(layers.map((l) => l.id));
    }
  };

  const overrideCount = Object.values(statuses).filter((s) => s.source === 'override').length;
  const basemapCount = Object.values(statuses).filter((s) => s.source === 'historical-basemaps').length;
  const schematicCount = Object.values(statuses).filter((s) => s.source === 'schematic').length;

  const filteredLayers = layers.filter((l) => {
    if (filterSource === 'all') return true;
    const s = statuses[l.id];
    return s?.source === filterSource;
  });

  // 1. Компактный режим (Docked / Minimized), чтобы видеть карту и красную обводку
  if (isMinimized) {
    const activeLayer = layers.find((l) => l.id === debugSelectedLayerId);

    return (
      <div className="fixed bottom-24 right-4 z-50 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-black/15 p-3 flex flex-col gap-2 max-w-xs animate-fade-in text-xs text-[#2B2A28]">
        <div className="flex items-center justify-between gap-2 border-b border-black/10 pb-1.5">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span>?debug=layers</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(false)}
              className="cursor-pointer px-2 py-0.5 rounded text-[11px] font-medium bg-black/5 hover:bg-black/10 transition-colors"
              title="Развернуть полную таблицу слоёв"
            >
              Таблица ↗
            </button>
            <button
              onClick={() => {
                setDebugSelectedLayerId(null);
                onClose();
              }}
              className="cursor-pointer p-1 text-[#5E5951] hover:text-[#2B2A28]"
              title="Закрыть режим отладки"
            >
              ✕
            </button>
          </div>
        </div>

        {activeLayer ? (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#6B665E] font-semibold">
              Красная обводка слоя:
            </div>
            <div className="font-bold text-sm text-[#2B2A28] truncate">{activeLayer.title}</div>
            <div className="text-[11px] font-mono text-[#5E5951] mt-0.5">
              id: {activeLayer.id} ({activeLayer.from}–{activeLayer.to} гг.)
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-[#5E5951]">
            Кликните на слой в таблице, чтобы подсветить его красной обводкой.
          </div>
        )}

        <div className="flex items-center gap-1.5 pt-1 border-t border-black/5">
          <button
            onClick={handleToggleAllVisibility}
            className="cursor-pointer flex-1 py-1 px-2 rounded-lg text-[10.5px] font-medium bg-black/5 hover:bg-black/10 transition-colors"
          >
            {debugForcedLayerIds.length === layers.length ? 'Скрыть все' : 'Показать все (24)'}
          </button>
          {debugSelectedLayerId && (
            <button
              onClick={() => setDebugSelectedLayerId(null)}
              className="cursor-pointer py-1 px-2 rounded-lg text-[10.5px] font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
            >
              Снять обводку
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. Полный режим модального окна с подробной таблицей слоёв
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="debug-layers-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-black/15 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-[#2B2A28]">
        {/* Шапка модального окна */}
        <header className="p-4 sm:p-5 border-b border-black/10 flex items-center justify-between bg-[#FDFBF7]">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-purple-100 text-purple-900 font-bold uppercase tracking-wider">
                ?debug=layers
              </span>
              <h2 id="debug-layers-title" className="text-lg font-serif font-bold text-[#2B2A28]">
                Таблица и отладчик слоёв территорий
              </h2>
            </div>
            <p className="text-xs text-[#5E5951] mt-1">
              Управление видимостью, источниками (<code className="font-mono bg-black/5 px-1 rounded">layers-override/</code>, <code className="font-mono bg-black/5 px-1 rounded">historical-basemaps</code>, <code className="font-mono bg-black/5 px-1 rounded">schematic</code>) и красная обводка выбранного полигона.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMinimized(true)}
              className="cursor-pointer px-2.5 py-1.5 rounded-lg text-xs font-medium bg-black/5 hover:bg-black/10 text-[#2B2A28] transition-colors flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
              title="Свернуть окно в компактную панель, чтобы видеть карту"
            >
              <span>Свернуть к карте ↘</span>
            </button>
            <button
              onClick={checkStatus}
              disabled={loading}
              className="cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium bg-black/5 hover:bg-black/10 text-[#2B2A28] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
            >
              {loading ? 'Проверка...' : '🔄 Обновить'}
            </button>
            <button
              onClick={onClose}
              className="cursor-pointer p-1.5 rounded-lg text-sm text-[#5E5951] hover:text-[#2B2A28] hover:bg-black/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
              aria-label="Закрыть режим отладки"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Панель фильтров и статистики */}
        <div className="px-5 py-3 bg-[#FAF7F2] border-b border-black/10 flex items-center justify-between flex-wrap gap-2 text-xs">
          {/* Фильтры по источнику */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-[#5E5951] mr-1">Источник:</span>
            <button
              onClick={() => setFilterSource('all')}
              className={`cursor-pointer px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                filterSource === 'all'
                  ? 'bg-[#2B2A28] text-white shadow-xs'
                  : 'bg-white text-[#5E5951] border border-black/10 hover:bg-black/5'
              }`}
            >
              Все (24)
            </button>
            <button
              onClick={() => setFilterSource('override')}
              className={`cursor-pointer px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                filterSource === 'override'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100'
              }`}
            >
              📁 Override ({overrideCount})
            </button>
            <button
              onClick={() => setFilterSource('historical-basemaps')}
              className={`cursor-pointer px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                filterSource === 'historical-basemaps'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              🌐 historical-basemaps ({basemapCount})
            </button>
            <button
              onClick={() => setFilterSource('schematic')}
              className={`cursor-pointer px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                filterSource === 'schematic'
                  ? 'bg-amber-700 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              📐 schematic ({schematicCount})
            </button>
          </div>

          {/* Действия массовой видимости */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleAllVisibility}
              className="cursor-pointer px-3 py-1 rounded-lg text-xs font-semibold bg-white border border-black/15 hover:bg-black/5 transition-colors shadow-xs"
            >
              {debugForcedLayerIds.length === layers.length ? 'Скрыть все' : 'Показать все на карте'}
            </button>
            {debugSelectedLayerId && (
              <button
                onClick={() => setDebugSelectedLayerId(null)}
                className="cursor-pointer px-2.5 py-1 rounded-lg text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
              >
                Снять красную обводку
              </button>
            )}
          </div>
        </div>

        {/* Таблица 24 слоёв */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F6F1E7] sticky top-0 z-10 border-b border-black/10 text-[11px] font-semibold text-[#5E5951]">
              <tr>
                <th className="py-2.5 px-3">Видимость</th>
                <th className="py-2.5 px-3">ID слоя</th>
                <th className="py-2.5 px-3">Название</th>
                <th className="py-2.5 px-3">Источник</th>
                <th className="py-2.5 px-3">Снимок</th>
                <th className="py-2.5 px-3 text-right">Вершин</th>
                <th className="py-2.5 px-3 text-right">Размер</th>
                <th className="py-2.5 px-3">Статус</th>
                <th className="py-2.5 px-3 text-center">Обводка</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {filteredLayers.map((layer) => {
                const entry = statuses[layer.id];
                const isSelected = debugSelectedLayerId === layer.id;
                const isForcedVisible = debugForcedLayerIds.includes(layer.id);
                const source = entry?.source ?? (layer.id.includes('override') ? 'override' : 'schematic');
                const era = eras.find((e) => e.from <= layer.to && e.to >= layer.from);

                return (
                  <tr
                    key={layer.id}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-red-50/80 font-medium'
                        : isForcedVisible
                        ? 'bg-blue-50/40 hover:bg-blue-50/70'
                        : 'hover:bg-black/[0.02]'
                    }`}
                  >
                    {/* Кнопка показа/скрытия на карте */}
                    <td className="py-2 px-3">
                      <button
                        onClick={() => toggleDebugForcedLayer(layer.id)}
                        aria-pressed={isForcedVisible}
                        title={isForcedVisible ? 'Скрыть с карты' : 'Показать слой на карте'}
                        className={`cursor-pointer px-2 py-1 rounded text-[11px] font-semibold border transition-all flex items-center gap-1 ${
                          isForcedVisible
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                            : 'bg-white text-[#6B665E] border-black/15 hover:border-black/30'
                        }`}
                      >
                        <span>{isForcedVisible ? '👁️ Вкл' : 'Скрыт'}</span>
                      </button>
                    </td>

                    {/* ID слоя */}
                    <td className="py-2 px-3 font-mono font-bold text-[11px] text-[#2B2A28]">
                      {layer.id}
                    </td>

                    {/* Название и эпоха */}
                    <td className="py-2 px-3">
                      <div className="font-semibold text-[#2B2A28]">{layer.title}</div>
                      {layer.shortTitle && layer.shortTitle !== layer.title && (
                        <div className="text-[10px] text-[#2C6466] font-medium mt-0.5">
                          На карте: «{layer.shortTitle}»
                        </div>
                      )}
                      <div className="text-[10.5px] text-[#5E5951] flex items-center gap-1.5 mt-0.5">
                        <span>
                          {layer.from < 0 ? `${Math.abs(layer.from)} до н.э.` : layer.from}–
                          {layer.to < 0 ? `${Math.abs(layer.to)} до н.э.` : layer.to} гг.
                        </span>
                        {era && (
                          <span
                            className="px-1.5 py-0.2 rounded text-[9.5px] text-white font-medium"
                            style={{ backgroundColor: era.color }}
                          >
                            {era.title}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Источник: historical-basemaps / override / schematic */}
                    <td className="py-2 px-3">
                      {source === 'override' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                          📁 override
                        </span>
                      ) : source === 'historical-basemaps' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-100 text-emerald-900 border border-emerald-300">
                          🌐 historical-basemaps
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-amber-100 text-amber-900 border border-amber-300">
                          📐 schematic
                        </span>
                      )}
                    </td>

                    {/* Год снимка */}
                    <td className="py-2 px-3 font-mono text-[11px] text-[#5E5951]">
                      {entry?.snapshotYear
                        ? entry.snapshotYear > 0
                          ? `${entry.snapshotYear} г.`
                          : `${Math.abs(entry.snapshotYear)} до н.э.`
                        : '—'}
                    </td>

                    {/* Число вершин */}
                    <td className="py-2 px-3 font-mono text-right text-[11.5px] text-[#2B2A28]">
                      {entry?.vertices ? entry.vertices.toLocaleString() : '—'}
                    </td>

                    {/* Размер файла */}
                    <td className="py-2 px-3 font-mono text-right text-[11px] text-[#5E5951]">
                      {entry?.sizeKb ? `${entry.sizeKb} КБ` : '—'}
                    </td>

                    {/* Статус */}
                    <td className="py-2 px-3">
                      {entry?.status === 'loaded' ? (
                        <span className="text-emerald-700 font-medium">✅ Загружен</span>
                      ) : entry?.status === 'missing' ? (
                        <span className="text-amber-700 font-medium">⚠️ BBox заглушка</span>
                      ) : (
                        <span className="text-[#8C8275]">⏳ Загрузка...</span>
                      )}
                    </td>

                    {/* Кнопка красной обводки и перехода */}
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => handleSelectLayer(layer)}
                        aria-pressed={isSelected}
                        className={`cursor-pointer px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                          isSelected
                            ? 'bg-red-600 text-white border-red-700 shadow-sm ring-2 ring-red-400/50'
                            : 'bg-white hover:bg-red-50 text-red-700 border-red-300'
                        }`}
                        title="Нажмите, чтобы приблизить слой и подсветить его яркой красной обводкой"
                      >
                        {isSelected ? '🔴 Выбран' : 'Фокус'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Подвал с инструкцией по layers-override */}
        <footer className="p-3 sm:p-4 bg-[#FDFBF7] border-t border-black/10 flex items-center justify-between text-xs text-[#5E5951] flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#2B2A28]">Ручная правка границ:</span>
            <span>
              Положите <code className="font-mono bg-black/5 px-1 rounded">&lt;id&gt;.geojson</code> в{' '}
              <code className="font-mono bg-black/5 px-1 rounded">public/data/layers-override/</code> — он имеет приоритет и никогда не перезаписывается.
            </span>
          </div>
          <button
            onClick={() => setIsMinimized(true)}
            className="cursor-pointer text-xs font-medium text-[#2B2A28] hover:underline"
          >
            Свернуть и смотреть на карте →
          </button>
        </footer>
      </div>
    </div>
  );
}
