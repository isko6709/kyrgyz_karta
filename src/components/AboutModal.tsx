import { useEffect, useState, useMemo } from 'react';
import aboutData from '../data/about.json';
import rulersData from '../data/rulers.json';
import { loadCredits, type PortraitCredit } from '../lib/portrait';
import { RulerAvatar } from './RulerAvatar';
import type { Ruler } from '../types';

interface AboutModalProps {
  onClose: () => void;
}

type TabType = 'overview' | 'disclaimer' | 'sources' | 'credits';

interface FormattedCredit {
  id: string;
  name: string;
  role: string;
  display: string;
  author: string;
  license: string;
  source: string;
  ruler?: Ruler;
}

const RULERS_LIST = (rulersData.rulers || []) as Ruler[];

export function AboutModal({ onClose }: AboutModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [credits, setCredits] = useState<Record<string, PortraitCredit>>({});
  const [creditsSearch, setCreditsSearch] = useState('');
  const [selectedLicense, setSelectedLicense] = useState<string>('all');
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);

  // Загружаем авторов и лицензии портретов из public/portraits/credits.json
  useEffect(() => {
    let isMounted = true;
    loadCredits().then((data) => {
      if (isMounted) {
        setCredits(data);
        setIsLoadingCredits(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Закрытие по клавише Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Преобразуем credits.json в обогащённый массив с данными из rulers.json
  const formattedCredits = useMemo<FormattedCredit[]>(() => {
    const list: FormattedCredit[] = [];
    const entries = Object.entries(credits);

    for (const [id, cred] of entries) {
      const ruler = RULERS_LIST.find((r) => r.id === id);
      const rawAuthor = cred.author || 'Не указан';
      const cleanAuthor = rawAuthor.includes('Unknown author')
        ? 'Неизвестный автор'
        : rawAuthor;

      list.push({
        id,
        name: ruler ? ruler.name : id,
        role: ruler ? ruler.role : 'Историческая фигура',
        display: ruler ? ruler.display : '',
        author: cleanAuthor,
        license: cred.license || 'Public domain',
        source: cred.source || '',
        ruler,
      });
    }

    // Сортировка по имени
    return list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [credits]);

  // Уникальные лицензии для фильтра
  const uniqueLicenses = useMemo(() => {
    const set = new Set<string>();
    for (const c of formattedCredits) {
      if (c.license) set.add(c.license);
    }
    return Array.from(set).sort();
  }, [formattedCredits]);

  // Отфильтрованные кредиты
  const filteredCredits = useMemo(() => {
    const q = creditsSearch.toLowerCase().trim();
    return formattedCredits.filter((c) => {
      const matchText =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q) ||
        c.author.toLowerCase().includes(q) ||
        c.license.toLowerCase().includes(q);
      const matchLicense = selectedLicense === 'all' || c.license === selectedLicense;
      return matchText && matchLicense;
    });
  }, [formattedCredits, creditsSearch, selectedLicense]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-modal-title"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#FDFBF7] text-[#2B2A28] rounded-2xl shadow-2xl border border-black/15 flex flex-col overflow-hidden">
        {/* Шапка модального окна */}
        <header className="px-6 py-4 border-b border-black/10 bg-white/70 backdrop-blur-md flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">ℹ️</span>
              <h2
                id="about-modal-title"
                className="text-lg sm:text-xl font-serif font-bold text-[#2B2A28]"
              >
                {aboutData.title}
              </h2>
            </div>
            <p className="text-xs text-[#6B665E] mt-0.5">{aboutData.subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть окно «О проекте»"
            className="cursor-pointer w-8 h-8 rounded-full flex items-center justify-center text-[#6B665E] hover:text-[#2B2A28] hover:bg-black/5 transition-colors"
          >
            ✕
          </button>
        </header>

        {/* Навигационные табы */}
        <nav
          className="px-6 pt-3 pb-2 bg-[#FAF7F2] border-b border-black/10 flex items-center gap-1.5 overflow-x-auto text-xs shrink-0"
          aria-label="Разделы информации о проекте"
        >
          <button
            onClick={() => setActiveTab('overview')}
            className={`cursor-pointer px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'bg-[#2B2A28] text-white shadow-xs'
                : 'text-[#5E5951] hover:bg-black/5 hover:text-[#2B2A28]'
            }`}
          >
            <span>🎯</span>
            <span>Цель и миссия</span>
          </button>
          <button
            onClick={() => setActiveTab('disclaimer')}
            className={`cursor-pointer px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'disclaimer'
                ? 'bg-[#2B2A28] text-white shadow-xs'
                : 'text-[#5E5951] hover:bg-black/5 hover:text-[#2B2A28]'
            }`}
          >
            <span>⚖️</span>
            <span>Дисклеймер</span>
          </button>
          <button
            onClick={() => setActiveTab('sources')}
            className={`cursor-pointer px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'sources'
                ? 'bg-[#2B2A28] text-white shadow-xs'
                : 'text-[#5E5951] hover:bg-black/5 hover:text-[#2B2A28]'
            }`}
          >
            <span>🌐</span>
            <span>Источники и лицензии</span>
          </button>
          <button
            onClick={() => setActiveTab('credits')}
            className={`cursor-pointer px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'credits'
                ? 'bg-[#2B2A28] text-white shadow-xs'
                : 'text-[#5E5951] hover:bg-black/5 hover:text-[#2B2A28]'
            }`}
          >
            <span>📷</span>
            <span>Авторы фото ({formattedCredits.length})</span>
          </button>
        </nav>

        {/* Тело модального окна со скроллом */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ТАБ 1: ЦЕЛЬ И МИССИЯ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <section className="space-y-3">
                <h3 className="text-base font-serif font-bold text-[#2B2A28] border-b border-black/10 pb-1.5">
                  {aboutData.goal.title}
                </h3>
                {aboutData.goal.paragraphs.map((p, idx) => (
                  <p key={idx} className="text-sm text-[#4A463F] leading-relaxed">
                    {p}
                  </p>
                ))}
              </section>

              {/* Ключевые возможности */}
              <section className="space-y-3">
                <h4 className="text-xs uppercase tracking-wider font-bold text-[#6B665E]">
                  Ключевые возможности приложения
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {aboutData.goal.features.map((feat, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white rounded-xl border border-black/10 shadow-xs"
                    >
                      <div className="text-sm font-bold text-[#2B2A28]">
                        {feat.title}
                      </div>
                      <div className="text-xs text-[#5E5951] mt-1 leading-relaxed">
                        {feat.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Карточка быстрого перехода к дисклеймеру */}
              <div className="p-4 bg-[#F6F1E7] rounded-xl border border-black/10 flex items-start gap-3">
                <span className="text-xl shrink-0 mt-0.5">⚠️</span>
                <div>
                  <div className="text-xs font-bold text-[#2B2A28] uppercase tracking-wide">
                    {aboutData.disclaimer.primary}
                  </div>
                  <div className="text-xs text-[#6B665E] mt-1 leading-relaxed">
                    {aboutData.disclaimer.details}
                  </div>
                  <button
                    onClick={() => setActiveTab('disclaimer')}
                    className="cursor-pointer text-xs font-semibold text-[#2C6466] hover:underline mt-2 inline-block"
                  >
                    Подробнее о достоверности и датах →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ТАБ 2: ДИСКЛЕЙМЕР И ТОЧНОСТЬ */}
          {activeTab === 'disclaimer' && (
            <div className="space-y-5">
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                    {aboutData.disclaimer.badge}
                  </span>
                  <h3 className="text-base font-serif font-bold text-[#2B2A28]">
                    {aboutData.disclaimer.primary}
                  </h3>
                </div>
                <p className="text-sm text-[#4A463F] leading-relaxed">
                  {aboutData.disclaimer.details}
                </p>
              </section>

              {/* Разъяснение шкалы достоверности */}
              <section className="p-4 bg-white rounded-xl border border-black/10 space-y-3 shadow-xs">
                <h4 className="text-xs uppercase tracking-wider font-bold text-[#6B665E]">
                  Обозначения степени достоверности событий (Certainty)
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                      high
                    </span>
                    <span className="text-[#4A463F]">
                      <strong>Общепринято:</strong> дата и локализация события подтверждены
                      независимыми письменными источниками и археологическими свидетельствами.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                      medium ⚠️
                    </span>
                    <span className="text-[#4A463F]">
                      <strong>Уточняется:</strong> датировка или детали в академических
                      источниках различаются в пределах нескольких лет или десятилетий.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300 shrink-0">
                      debated ❓
                    </span>
                    <span className="text-[#4A463F]">
                      <strong>Предмет научных споров:</strong> гипотеза, масштаб или
                      хронологическая локализация являются предметом активной научной дискуссии.
                    </span>
                  </div>
                </div>
              </section>

              <section className="p-4 bg-[#FAF7F2] rounded-xl border border-black/10 text-xs text-[#5E5951] leading-relaxed">
                <strong>Правило нейтральности:</strong> проект придерживается академического
                нейтрального тона при описании сложных политических периодов, не добавляя
                современных политических оценок к событиям прошлого.
              </section>
            </div>
          )}

          {/* ТАБ 3: ИСТОЧНИКИ И ЛИЦЕНЗИИ */}
          {activeTab === 'sources' && (
            <div className="space-y-6">
              {/* Источники данных */}
              <section className="space-y-3">
                <h3 className="text-base font-serif font-bold text-[#2B2A28] border-b border-black/10 pb-1.5">
                  {aboutData.sources.title}
                </h3>
                <p className="text-xs text-[#6B665E]">
                  {aboutData.sources.description}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {aboutData.sources.items.map((src) => (
                    <div
                      key={src.id}
                      className="p-3.5 bg-white rounded-xl border border-black/10 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-[#2B2A28]">
                            {src.name}
                          </h4>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 text-[#5E5951]">
                            {src.license}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#2C6466] font-medium mt-0.5">
                          {src.author}
                        </div>
                        <p className="text-xs text-[#5E5951] mt-2 leading-relaxed">
                          {src.role}
                        </p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-black/5">
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#2C6466] hover:underline font-semibold flex items-center gap-1"
                        >
                          <span>Перейти к источнику</span>
                          <span>↗</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Лицензии ПО и данных */}
              <section className="space-y-3 pt-2 border-t border-black/10">
                <h3 className="text-base font-serif font-bold text-[#2B2A28]">
                  {aboutData.licenses.title}
                </h3>
                <p className="text-xs text-[#6B665E]">
                  {aboutData.licenses.description}
                </p>
                <div className="overflow-x-auto border border-black/10 rounded-xl bg-white shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF7F2] border-b border-black/10 text-[11px] text-[#6B665E] font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Компонент</th>
                        <th className="py-2.5 px-4">Название</th>
                        <th className="py-2.5 px-4">Лицензия</th>
                        <th className="py-2.5 px-4">Ссылка</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {aboutData.licenses.items.map((lic, idx) => (
                        <tr key={idx} className="hover:bg-black/[0.02]">
                          <td className="py-2.5 px-4 font-medium text-[#2B2A28]">
                            {lic.type}
                          </td>
                          <td className="py-2.5 px-4 text-[#5E5951]">{lic.name}</td>
                          <td className="py-2.5 px-4">
                            <span className="font-mono text-[11px] px-2 py-0.5 bg-black/5 rounded">
                              {lic.license}
                            </span>
                          </td>
                          <td className="py-2.5 px-4">
                            <a
                              href={lic.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#2C6466] hover:underline font-semibold"
                            >
                              Условия ↗
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* ТАБ 4: АВТОРЫ ФОТО И ПОРТРЕТОВ */}
          {activeTab === 'credits' && (
            <div className="space-y-4">
              <section className="space-y-1.5">
                <h3 className="text-base font-serif font-bold text-[#2B2A28]">
                  {aboutData.creditsSection.title}
                </h3>
                <p className="text-xs text-[#6B665E]">
                  {aboutData.creditsSection.subtitle}
                </p>
                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
                  {aboutData.creditsSection.note}
                </div>
              </section>

              {/* Поиск и фильтры по авторам */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <div className="relative flex-1 min-w-[200px]">
                  <input
                    type="search"
                    placeholder="Поиск по имени, автору или лицензии..."
                    value={creditsSearch}
                    onChange={(e) => setCreditsSearch(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 bg-white border border-black/15 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2C6466]"
                  />
                  {creditsSearch && (
                    <button
                      onClick={() => setCreditsSearch('')}
                      className="absolute right-2 top-1.5 text-xs text-[#8C867D] hover:text-[#2B2A28]"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Селектор лицензии */}
                <select
                  value={selectedLicense}
                  onChange={(e) => setSelectedLicense(e.target.value)}
                  className="text-xs px-2.5 py-1.5 bg-white border border-black/15 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2C6466]"
                >
                  <option value="all">Все лицензии ({formattedCredits.length})</option>
                  {uniqueLicenses.map((lic) => (
                    <option key={lic} value={lic}>
                      {lic}
                    </option>
                  ))}
                </select>
              </div>

              {/* Список авторов и портретов */}
              {isLoadingCredits ? (
                <div className="text-center py-10 text-xs text-[#6B665E]">
                  {aboutData.creditsSection.emptyMessage}
                </div>
              ) : filteredCredits.length === 0 ? (
                <div className="text-center py-10 text-xs text-[#6B665E]">
                  Ничего не найдено по запросу «{creditsSearch}»
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[48vh] overflow-y-auto pr-1">
                  {filteredCredits.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-white rounded-xl border border-black/10 shadow-xs flex items-center gap-3"
                    >
                      {/* Аватарка через штатный RulerAvatar */}
                      <div className="shrink-0">
                        {item.ruler ? (
                          <RulerAvatar ruler={item.ruler} size={48} />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-[#F6F1E7] border border-black/10 flex items-center justify-center font-bold text-xs text-[#5E5951]">
                            {item.name.charAt(0)}
                          </div>
                        )}
                      </div>

                      {/* Текстовая информация */}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs text-[#2B2A28] truncate">
                          {item.name}
                        </div>
                        <div className="text-[10.5px] text-[#5E5951] truncate">
                          {item.role} {item.display ? `(${item.display})` : ''}
                        </div>
                        <div className="text-[10px] text-[#6B665E] mt-0.5 truncate">
                          Автор: <strong>{item.author}</strong>
                        </div>
                        <div className="flex items-center justify-between gap-1.5 mt-1 pt-1 border-t border-black/5">
                          <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-black/5 text-[#5E5951] font-medium truncate max-w-[140px]">
                            {item.license}
                          </span>
                          {item.source && (
                            <a
                              href={item.source}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-[#2C6466] hover:underline font-semibold shrink-0"
                            >
                              Commons ↗
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Подвал модального окна */}
        <footer className="px-6 py-3 bg-[#FAF7F2] border-t border-black/10 flex items-center justify-between text-xs text-[#6B665E] shrink-0">
          <div className="text-[11px] truncate mr-2">
            «{aboutData.disclaimer.primary}»
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer px-4 py-1.5 rounded-lg font-semibold bg-[#2B2A28] text-white hover:bg-black transition-colors shrink-0"
          >
            Закрыть
          </button>
        </footer>
      </div>
    </div>
  );
}
