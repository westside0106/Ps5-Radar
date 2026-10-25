'use client';
import {useMemo} from 'react';
import {platinumProjects} from '../../lib/psn-gaming-insights.mjs';
import {trophySetCandidates} from '../../lib/psn-platinum-plan.mjs';

const number=n=>Number(n).toLocaleString('de-DE');
const status=project=>project.candidates===0?'Keine Zuordnung':
 project.trophy?'PSN-Trophäenliste erkannt':'Version auswählen';
export default function PlatinumMissionControl({played=[],titles=[],notes={},onOpenPlan}){
 const projects=useMemo(()=>platinumProjects(played,titles,notes,trophySetCandidates),[played,titles,notes]);
 const mapped=projects.filter(p=>p.trophy).length;
 const earned=projects.filter(p=>p.platinumEarned).length;
 return <section className="psn-mission-control" aria-label="Platin-Cockpit">
  <div className="psn-mission-heading">
   <div><span className="psn-eyebrow">TROPHY HUNTER · MISSION CONTROL</span><h3>Deine Platin-Missionen</h3><p>Persönliche Platin-Ziele, abgeglichen mit den zugeordneten PSN-Trophäenlisten.</p></div>
  </div>
  <div className="psn-mission-summary">
   <div><strong>{number(projects.length)}</strong><small>Geplante Platin-Projekte</small></div>
   <div><strong>{number(mapped)}</strong><small>PSN-Listen zugeordnet</small></div>
   <div><strong>{number(earned)}</strong><small>Platin auf PSN bestätigt</small></div>
  </div>
  {projects.length?<div className="psn-mission-projects">
   {projects.slice(0,18).map(project=><article className={'psn-mission-card'+(project.platinumEarned?' is-platinum-earned':'')} key={project.id}>
    <div className="psn-mission-card-head">
     <div><small>{project.priority==='high'?'HOHE PRIORITÄT':project.platinumEarned?'PLATIN ERHALTEN':'PLATIN-PROJEKT'}</small><h4>{project.title}</h4></div>
     <span className="psn-mission-state">{project.platinumEarned?'PSN-Platin':status(project)}</span>
    </div>
    {project.trophy?<>
     <div className="psn-mission-progress-label"><span>Trophäen-Fortschritt laut PSN</span><strong>{project.progress!==null?project.progress.toLocaleString('de-DE',{maximumFractionDigits:1})+' %':'Nicht verfügbar'}</strong></div>
     <div className="psn-mission-track" role="progressbar" aria-label={'PSN-Trophäenfortschritt '+project.title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={project.progress??0}>
      <span style={{width:(project.progress??0)+'%'}}/>
     </div>
     <small className="psn-mission-edition">{project.trophy.trophyTitleName||'PSN-Trophäenliste'}{project.trophy.trophyTitlePlatform?' · '+(Array.isArray(project.trophy.trophyTitlePlatform)?project.trophy.trophyTitlePlatform.join(' / '):project.trophy.trophyTitlePlatform):''}</small>
    </>:<p className="psn-mission-uncertain">{project.candidates>1?'Mehrere PSN-Versionen gefunden. Wähle im Spielplan die richtige Trophäenliste.':'Keine eindeutig passende PSN-Trophäenliste. Dein persönliches Ziel bleibt gespeichert.'}</p>}
    {project.note?<div className="psn-mission-next"><small>DEIN NÄCHSTER SCHRITT</small><p>{project.note}</p></div>:null}
    <button type="button" onClick={()=>onOpenPlan(project.id)}>Platin-Plan bearbeiten <span aria-hidden="true">↗</span></button>
   </article>)}
  </div>:<div className="psn-mission-empty"><strong>Noch keine Platin-Projekte</strong><p>Markiere ein Spiel im Bereich „Meine Spielwelt → Spiele planen & Backlog“ als „Platin-Ziel“. Hier erscheinen dann deine Projekte mit echten PSN-Daten.</p></div>}
  {projects.length>18?<small className="psn-mission-note">Es werden die ersten 18 Projekte angezeigt. Alle Pläne bleiben im Backlog erreichbar.</small>:null}
  <p className="psn-mission-note">Ein PSN-Fortschritt von 100 % ist nicht automatisch eine freigeschaltete Platin-Trophäe. Die Anzeige bestätigt Platin nur, wenn Sony eine erhaltene Platin-Trophäe meldet. Einzelne DLC-Erfolge können die Fortschrittsanzeige beeinflussen.</p>
 </section>;
}
