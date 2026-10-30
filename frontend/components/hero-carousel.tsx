'use client';

import Link from 'next/link';import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,ChefHat,Clock3,Pause,Play,Volume2} from 'lucide-react';
import type {RecipeData} from '@/lib/types';import {FoodImage} from './food-image';import {gsap,lowPower,prefersReducedMotion} from '@/lib/motion';

// Preferred order for the featured collection; only recipes that exist (and have photos) are shown.
const PREFERRED=['paneer-butter-masala','andhra-chicken-curry','palak-paneer','homestyle-egg-curry','tomato-pappu','chana-masala'];
const AUTOPLAY_MS=6500;
/*
 Plate slots, inspired by the reference video: the active dish sits large in the centre and the next dishes orbit
 as small plates. On every change each plate tweens to its new slot, so the next dish grows into the hero spot while
 the previous one spins away. Offsets are relative to the plate's own size, so the layout scales with the stage.
*/
const SLOTS=[
 {xPercent:-50,yPercent:-50,scale:1,rotation:0,opacity:1,zIndex:4},
 {xPercent:8,yPercent:-108,scale:.3,rotation:-30,opacity:1,zIndex:3},
 {xPercent:16,yPercent:2,scale:.24,rotation:25,opacity:1,zIndex:3},
 {xPercent:-118,yPercent:12,scale:.2,rotation:40,opacity:1,zIndex:2},
];
const EXIT={xPercent:-190,yPercent:-90,scale:.15,rotation:-120,opacity:0,zIndex:1};

export function pickFeatured(recipes:RecipeData[]){
 const withPhoto=recipes.filter(r=>r.imageUrl);
 const ordered=[...PREFERRED.map(s=>withPhoto.find(r=>r.slug===s)).filter((r):r is RecipeData=>Boolean(r)),...withPhoto.filter(r=>!PREFERRED.includes(r.slug))];
 return ordered.slice(0,5);
}

export function HeroCarousel({recipes,loading=false,error='',onRetry}:{recipes:RecipeData[];loading?:boolean;error?:string;onRetry?:()=>void}){
 const featured=pickFeatured(recipes);const n=featured.length;
 const [active,setActive]=useState(0);const [playing,setPlaying]=useState(true);const [hovered,setHovered]=useState(false);
 const section=useRef<HTMLElement>(null);const stage=useRef<HTMLDivElement>(null);const copy=useRef<HTMLDivElement>(null);const geo=useRef<HTMLDivElement>(null);const first=useRef(true);
 const go=useCallback((to:number)=>{if(n)setActive(((to%n)+n)%n)},[n]);
 useEffect(()=>{setActive(a=>n?a%n:0)},[n]);

 useEffect(()=>{if(prefersReducedMotion())setPlaying(false)},[]);
 // Autoplay pauses on hover/focus, when the tab is hidden, or once the user takes control.
 useEffect(()=>{
  if(!playing||hovered||n<2)return;
  const id=window.setInterval(()=>{if(!document.hidden)setActive(a=>(a+1)%n)},AUTOPLAY_MS);
  return ()=>window.clearInterval(id);
 },[playing,hovered,n]);

 // One GSAP context for the component's lifetime: reverting per slide would snap plates back to their start.
 const ctx=useRef<gsap.Context|null>(null);
 useLayoutEffect(()=>{ctx.current=gsap.context(()=>{},section.current!);return ()=>{ctx.current?.revert();ctx.current=null}},[]);
 useLayoutEffect(()=>{
  if(!stage.current||!n||!ctx.current)return;
  const reduced=prefersReducedMotion();const instant=first.current||reduced;first.current=false;
  ctx.current.add(()=>{
   const plates=gsap.utils.toArray<HTMLElement>('.hero-plate');
   plates.forEach((plate,i)=>{
    const offset=(i-active+n)%n;
    const slot=SLOTS[offset]??EXIT;
    if(instant)gsap.set(plate,slot);
    else gsap.to(plate,{...slot,duration:1.15,ease:'power3.inOut',overwrite:'auto'});
   });
   // Text reveal is a CSS keyframe (restarted via key) so copy can never get stuck hidden.
   if(!instant){
    gsap.to(geo.current,{rotation:active%2?-14:-6,xPercent:active%2?4:0,duration:1.2,ease:'power2.inOut'});
    gsap.fromTo('.hero-ring',{scale:.85,opacity:.3},{scale:1,opacity:1,duration:1.2,ease:'expo.out'});
   }
  });
 },[active,n]);

 // Gentle idle float on the orbiting plates; skipped on reduced-motion and low-power devices.
 useEffect(()=>{
  if(!stage.current||prefersReducedMotion()||lowPower())return;
  const ctx=gsap.context(()=>{gsap.to('.hero-plate-float',{y:-10,duration:2.6,ease:'sine.inOut',yoyo:true,repeat:-1,stagger:{each:.6,from:'random'}})},stage.current);
  return ()=>ctx.revert();
 },[n]);

 if(!n)return <section ref={section} className="hero-carousel is-empty"><div className="container"><div className="hero-loading" role={error?'alert':'status'}><h1>{loading?'Loading featured recipes…':error?'Our recipe kitchen is temporarily unavailable':'Your recipe collection is empty'}</h1><p>{error||(!loading?'Add or publish recipes in the admin dashboard.':'')}</p>{error&&onRetry&&<button className="btn btn-dark" onClick={onRetry}>Retry loading recipes</button>}</div></div></section>;
 const r=featured[active%n];
 return <section ref={section} className="hero-carousel" aria-roledescription="carousel" aria-label="Featured recipes" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocus={()=>setHovered(true)} onBlur={()=>setHovered(false)}>
  <div className="hero-geo" ref={geo} aria-hidden="true"/><div className="hero-dots" aria-hidden="true"/>
  <div className="container hero-carousel-inner">
   <div className="hero-carousel-copy" ref={copy} key={active} aria-live={playing&&!hovered?'off':'polite'}>
    <div className="hero-mask"><span className="hero-reveal hero-kicker">FEATURED RECIPE · {String(active+1).padStart(2,'0')} / {String(n).padStart(2,'0')}</span></div>
    <h1 className="hero-mask"><span className="hero-reveal" key={r.id}>{r.name}</span></h1>
    <div className="hero-mask"><p className="hero-reveal">{r.description}</p></div>
    <div className="hero-mask"><div className="hero-reveal hero-meta"><span><Clock3 size={16}/> {r.prepMinutes+r.cookMinutes} min</span><span><ChefHat size={16}/> {r.difficulty}</span><span>{r.cuisine}</span></div></div>
    <div className="hero-mask"><div className="hero-reveal hero-ctas"><Link className="btn hero-btn-primary" href={`/recipe/${r.slug}`}>View recipe <ArrowRight size={17}/></Link><Link className="btn hero-btn-ghost" href={`/recipe/${r.slug}#cook-along`}><Volume2 size={17}/> Start cooking</Link></div></div>
    <div className="hero-nav">
     <button aria-label="Previous recipe" onClick={()=>{setPlaying(false);go(active-1)}}><ArrowLeft size={18}/></button>
     <div className="hero-indicators" role="tablist" aria-label="Choose featured recipe">{featured.map((f,i)=><button key={f.id} role="tab" aria-selected={i===active} aria-label={f.name} className={i===active?'active':''} onClick={()=>{setPlaying(false);go(i)}}><span style={{animationDuration:`${AUTOPLAY_MS}ms`,animationPlayState:playing&&!hovered?'running':'paused'}} key={`${i}-${active}`}/></button>)}</div>
     <button aria-label="Next recipe" onClick={()=>{setPlaying(false);go(active+1)}}><ArrowRight size={18}/></button>
     <button className="hero-pause" aria-label={playing?'Pause slideshow':'Play slideshow'} onClick={()=>setPlaying(p=>!p)}>{playing?<Pause size={15}/>:<Play size={15}/>}</button>
    </div>
   </div>
   <div className="hero-stage" ref={stage}>
    <div className="hero-ring" aria-hidden="true"/>
    {featured.map((f,i)=>{const offset=(i-active+n)%n;return <Link key={f.id} href={`/recipe/${f.slug}`} className="hero-plate" tabIndex={offset===0?0:-1} aria-hidden={offset!==0} aria-label={offset===0?`Open ${f.name}`:undefined} onClick={e=>{if(offset!==0){e.preventDefault();setPlaying(false);go(i)}}}>
     <span className={offset===0?'hero-plate-inner':'hero-plate-inner hero-plate-float'}><FoodImage src={f.imageUrl} alt={f.name} sizes="(max-width: 700px) 80vw, 520px" priority={i===0}/></span></Link>})}
    <div className="hero-badge" aria-hidden="true"><strong>{r.category==='Non-Vegetarian'?'Non-veg':'Veg'}</strong><span>{r.cuisine}</span></div>
   </div>
  </div>
 </section>
}
