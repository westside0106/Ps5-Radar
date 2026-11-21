// Local-first Trophy Guide Hub. It never scrapes third-party guides or infers
// PSNProfiles IDs from Sony npCommunicationIds; only user-confirmed links are saved.
export const TROPHY_GUIDES_KEY='psn-trophy-guides-v1';
export const TROPHY_GUIDES_EVENT='psn-trophy-guides-change';
// Sony trophy-list IDs only: reject arbitrary object keys including __proto__.
const VALID_SET=/^NPWR[0-9]{5,8}_[0-9]{2}$/;
const allowedHosts=new Set(['psnprofiles.com','www.psnprofiles.com','powerpyx.com','www.powerpyx.com','truetrophies.com','www.truetrophies.com','playstationtrophies.org','www.playstationtrophies.org','youtube.com','www.youtube.com','youtu.be','knoef.info','www.knoef.info','platget.com','www.platget.com','videogamelizard.com','www.videogamelizard.com','trophy-tom.com','www.trophy-tom.com']);
export function trustedGuideUrl(raw){
 if(typeof raw!=='string'||raw.length>600)return null;
 try{
  const u=new URL(raw.trim());
  if(u.protocol!=='https:'||u.username||u.password||u.port||!allowedHosts.has(u.hostname.toLowerCase()))return null;
  u.hash='';return u.href.length<=600?u.href:null;
 }catch{return null;}
}
export function normalizeGuideRecord(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const url=trustedGuideUrl(input.url||'');
 const note=typeof input.note==='string'?input.note.trim().slice(0,400):'';
 const missable=['unknown','yes','no'].includes(input.missable)?input.missable:'unknown';
 if(!url&&!note&&missable==='unknown')return null;
 const timestamp=typeof input.updatedAt==='string'&&Number.isFinite(Date.parse(input.updatedAt))?new Date(input.updatedAt).toISOString():null;
 return {url:url||'',note,missable,updatedAt:timestamp};
}
export function normalizeTrophyGuides(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return {};
 const result=Object.create(null);
 for(const [id,value] of Object.entries(input).slice(0,500)){
  if(!VALID_SET.test(id))continue;
  const record=normalizeGuideRecord(value);
  if(record)result[id]=record;
 }
 return result;
}
export function mergeTrophyGuides(existing,incoming){
 const left=normalizeTrophyGuides(existing),right=normalizeTrophyGuides(incoming);
 const merged={...left};
 for(const [id,record] of Object.entries(right)){
  const old=merged[id];
  // Unknown/legacy timestamps cannot replace a more recent local entry.
  if(!old||!old.updatedAt||(record.updatedAt&&record.updatedAt>old.updatedAt))merged[id]=record;
 }
 return normalizeTrophyGuides(merged);
}
export function trophyGuideSearches(title){
 const cleaned=String(title||'').normalize('NFKC').trim().slice(0,150);
 if(!cleaned)return [];
 return [
  {name:'PSNProfiles',host:'psnprofiles.com'},
  {name:'PowerPyx',host:'powerpyx.com'},
  {name:'TrueTrophies',host:'truetrophies.com'},
  {name:'PlayStationTrophies',host:'playstationtrophies.org'}
 ].map(item=>({name:item.name,url:'https://www.google.com/search?'+new URLSearchParams({q:'site:'+item.host+' '+cleaned+' trophy guide'}).toString()}));
}
