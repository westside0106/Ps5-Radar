'use client';
import {useEffect} from 'react';
export default function RadarServiceWorker(){
 useEffect(()=>{
  if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
  navigator.serviceWorker.register('/radar-sw.js',{scope:'/'}).catch(()=>{});
 },[]);
 return null;
}
