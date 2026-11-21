// PSN Monitor CSV — local-only, source-aware parsing of status transitions.
// Upstream misiektoja/psn_monitor writes Date,Status,Game name; Date is a naive
// timestamp in the tool's LOCAL_TIMEZONE (not necessarily the browser time zone).
export const PSN_MONITOR_KEY='psn-observed-game-sessions-v1';
export const PSN_MONITOR_EVENT='psn-observed-game-sessions-change';
export const MAX_MONITOR_CSV_BYTES=2_000_000;
export const MAX_MONITOR_SESSIONS=2000;
export const MAX_SESSION_MS=12*60*60*1000;
const MAX_ROWS=20000;
const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const datePattern=/^(20\d{2})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;
const statusSet=new Set(['online','offline','away','busy']);
const reasons=new Set(['offline','game-stopped','game-switch','status-change']);

export function validMonitorZone(zone){
 if(typeof zone!=='string'||zone.length>60||!(/^[A-Za-z_]+(?:\/[A-Za-z_+-]+)*$/.test(zone)))return false;
 try{new Intl.DateTimeFormat('en-US',{timeZone:zone}).format(0);return true}catch{return false}
}
const asParts=(date,formatter)=>{
 const obj=Object.fromEntries(formatter.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
 return {year:obj.year,month:obj.month,day:obj.day,hour:obj.hour,minute:obj.minute,second:obj.second};
};
const wallMs=p=>Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);
function wallFormatter(zone){
 return new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
}
// The local-time fall-back hour has TWO possible instants: reject rather than
// silently picking the first. Spring gap has NONE: reject that as well.
export function resolveMonitorWallTime(value,zone){
 if(!validMonitorZone(zone))return {status:'invalid-zone',at:null};
 const match=typeof value==='string'?value.trim().match(datePattern):null;
 if(!match)return {status:'invalid-date',at:null};
 const [year,month,day,hour,minute,second]=match.slice(1).map(Number);
 if(year<2020||year>2100||month<1||month>12||day<1||day>31||hour>23||minute>59||second>59)return {status:'invalid-date',at:null};
 const want={year,month,day,hour,minute,second},epoch=wallMs(want),check=new Date(epoch);
 if(check.getUTCFullYear()!==year||check.getUTCMonth()+1!==month||check.getUTCDate()!==day)return {status:'invalid-date',at:null};
 const fmt=wallFormatter(zone);
 const offsets=new Set();
 for(const sample of [epoch-86400000,epoch-21600000,epoch,epoch+21600000,epoch+86400000]){
  const observed=asParts(sample,fmt);
  offsets.add(wallMs(observed)-sample);
 }
 const matches=[];
 for(const offset of offsets){
  const candidate=epoch-offset,actual=asParts(candidate,fmt);
  if(Object.keys(want).every(k=>want[k]===actual[k]))matches.push(candidate);
 }
 const instants=[...new Set(matches)].sort((a,b)=>a-b);
 if(instants.length===0)return {status:'nonexistent-time',at:null};
 if(instants.length>1)return {status:'ambiguous-time',at:null};
 return {status:'ok',at:new Date(instants[0]).toISOString()};
}
// Bounded RFC4180-style comma CSV with Python csv.DictWriter escaped quotes and
// embedded commas/newlines. No delimiter guessing or arbitrary CSV execution.
export function parseMonitorCsvRows(text){
 if(typeof text!=='string'||!text.length||text.length>MAX_MONITOR_CSV_BYTES)throw Error('CSV fehlt oder überschreitet 2 MB.');
 const input=text.charCodeAt(0)===0xfeff?text.slice(1):text;
 const rows=[];let row=[],field='',quoted=false,afterQuote=false,atFieldStart=true;
 const emitField=()=>{row.push(field);field='';afterQuote=false;atFieldStart=true;};
 const emitRow=()=>{
  emitField();
  if(row.some(x=>x.trim()!==''))rows.push(row);
  row=[];
  if(rows.length>MAX_ROWS+1)throw Error('CSV enthält mehr als 20.000 Datensätze.');
 };
 for(let i=0;i<input.length;i++){
  const ch=input[i];
  if(quoted){
   if(ch==='"'&&input[i+1]==='"'){field+='"';i++;}
   else if(ch==='"'){quoted=false;afterQuote=true;}
   else field+=ch;
  }else if(ch==='"'&&atFieldStart){quoted=true;atFieldStart=false;}
  else if(ch===',' ){emitField();}
  else if(ch==='\n'||ch==='\r'){
   if(ch==='\r'&&input[i+1]==='\n')i++;
   emitRow();
  }else if(afterQuote){
   if(ch!==' '&&ch!=='\t')throw Error('Ungültiges CSV-Quoting.');
  }else{
   if(ch==='"')throw Error('Ungültiges Anführungszeichen im CSV.');
   field+=ch;atFieldStart=false;
  }
 }
 if(quoted)throw Error('CSV mit nicht geschlossenem Textfeld.');
 if(field||row.length)emitRow();
 const header=rows.shift()?.map(v=>v.trim());
 if(!header||header.length!==3||header.some((v,i)=>v!==['Date','Status','Game name'][i]))throw Error('Erwartete CSV-Spalten: Date, Status, Game name.');
 return rows;
}
const cleanName=v=>String(v||'').replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,140);
const sessionKey=v=>v.start+'|'+v.end+'|'+v.game.toLocaleLowerCase('de');
const goodISOString=v=>typeof v==='string'&&ISO.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
export function normalizeObservedSessions(raw){
 if(!Array.isArray(raw))return [];
 const unique=new Map();
 for(const item of raw.slice(-MAX_MONITOR_SESSIONS*3)){
  if(!item||typeof item!=='object'||!goodISOString(item.start)||!goodISOString(item.end)||!validMonitorZone(item.timeZone))continue;
  const ms=Date.parse(item.end)-Date.parse(item.start),game=cleanName(item.game);
  if(ms<=0||ms>MAX_SESSION_MS||!game)continue;
  const session={id:'observed:'+sessionKey({start:item.start,end:item.end,game}),game,start:item.start,end:item.end,minutes:Math.round(ms/60000*10)/10,timeZone:item.timeZone,
   stopReason:reasons.has(item.stopReason)?item.stopReason:'status-change',source:'psn_monitor CSV',quality:'poll-observed'};
  unique.set(session.id,session);
 }
 return [...unique.values()].sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id)).slice(-MAX_MONITOR_SESSIONS);
}
export function mergeObservedSessions(existing,incoming){
 return normalizeObservedSessions([...normalizeObservedSessions(existing),...normalizeObservedSessions(incoming)]);
}
export function parsePsnMonitorCsv(text,{timeZone,now=new Date()}={}){
 if(!validMonitorZone(timeZone))throw Error('Zeitzone des Rechners auswählen, auf dem psn_monitor lief.');
 const rows=parseMonitorCsvRows(text);
 const warnings={malformed:0,ambiguous:0,nonexistent:0,outOfOrder:0,unknownStatus:0,duplicates:0,longGaps:0,incomplete:0,future:0};
 let active=null,lastTime=null,previousSignature=null;
 const intervals=[];
 const maxAt=(now instanceof Date?now:new Date(now)).getTime()+300000;
 const close=(end,reason)=>{
  if(!active)return;
  const ms=Date.parse(end)-Date.parse(active.start);
  if(ms>0&&ms<=MAX_SESSION_MS)intervals.push({game:active.game,start:active.start,end,timeZone,stopReason:reason});
  else if(ms>MAX_SESSION_MS)warnings.longGaps++;
  active=null;
 };
 for(const row of rows){
  if(row.length!==3){warnings.malformed++;active=null;continue}
  const [stamp,statusRaw,gameRaw]=row;
  const resolved=resolveMonitorWallTime(stamp,timeZone);
  if(resolved.status!=='ok'){
   if(resolved.status==='ambiguous-time')warnings.ambiguous++;
   else if(resolved.status==='nonexistent-time')warnings.nonexistent++;
   else warnings.malformed++;
   active=null;lastTime=null;previousSignature=null;continue;
  }
  const at=resolved.at,time=Date.parse(at);
  if(time>maxAt){warnings.future++;active=null;lastTime=null;previousSignature=null;continue}
  if(lastTime!==null&&time<lastTime){warnings.outOfOrder++;active=null;lastTime=time;previousSignature=null;continue}
  lastTime=time;
  const status=String(statusRaw).trim().toLowerCase(),game=cleanName(gameRaw);
  if(!statusSet.has(status)){warnings.unknownStatus++;active=null;continue}
  const signature=at+'|'+status+'|'+game;
  if(signature===previousSignature){warnings.duplicates++;continue}
  previousSignature=signature;
  const playing=status==='online'&&Boolean(game);
  if(playing){
   if(active&&active.game.toLocaleLowerCase('de')===game.toLocaleLowerCase('de'))continue;
   if(active)close(at,'game-switch');
   active={start:at,game};
  }else if(active)close(at,status==='offline'?'offline':status==='online'?'game-stopped':'status-change');
 }
 if(active)warnings.incomplete++;
 const sessions=normalizeObservedSessions(intervals);
 return {sessions,rows:rows.length,recognized:rows.length-Object.values(warnings).reduce((n,v)=>n+v,0)+warnings.longGaps+warnings.incomplete,warningCounts:warnings,
  totalMinutes:sessions.reduce((n,s)=>n+s.minutes,0),timeZone};
}
