// Authenticated manual health check: cross-instance cooldown and daily idempotence.
// Live diagnostics are not a replacement for the existing daily background scheduler.
import {sourceHistoryDb,storeScheduledHealth} from './source-health-history.mjs';
import {checkSourceHealth} from './source-health.mjs';
import {deliverPendingNtfy,ntfyConfig} from './ntfy-source-push.mjs';

export const MANUAL_SCAN_COOLDOWN_MS=10*60*1000;

export async function reserveManualSourceScan(storage,{now=new Date(),db=sourceHistoryDb}={}){
 if(!storage||!Number.isFinite(now.getTime()))throw Error('Manual source scan storage/time unavailable');
 const threshold=new Date(now.getTime()-MANUAL_SCAN_COOLDOWN_MS).toISOString();
 const updated=await db(storage,'pushControl',
  '?id=eq.default&last_manual_scan_at=lt.'+encodeURIComponent(threshold),{
  method:'PATCH',prefer:'return=representation',data:{last_manual_scan_at:now.toISOString()}
 });
 if(!Array.isArray(updated))throw Error('Manual scan cooldown unavailable');
 return updated.length===1;
}
export async function runLiveSourceScan(storage,{
 now=Date.now(),check=checkSourceHealth,save=storeScheduledHealth,dispatch=deliverPendingNtfy,
 pushConfig=ntfyConfig
}={}){
 if(!storage)throw Error('Private status storage unavailable');
 const report=await check({useCache:false,now});
 if(!report||!Array.isArray(report.checks)||report.checks.length!==6)throw Error('Unexpected live health report');
 const stored=await save(storage,report);
 let push;
 try{push=await dispatch(storage,pushConfig(),{limit:5})}
 catch{push={configured:Boolean(pushConfig()),attempted:0,accepted:0,failed:1,deliveryError:true}}
 return {
  ok:true,checkedAt:report.checkedAt,checks:report.checks,summary:report.summary,
  cacheSeconds:0,stored,push
 };
}
