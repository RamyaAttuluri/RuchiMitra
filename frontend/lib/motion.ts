'use client';
import {useEffect,type RefObject} from 'react';
import gsap from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';

if(typeof window!=='undefined')gsap.registerPlugin(ScrollTrigger);
export {gsap,ScrollTrigger};

export const prefersReducedMotion=()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Few cores or data-saver: keep transitions but drop idle/looping animation.
export const lowPower=()=>typeof navigator!=='undefined'&&((navigator.hardwareConcurrency||8)<=4||Boolean((navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData));

/** Staggered rise of `selector` children as they scroll into view. Re-runs when `key` changes. */
export function useScrollReveal(ref:RefObject<HTMLElement|null>,selector:string,key:unknown){
 useEffect(()=>{
  const root=ref.current;if(!root||prefersReducedMotion())return;
  const ctx=gsap.context(()=>{
   const items=gsap.utils.toArray<HTMLElement>(selector);if(!items.length)return;
   // Essential content stays visible even if a scroll callback is delayed.
   gsap.set(items,{opacity:1,y:18});
   ScrollTrigger.batch(items,{start:'top 90%',once:true,onEnter:batch=>gsap.to(batch,{opacity:1,y:0,duration:.7,ease:'power3.out',stagger:.08,overwrite:true,clearProps:'transform'})});
  },root);
  return ()=>ctx.revert();
 },[ref,selector,key]);
}
