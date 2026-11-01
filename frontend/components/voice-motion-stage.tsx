'use client';
import {useEffect,useRef,useState} from 'react';
import {Pause,Play,RotateCcw} from 'lucide-react';
import {gsap} from '@/lib/motion';
const SCENES=[
 {word:'Listen.',name:'Paneer butter masala',phase:'PRESS PLAY',image:'/images/recipes/paneer.jpg'},
 {word:'Cook.',name:'Andhra chicken curry',phase:'FOLLOW THE FLAVOUR',image:'/images/recipes/chicken.jpg'},
 {word:'Savour.',name:'Comfort, one step at a time',phase:'MAKE IT YOURS',image:'/images/recipes/rice.jpg'},
];
export function VoiceMotionStage(){
 const root=useRef<HTMLDivElement>(null),controls=useRef<{sync:()=>void;replay:()=>void}|null>(null);
 const pausedRef=useRef(false),[paused,setPaused]=useState(false),[reduced,setReduced]=useState(false);
 useEffect(()=>{
  const element=root.current;if(!element)return;
  const media=gsap.matchMedia();
  media.add({all:'all',reduce:'(prefers-reduced-motion: reduce)'},context=>{
   const reduce=Boolean(context.conditions?.reduce);setReduced(reduce);if(reduce)return;
   let visible=false;
   const scope=gsap.context(()=>{
    const scenes=gsap.utils.toArray<HTMLElement>('.motion-scene');
    gsap.set(scenes.flatMap(scene=>[scene.querySelector('.motion-dish'),scene.querySelector('.motion-scene-word'),scene.querySelector('.motion-scene-caption')]),{opacity:0});
    const film=gsap.timeline({paused:true,repeat:-1,defaults:{ease:'power3.inOut'}});
    scenes.forEach((scene,index)=>{
     const start=index*4.8,dish=scene.querySelector('.motion-dish'),word=scene.querySelector('.motion-scene-word'),caption=scene.querySelector('.motion-scene-caption');
     film.set(scene,{autoAlpha:1},start)
      .fromTo(dish,{xPercent:24,yPercent:32,rotation:-32,scale:.48,opacity:0},{xPercent:0,yPercent:0,rotation:0,scale:1,opacity:1,duration:1.25,immediateRender:false},start)
      .fromTo(word,{yPercent:110,rotation:5,opacity:0},{yPercent:0,rotation:0,opacity:1,duration:1.05,immediateRender:false},start+.18)
      .fromTo(caption,{y:18,opacity:0},{y:0,opacity:1,duration:.7,immediateRender:false},start+.45)
      .to(dish,{yPercent:-4,xPercent:-2,rotation:7,scale:1.045,duration:2.1,ease:'sine.inOut'},start+1.3)
      .to(dish,{xPercent:-45,yPercent:-20,scale:.65,rotation:34,opacity:0,duration:1},start+3.7)
      .to(word,{yPercent:-95,opacity:0,duration:.7},start+3.9)
      .to(caption,{opacity:0,duration:.4},start+4)
      .set(scene,{autoAlpha:0},start+4.8);
    });
    const ambient=gsap.timeline({paused:true,repeat:-1,yoyo:true})
     .to('.motion-herb',{y:(index)=>index%2?-24:22,x:(index)=>index%2?14:-12,rotation:(index)=>index%2?24:-18,duration:2.6,ease:'sine.inOut',stagger:.18},0)
     .to('.motion-seed',{y:-22,rotation:70,stagger:.09,duration:2.7,ease:'sine.inOut'},0)
     .to('.motion-orbit',{rotation:24,duration:3.2,ease:'none'},0)
     .to([...element.querySelectorAll('.motion-mini-wave i'),...element.closest('section')!.querySelectorAll('.cinema-wave i')],{scaleY:(index)=>.3+Math.sin(index*1.3)**2*1.6,duration:.65,stagger:.025,ease:'sine.inOut',repeat:3,yoyo:true},0);
    const sync=()=>{const play=visible&&!document.hidden&&!pausedRef.current;film.paused(!play);ambient.paused(!play);element.dataset.motion=play?'playing':'paused'};
    controls.current={sync,replay:()=>{film.restart();ambient.restart();sync()}};
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync()},{threshold:.12});observer.observe(element);
    document.addEventListener('visibilitychange',sync);
    return()=>{observer.disconnect();document.removeEventListener('visibilitychange',sync);controls.current=null;delete element.dataset.motion};
   },element);
   return()=>scope.revert();
  },element);
  return()=>media.revert();
 },[]);
 function toggle(){const next=!paused;pausedRef.current=next;setPaused(next);controls.current?.sync()}
 return <div className="cinema-visual motion-visual" ref={root}>
  <span className="cinema-scene-number">THE ART OF LISTENING · A KITCHEN IN MOTION</span>
  <div className="motion-stage" role="img" aria-label="Animated food photography: listen, cook and savour. A voice guides every step.">
   <img className="motion-kitchen" src="/images/kitchen.jpg" alt="" width={900} height={1100} loading="lazy"/>
   <div className="motion-orbit" aria-hidden="true"/>
   <span className="motion-stage-label" aria-hidden="true">GOOD FOOD.<br/>GREAT COMPANY.</span>
   {SCENES.map((scene,index)=><div className={`motion-scene motion-scene-${index}`} key={scene.word} aria-hidden="true">
    <div className="motion-scene-caption"><span>0{index+1} / {scene.phase}</span><small>{scene.name}</small></div>
    <div className="motion-dish"><img src={scene.image} alt="" width={600} height={600} loading="lazy"/></div>
    <span className="motion-scene-word">{scene.word}</span>
   </div>)}
   <div className="motion-seasoning" aria-hidden="true">{[0,1,2].map(i=><svg className={`motion-herb herb-${i}`} key={i} viewBox="0 0 80 120" fill="none"><path d="M39 115C30 78 49 39 35 4M38 84C10 82 4 65 8 51C30 53 43 65 38 84ZM41 61C66 54 73 38 68 24C47 29 36 45 41 61ZM36 36C15 34 10 21 14 10C30 12 38 22 36 36Z" fill="currentColor"/><path d="M39 115C30 78 49 39 35 4" stroke="#b8c699" strokeWidth="1.5"/></svg>)}{Array.from({length:9},(_,i)=><i className={`motion-seed seed-${i}`} key={i}/>)}</div>
   <div className="motion-stage-footer"><div className="motion-mini-wave" aria-hidden="true">{Array.from({length:12},(_,i)=><i key={i} style={{height:`${Math.round(7+Math.sin(i*.8)**2*16)}px`}}/>)}</div><span>ENGLISH · తెలుగు · हिन्दी</span></div>
  </div>
  <div className="motion-toolbar"><span>{reduced?'A little guidance. A lot of flavour.':'A recipe that moves with you.'}</span><div><button type="button" disabled={reduced} onClick={toggle} aria-label={paused?'Play food animation':'Pause food animation'}>{paused?<Play size={14}/>:<Pause size={14}/>} {paused?'Play':'Pause'}</button><button type="button" disabled={reduced} onClick={()=>{pausedRef.current=false;setPaused(false);controls.current?.replay()}} aria-label="Replay food animation"><RotateCcw size={14}/> Replay</button></div></div>
 </div>;
}
