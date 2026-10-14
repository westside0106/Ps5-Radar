import fs from 'node:fs/promises';
import { titleKey } from '../lib/ps-plus-catalog.mjs';

const path = new URL('../data/ps-plus-catalog.json', import.meta.url);
const clientId = process.env.IGDB_CLIENT_ID;
const secret = process.env.IGDB_CLIENT_SECRET;
if (!clientId || !secret) {
  console.log('IGDB: no credentials; skipping metadata enrichment.');
  process.exit(0);
}
const catalog = JSON.parse(await fs.readFile(path, 'utf8'));
const auth = await fetch('https://id.twitch.tv/oauth2/token', {
  method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'},
  body: new URLSearchParams({client_id:clientId,client_secret:secret,grant_type:'client_credentials'})
});
if (!auth.ok) throw new Error('IGDB OAuth authentication failed: '+auth.status);
const {access_token:token} = await auth.json();
const modes = {'Single player':'Solo','Multiplayer':'Mehrspieler','Co-operative':'Koop','Split screen':'Splitscreen','Massively Multiplayer Online (MMO)':'MMO'};
const perspectives = {'First person':'First-Person','Third person':'Third-Person','Bird view / Isometric':'Isometrisch','Side view':'Seitenansicht','Text':'Text','Auditory':'Audio','Virtual Reality':'VR'};
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
const unique = values => [...new Set(values.filter(Boolean))];
// Verified exceptions for IGDB's punctuation or regional spelling differences.
// Never map remasters, collections or DLCs to an unrelated base game.
const aliases = new Map([
  ['FARCRY 6', 'Far Cry 6'],
  ['FARCRY 3 Classic Edition', 'Far Cry 3: Classic Edition'],
  ['EARTH DEFENSE FORCE:WORLD BROTHERS', 'Earth Defense Force: World Brothers'],
  ['For The King', 'For the King'],
  ['Death end reQuest', 'Death end re;Quest'],
  ['Grand Theft Auto V (PS4 & PS5)', 'Grand Theft Auto V'],
  ['Dying Light 2 Stay Human PS4&PS5 LV', 'Dying Light 2 Stay Human'],
]);

function candidateNames(title) {
  let cleaned = title.normalize('NFKC').replace(/[®™©]/g,'').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
  const candidates=[cleaned];
  // Strip only store packaging, platform labels and generic edition suffixes.
  // Never strip story subtitles or numbered sequels.
  cleaned=cleaned
    .replace(/\s*\((?:PS4|PS5|PS4\s*(?:&|\+|and)\s*PS5|PlayStation\s*4|PlayStation\s*5|PlayStation Plus)\)\s*/gi,' ')
    .replace(/\s*\[(?:PS4|PS5|PS4\s*&\s*PS5)\]\s*/gi,' ')
    .replace(/\s*(?:\||\+|&|and|\/)\s*PS4\s*(?:\+|&|and|\/)\s*PS5\b/gi,' ')
    .replace(/\s*\bPS4\s*(?:\+|&|and|\/)\s*PS5\b/gi,' ')
    .replace(/\s*\bPS5\s*(?:\+|&|and|\/)\s*PS4\b/gi,' ')
    .replace(/\s*\bPS[45]\s*(?:Version|Edition|Free Upgrade)?\b/gi,' ')
    .replace(/\s*\b(?:Standard|Digital Deluxe|Deluxe|Definitive|Complete|Ultimate|Collector's|Collectors|Classic) Edition\b/gi,' ')
    .replace(/\s*\b(?:Director's Cut|DIRECTOR’S CUT)\b/gi,' ')
    .replace(/\s*\b(?:PlayStation Plus|Free Upgrade)\b/gi,' ')
    .replace(/\s+/g,' ').replace(/[\s:|+&-]+$/g,'').trim();
  candidates.push(cleaned);
  const alias=aliases.get(title.normalize('NFKC').replace(/[®™©]/g,'').trim());
  if (alias) candidates.push(alias);
  // Some storefront titles have an extra regional/version marker after PS4/PS5.
  candidates.push(cleaned.replace(/\\s+LV$/i,'').trim());
  // Only generic platform marketing: remove a trailing platform parenthetical
  // and a PS4/PS5 marketing suffix without touching gameplay subtitles.
  candidates.push(cleaned.replace(/\\s*\\((?:PS4|PS5)(?:\\s*[&+]\\s*(?:PS4|PS5))?\\)\\s*$/i,'').trim());
  // Do not automatically equate named collections, remasters or expansions
  // with their base game: those may have different release dates/content.
  return unique(candidates.filter(n=>n.length>=3 && !/^(PS4|PS5)$/i.test(n)));
}
function equivalent(a,b) {
  const normalize = s => titleKey(s).replace(/\b(?:the|a)\b/g,' ').replace(/\s+/g,' ').trim();
  return normalize(a) === normalize(b);
}
async function search(name) {
  const escaped=name.replace(/["\\]/g,' ').slice(0,110);
  const query='search "'+escaped+'"; fields id,name,first_release_date,summary,platforms.name,game_modes.name,player_perspectives.name; limit 35;';
  const response=await fetch('https://api.igdb.com/v4/games',{
    method:'POST',headers:{'Client-ID':clientId,'Authorization':'Bearer '+token,'Content-Type':'text/plain'},body:query
  });
  if (!response.ok) throw new Error('IGDB request failed: '+response.status);
  return response.json();
}
let enriched=0,unmatched=0,failures=0,alreadyComplete=0;
const unresolved=[];
for (const game of catalog.games) {
  if (game.releaseDate && game.description && game.modes?.length && game.perspective) {alreadyComplete++;continue;}
  const candidates=candidateNames(game.title);
  let match=null,ambiguous=false;
  try {
    for (const candidate of candidates) {
      const results=await search(candidate);
      const exact=results.filter(item => equivalent(item.name,candidate)
        && (item.platforms||[]).some(p=>/^(PlayStation 4|PlayStation 5)$/.test(p.name||'')));
      // Multiple distinct IGDB entries (e.g. remasters/versions) are ambiguous.
      if (exact.length===1) {match=exact[0];break;}
      if (exact.length>1) ambiguous=true;
      await wait(300);
    }
    if (!match) {unmatched++;unresolved.push({title:game.title,reason:ambiguous?'ambiguous':'not_found'});continue;}
    if (!game.releaseDate && Number.isInteger(match.first_release_date)) {
      const date=new Date(match.first_release_date*1000).toISOString().slice(0,10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) game.releaseDate=date;
    }
    if (!game.description && match.summary) game.description=match.summary.slice(0,520);
    if (!game.modes?.length) game.modes=(match.game_modes||[]).map(m=>modes[m.name]).filter(Boolean);
    if (!game.perspective) game.perspective=(match.player_perspectives||[]).map(p=>perspectives[p.name]).find(Boolean)||null;
    if (game.releaseDate || game.description || game.modes?.length || game.perspective) {
      game.metadataSource='IGDB';
      enriched++;
    } else {unmatched++;unresolved.push({title:game.title,reason:'no_metadata'});}
  } catch(error) {
    failures++;unresolved.push({title:game.title,reason:'api_error',detail:String(error.message||error)});
  }
  await wait(300);
}
await fs.writeFile(path,JSON.stringify(catalog,null,2)+'\n');
console.log('IGDB:',{enriched,alreadyComplete,unmatched,failures,total:catalog.games.length});
console.log('IGDB unresolved examples:',JSON.stringify(unresolved.slice(0,45)));
if (failures) console.log('::warning::IGDB metadata requests failed for '+failures+' games.');
