import {cloudHeaders} from './psn-cloud-helpers.mjs';

export function alertStorageConfig(env=process.env){
 const host=env.SUPABASE_URL,secret=env.SUPABASE_SECRET_KEY;
 if(!host||!secret)return null;
 try{
  const u=new URL(host);
  if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co'))return null;
  return {base:u.origin+'/rest/v1/',secret};
 }catch{return null}
}
export async function alertDb(config,table,query='',{method='GET',data,prefer}={}){
 if(!config)throw Error('Alert storage is unavailable');
 if(!['radar_price_alert_rules','radar_price_notifications'].includes(table))throw Error('Invalid private table');
 const url=config.base+table+query;
 const headers={...cloudHeaders(config.secret),...(prefer?{Prefer:prefer}:{})};
 const response=await fetch(url,{method,headers,cache:'no-store',...(data!==undefined?{body:JSON.stringify(data)}:{})});
 if(!response.ok)throw Error('Private alert storage HTTP '+response.status);
 const text=await response.text();
 return text?JSON.parse(text):[];
}
export async function alertSnapshot(config){
 const [rules,events]=await Promise.all([
  alertDb(config,'radar_price_alert_rules','?select=title,target_price,enabled,last_checked_at,last_observed_price,last_status,updated_at&order=title.asc&limit=80'),
  alertDb(config,'radar_price_notifications','?select=id,title,observed_price,target_price,observed_at,created_at,read_at&order=created_at.desc&limit=60')
 ]);
 return {rules,events};
}
