import type { HistEvent, Certainty } from '../types';

export const CATEGORY_CONFIG: Record<
  HistEvent['category'],
  { label: string; color: string; bg: string }
> = {
  state: { label: 'Государство', color: '#1D4ED8', bg: '#EFF6FF' },
  war: { label: 'Война / Восстание', color: '#DC2626', bg: '#FEF2F2' },
  culture: { label: 'Культура / Наука', color: '#047857', bg: '#ECFDF5' },
  trade: { label: 'Торговля', color: '#D97706', bg: '#FFFBEB' },
  society: { label: 'Общество', color: '#7C3AED', bg: '#F5F3FF' },
  tragedy: { label: 'Трагедия', color: '#991B1B', bg: '#FEF2F2' },
  economy: { label: 'Экономика', color: '#047857', bg: '#ECFDF5' },
};

export const CERTAINTY_CONFIG: Record<
  Certainty,
  {
    label: string;
    icon: string;
    tooltip: string;
    textClass: string;
    bgClass: string;
    borderClass: string;
  }
> = {
  high: {
    label: 'Общепринято',
    icon: '✅',
    tooltip: 'Высокая достоверность: дата и факт подтверждены устойчивым историографическим консенсусом.',
    textClass: 'text-emerald-800',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
  },
  medium: {
    label: 'Источники расходятся',
    icon: '⚠️',
    tooltip: 'Средняя достоверность: различные исторические источники приводят несовпадающие даты (± несколько лет).',
    textClass: 'text-amber-800',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
  },
  debated: {
    label: 'Предмет споров',
    icon: '❓',
    tooltip: 'Дискуссионно: хронология или обстоятельства события являются предметом активных научных споров.',
    textClass: 'text-purple-800',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-200',
  },
};
