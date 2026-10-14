'use client';
import {useRouter} from 'next/navigation';
import {useTransition} from 'react';
export default function TrophyFilter({enabled=false}){
 const router=useRouter();
 const [pending,start]=useTransition();
 return <label className="psn-toggle">
   <span className="psn-toggle-copy"><strong>Über 50 % Fortschritt</strong><small>{enabled?'Nur fortgeschrittene Spiele':'Alle Spiele anzeigen'}</small></span>
   <input type="checkbox" role="switch" aria-label="Nur Spiele mit über 50 Prozent Trophäenfortschritt" checked={enabled} disabled={pending} onChange={e=>{const checked=e.target.checked;start(()=>router.push(checked?'/mein-playstation?filter=over50':'/mein-playstation',{scroll:false}));}}/>
   <span className="psn-toggle-track" aria-hidden="true"><span/></span>
 </label>;
}
