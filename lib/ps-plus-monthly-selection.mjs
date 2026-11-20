// Pure PlayStation Plus monthly-edition selection. No guess based on today's month.
export const GERMAN_MONTHS=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

const key = d => Number(d?.year)*10000+Number(d?.month)*100+Number(d?.day);
const valid = d => d && Number.isInteger(Number(d.year)) && Number.isInteger(Number(d.month)) &&
 Number.isInteger(Number(d.day)) && Number(d.month)>=1 && Number(d.month)<=12 &&
 Number(d.day)>=1 && Number(d.day)<=31;

export function readMonthlyEdition(title, sourceUrl){
 if(typeof title!=='string'||!/monatlich(?:e|en)/i.test(title)||
    !/spiele/i.test(title)||!/playstation\s*plus/i.test(title))return null;
 const match=title.match(new RegExp('\\b('+GERMAN_MONTHS.join('|')+')\\b(?:\\s+(20\\d{2}))?','i'));
 if(!match)return null;
 const month=GERMAN_MONTHS.findIndex(n=>n.toLocaleLowerCase('de')===match[1].toLocaleLowerCase('de'))+1;
 let published=null;
 try{
  const u=new URL(sourceUrl);
  if(!/^(?:blog\.de\.playstation\.com|blog\.playstation\.com)$/.test(u.hostname))return null;
  const m=u.pathname.match(/^\/(20\d{2})\/(0?[1-9]|1[0-2])\/([0-3]?\d)\//);
  if(m)published={year:Number(m[1]),month:Number(m[2])};
 }catch{return null}
 if(!published&&!match[2])return null;
 let year=match[2]?Number(match[2]):published.year;
 if(!match[2]){
  if(month<published.month-6)year++;
  else if(month>published.month+6)year--;
 }
 if(year<2020||year>2100)return null;
 return {month,year,label:GERMAN_MONTHS[month-1].toLocaleUpperCase('de')+' '+year};
}

export function monthlyCandidatePriority(edition,availabilityWindow,today){
 if(!edition||!valid(today))return -1;
 const distance=(Number(today.year)-Number(edition.year))*12+Number(today.month)-Number(edition.month);
 if(distance<0||distance>1)return -1; // no future announcements or stale editions
 const hasWindow=Boolean(availabilityWindow?.start&&availabilityWindow?.end);
 const active=hasWindow && valid(availabilityWindow.start)&&valid(availabilityWindow.end) &&
   key(today)>=key(availabilityWindow.start)&&key(today)<=key(availabilityWindow.end);
 if(hasWindow&&!active)return -1; // don't call an announced but unavailable lineup 'live'
 if(distance===1&&!active)return -1;
 return distance===0?(active?30:20):10;
}
