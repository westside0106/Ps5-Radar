// Original, locally rendered PSN trophy motion cards. No remote renderer or game artwork.
// Browser MediaRecorder capabilities vary; the static SVG export remains the fallback.
export const VIDEO_DURATION_MS=4000;
export const VIDEO_SIZE={width:720,height:960};
export function preferredVideoMime(MediaRecorderClass){
 if(!MediaRecorderClass||typeof MediaRecorderClass.isTypeSupported!=='function')return null;
 const candidates=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
 return candidates.find(type=>MediaRecorderClass.isTypeSupported(type))||null;
}
export function cardVideoTitle(raw,max=21){
 const value=String(raw||'UNKNOWN GAME').normalize('NFKC').replace(/\s+/g,' ').trim().slice(0,150);
 const words=value.split(' '),lines=[];let text='';
 for(const word of words){
  if(word.length>max){if(text){lines.push(text);text='';}lines.push(word.slice(0,max));}
  else if((text?text.length+1:0)+word.length>max){lines.push(text);text=word;}
  else text=text?text+' '+word:word;
 }
 if(text)lines.push(text);
 if(lines.length>3){const keep=lines.slice(0,3);keep[2]=keep[2].slice(0,max-1)+'…';return keep;}
 return lines.length?lines:['UNKNOWN GAME'];
}
export function trophyVideoFacts(item){
 const types=['bronze','silver','gold','platinum'];
 const earned={};
 for(const kind of types){const n=Number(item?.earnedTrophies?.[kind]);earned[kind]=Number.isFinite(n)&&n>0?Math.floor(n):0;}
 const raw=item?.progress;
 const pct=raw===null||raw===undefined||raw===''?null:Number(raw);
 const progress=Number.isFinite(pct)&&pct>=0&&pct<=100?pct:null;
 return {
  title:String(item?.trophyTitleName||'Unbekanntes Spiel').slice(0,150),
  progress,earned,platinum:earned.platinum>0,
  count:types.reduce((n,t)=>n+earned[t],0)
 };
}
const pathRect=(ctx,x,y,w,h,r)=>{
 const q=Math.min(r,w/2,h/2);
 ctx.beginPath();ctx.moveTo(x+q,y);ctx.lineTo(x+w-q,y);ctx.quadraticCurveTo(x+w,y,x+w,y+q);
 ctx.lineTo(x+w,y+h-q);ctx.quadraticCurveTo(x+w,y+h,x+w-q,y+h);ctx.lineTo(x+q,y+h);
 ctx.quadraticCurveTo(x,y+h,x,y+h-q);ctx.lineTo(x,y+q);ctx.quadraticCurveTo(x,y,x+q,y);ctx.closePath();
};
export function renderTrophyVideoFrame(ctx,item,theme,t){
 const {width:w,height:h}=VIDEO_SIZE;
 const info=trophyVideoFacts(item),progress=info.progress??0;
 const light=theme?.light||'#9ee5ff',accent=theme?.accent||'#567eff';
 const base=theme?.base||'#07132c',secondary=theme?.secondary||'#ccaeff';
 const phase=Math.max(0,Math.min(1,t));
 ctx.clearRect(0,0,w,h);
 const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,base);bg.addColorStop(.45,accent);bg.addColorStop(1,base);
 ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 ctx.fillStyle='rgba(3,9,23,0.63)';ctx.fillRect(0,0,w,h);
 const glow=ctx.createRadialGradient(w*.71,h*.25,10,w*.71,h*.25,530);
 glow.addColorStop(0,light+'7a');glow.addColorStop(1,light+'00');
 ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
 ctx.strokeStyle='rgba(255,255,255,.07)';ctx.lineWidth=1;
 for(let x=16;x<w;x+=42){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
 for(let y=10;y<h;y+=42){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
 ctx.save();ctx.translate((phase*2-1)*950,0);ctx.rotate(-Math.PI/5);
 const shine=ctx.createLinearGradient(-180,0,180,0);
 shine.addColorStop(0,'rgba(255,255,255,0)');shine.addColorStop(.48,'rgba(255,255,255,.12)');shine.addColorStop(.5,'rgba(255,255,255,.22)');shine.addColorStop(.52,'rgba(255,255,255,.12)');shine.addColorStop(1,'rgba(255,255,255,0)');
 ctx.fillStyle=shine;ctx.fillRect(-180,-600,360,2200);ctx.restore();
 ctx.lineWidth=3;ctx.strokeStyle=light;pathRect(ctx,23,23,w-46,h-46,22);ctx.stroke();
 ctx.strokeStyle='rgba(255,255,255,.22)';ctx.lineWidth=1;pathRect(ctx,31,31,w-62,h-62,18);ctx.stroke();
 ctx.fillStyle=light;ctx.font='700 17px sans-serif';ctx.fillText('PLAYSTATION RADAR',51,87);
 ctx.textAlign='right';ctx.fillStyle='#d9eaff';ctx.font='600 12px sans-serif';ctx.fillText('HOLO COLLECTOR / 001',w-49,87);ctx.textAlign='left';
 ctx.strokeStyle='rgba(255,255,255,.35)';ctx.beginPath();ctx.moveTo(50,107);ctx.lineTo(w-50,107);ctx.stroke();
 // Original animated trophy insignia and halo, independent of copyrighted game assets.
 const pulse=.6+.15*Math.sin(phase*Math.PI*6);
 ctx.save();ctx.translate(w/2,252);ctx.shadowColor=light;ctx.shadowBlur=16+30*pulse;
 ctx.strokeStyle=light;ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,0,105+4*Math.sin(phase*Math.PI*2),0,Math.PI*2);ctx.stroke();
 ctx.lineWidth=11;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
 ctx.moveTo(-50,-28);ctx.lineTo(-50,20);ctx.quadraticCurveTo(-50,63,0,63);ctx.quadraticCurveTo(50,63,50,20);ctx.lineTo(50,-28);
 ctx.moveTo(-73,-28);ctx.lineTo(-50,-55);ctx.lineTo(-27,-28);
 ctx.moveTo(-22,-55);ctx.lineTo(0,-83);ctx.lineTo(22,-55);
 ctx.moveTo(27,-28);ctx.lineTo(50,-55);ctx.lineTo(73,-28);
 ctx.moveTo(0,-76);ctx.lineTo(0,91);
 ctx.stroke();ctx.restore();
 ctx.fillStyle=light;ctx.font='700 17px sans-serif';ctx.fillText('PERSONAL TROPHY RECORD',52,411);
 const lines=cardVideoTitle(info.title,21);
 ctx.fillStyle='#fff';ctx.font='900 39px sans-serif';
 lines.forEach((line,i)=>ctx.fillText(line,52,462+i*50,610));
 const cardStart=628;
 ctx.fillStyle='rgba(4,9,20,.4)';pathRect(ctx,50,cardStart,620,80,12);ctx.fill();
 ctx.strokeStyle='rgba(210,240,255,.5)';ctx.lineWidth=1;ctx.stroke();
 const status=info.platinum?'PLATINUM UNLOCKED':info.progress===100?'100% TROPHY PROGRESS':info.progress===null?'PROGRESS UNKNOWN':'TROPHY HUNTER';
 ctx.fillStyle=light;ctx.font='700 14px sans-serif';ctx.fillText('YOUR STATUS',65,cardStart+24);
 ctx.fillStyle='#fff';ctx.font='800 27px sans-serif';ctx.fillText(status,65,cardStart+58,580);
 ctx.fillStyle=light;ctx.font='700 16px sans-serif';ctx.fillText('TROPHY PROGRESS',52,765);
 ctx.textAlign='right';ctx.fillStyle='#fff';ctx.font='900 48px sans-serif';ctx.fillText(info.progress===null?'—':info.progress+'%',w-52,767);ctx.textAlign='left';
 ctx.fillStyle='rgba(255,255,255,.20)';pathRect(ctx,52,790,616,13,6);ctx.fill();
 ctx.fillStyle=light;pathRect(ctx,52,790,Math.max(0,616*progress/100),13,6);ctx.fill();
 const trophyLine='BR '+info.earned.bronze+'     SI '+info.earned.silver+'     GO '+info.earned.gold+'     PL '+info.earned.platinum;
 ctx.fillStyle='#f1faff';ctx.font='700 21px sans-serif';ctx.fillText(trophyLine,52,854,620);
 ctx.fillStyle=secondary;ctx.font='600 13px sans-serif';ctx.fillText(info.count+' EARNED / '+(theme?.name||'AURORA').toUpperCase(),52,911);
 // Sparse motion elements: bounded and deterministic with no randomized per-frame positions.
 for(let i=0;i<17;i++){
  const x=42+((i*67+phase*(i%2?45:-35)+720)%630);
  const y=130+((i*47+phase*(i%3?280:125))%430);
  ctx.fillStyle=light;ctx.globalAlpha=.25+.35*Math.abs(Math.sin(phase*Math.PI*4+i));
  ctx.fillRect(x,y,i%3===0?3:2,i%3===0?3:2);
 }
 ctx.globalAlpha=1;
}
export async function exportTrophyMotionVideo(item,theme,{onProgress=()=>{}}={}){
 if(typeof window==='undefined'||typeof document==='undefined')throw new Error('Videoexport benötigt einen Browser.');
 const MediaRecorderClass=window.MediaRecorder;
 const mime=preferredVideoMime(MediaRecorderClass);
 if(!mime)throw new Error('Der Browser unterstützt hier keinen Videoencoder. SVG-Export bleibt verfügbar.');
 const canvas=document.createElement('canvas');
 canvas.width=VIDEO_SIZE.width;canvas.height=VIDEO_SIZE.height;
 const ctx=canvas.getContext('2d',{alpha:false});
 if(!ctx||typeof canvas.captureStream!=='function')throw new Error('Dieser Browser unterstützt Canvas-Videomitschnitte nicht.');
 const stream=canvas.captureStream(24);
 const tracks=stream.getTracks();
 const recorded=[];
 let recorder;
 try{recorder=new MediaRecorderClass(stream,{mimeType:mime,videoBitsPerSecond:3_200_000});}
 catch{tracks.forEach(t=>t.stop());throw new Error('Videoencoder konnte nicht gestartet werden. SVG-Export bleibt verfügbar.');}
 let frame=0,raf=0,timeout=0;
 const release=()=>{if(raf)window.cancelAnimationFrame(raf);if(timeout)window.clearTimeout(timeout);tracks.forEach(t=>t.stop());};
 const blob=await new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(error,result)=>{
   if(settled)return;settled=true;release();
   if(error)reject(error);else resolve(result);
  };
  recorder.ondataavailable=e=>{if(e.data?.size)recorded.push(e.data);};
  recorder.onerror=()=>finish(new Error('Videoaufzeichnung fehlgeschlagen. SVG-Export bleibt verfügbar.'));
  recorder.onstop=()=>{const output=new Blob(recorded,{type:recorder.mimeType||mime});if(!output.size)return finish(new Error('Keine Videodaten erzeugt.'));finish(null,output);};
  try{
   renderTrophyVideoFrame(ctx,item,theme,0);
   recorder.start(500);
   const start=window.performance.now();
   const draw=()=>{
    const position=Math.min(1,(window.performance.now()-start)/VIDEO_DURATION_MS);
    renderTrophyVideoFrame(ctx,item,theme,position);frame++;
    if(frame%5===0)onProgress(Math.floor(position*100));
    if(position<1&&recorder.state==='recording')raf=window.requestAnimationFrame(draw);
    else if(recorder.state==='recording')recorder.stop();
   };
   raf=window.requestAnimationFrame(draw);
   timeout=window.setTimeout(()=>{if(recorder.state==='recording')recorder.stop()},VIDEO_DURATION_MS+3000);
  }catch(error){try{if(recorder.state==='recording')recorder.stop()}catch{}finish(error);}
 });
 const ext=(recorder.mimeType||mime).includes('mp4')?'mp4':'webm';
 const safeName=trophyVideoFacts(item).title.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,58)||'game';
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='PS5-Radar-'+safeName+'-Holo-Card.'+ext;
 document.body.appendChild(a);a.click();a.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),15000);
 onProgress(100);
 return {size:blob.size,mimeType:recorder.mimeType||mime,extension:ext};
}
