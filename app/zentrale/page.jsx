import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {COOKIE_NAME,safeEqual,sessionToken} from '../auth';
import radar from '../../data/radar.json';
import catalog from '../../data/ps-plus-catalog.json';
import xbox from '../../data/platforms/xbox/radar.json';
import prices from '../../data/price-history.json';
import archive from '../../data/archive/index.json';
import {buildIndex,buildEvents,sourceSummary} from '../../lib/radar-zentrale.mjs';
import ZentraleClient from './ZentraleClient';
import './zentrale.css';

export const dynamic='force-dynamic';
export const metadata={title:'Radar-Zentrale · PlayStation Radar',robots:{index:false,follow:false,nocache:true}};

export default async function RadarZentralePage(){
 const jar=await cookies(),token=sessionToken(),value=jar.get(COOKIE_NAME)?.value;
 if(!token||!safeEqual(value,token))redirect('/');
 return <ZentraleClient index={buildIndex({catalog,xbox,prices,archive,radar})} events={buildEvents({catalog,radar})}
  sources={sourceSummary({catalog,xbox,prices,radar})}
  priceGames={Object.fromEntries(Object.entries(prices.games||{}).map(([title,g])=>[title,{signal:g.signal||null,storeUrl:g.storeUrl||null,image:g.image||null,low:g.signal?.radarLow??null,points:(g.points||[]).slice(-80)}]))}
  archiveCount={archive.length} bulletin={{edition:radar.edition,headline:radar.leadTitle,image:radar.leadImage,date:radar.date}}
  catalogChanges={(catalog.changes||[]).slice(-70)} />;
}
