import {timingSafeEqual} from 'node:crypto';
import {alertStorageConfig} from '../../../../../lib/radar-alerts-db.mjs';
import {scanPriceAlerts} from '../../../../../lib/radar-price-alert-scan.mjs';
import priceHistory from '../../../../../data/price-history.json';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
const secure={'Cache-Control':'no-store'};
export async function GET(request){
 const configured=process.env.CRON_SECRET;
 const received=request.headers.get('authorization')||'';
 const expected='Bearer '+configured;
 if(!configured||configured.length<20||received.length!==expected.length||!timingSafeEqual(Buffer.from(received),Buffer.from(expected)))
  return Response.json({error:'Unauthorized'},{status:401,headers:secure});
 const config=alertStorageConfig();
 if(!config)return Response.json({error:'Alert storage unavailable'},{status:503,headers:secure});
 try{return Response.json({ok:true,...await scanPriceAlerts({config,source:priceHistory})},{headers:secure})}
 catch{return Response.json({error:'Alert scan failed'},{status:503,headers:secure})}
}
