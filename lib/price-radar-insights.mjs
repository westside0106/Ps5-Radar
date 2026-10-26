// A chart of the Radar's own recorded store observations. Never call this an external all-time low.
export function cleanPricePoints(raw=[]){
 const byDay=new Map();
 for(const p of Array.isArray(raw)?raw:[]){
  if(typeof p?.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!Number.isFinite(Number(p.price))||Number(p.price)<0||Number(p.price)>10000)continue;
  byDay.set(p.date,{date:p.date,price:Number(p.price)});
 }
 return [...byDay.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-365);
}
export function summarizePriceHistory(raw=[]){
 const points=cleanPricePoints(raw);
 if(!points.length)return {points:[],count:0,first:null,last:null,low:null,high:null,change:null};
 const low=Math.min(...points.map(x=>x.price)),high=Math.max(...points.map(x=>x.price));
 const first=points[0],last=points.at(-1);
 return {points,count:points.length,first,last,low,high,change:first.price>0?(last.price-first.price)/first.price*100:null};
}
export function chartPoints(raw=[],width=300,height=95){
 const {points,low,high}=summarizePriceHistory(raw);
 if(points.length<2)return '';
 const span=high-low||1;
 return points.map((p,i)=>[Math.round(i/(points.length-1)*width*100)/100,Math.round((height-(p.price-low)/span*height)*100)/100].join(',')).join(' ');
}
