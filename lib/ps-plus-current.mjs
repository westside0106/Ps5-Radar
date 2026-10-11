// Resolve what the magazine may safely call its current Essential selection.
// A stale monthly editorial must never overrule a newer verified catalog.
// The catalog records membership, NOT monthly claim-window dates.
const MONTHS = ['JANUAR','FEBRUAR','MÄRZ','APRIL','MAI','JUNI','JULI','AUGUST','SEPTEMBER','OKTOBER','NOVEMBER','DEZEMBER'];

export function berlinDay(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

export function monthlyClaimEnd(radar) {
  const text = String(radar?.psplusText || '');
  const label = String(radar?.psplusLabel || '').toLocaleUpperCase('de');
  const until = text.match(/\bbis\s+(\d{1,2})\.(\d{1,2})\./i);
  const year = Number(label.match(/\b20\d{2}\b/)?.[0]);
  const monthIndex = MONTHS.findIndex(month => label.includes(month));
  if (!until || !Number.isInteger(year) || year < 2020 || monthIndex === -1) return null;
  const day = Number(until[1]), month = Number(until[2]);
  const endYear = month < monthIndex + 1 ? year + 1 : year;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${endYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

export function currentEssential(radar, catalog, now = new Date()) {
  const today = berlinDay(now);
  const end = monthlyClaimEnd(radar);
  const label = String(radar?.psplusLabel || '').toLocaleUpperCase('de');
  const sourceMonth = MONTHS.findIndex(month => label.includes(month));
  const sourceYear = Number(label.match(/\b20\d{2}\b/)?.[0]);
  const [year, month] = today.split('-').map(Number);
  const staleByMonth = !end && Number.isInteger(sourceYear) && sourceYear > 2020 && sourceMonth !== -1
    && sourceYear * 12 + sourceMonth < year * 12 + (month - 1);
  const expired = (end && end < today) || staleByMonth;
  const sourceUrl = catalog?.sourceUrl || 'https://www.playstation.com/de-de/ps-plus/games/';
  if (!expired) return {
    kind: 'monthly', label: radar?.psplusLabel || 'AKTUELL',
    title: radar?.psplusTitle || 'PlayStation Plus Essential',
    text: radar?.psplusText || 'Beanspruchungszeitraum bitte offiziell prüfen',
    games: radar?.plusGames || [],
    sourceUrl: radar?.resolvedSources?.psPlusMonthly || sourceUrl,
  };

  const checkedAt = new Date(catalog?.checkedAt || 0).getTime();
  const ageMs = now.getTime() - checkedAt;
  const recent = Number.isFinite(checkedAt) && checkedAt > 0 && ageMs >= 0 && ageMs < 72 * 60 * 60 * 1000;
  const games = recent && catalog?.sections?.essential?.complete === true
    ? (catalog.games || []).filter(game => game.services?.includes('essential') && game.storeUrl)
    : [];
  if (games.length) {
    const date = berlinDay(new Date(catalog.checkedAt)).split('-').reverse().join('.');
    return {
      kind: 'catalog', label: 'ESSENTIAL · KATALOG',
      title: 'Im Essential-Katalog erfasste Spiele',
      text: `Quellenstand ${date}. Die monatliche Beanspruchungsfrist ist hier nicht bestätigt.`,
      games, sourceUrl,
    };
  }
  return {
    kind: 'unverified', label: 'ESSENTIAL · PRÜFUNG OFFEN',
    title: 'Aktuelle Essential-Monatsspiele nicht bestätigt',
    text: 'Die vorige Beanspruchungsfrist ist abgelaufen; eine aktuelle, vollständig geprüfte Liste liegt hier nicht vor.',
    games: [], sourceUrl,
  };
}
