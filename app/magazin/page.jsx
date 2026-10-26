import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {COOKIE_NAME,safeEqual,sessionToken} from '../auth';
import radar from '../../data/radar.json';
import MagazineClient from './MagazineClient';
import '../experience.css';
export const dynamic='force-dynamic';
export const metadata={title:'Mein Gaming-Magazin · Radar',robots:{index:false,follow:false}};
export default async function MagazinePage(){
 const jar=await cookies(),token=sessionToken();
 if(!token||!safeEqual(jar.get(COOKIE_NAME)?.value,token))redirect('/');
 return <MagazineClient bulletin={{title:radar.leadTitle,image:radar.leadImage,edition:radar.edition,date:radar.date}}/>;
}