import test from 'node:test';
import assert from 'node:assert/strict';
import {validatedRule,activePriceSignal,checkPriceRule} from '../lib/radar-price-alerts.mjs';
import {scanPriceAlerts} from '../lib/radar-price-alert-scan.mjs';
import {alertStorageConfig} from '../lib/radar-alerts-db.mjs';

const now=new Date('2026-10-26T17:00:00Z');
const game={signal:{activeDeal:true,currentPrice:28.99,lastObservedDate:'2026-10-26'}};
test('price rules are exact edition-aware titles with bounded EUR amounts',()=>{
 assert.deepEqual(validatedRule({title:'Game PS5',limit:29.99},['Game PS5']),{title:'Game PS5',target_price:29.99,enabled:true});
 assert.equal(validatedRule({title:'Game PS4',limit:20},['Game PS5']),null);
 assert.equal(validatedRule({title:'Game PS5',limit:-1},['Game PS5']),null);
 assert.equal(validatedRule({title:'Game PS5',limit:'abc'},['Game PS5']),null);
});
test('only fresh explicitly active Store prices can trigger notices',()=>{
 assert.ok(activePriceSignal(game,now));
 assert.equal(activePriceSignal({signal:{activeDeal:true,currentPrice:20,lastObservedDate:'2026-09-01'}},now),null);
 assert.equal(activePriceSignal({signal:{activeDeal:false,currentPrice:20,lastObservedDate:'2026-10-26'}},now),null);
 assert.equal(activePriceSignal({signal:{activeDeal:true,currentPrice:null,lastObservedDate:'2026-10-26'}},now),null);
 const r={title:'Game PS5',target_price:30,enabled:true,last_match_key:null};
 const matched=checkPriceRule(r,game,now);
 assert.equal(matched.status,'matched');assert.equal(matched.notify,true);
 assert.equal(checkPriceRule({...r,last_match_key:matched.matchKey},game,now).notify,false);
 assert.equal(checkPriceRule({...r,target_price:25},game,now).status,'above_target');
});
test('cron scan makes no duplicate inbox items and rearms if deal stops',async()=>{
 const rules=[{title:'Game PS5',target_price:30,enabled:true,last_match_key:null}];
 const notifications=new Map();
 const calls=[];
 const db=async(_config,table,query,options={})=>{
  calls.push([table,query,options.method]);
  if(table==='radar_price_alert_rules'&&!options.method)return rules;
  if(table==='radar_price_notifications'){
   const e=options.data;notifications.set(e.id,e);return [];
  }
  if(table==='radar_price_alert_rules'&&options.method==='PATCH'){
   Object.assign(rules[0],options.data);return [];
  }
  throw Error('Unexpected DB operation '+table);
 };
 const source={updatedAt:now.toISOString(),games:{'Game PS5':game}};
 const base={config:{secret:'testing'},now,db,source};
 const first=await scanPriceAlerts(base);
 assert.equal(first.checked,1);assert.equal(first.matched,1);assert.equal(notifications.size,1);
 await scanPriceAlerts(base);assert.equal(notifications.size,1);
 source.games['Game PS5']={signal:{activeDeal:false,currentPrice:null,lastObservedDate:'2026-10-26'}};
 await scanPriceAlerts(base);assert.equal(rules[0].last_status,'no_active_deal');
 assert.equal(rules[0].last_match_key,null);
});
test('alert database configuration rejects unsafe/non-Supabase hosts',()=>{
 assert.equal(alertStorageConfig({SUPABASE_URL:'https://example.com',SUPABASE_SECRET_KEY:'x'}),null);
 assert.equal(alertStorageConfig({SUPABASE_URL:'http://example.supabase.co',SUPABASE_SECRET_KEY:'x'}),null);
 assert.ok(alertStorageConfig({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'x'}));
});
