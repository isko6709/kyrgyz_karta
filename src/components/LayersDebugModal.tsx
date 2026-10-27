import { useState, useEffect } from 'react';
import { layers, eras } from '../lib/data';
import { checkAllLayersStatus, type LayerCacheEntry } from '../lib/layersCache';
import { useStore } from '../store';
import type { Layer } from '../types';

export function LayersDebugModal({ onClose }: { onClose: () => void }) {
  const { setYear, setHighlightedLayerId, flyTo } = useStore();
  const [statuses, setStatuses] = useState<Record<string, LayerCacheEntry>>({});
  const [loading, setLoading] = useState(true);

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

  const handleInspectLayer = (layer: Layer) => {
    setYear(layer.from);
    setHighlightedLayerId(layer.id);
    const [w, s, e, n] = layer.bbox;
    flyTo([(w + e) / 2, (s + n) / 2], 5.5, 1200);
    onClose();
  };

  const loadedCount = Object.values(statuses).filter((s) => s.status === 'loaded').length;
  const missingCount = layers.length - loadedCount;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="debug-layers-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-black/15 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Шапка модального окна */}
        <header className="p-4 sm:p-5 border-b border-black/10 flex items-center justify-between bg-[#FDFBF7]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10.5px] font-mono bg-purple-100 text-purple-800 font-bold uppercase">
                ?debug=layers
              </span>
              <h2 id="debug-layers-title" className="text-lg font-serif font-bold text-[#2B2A28]">
                Отладка GeoJSON слоёв территорий
              </h2>
            </div>
            <p className="text-xs text-[#5E5951] mt-1">
              Проверка доступности файлов <code className="bg-black/5 px-1 rounded font-mono">public/data/layers/&lt;id&gt;.geojson</code>
            </p>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Сводная плашка */}
        <div className="px-5 py-2.5 bg-black/[0.02] border-b border-black/5 flex items-center justify-between text-xs text-[#2B2A28] flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span>Всего слоёв: <strong>{layers.length}</strong></span>
            <span className="text-emerald-700 font-medium">Загружено GeoJSON: <strong>{loadedCount}</strong></span>
            <span className="text-amber-700 font-medium">BBox-заглушки: <strong>{missingCount}</strong></span>
          </div>
          <div className="text-[11px] text-[#5E5951] italic">
            Инструкции и шаблоны: <code className="font-mono">docs/layers-todo.md</code>
          </div>
        </div>

        {/* Таблица слоёв */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {layers.map((layer) => {
              const entry = statuses[layer.id];
              const isLoaded = entry?.status === 'loaded';
              const era = eras.find((e) => e.from <= layer.to && e.to >= layer.from);

              return (
                <div
                  key={layer.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                    isLoaded
                      ? 'bg-emerald-50/40 border-emerald-300'
                      : 'bg-[#FDFBF7] border-black/10 hover:border-black/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[11px] font-bold text-[#2B2A28] bg-black/5 px-1.5 py-0.2 rounded">
                          {layer.id}
                        </span>
                        {era && (
                          <span
                            className="text-[10px] text-white px-1.5 py-0.2 rounded font-medium"
                            style={{ backgroundColor: era.color }}
                          >
                            {era.title}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm text-[#2B2A28] mt-1">
                        {layer.title}
                      </h3>
                      {layer.note && (
                        <p className="text-[11px] text-[#5E5951] mt-0.5">{layer.note}</p>
                      )}
                    </div>

                    {/* Статус бейдж */}
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-[10.5px] font-medium border ${
                        isLoaded
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {isLoaded ? '✅ GeoJSON' : '⚠️ BBox заглушка'}
                    </span>
                  </div>

                  {/* Параметры: период и bbox */}
                  <div className="text-[11px] font-mono text-[#5E5951] bg-white p-2 rounded-lg border border-black/5 flex items-center justify-between">
                    <span>
                      Период: {layer.from < 0 ? `${Math.abs(layer.from)} до н.э.` : layer.from}–
                      {layer.to < 0 ? `${Math.abs(layer.to)} до н.э.` : layer.to}
                    </span>
                    <span>bbox: [{layer.bbox.join(', ')}]</span>
                  </div>

                  {/* Кнопка перехода к слою */}
                  <button
                    onClick={() => handleInspectLayer(layer)}
                    className="cursor-pointer w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-[#2B2A28] hover:bg-black text-white transition-colors flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
                  >
                    <span>Перейти и показать на карте ({layer.from < 0 ? `${Math.abs(layer.from)} до н.э.` : layer.from} г.)</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
