'use client';

import {AnimatedVoiceFeatureSection} from '@/components/animated-voice-feature-section';
import Link from 'next/link';import { ArrowRight,Heart,Mic2,Play,Search } from 'lucide-react';
import {apiFetch,API_URL} from '@/lib/api';
import {useCallback,useEffect,useRef,useState} from 'react';import type {RecipeData} from '@/lib/types';import {RecipeGrid} from '@/components/recipe-grid';import {SearchBox} from '@/components/search-box';import {HeroCarousel} from '@/components/hero-carousel';import {useScrollReveal} from '@/lib/motion';
export default function Home(){
 const [recipes,setRecipes]=useState<RecipeData[]>([]);const [error,setError]=useState('');const [loading,setLoading]=useState(true);
 const load=useCallback(async(signal?:AbortSignal)=>{setLoading(true);setError('');try{const response=await apiFetch(`${API_URL}/recipes`,{signal});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not load recipes.');if(!Array.isArray(data.recipes))throw Error('The recipe service returned an unexpected response.');if(!signal?.aborted)setRecipes(data.recipes)}catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:'Could not reach the recipe service.')}finally{if(!signal?.aborted)setLoading(false)}},[]);
 useEffect(()=>{const controller=new AbortController();load(controller.signal);return()=>controller.abort()},[load]);
 const page=useRef<HTMLElement>(null);useScrollReveal(page,'.reveal-up',recipes.length);
 return <main ref={page}>
 <HeroCarousel recipes={recipes} loading={loading} error={error} onRetry={()=>load()}/>
 <section className="search-strip"><div className="container search-strip-inner"><div><span className="eyebrow"><span className="tiny-star">✳</span> YOUR KITCHEN, INSPIRED</span><h2>Every great meal starts with a <em>little inspiration.</em></h2></div><div><SearchBox hero/><div className="popular-search"><span>Popular right now</span>{['Chicken Curry','Paneer Butter Masala','Tomato Pappu'].map(x=><Link key={x} href={`/search?q=${encodeURIComponent(x)}`}>{x} <span>↗</span></Link>)}</div></div></div></section>
 <section className="value-strip"><div className="container value-inner"><div><span className="value-icon"><Search size={22}/></span><span><strong>Find it fast</strong><small>Search recipes in seconds</small></span></div><div><span className="value-icon"><Mic2 size={22}/></span><span><strong>Cook with a voice guide</strong><small>English, తెలుగు & हिन्दी</small></span></div><div><span className="value-icon"><Heart size={22}/></span><span><strong>Save your favourites</strong><small>All your recipes in one place</small></span></div></div></section>
 <section className="discovery container" id="discover"><div className="section-header"><div><span className="eyebrow"><span className="tiny-star">✳</span> MADE FOR YOUR TABLE</span><h2>What sounds good <em>today?</em></h2><p>Traditional comfort food, with a little room to explore.</p></div><Link className="simple-link" href="/search">Explore all recipes <ArrowRight size={18}/></Link></div>
 {error?<div className="inline-error" role="alert"><p>{error}</p><button className="btn btn-dark" onClick={()=>load()}>Retry recipes</button></div>:loading?<p role="status">Loading recipes…</p>:<RecipeGrid recipes={recipes}/>} </section>
 <AnimatedVoiceFeatureSection/>
 <section className="bottom-cta container reveal-up"><div><span className="eyebrow">A LITTLE MAGIC IN EVERY MEAL</span><h2>What&apos;s in your kitchen?</h2><p>Tell us which ingredients you have. We'll find something lovely to make.</p></div><Link className="btn btn-cream btn-large" href="/pantry">Explore my pantry <ArrowRight size={18}/></Link><div className="cta-flower">✳</div></section>
 </main>
}
