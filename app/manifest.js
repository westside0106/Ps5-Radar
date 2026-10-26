export default function manifest(){
 return {
  id:'/radar',
  name:'PlayStation Radar · Gaming Intelligence',
  short_name:'Radar',
  description:'Private PlayStation-, Xbox- und Gaming-Zentrale',
  start_url:'/zentrale',
  scope:'/',
  display:'standalone',
  background_color:'#071425',
  theme_color:'#091a30',
  lang:'de',
  icons:[{src:'/radar-icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]
 };
}
