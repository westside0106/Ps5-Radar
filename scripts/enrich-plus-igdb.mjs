import fs from 'node:fs/promises';
import { titleKey } from '../lib/ps-plus-catalog.mjs';

// Optional IGDB enrichment: only exact normalized titles and a verified PS4/PS5
// platform match are accepted. Missing credentials leave existing data intact.
const path = new URL('../data/ps-plus-catalog.json', import.meta.url);
const clientId = process.env.IGDB_CLIENT_ID;
const secret = process.env.IGDB_CLIENT_SECRET;
if (!clientId || !secret) {
  console.log('IGDB: no credentials; skipping metadata enrichment.');
  process.exit(0);
}
const catalog = JSON.parse(await fs.readFile(path,'utf8'));
const auth = await fetch('https://id.twitch.tv/oauth2/token', {
  method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({client_id:clientId,client_secret:secret,grant_type:'client_credentials'})
});
if (!auth.ok) throw new Error('IGDB OAuth authentication failed: '+auth.status);
const {access_token:token} = await auth.json();
const modes = {'Single player':'Solo','Multiplayer':'Mehrspieler','Co-operative':'Koop','Split screen':'Splitscreen','Massively Multiplayer Online (MMO)':'MMO'};
const perspectives = {'First person':'First-Person','Third person':'Third-Person','Bird view / Isometric':'Isometrisch','Side view':'Seitenansicht','Text':'Text','Auditory':'Audio','Virtual Reality':'VR'};
let enriched=0, unmatched=0, failures=0;
for (const game of catalog.games) {
  if (game.releaseDate && game.description && game.modes?.length && game.perspective) continue;
  const name=game.title.replace(/["\\]/g,' ').replace(/\s+/g,' ').trim();
  const query='search "'+name.slice(0,110)+'"; fields name,first_release_date,summary,platforms.name,game_modes.name,player_perspectives.name; limit 15;';
  try {
    const res=await fetch('https://api.igdb.com/v4/games',{
      method:'POST',headers:{'Client-ID':clientId,'Authorization':'Bearer '+token,'Content-Type':'text/plain'},
      body:query
    });
    if (!res.ok) { failures++; continue; }
    const matches=(await res.json()).filter(item => titleKey(item.name)===titleKey(game.title)
      && (item.platforms||[]).some(p=>/^(PlayStation 4|PlayStation 5)$/.test(p.name||'')));
    if (matches.length!==1) {unmatched++;continue;}
    const match=matches[0];
    if (!game.releaseDate && Number.isInteger(match.first_release_date)) {
      const date=new Date(match.first_release_date*1000).toISOString().slice(0,10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) game.releaseDate=date;
    }
    if (!game.description && match.summary) game.description=match.summary.slice(0,520);
    if (!game.modes?.length) game.modes=(match.game_modes||[]).map(m=>modes[m.name]).filter(Boolean);
    if (!game.perspective) game.perspective=(match.player_perspectives||[]).map(p=>perspectives[p.name]).find(Boolean)||null;
    game.metadataSource='IGDB';
    enriched++;
  } catch { failures++; }
  await new Promise(resolve=>setTimeout(resolve,300)); // IGDB limit: 4 req/sec
}
await fs.writeFile(path,JSON.stringify(catalog,null,2)+'\n');
console.log('IGDB:',{enriched,unmatched,failures,total:catalog.games.length});
