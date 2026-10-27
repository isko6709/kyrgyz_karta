import sharp from 'sharp';

const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F6F1E7"/>
      <stop offset="100%" stop-color="#EFE8D8"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#B08D57"/>
      <stop offset="25%" stop-color="#4F8A8B"/>
      <stop offset="50%" stop-color="#7A9E7E"/>
      <stop offset="75%" stop-color="#C0825A"/>
      <stop offset="100%" stop-color="#D9A441"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  
  <rect x="30" y="30" width="1140" height="570" rx="24" fill="none" stroke="#2B2A28" stroke-width="2" stroke-opacity="0.15"/>
  <rect x="42" y="42" width="1116" height="546" rx="16" fill="none" stroke="#2B2A28" stroke-width="1" stroke-opacity="0.08"/>

  <rect x="100" y="110" width="1000" height="10" rx="5" fill="url(#accent)"/>

  <text x="100" y="220" font-family="serif, Georgia" font-size="56" font-weight="bold" fill="#2B2A28">Кыргызстан сквозь века</text>
  <text x="100" y="275" font-family="sans-serif, Arial" font-size="24" font-weight="normal" fill="#5E5951">Интерактивная карта истории Кыргызстана от енисейских кыргызов до наших дней</text>

  <g transform="translate(100, 340)">
    <rect width="280" height="56" rx="28" fill="#FFFFFF" stroke="#2B2A28" stroke-width="1" stroke-opacity="0.1"/>
    <circle cx="32" cy="28" r="8" fill="#4F8A8B"/>
    <text x="54" y="35" font-family="sans-serif, Arial" font-size="18" font-weight="600" fill="#2B2A28">90+ событий истории</text>
  </g>

  <g transform="translate(410, 340)">
    <rect width="280" height="56" rx="28" fill="#FFFFFF" stroke="#2B2A28" stroke-width="1" stroke-opacity="0.1"/>
    <circle cx="32" cy="28" r="8" fill="#B08D57"/>
    <text x="54" y="35" font-family="sans-serif, Arial" font-size="18" font-weight="600" fill="#2B2A28">66 правителей и ханов</text>
  </g>

  <g transform="translate(720, 340)">
    <rect width="280" height="56" rx="28" fill="#FFFFFF" stroke="#2B2A28" stroke-width="1" stroke-opacity="0.1"/>
    <circle cx="32" cy="28" r="8" fill="#D9A441"/>
    <text x="54" y="35" font-family="sans-serif, Arial" font-size="18" font-weight="600" fill="#2B2A28">15 исторических слоёв</text>
  </g>

  <text x="100" y="500" font-family="sans-serif, Arial" font-size="18" fill="#8C8275">2000 г. до н.э. — 2026 г. • Интерактивный таймлайн и светлая картография</text>
</svg>
`;

async function run() {
  await sharp(Buffer.from(svg)).png().toFile('public/og.png');
  console.log('Created public/og.png successfully');
}

run().catch(console.error);
