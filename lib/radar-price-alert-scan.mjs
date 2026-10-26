import {createHash} from 'node:crypto';
import {alertDb,alertStorageConfig} from './radar-alerts-db.mjs';
import {checkPriceRule} from './radar-price-alerts.mjs';
import history from '../data/price-history.json';

// Checks are invoked once daily by Vercel (Hobby) or explicitly by the authenticated user.
// Only fresh, explicitly active Radar Store deals may create notifications.
// A deterministic event ID and PostgREST ignore-duplicates make retry safe.
export async function scanPriceAlerts({config=alertStorageConfig(),now=new Date(),db=alertDb,source=history}={}){
 if(!config)throw Error('Alert storage is unavailable');
 const rules=await db(config,'radar_price_alert_rules','?select=title,target_price,enabled,last_match_key&order=title.asc&limit=80');
 let matched=0,created=0,checked=0;
 for(const rule of rules){
  const game=source.games?.[rule.title];
  const outcome=checkPriceRule(rule,game,now);
  checked++;
  if(outcome.status==='matched')matched++;
  if(outcome.notify){
   const id='price-'+createHash('sha256').update(JSON.stringify([rule.title,outcome.price,outcome.observedAt])).digest('hex');
   await alertDb(config,'radar_price_notifications','?on_conflict=id',{
    method:'POST',
    data:{id,title:rule.title,observed_price:outcome.price,target_price:rule.target_price,observed_at:outcome.observedAt},
    prefer:'resolution=ignore-duplicates,return=minimal'
   });
   created++;
  }
  await alertDb(config,'radar_price_alert_rules','?title=eq.'+encodeURIComponent(rule.title),{
   method:'PATCH',data:{
    last_match_key:outcome.matchKey,last_status:outcome.status,
    last_observed_price:outcome.price,last_checked_at:now.toISOString()
   },prefer:'return=minimal'
  });
 }
 return {checked,matched,created,scanAt:now.toISOString(),sourceUpdatedAt:source.updatedAt||null};
}
