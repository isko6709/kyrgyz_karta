import { useState, useEffect, useRef } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import { eras, eraForYear } from '../lib/data';

export interface YearPickerModalProps {
  isOpen: boolean;
  currentYear: number;
  onClose: () => void;
  onSelectYear: (year: number) => void;
}

// Ключевые исторические вехи истории Кыргызстана для мгновенного перехода в 1 клик
const HISTORICAL_PRESETS = [
  { year: -800, label: '800 до н.э.', title: 'Саки и усуни', era: 'ancient', icon: '🏺' },
  { year: -201, label: '201 до н.э.', title: 'Первое упомин. кыргызов', era: 'ancient', icon: '📜' },
  { year: 552, label: '552 г.', title: 'Тюркский каганат', era: 'turkic', icon: '🐎' },
  { year: 751, label: '751 г.', title: 'Атлахская битва (Талас)', era: 'turkic', icon: '⚔️' },
  { year: 840, label: '840 г.', title: 'Кыргызский каганат', era: 'turkic', icon: '🦅' },
  { year: 940, label: '940 г.', title: 'Караханиды (Баласагун)', era: 'karakhanid', icon: '🕌' },
  { year: 1128, label: '1128 г.', title: 'Каракитаи (Западное Ляо)', era: 'karakhanid', icon: '🏹' },
  { year: 1207, label: '1207 г.', title: 'Эпоха Чингисхана', era: 'mongol', icon: '🐎' },
  { year: 1347, label: '1347 г.', title: 'Моголистан', era: 'mongol', icon: '🏕️' },
  { year: 1500, label: '1500 г.', title: 'Кыргызы на Тянь-Шане', era: 'tribes', icon: '⛰️' },
  { year: 1755, label: '1755 г.', title: 'Разгром Джунгарии', era: 'tribes', icon: '🛡️' },
  { year: 1820, label: '1820 г.', title: 'Кокандское ханство', era: 'tribes', icon: '🏰' },
  { year: 1855, label: '1855 г.', title: 'Боромбай (Росс. империя)', era: 'russian', icon: '📜' },
  { year: 1873, label: '1873 г.', title: 'Российский Туркестан', era: 'russian', icon: '🏛️' },
  { year: 1876, label: '1876 г.', title: 'Курманджан датка (Алай)', era: 'russian', icon: '👑' },
  { year: 1916, label: '1916 г.', title: 'Восстание Үркүн', era: 'russian', icon: '⚡' },
  { year: 1924, label: '1924 г.', title: 'Кара-Киргизская АО', era: 'soviet', icon: '🚩' },
  { year: 1936, label: '1936 г.', title: 'Киргизская ССР', era: 'soviet', icon: '⭐' },
  { year: 1991, label: '1991 г.', title: 'Суверенный Кыргызстан', era: 'modern', icon: '🇰🇬' },
  { year: 2026, label: '2026 г.', title: 'Наши дни', era: 'modern', icon: '📍' },
];

export function YearPickerModal({
  isOpen,
  currentYear,
  onClose,
  onSelectYear,
}: YearPickerModalProps) {
  const shouldReduceMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);

  const [inputVal, setInputVal] = useState<string>(String(Math.abs(currentYear)));
  const [isBc, setIsBc] = useState<boolean>(currentYear < 0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Синхронизация при открытии
  useEffect(() => {
    if (isOpen) {
      setInputVal(String(Math.abs(currentYear)));
      setIsBc(currentYear < 0);
      setErrorMsg(null);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 80);
    }
  }, [isOpen, currentYear]);

  // Закрытие по Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const parsedYear = (): number | null => {
    const raw = parseInt(inputVal.trim(), 10);
    if (Number.isNaN(raw)) return null;
    const y = isBc ? -Math.abs(raw) : Math.abs(raw);
    if (y < -2000 || y > 2026) return null;
    return y;
  };

  const handleApply = (targetYear?: number) => {
    const y = targetYear !== undefined ? targetYear : parsedYear();
    if (y === null) {
      setErrorMsg('Введите год в диапазоне от 2000 до н.э. до 2026 н.э.');
      return;
    }
    onSelectYear(y);
    onClose();
  };

  const handleStep = (step: number) => {
    const curr = parsedYear() ?? currentYear;
    const next = Math.max(-2000, Math.min(2026, curr + step));
    setInputVal(String(Math.abs(next)));
    setIsBc(next < 0);
    setErrorMsg(null);
  };

  const activeCalculatedYear = parsedYear();
  const previewEra = activeCalculatedYear !== null ? eraForYear(activeCalculatedYear) : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 select-none"
          role="dialog"
          aria-modal="true"
          aria-label="Выбор года и исторической эпохи"
        >
          {/* Фон затемнения */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            aria-hidden="true"
          />

          {/* Панель модального окна */}
          <m.div
            initial={{ y: shouldReduceMotion ? 0 : 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: shouldReduceMotion ? 0 : 40, opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: 'easeOut' }}
            className="relative w-full max-w-lg max-h-[85vh] bg-[#FDFBF7] text-[#1F1E1D] rounded-t-[24px] sm:rounded-2xl shadow-2xl border border-black/10 flex flex-col overflow-hidden z-10"
          >
            {/* Шапка модального окна */}
            <div className="px-5 py-3.5 border-b border-black/10 flex items-center justify-between bg-white/70">
              <div className="flex items-center gap-2">
                <span className="text-lg" aria-hidden="true">📅</span>
                <h2 className="font-serif font-bold text-base sm:text-lg text-[#1F1E1D]">
                  Выбрать год истории
                </h2>
              </div>
              <button
                onClick={onClose}
                className="cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-[#4A463F] hover:text-[#1F1E1D] hover:bg-black/5 active:bg-black/10 transition-colors"
                aria-label="Закрыть"
              >
                <span className="text-lg font-bold">✕</span>
              </button>
            </div>

            {/* Основное содержимое со скроллом */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Блок прямого ввода года */}
              <div className="bg-white rounded-2xl p-4 border border-black/10 shadow-xs space-y-3">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-[#4A463F] text-center">
                  Прямой ввод года (от 2000 до н.э. до 2026)
                </div>

                <div className="flex items-center justify-center gap-2">
                  {/* Кнопка переключения "до н.э. / н.э." */}
                  <button
                    type="button"
                    onClick={() => setIsBc(!isBc)}
                    className={`cursor-pointer min-h-[44px] px-3 rounded-xl font-bold text-xs transition-all border ${
                      isBc
                        ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                        : 'bg-black/5 text-[#1F1E1D] border-black/10 hover:bg-black/10'
                    }`}
                    title="Переключить до нашей эры / нашей эры"
                  >
                    {isBc ? 'до н.э.' : 'н.э.'}
                  </button>

                  {/* Крупное поле ввода числа */}
                  <input
                    ref={inputRef}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={2026}
                    value={inputVal}
                    onChange={(e) => {
                      setInputVal(e.target.value);
                      setErrorMsg(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApply();
                      }
                    }}
                    className="w-32 sm:w-36 min-h-[44px] text-center text-2xl sm:text-3xl font-serif font-bold text-[#1F1E1D] bg-[#F6F1E7] border-2 border-black/15 rounded-xl focus:outline-none focus:border-[#2C6466] focus:ring-2 focus:ring-[#2C6466]/20 transition-all"
                    placeholder="840"
                    aria-label="Число года"
                  />

                  {/* Кнопка "Применить" */}
                  <button
                    type="button"
                    onClick={() => handleApply()}
                    className="cursor-pointer min-h-[44px] px-4 rounded-xl bg-[#2C6466] text-white hover:bg-[#1E4D4F] active:bg-[#16383A] font-bold text-sm shadow-sm transition-all"
                  >
                    Перейти
                  </button>
                </div>

                {/* Предпросмотр эпохи */}
                {previewEra && (
                  <div className="flex items-center justify-center gap-2 pt-1 text-xs text-[#4A463F]">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: previewEra.color }}
                    />
                    <span className="font-semibold text-[#1F1E1D]">{previewEra.title}</span>
                    <span className="text-[11px]">
                      ({previewEra.from < 0 ? `${Math.abs(previewEra.from)} до н.э.` : previewEra.from}–
                      {previewEra.to < 0 ? `${Math.abs(previewEra.to)} до н.э.` : previewEra.to})
                    </span>
                  </div>
                )}

                {errorMsg && (
                  <div className="text-center text-xs text-red-600 font-medium">
                    {errorMsg}
                  </div>
                )}

                {/* Кнопки шага для точной подгонки */}
                <div className="flex items-center justify-center gap-1.5 pt-1 flex-wrap">
                  <span className="text-[10px] text-[#4A463F] mr-1">Шаг:</span>
                  {[-100, -25, -10, -1, +1, +10, +25, +100].map((step) => (
                    <button
                      key={`step-${step}`}
                      type="button"
                      onClick={() => handleStep(step)}
                      className="cursor-pointer min-h-[36px] min-w-[34px] px-1.5 py-1 text-xs font-semibold rounded-lg bg-black/5 hover:bg-black/10 active:bg-black/15 text-[#1F1E1D] transition-colors"
                    >
                      {step > 0 ? `+${step}` : step}
                    </button>
                  ))}
                </div>
              </div>

              {/* Быстрый переход по ключевым историческим эпохам */}
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-[#4A463F]">
                  Быстрый переход к историческим событиям и государствам:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {HISTORICAL_PRESETS.map((p) => {
                    const eraObj = eras.find((e) => e.id === p.era);
                    const isCurrent = currentYear === p.year;

                    return (
                      <button
                        key={`preset-${p.year}-${p.title}`}
                        type="button"
                        onClick={() => handleApply(p.year)}
                        className={`cursor-pointer min-h-[44px] p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all active:scale-98 ${
                          isCurrent
                            ? 'bg-[#2C6466]/10 border-[#2C6466] ring-2 ring-[#2C6466]/30 shadow-xs'
                            : 'bg-white border-black/10 hover:border-black/20 hover:bg-[#FDFBF7]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base shrink-0" aria-hidden="true">{p.icon}</span>
                          <div className="truncate">
                            <div className="text-xs font-bold text-[#1F1E1D] leading-tight truncate">
                              {p.title}
                            </div>
                            <div className="text-[10px] text-[#4A463F] leading-tight mt-0.5">
                              {eraObj?.title ?? ''}
                            </div>
                          </div>
                        </div>

                        <span
                          className="shrink-0 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold"
                          style={{
                            backgroundColor: (eraObj?.color ?? '#4A463F') + '25',
                            color: '#1F1E1D',
                          }}
                        >
                          {p.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Нижняя панель действий */}
            <div className="p-3 bg-white/80 border-t border-black/10 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleApply(2026)}
                className="cursor-pointer min-h-[42px] px-3 rounded-xl bg-black/5 hover:bg-black/10 text-xs font-semibold text-[#1F1E1D]"
              >
                📍 Сегодня (2026)
              </button>
              <button
                type="button"
                onClick={() => handleApply(-800)}
                className="cursor-pointer min-h-[42px] px-3 rounded-xl bg-black/5 hover:bg-black/10 text-xs font-semibold text-[#1F1E1D]"
              >
                🏺 Древность (-800)
              </button>
              <button
                type="button"
                onClick={() => handleApply()}
                className="cursor-pointer min-h-[42px] px-5 rounded-xl bg-[#2C6466] text-white hover:bg-[#1E4D4F] font-bold text-xs shadow-xs"
              >
                ✓ Применить
              </button>
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
