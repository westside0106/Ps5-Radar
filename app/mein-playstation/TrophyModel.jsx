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
    const [{Scene,PerspectiveCamera,WebGLRenderer,AmbientLight,DirectionalLight,Box3,Vector3,Color,SRGBColorSpace,ACESFilmicToneMapping,Group,Mesh,MeshStandardMaterial,LatheGeometry,TubeGeometry,CatmullRomCurve3,TorusGeometry,SphereGeometry},{GLTFLoader}]=await Promise.all([import('three'),import('three/addons/loaders/GLTFLoader.js')]);
    if(disposed)return;
    const response=await fetch(MODEL_PATHS[rank],{method:'HEAD'}).catch(()=>null);
    const hasOriginal=Boolean(response?.ok);
    scene=new Scene();scene.background=null;
    const camera=new PerspectiveCamera(35,1,.01,1000);camera.position.set(0,0,5);
    renderer=new WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=ACESFilmicToneMapping;
    renderer.setClearColor(new Color(0x000000),0);
    canvas=renderer.domElement;el.appendChild(canvas);
    scene.add(new AmbientLight(0xffffff,3.2));
    const key=new DirectionalLight(0xffffff,5.5);key.position.set(3,5,7);scene.add(key);
    const rim=new DirectionalLight(0xb8dfff,3.5);rim.position.set(-5,2,-4);scene.add(rim);const fill=new DirectionalLight(0xffffff,3.5);fill.position.set(-4,-2,6);scene.add(fill);
    if(hasOriginal){try{const gltf=await new GLTFLoader().loadAsync(MODEL_PATHS[rank]);if(disposed)return;model=gltf.scene}catch{}}
    if(!model){
      const shades={platinum:0xb9dfff,gold:0xf5b83f,silver:0xc7d0df,bronze:0xb96b52};
      const material=new MeshStandardMaterial({color:shades[rank]||shades.gold,metalness:.86,roughness:.2});
      const accent=new MeshStandardMaterial({color:rank==='platinum'?0x5b9aff:0x23344b,metalness:.65,roughness:.24});
      const trophy=new Group();
      const pts=[[0,-1.3],[.55,-1.3],[.63,-1.24],[.63,-1.12],[.25,-1.12],[.18,-.98],[.12,-.85],[.13,-.55],[.25,-.45],[.39,-.3],[.55,0],[.69,.35],[.74,.78],[.7,.9],[.6,.94],[.52,.87],[.45,.58],[.3,.3],[0,.2]].map(([x,y])=>({x,y}));
      trophy.add(new Mesh(new LatheGeometry(pts,72),material));
      for(const side of [-1,1]){
        const path=new CatmullRomCurve3([[.58,.78,0],[1.0,.93,0],[1.12,.35,0],[.92,-.1,0],[.55,-.16,0]].map(([x,y,z])=>new Vector3(x*side,y,z)));
        trophy.add(new Mesh(new TubeGeometry(path,45,.07,10,false),material));
      }
      const ring=new Mesh(new TorusGeometry(.59,.035,10,64),accent);ring.rotation.x=Math.PI/2;ring.position.y=.86;trophy.add(ring);
      if(rank==='platinum'){const orb=new Mesh(new SphereGeometry(.35,32,20),new MeshStandardMaterial({color:0x5aaeff,metalness:.25,roughness:.1,transparent:true,opacity:.78}));orb.position.y=.5;trophy.add(orb)}
      model=trophy;
    }
    scene.add(model);
    const box=new Box3().setFromObject(model),size=box.getSize(new Vector3()),center=box.getCenter(new Vector3());
    model.position.sub(center);
    const extent=Math.max(size.x,size.y,size.z)||1;model.scale.setScalar(1/extent);
    const scaled=extent>0?size.clone().multiplyScalar(1/extent):new Vector3(1,1,1);
    const fitCamera=()=>{const aspect=Math.max(.5,el.clientWidth/Math.max(1,el.clientHeight));const fov=camera.fov*Math.PI/180;const required=Math.max(scaled.y/(2*Math.tan(fov/2)),scaled.x/(2*Math.tan(fov/2)*aspect));camera.position.set(0,0,Math.max(1.4,required*1.55));camera.lookAt(0,0,0)};fitCamera();
    const onResize=()=>{if(!renderer)return;const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;fitCamera();camera.updateProjectionMatrix()};
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
