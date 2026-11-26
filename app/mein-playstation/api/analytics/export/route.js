import {GET as analytics} from '../route';
import {generateAnalyticsXlsx} from '../../../../../lib/psn-analytics-xlsx.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 const response=await analytics();
 if(!response.ok)return response;
 const workbook=generateAnalyticsXlsx(await response.json());
 return new Response(new Uint8Array(workbook),{headers:{
 'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'Content-Disposition':'attachment; filename="PS5-Radar-Analytics.xlsx"',
 'Cache-Control':'private, no-store',
 'X-Content-Type-Options':'nosniff'
 }});
}
