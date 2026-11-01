'use client';
import Link from 'next/link';
import {useEffect,useRef} from 'react';
import {ArrowUpRight,Check} from 'lucide-react';
import {gsap} from '@/lib/motion';
import {VoiceMotionStage} from './voice-motion-stage';
export function AnimatedVoiceFeatureSection(){
 const section=useRef<HTMLElement>(null);
 useEffect(()=>{
  const root=section.current;if(!root)return;
  const media=gsap.matchMedia();
  media.add({all:'all',desktop:'(min-width: 1000px)',reduce:'(prefers-reduced-motion: reduce)'},context=>{
   if(context.conditions?.reduce)return;
   const scope=gsap.context(()=>{
    const desktop=context.conditions?.desktop,distance=desktop?36:18;
    gsap.timeline({scrollTrigger:{trigger:root,start:'top 82%',toggleActions:'play none none reverse'},defaults:{ease:'power3.out'}})
     .fromTo('.cinema-eyebrow',{y:distance},{y:0,duration:.8},0)
     .fromTo('.cinema-word',{y:12,rotation:2},{y:0,rotation:0,stagger:.09,duration:.9,clearProps:'transform'},.1)
     .fromTo('.cinema-accent-rule',{scaleX:.15},{scaleX:1,duration:1.2},.65);
   },root);
   return()=>scope.revert();
  },root);
  return()=>media.revert();
 },[]);
 return <section ref={section} className="voice-cinema" aria-labelledby="cinema-title">
  <div className="container cinema-layout">
   <VoiceMotionStage/>
   <div className="cinema-copy"><span className="eyebrow cinema-eyebrow">MEET YOUR SOUS-CHEF</span>
    <h2 id="cinema-title"><span className="sr-only">A recipe that talks you through it.</span><span aria-hidden="true"><span className="cinema-line">{['A','recipe','that'].map(word=><span className="cinema-mask" key={word}><span className="cinema-word">{word}</span></span>)}</span><em className="cinema-accent">{['talks','you','through','it.'].map(word=><span className="cinema-mask" key={word}><span className="cinema-word">{word}</span></span>)}<span className="cinema-accent-rule"/></em></span></h2>
    <div className="cinema-wave" aria-hidden="true">{Array.from({length:23},(_,i)=><i key={i} style={{height:`${Math.round(8+Math.sin(i*.82)**2*21)}px`}}/>)}<span>GOOD FOOD HAS A VOICE.</span></div>
    <p className="cinema-support">Chopping onions? Hands covered in flour? Just press play. Your kitchen companion reads every step aloud, in the language you love.</p>
    <ul className="cinema-benefits">{['Listen in English, Telugu or Hindi','Pause, replay and skip any step','Follow each step at your own pace'].map(text=><li key={text}><Check size={15} aria-hidden="true"/>{text}</li>)}</ul>
    <Link className="btn btn-dark btn-large cinema-link" href="/recipe/andhra-chicken-curry">Try voice cooking <ArrowUpRight size={20}/></Link>
   </div>
  </div><span className="cinema-background-word" aria-hidden="true">listen.</span>
 </section>;
}
