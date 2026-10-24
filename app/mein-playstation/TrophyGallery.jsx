'use client';
import {useEffect,useRef,useState} from 'react';
const ranks=[['platinum','Platin'],['gold','Gold'],['silver','Silber'],['bronze','Bronze']];
export default function TrophyGallery({counts={}}){
 const host=useRef(null),[error,setError]=useState(''),[active,setActive]=useState(0);
 useEffect(()=>{
  const el=host.current;if(!el)return;
  let stop=false,renderer,frame=0,observer,resize,scene;
  const geometries=[],materials=[];
  async function start(){
   try{
    const THREE=await import('three');const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
    if(stop)return;
    const {Scene,PerspectiveCamera,WebGLRenderer,AmbientLight,DirectionalLight,Mesh,MeshStandardMaterial,BoxGeometry,CylinderGeometry,Color,Group,Box3,Vector3}=THREE;
    scene=new Scene();scene.background=new Color(0x081427);
    const camera=new PerspectiveCamera(50,1,.1,90);camera.position.set(0,2.4,9.6);
    renderer=new WebGLRenderer({antialias:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(1.5,window.devicePixelRatio||1));el.appendChild(renderer.domElement);
    const makeMat=(hex,metalness=0)=>{const m=new MeshStandardMaterial({color:hex,metalness,roughness:.42});materials.push(m);return m};
    const geo=(fn,...args)=>{const g=new fn(...args);geometries.push(g);return g};
    scene.add(new AmbientLight(0xd9e9ff,2.2));
    const light=new DirectionalLight(0xffffff,4);light.position.set(-3,7,8);scene.add(light);
    const back=new DirectionalLight(0x6bafff,2);back.position.set(4,5,-4);scene.add(back);
    const floor=new Mesh(geo(BoxGeometry,18,.2,7),makeMat(0x12233a));floor.position.y=-.52;scene.add(floor);
    const wall=new Mesh(geo(BoxGeometry,18,6,.3),makeMat(0x102038));wall.position.set(0,2,-3);scene.add(wall);
    const blues=[0xa5d9ff,0xf6ba44,0xc4d4eb,0xb87758];
    const exhibits=[];
    const loader=new GLTFLoader();
    for(let i=0;i<ranks.length;i++){
      const x=(i-1.5)*2.35;
      const pedestal=new Mesh(geo(CylinderGeometry,.76,.87,.8,32),makeMat(0x243953,.42));pedestal.position.set(x,-.04,0);scene.add(pedestal);
      const trim=new Mesh(geo(CylinderGeometry,.77,.77,.07,32),makeMat(blues[i],.74));trim.position.set(x,.38,0);scene.add(trim);
      const holder=new Group();holder.position.set(x,.57,0);scene.add(holder);exhibits.push(holder);
      try{
        const model=await loader.loadAsync('/trophies/'+ranks[i][0]+'.glb');
        if(stop)return;
        const obj=model.scene,box=new Box3().setFromObject(obj),size=box.getSize(new Vector3()),center=box.getCenter(new Vector3()),scale=1.85/(Math.max(size.x,size.y,size.z)||1);
        obj.position.copy(center).multiplyScalar(-1);obj.scale.setScalar(scale);holder.add(obj);
      }catch{
        const cup=new Mesh(geo(CylinderGeometry,.32,.18,1.15,20),makeMat(blues[i],.8));cup.position.y=.7;holder.add(cup);
      }
    }
    let drag=false,last=0,yaw=0,visible=true;
    const down=e=>{drag=true;last=e.clientX;el.setPointerCapture?.(e.pointerId)};
    const move=e=>{if(!drag)return;yaw=Math.max(-.5,Math.min(.5,yaw+(e.clientX-last)*.003));last=e.clientX};
    const up=()=>{drag=false};
    el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
    resize=new ResizeObserver(()=>{if(!renderer)return;const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()});resize.observe(el);
    if(typeof IntersectionObserver!=='undefined'){observer=new IntersectionObserver(v=>{visible=v[0]?.isIntersecting??true});observer.observe(el)}
    let angle=0;
    const render=()=>{if(stop)return;frame=requestAnimationFrame(render);if(!visible)return;angle+=(yaw-angle)*.08;camera.position.x=Math.sin(angle)*5;camera.lookAt(0,.8,0);renderer.render(scene,camera)};render();
    return()=>{el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up)};
   }catch{if(!stop)setError('3D-Darstellung auf diesem Gerät nicht verfügbar')}
  }
  let cleanup;
  start().then(fn=>cleanup=fn);
  return()=>{stop=true;cancelAnimationFrame(frame);observer?.disconnect();resize?.disconnect();cleanup?.();if(scene)scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(!materials.includes(m))m.dispose()}}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer?.dispose();if(renderer?.domElement?.parentNode===el)el.removeChild(renderer.domElement)};
 },[]);
 return <div className="psn-gallery-showcase"><div className="psn-gallery-3d" ref={host} role="img" aria-label="Interaktive 3D-Sammlung der vier Trophäenränge; mit Fingerbewegung Perspektive ändern">{error?<p>{error}</p>:null}</div><div className="psn-gallery-ranks">{ranks.map(([key,label],i)=><div key={key}><strong>{Number(counts[key]||0).toLocaleString('de-DE')}</strong><small>{label}</small></div>)}</div><small>Virtuelle Sammlung auf Grundlage deiner PSN-Trophäen. Anzeige der vier Ränge, keine einzeln modellierten echten Erfolge.</small></div>
}
