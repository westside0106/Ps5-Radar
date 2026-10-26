// RFC 5545 date-only calendar export for known, source-backed events.
const safe=text=>String(text||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n').slice(0,400);
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(new Date(v+'T12:00:00Z').valueOf());
export function calendarIcs(events=[],generatedAt=new Date('2026-01-01T00:00:00Z')){
 const stamp=(Number.isFinite(generatedAt?.getTime?.())?generatedAt:new Date('2026-01-01T00:00:00Z')).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
 const result=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PlayStation Radar//Verified Gaming Events//DE','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:PlayStation Radar Termine'];
 const seen=new Set();
 for(const e of Array.isArray(events)?events:[]){
  if(!validDate(e.date)||typeof e.title!=='string'||!e.title.trim()||!e.type)continue;
  const id=String(e.type)+':'+e.date+':'+e.title;
  if(seen.has(id))continue;seen.add(id);
  const d=new Date(e.date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);
  const end=d.toISOString().slice(0,10).replaceAll('-','');
  result.push('BEGIN:VEVENT','UID:'+encodeURIComponent(id).slice(0,160)+'@psradar.local','DTSTAMP:'+stamp,
   'DTSTART;VALUE=DATE:'+e.date.replaceAll('-',''),
   'DTEND;VALUE=DATE:'+end,
   'SUMMARY:'+safe(e.title),'DESCRIPTION:'+safe(e.subtitle||'Aus dem Radar-Datensatz; Termin nicht live geprüft.'),
   'END:VEVENT');
 }
 return [...result,'END:VCALENDAR',''].join('\r\n');
}
