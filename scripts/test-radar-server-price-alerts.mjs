import test from 'node:test';
import assert from 'node:assert/strict';
import {validatedRule,activePriceSignal,checkPriceRule} from '../lib/radar-price-alerts.mjs';
import {scanPriceAlerts} from '../lib/radar-price-alert-scan.mjs';
import {alertStorageConfig} from '../lib/radar-alerts-db.mjs';

const NOW=new Date('2026-10-26T16:00:00Z');
const game=(price,when='2026-10-26')=>({signal:{activeDeal:true,currentPrice:price,lastObservedDate:when}});
test('price thresholds only accept exact tracked games and finite explicit amounts',()=>{
 assert.deepEqual(validatedRule({title:'Game',limit:'29,99'},['Game']),null);
 assert.deepEqual(validatedRule({title:'Game',limit:29.991},['Game']),{title:'Game',target_price:29.99,enabled:true});
 for(const limit of ['',null,undefined,'NaN',-1,10001])assert.equal(validatedRule({title:'Game',limit},['Game']),null);
 assert.equal(validatedRule({title:'Missing',limit:20},['Game']),null);
});
test('only verified fresh active deals can trigger server inbox entries',()=>{
 assert.equal(activePriceSignal(game(19.99,'2026-10-22'),NOW),null,'stale deals rejected');
 assert.equal(activePriceSignal({signal:{activeDeal:false,currentPrice:10,lastObservedDate:'2026-10-26'}},NOW),null);
 assert.equal(activePriceSignal({signal:{activeDeal:true,currentPrice:null,lastObservedDate:'2026-10-26'}},NOW),null);
 const rule={title:'Game',target_price:30,enabled:true,last_match_key:null};
 assert.equal(checkPriceRule(rule,game(29.99),NOW).notify,true);
 assert.equal(checkPriceRule(rule,game(35),NOW).status,'above_target');
 assert.equal(checkPriceRule({...rule,last_match_key:JSON.stringify(['Game',29.99])},game(29.99),NOW).notify,false);
 assert.equal(checkPriceRule({...rule,enabled:false},game(29.99),NOW).notify,false);
});
test('background scan persists exactly one event and does not duplicate on a repeat scan',async()=>{
 const rows=[{title:'Game',target_price:30,enabled:true,last_match_key:null}];
 const events=new Map();
 const db=async(_config,table,query,opts={})=>{
  if(table==='radar_price_alert_rules'&&opts.method===undefined)return rows;
  if(table==='radar_price_notifications'&&opts.method==='POST'){
   const entry=opts.data;
   if(events.has(entry.id))return [];
   events.set(entry.id,entry);
   return [entry];
  }
  if(table==='radar_price_alert_rules'&&opts.method==='PATCH'){
   Object.assign(rows[0],opts.data);
   return [];
  }
  throw Error('Unexpected mock '+table+' '+query);
 };
 const config={base:'https://example.supabase.co/rest/v1/',secret:'test'};
 const source={updatedAt:NOW.toISOString(),games:{Game:game(29.99)}};
 const first=await scanPriceAlerts({config,db,source,now:NOW});
 assert.deepEqual({checked:first.checked,matched:first.matched,created:first.created},{checked:1,matched:1,created:1});
 const second=await scanPriceAlerts({config,db,source,now:NOW});
 assert.equal(second.created,0);
 assert.equal(events.size,1);
});
test('storage requires private HTTPS Supabase origin',()=>{
 assert.equal(alertStorageConfig({SUPABASE_URL:'http://evil.test',SUPABASE_SECRET_KEY:'x'}),null);
 assert.equal(alertStorageConfig({SUPABASE_URL:'https://supabase.co.evil.test',SUPABASE_SECRET_KEY:'x'}),null);
 assert.ok(alertStorageConfig({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'secret'}));
});
