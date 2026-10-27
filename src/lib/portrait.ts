import portraits from '../data/portraits.json'; // генерируется: npm run sync:portraits

const map = portraits as Record<string, string>;
export const PLACEHOLDER = '/portraits/_placeholder.svg';

export interface PortraitCredit {
  author?: string;
  license?: string;
  source?: string;
}

let creditsCache: Record<string, PortraitCredit> | null = null;
let creditsPromise: Promise<Record<string, PortraitCredit>> | null = null;

export async function loadCredits(): Promise<Record<string, PortraitCredit>> {
  if (creditsCache) return creditsCache;
  if (!creditsPromise) {
    creditsPromise = fetch('/portraits/credits.json')
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        creditsCache = data;
        return data;
      })
      .catch(() => ({}));
  }
  return creditsPromise;
}

export function getPortrait(id: string): { src: string; isPlaceholder: boolean } {
  const src = map[id];
  return src ? { src, isPlaceholder: false } : { src: PLACEHOLDER, isPlaceholder: true };
}
