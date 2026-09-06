import fs from 'node:fs/promises';

const pagePath = new URL('../app/radar/page.jsx', import.meta.url);
let page = await fs.readFile(pagePath, 'utf8');
const marker = '/* RADAR_RESOLVED_SOURCES_V2 */';

if (page.includes(marker)) {
  console.log('Radar source UI migration already applied.');
  process.exit(0);
}

function replaceOnce(before, after, label) {
  if (!page.includes(before)) throw new Error(`UI migration pattern missing: ${label}`);
  page = page.replace(before, after);
}

replaceOnce(
  "export const dynamic = 'force-dynamic';",
  "export const dynamic = 'force-dynamic';\n\n/* RADAR_RESOLVED_SOURCES_V2 */",
  'marker'
);

replaceOnce(
`function daysUntil(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}`,
`function daysUntil(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}`,
  'null-safe daysUntil'
);

replaceOnce(
  "const expiry = remaining === 0 ? 'ENDET HEUTE' : remaining === 1 ? 'NOCH 1 TAG' : `NOCH ${remaining} TAGE`;",
  "const expiry = remaining === null ? 'AKTUELL' : remaining === 0 ? 'ENDET HEUTE' : remaining === 1 ? 'NOCH 1 TAG' : `NOCH ${remaining} TAGE`;",
  'deal expiry'
);

page = page.replaceAll(
  'alertUrl(title) || sources.monthlyReleases',
  'alertUrl(title) || radar.resolvedSources?.monthlyReleases || sources.monthlyReleases'
);
page = page.replaceAll(
  'url: sources.psPlusMonthly',
  'url: radar.resolvedSources?.psPlusMonthly || sources.psPlusMonthly'
);
page = page.replaceAll(
  'url: sources.monthlyReleases',
  'url: radar.resolvedSources?.monthlyReleases || sources.monthlyReleases'
);
page = page.replaceAll(
  'url: sources.eaPlay',
  'url: radar.resolvedSources?.eaPlay || sources.eaPlay'
);
page = page.replaceAll(
  'url: sources.ubisoftPlus',
  'url: radar.resolvedSources?.ubisoftPlus || sources.ubisoftPlus'
);

replaceOnce(
  "const source = (sources.storeDeals || []).find((item) => item.title === deal.title)?.url;",
  "const source = radar.resolvedSources?.storeDeals?.[deal.title] || (sources.storeDeals || []).find((item) => item.title === deal.title)?.url;",
  'dynamic deal source'
);

replaceOnce(
  "const endingClass = stats.remaining <= 1 ? 'is-ending' : '';",
  "const endingClass = stats.remaining !== null && stats.remaining <= 1 ? 'is-ending' : '';",
  'deal ending class'
);

replaceOnce(
`          <DetailTile detail={{
            kicker: 'ENDET BALD',
            title: radar.leavingTitle,
            summary: radar.leavingText,
            rows: compactRows([
              { label: 'Verbleibend', value: \`${'${remaining}'} ${'${remaining === 1 ? \'Tag\' : \'Tage\'}'}\` },
              { label: 'Ende', value: displayEndFull(radar.storeEnd) },
            ]),
          }} className="radar-panel-clickable">
            <Panel tone="danger" icon="⌛" title="ENDET BALD" className="compact-panel">
              <div className="deadline-row">
                <div><h4>{radar.leavingTitle}</h4><p>{radar.leavingText}</p></div>
                <div className="mag-deadline">{remaining} {remaining === 1 ? 'TAG' : 'TAGE'}</div>
              </div>
            </Panel>
          </DetailTile>`,
`          {remaining === null ? (
            <Panel tone="store" icon="✓" title="STORE-CHECK" className="compact-panel">
              <div className="deadline-row">
                <div><h4>Keine aktive verifizierte Store-Aktion</h4><p>Der Radar veröffentlicht keine abgelaufenen Angebotsdaten.</p></div>
                <div className="mag-deadline">—</div>
              </div>
            </Panel>
          ) : (
            <DetailTile detail={{
              kicker: 'ENDET BALD',
              title: radar.leavingTitle,
              summary: radar.leavingText,
              rows: compactRows([
                { label: 'Verbleibend', value: \`${'${remaining}'} ${'${remaining === 1 ? \'Tag\' : \'Tage\'}'}\` },
                { label: 'Ende', value: displayEndFull(radar.storeEnd) },
              ]),
            }} className="radar-panel-clickable">
              <Panel tone="danger" icon="⌛" title="ENDET BALD" className="compact-panel">
                <div className="deadline-row">
                  <div><h4>{radar.leavingTitle}</h4><p>{radar.leavingText}</p></div>
                  <div className="mag-deadline">{remaining} {remaining === 1 ? 'TAG' : 'TAGE'}</div>
                </div>
              </Panel>
            </DetailTile>
          )}`,
  'store deadline panel'
);

replaceOnce(
  "<div className=\"store-stat\"><small>ENDET</small><b>{remaining === 0 ? 'HEUTE' : remaining === 1 ? '1 TAG' : `${remaining} TAGE`}</b></div>",
  "<div className=\"store-stat\"><small>ENDET</small><b>{remaining === null ? '—' : remaining === 0 ? 'HEUTE' : remaining === 1 ? '1 TAG' : `${remaining} TAGE`}</b></div>",
  'store summary end'
);

await fs.writeFile(pagePath, page);
console.log('Applied resolved-source UI migration and null-safe Store state.');
