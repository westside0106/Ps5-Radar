import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {COOKIE_NAME,safeEqual,sessionToken} from '../auth';
import MuseumClient from './MuseumClient';
import '../experience.css';
export const dynamic='force-dynamic';
export const metadata={title:'Sammlungs-Museum · Radar',robots:{index:false,follow:false}};
export default async function MuseumPage(){
 const jar=await cookies(),token=sessionToken();
 if(!token||!safeEqual(jar.get(COOKIE_NAME)?.value,token))redirect('/');
 return <MuseumClient/>;
}