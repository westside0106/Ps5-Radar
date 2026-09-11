export const PLATFORMS = Object.freeze({
  ps: { id: 'ps', label: 'PlayStation', defaultRoute: '/radar', store: 'playstation',
    supportedTargets: ['ps4', 'ps5'], sourceLocale: 'de-DE', timeZone: 'Europe/Berlin' },
  xbox: { id: 'xbox', label: 'Xbox', defaultRoute: '/xbox/radar', store: 'microsoft',
    supportedTargets: ['xbox-one', 'xbox-series', 'windows-pc', 'xbox-cloud'], sourceLocale: 'de-DE', timeZone: 'Europe/Berlin' }
});
export const SOURCE_REGISTRY = Object.freeze({
  ps: [
    { id: 'ps-blog-de', url: 'https://blog.de.playstation.com/', kind: 'news' },
    { id: 'ps-store-de', url: 'https://store.playstation.com/de-de/', kind: 'store' },
    { id: 'ps-plus-de', url: 'https://www.playstation.com/de-de/ps-plus/games/', kind: 'catalog' }
  ],
  xbox: [
    { id: 'xbox-wire-de', url: 'https://news.xbox.com/de-de/', kind: 'news' },
    { id: 'xbox-games-de', url: 'https://www.xbox.com/de-DE/games', kind: 'games' },
    { id: 'xbox-gamepass-de', url: 'https://www.xbox.com/de-DE/xbox-game-pass', kind: 'catalog-discovery' },
    { id: 'microsoft-store-de', url: 'https://www.microsoft.com/de-de/store/games', kind: 'store-discovery' }
  ]
});
// Discovery URLs only. No undocumented API or current subscription tier is assumed.
export function platformFromUrl(url, fallback = 'ps') {
  const value = new URL(url, 'https://radar.local').searchParams.get('platform');
  return Object.hasOwn(PLATFORMS, value) ? value : fallback;
}
export function platformRoute(platform, route = 'radar') {
  if (!Object.hasOwn(PLATFORMS, platform)) throw new Error('Unknown platform');
  return platform === 'ps' ? `/${route}` : `/xbox/${route}`;
}
