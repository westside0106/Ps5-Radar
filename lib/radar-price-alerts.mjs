// Pure validation and matching for the once-daily server-side Radar price inbox.
export function validatedRule(input,knownTitles=[]){
 const title=String(input?.title||'').trim();
 const limit=Number(input?.limit);
 if(!title||title.length>180||!knownTitles.includes(title)||!Number.isFinite(limit)||limit<0||limit>10000)return null;
 return {title,target_price:Math.round(limit*100)/100,enabled:input.enabled!==false};
}
export function activePriceSignal(game,now=new Date()){
 const s=game?.signal;
 if(!s?.activeDeal||!Number.isFinite(s.currentPrice)||s.currentPrice<0)return null;
 const stamp=s.lastObservedDate||s.changedAt;
 if(typeof stamp!=='string')return null;
 const date=new Date(stamp.length===10?stamp+'T23:59:59Z':stamp);
 if(!Number.isFinite(date.getTime())||date.getTime()>now.getTime()+86400000||now.getTime()-date.getTime()>72*3600000)return null;
 return {price:Math.round(s.currentPrice*100)/100,observedAt:date.toISOString()};
}
export function checkPriceRule(row,game,now=new Date()){
 const signal=activePriceSignal(game,now);
 if(row.enabled===false)return {status:'unverified',notify:false,price:null,matchKey:null};
 if(!signal)return {status:'no_active_deal',notify:false,price:null,matchKey:null};
 const target=Number(row.target_price);
 if(!Number.isFinite(target)||signal.price>target)return {status:'above_target',notify:false,price:signal.price,matchKey:null};
 const key=JSON.stringify([row.title,signal.price]);
 return {status:'matched',notify:row.last_match_key!==key,price:signal.price,matchKey:key,observedAt:signal.observedAt};
}
