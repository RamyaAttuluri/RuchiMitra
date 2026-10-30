'use client';

import Link from 'next/link';import {useEffect,useRef,useState} from 'react';import {ArrowUpRight,ChefHat,Clock3,Flame,Leaf} from 'lucide-react';
import {apiFetch,API_URL} from '@/lib/api';import {useScrollReveal} from '@/lib/motion';import {FoodImage} from './food-image';

export type RelatedRecipe={id:string;slug:string;name:string;description:string;imageUrl:string;category:string;cuisine:string;difficulty:string;totalMinutes:number;primaryIngredient:string|null;reasons:string[]};

/** "You may also like": only published recipes the backend scores as genuinely related. Hidden when there are none. */
export function RelatedRecipes({slug}:{slug:string}){
 const [items,setItems]=useState<RelatedRecipe[]|null>(null);
 const grid=useRef<HTMLDivElement>(null);
 useEffect(()=>{let live=true;setItems(null);
  apiFetch(`${API_URL}/recipes/${encodeURIComponent(slug)}/related?limit=6`).then(r=>r.ok?r.json():{related:[]}).then(d=>{if(live)setItems(d.related||[])}).catch(()=>{if(live)setItems([])});
  return ()=>{live=false}},[slug]);
 useScrollReveal(grid,'.related-card',items?.map(i=>i.id).join());
 if(!items?.length)return null;
 return <section className="related-section" aria-labelledby="related-title">
  <div className="related-head"><span className="eyebrow">✳ PICKED FOR YOU</span><h2 id="related-title">You may also <em>like.</em></h2><p>More delicious recipes picked just for you.</p></div>
  <div className="related-grid" ref={grid}>{items.map(r=><Link key={r.id} href={`/recipe/${r.slug}`} className="related-card">
   <div className="related-image">{r.imageUrl?<FoodImage src={r.imageUrl} alt={r.name} sizes="(max-width: 640px) 85vw, (max-width: 1000px) 45vw, 300px"/>:<span className="related-placeholder">✳</span>}
    <span className="related-cat">{r.category==='Non-Vegetarian'?<Flame size={12}/>:<Leaf size={12}/>} {r.category}</span></div>
   <div className="related-body">{r.reasons[0]&&<span className="related-reason">{r.reasons[0]}</span>}<h3>{r.name}</h3><p>{r.description}</p>
    <div className="related-meta"><span><Clock3 size={14}/> {r.totalMinutes} min</span><span><ChefHat size={14}/> {r.difficulty}</span><span className="related-go">View recipe <ArrowUpRight size={14}/></span></div></div>
  </Link>)}</div>
 </section>;
}
