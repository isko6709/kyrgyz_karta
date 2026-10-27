import { useState, useEffect } from 'react';
import { getPortrait, PLACEHOLDER, loadCredits, type PortraitCredit } from '../lib/portrait';
import type { Ruler } from '../types';

// Круглая аватарка правителя. Всегда использовать этот компонент для портретов.
export function RulerAvatar({
  ruler,
  size = 72,
  compact = false,
}: {
  ruler: Ruler;
  size?: number;
  compact?: boolean;
}) {
  const { src, isPlaceholder } = getPortrait(ruler.id);
  const [failed, setFailed] = useState(false);
  const [credit, setCredit] = useState<PortraitCredit | null>(null);

  useEffect(() => {
    let active = true;
    loadCredits().then((credits) => {
      if (active && credits && credits[ruler.id]) {
        setCredit(credits[ruler.id]);
      }
    });
    return () => {
      active = false;
    };
  }, [ruler.id]);

  const showPlaceholder = isPlaceholder || failed;
  const conditional = showPlaceholder || ruler.imageType === 'none';

  const attributionTooltip = credit
    ? `Изображение: ${credit.author || 'Автор не указан'}${credit.license ? ` (${credit.license})` : ''}${credit.source ? ` • Источник: ${credit.source}` : ''}`
    : conditional
    ? 'Условное изображение (подлинных портретов не сохранилось)'
    : undefined;

  return (
    <figure
      className="flex flex-col items-center text-center shrink-0 group relative"
      style={{ width: compact ? size : size + 40 }}
      title={attributionTooltip}
    >
      <div className="relative">
        <img
          src={showPlaceholder ? PLACEHOLDER : src}
          alt={showPlaceholder ? `Условное изображение: ${ruler.name}` : `Портрет: ${ruler.name}`}
          width={size}
          height={size}
          loading="lazy"
          onError={() => setFailed(true)}
          className="rounded-full object-cover border border-black/10 bg-[#EFE8D8] shadow-sm transition-transform group-hover:scale-105"
          style={{ width: size, height: size }}
        />
        {credit && (
          <span
            className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-[#2B2A28] text-white text-[9px] flex items-center justify-center font-serif shadow"
            title={attributionTooltip}
          >
            ©
          </span>
        )}
      </div>

      {!compact && (
        <>
          <figcaption className="mt-1 text-[13px] leading-tight text-[#2B2A28] font-medium">{ruler.name}</figcaption>
          <span className="text-[11px] text-[#6B665E]">{ruler.display}</span>
          {conditional && (
            <span className="text-[10px] italic text-[#6B665E]">условное изображение</span>
          )}
          {credit && (
            <div className="mt-0.5 text-[9.5px] text-[#6B665E] max-w-[120px] truncate">
              {credit.source ? (
                <a
                  href={credit.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="underline hover:text-[#2B2A28] transition-colors"
                  title={`${credit.author ? credit.author + ', ' : ''}${credit.license || ''}`}
                >
                  © {credit.author || credit.license || 'Commons'}
                </a>
              ) : (
                <span>© {credit.author || credit.license}</span>
              )}
            </div>
          )}
        </>
      )}
    </figure>
  );
}
