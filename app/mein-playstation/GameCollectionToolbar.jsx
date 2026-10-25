'use client';
const viewOptions=[['cards','Kacheln'],['list','Liste'],['shelf','Regal']];
export default function GameCollectionToolbar({collections,activeCollection,onSelect,onCreate,onRemove,newName,onNameChange,viewMode,onViewChange,message}){
 const selected=collections.find(c=>c.id===activeCollection);
 return <section className="psn-collection-tools" aria-label="Spielesammlungen und Darstellung">
  <div className="psn-collection-tools-top">
   <div><span className="psn-eyebrow">MEINE BIBLIOTHEK</span><h3>Sammlungen</h3><small>Persönliche Listen – unabhängig von deinen PSN-Trophäen und Spielplänen</small></div>
   <div className="psn-collection-view-switch" role="group" aria-label="Darstellung der Spiele">
    {viewOptions.map(([id,label])=><button key={id} type="button" aria-pressed={viewMode===id} onClick={()=>onViewChange(id)}>{label}</button>)}
   </div>
  </div>
  <div className="psn-collection-selector">
   <button type="button" aria-pressed={!activeCollection} onClick={()=>onSelect('')}>Alle Spiele</button>
   {collections.map(c=><button type="button" aria-pressed={activeCollection===c.id} key={c.id} onClick={()=>onSelect(c.id)}>{c.name} <span>{c.gameIds.length}</span></button>)}
  </div>
  <details className="psn-collection-manage">
   <summary>Sammlungen verwalten</summary>
   <div className="psn-collection-manage-content">
    <label>Neue Sammlung
     <input type="text" maxLength={42} value={newName} placeholder="z. B. Assassin’s Creed, Open World …" onChange={e=>onNameChange(e.target.value)} />
    </label>
    <button type="button" disabled={newName.trim().length<2||collections.length>=40} onClick={onCreate}>Sammlung anlegen</button>
    {selected?<button type="button" className="psn-collection-delete" onClick={onRemove}>„{selected.name}“ löschen</button>:null}
    <small>Öffne anschließend ein Spiel, um es einer oder mehreren Sammlungen zuzuordnen. Bis zu 40 Sammlungen.</small>
   </div>
  </details>
  {message?<p role="status" className="psn-collection-feedback">{message}</p>:null}
 </section>;
}
