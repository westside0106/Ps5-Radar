'use client';
import {useEffect,useRef,useState} from 'react';

const MODEL_PATHS={
 platinum:'/trophies/platinum.glb',
 gold:'/trophies/gold.glb',
 silver:'/trophies/silver.glb',
 bronze:'/trophies/bronze.glb'
};
export default function TrophyModel({rank='platinum'}){
 const host=useRef(null),[error,setError]=useState(false);
 useEffect(()=>{
  let disposed=false,frame=0,renderer=null,resize=null,scene=null,canvas=null,observer=null;
  let dragging=false,lastX=0,model=null,visible=true;
  const el=host.current;if(!el)return;
  setError(false);
  async function init(){
   try{
    const [{Scene,PerspectiveCamera,WebGLRenderer,AmbientLight,DirectionalLight,Box3,Vector3,Color,SRGBColorSpace,ACESFilmicToneMapping},{GLTFLoader}]=await Promise.all([import('three'),import('three/addons/loaders/GLTFLoader.js')]);
    if(disposed)return;
    const response=await fetch(MODEL_PATHS[rank],{method:'HEAD'});
    if(!response.ok)throw Error('3D-Datei nicht veröffentlicht');
    scene=new Scene();scene.background=null;
    const camera=new PerspectiveCamera(35,1,.01,1000);camera.position.set(0,0,4.8);
    renderer=new WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
    renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=ACESFilmicToneMapping;
    renderer.setClearColor(new Color(0x000000),0);
    canvas=renderer.domElement;el.appendChild(canvas);
    scene.add(new AmbientLight(0xffffff,2.1));
    const key=new DirectionalLight(0xffffff,3);key.position.set(3,5,7);scene.add(key);
    const rim=new DirectionalLight(0x80b8ff,1.8);rim.position.set(-5,2,-4);scene.add(rim);
    const gltf=await new GLTFLoader().loadAsync(MODEL_PATHS[rank]);
    if(disposed)return;
    model=gltf.scene;scene.add(model);
    const box=new Box3().setFromObject(model),size=box.getSize(new Vector3()),center=box.getCenter(new Vector3());
    model.position.sub(center);
    const extent=Math.max(size.x,size.y,size.z)||1;model.scale.setScalar(2.6/extent);
    const onResize=()=>{if(!renderer)return;const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};
    resize=new ResizeObserver(onResize);resize.observe(el);onResize();
    observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true});observer.observe(el);
    let last=0;const animate=(time)=>{if(disposed)return;frame=requestAnimationFrame(animate);if(!visible)return;if(model&&!dragging&&time-last>16){model.rotation.y+=.0035;last=time}renderer.render(scene,camera)};frame=requestAnimationFrame(animate);
   }catch(e){if(!disposed)setError(true)}
  }
  const down=e=>{dragging=true;lastX=e.clientX;el.setPointerCapture?.(e.pointerId)};
  const move=e=>{if(!dragging||!model)return;model.rotation.y+=(e.clientX-lastX)*.012;lastX=e.clientX};
  const up=()=>{dragging=false};
  el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
  init();
  return()=>{disposed=true;cancelAnimationFrame(frame);resize?.disconnect();observer?.disconnect();el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);if(scene){scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose()}}})}renderer?.dispose();if(canvas?.parentNode===el)el.removeChild(canvas)};
 },[rank]);
 return <div className="psn-trophy-3d" ref={host} role="img" aria-label={'Interaktives 3D-Modell der '+({platinum:'Platin',gold:'Gold',silver:'Silber',bronze:'Bronze'}[rank]||rank)+'-Trophäe'}>{error?<div className="psn-trophy-3d-fallback"><span aria-hidden="true">{rank==='platinum'?'🏆':rank==='gold'?'🥇':rank==='silver'?'🥈':'🥉'}</span><small>3D-Datei noch nicht veröffentlicht</small></div>:null}</div>;
}
