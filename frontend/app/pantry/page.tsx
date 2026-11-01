'use client';
import {apiFetch,API_URL} from '@/lib/api';
import Link from 'next/link';import {useEffect,useState,useRef} from 'react';import {ArrowRight,Check,Clock3,Lightbulb,LoaderCircle,Plus,Search,X} from 'lucide-react';
import type {RecipeData} from '@/lib/types';import {FoodImage} from '@/components/food-image';
type Match={recipe:RecipeData;required:string[];matched:string[];missing:string[];matchedCount:number;requiredCount:number};
const STORE='ruchimitra-pantry';
const STAPLES='salt, water, oil and turmeric';
// Kept for this tab only so going back from a recipe doesn't wipe the pantry.
const load=()=>{try{return JSON.parse(sessionStorage.getItem(STORE)||'null')}catch{return null}};
const save=(v:unknown)=>{try{sessionStorage.setItem(STORE,JSON.stringify(v))}catch{}};

export default function Pantry(){
 const request=useRef(0);const requestAbort=useRef<AbortController|null>(null);const [aiBusy,setAiBusy]=useState(false);const [notice,setNotice]=useState('');
 const [value,setValue]=useState('');const [ingredients,setIngredients]=useState<string[]>([]);
 const [includeStaples,setIncludeStaples]=useState(false);const [showNear,setShowNear]=useState(true);
 const [matches,setMatches]=useState<Match[]>([]);const [near,setNear]=useState<Match[]>([]);
 const [searched,setSearched]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [ready,setReady]=useState(false);
 useEffect(()=>{const s=load();if(s){setIngredients(s.ingredients||[]);setIncludeStaples(Boolean(s.includeStaples));setShowNear(s.showNear!==false);if(s.ingredients?.length)find(s.ingredients,Boolean(s.includeStaples),s.showNear!==false,false)}setReady(true);return()=>{requestAbort.current?.abort();request.current++}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{if(ready)save({ingredients,includeStaples,showNear})},[ready,ingredients,includeStaples,showNear]);
 function add(){
  const items=value.split(',').map(v=>v.trim().slice(0,50)).filter(Boolean);
  setIngredients(list=>{const next=[...list];for(const item of items)if(!next.some(i=>i.toLowerCase()===item.toLowerCase())&&next.length<30)next.push(item);return next});
  setValue('');requestAbort.current?.abort();request.current++;setBusy(false);setAiBusy(false);setNotice('');setError('');setSearched(false);
 }
 async function find(list=ingredients,staples=includeStaples,nearOn=showNear,autoCreate=true){
  if(!list.length)return;
  requestAbort.current?.abort();const abort=new AbortController();requestAbort.current=abort;
  const token=++request.current;setBusy(true);setError('');setNotice('');
  try{
   const res=await apiFetch(`${API_URL}/recipes/pantry`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ingredients:list,strict:true,includeStaples:staples,includeNearMatches:nearOn}),signal:abort.signal});
   const data=await res.json();if(!res.ok)throw Error(data.error||'Could not search');
   if(token!==request.current)return;setMatches(data.matches);setNear(data.nearMatches);setSearched(true);
   if(autoCreate&&!data.matches.length&&data.aiAvailable){
    setAiBusy(true);
    const created=await apiFetch(`${API_URL}/recipes/pantry/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ingredients:list,includeStaples:staples}),signal:abort.signal},370000);
    const generated=await created.json();if(!created.ok)throw Error(generated.error||'AI pantry suggestions are unavailable.');if(token!==request.current)return;
    const refreshed=await apiFetch(`${API_URL}/recipes/pantry`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ingredients:list,strict:true,includeStaples:staples,includeNearMatches:nearOn}),signal:abort.signal});
    const updated=await refreshed.json();if(!refreshed.ok)throw Error(updated.error||'Could not refresh pantry suggestions.');if(token!==request.current)return;
    setMatches(updated.matches);setNear(updated.nearMatches);setNotice('AI suggested a dish using only your listed ingredients. Review the recipe before cooking.');
   }
  }catch(e){if(token===request.current)setError(e instanceof Error?e.message:'Could not connect. Please try again.')}finally{if(token===request.current){setBusy(false);setAiBusy(false)}}
 }
 async function create(){
  requestAbort.current?.abort();const abort=new AbortController();requestAbort.current=abort;
  const list=[...ingredients],staples=includeStaples;const token=++request.current;
  setAiBusy(true);setError('');setNotice('');
  try{const response=await apiFetch(`${API_URL}/recipes/pantry/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ingredients:list,includeStaples:staples}),signal:abort.signal},370000);const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'Could not create a pantry recipe');if(token!==request.current)return;await find(list,staples,showNear,false);if(request.current===token+1)setNotice('AI suggested a dish using only your listed ingredients. Review the recipe before cooking.');}
  catch(e){if(token===request.current)setError(e instanceof Error?e.message:'Could not create a pantry recipe')}finally{if(token===request.current)setAiBusy(false)}
 }
 return <main className="container subpage pantry-page"><div className="page-header"><span className="eyebrow"><span className="tiny-star">✳</span> A LITTLE KITCHEN MAGIC</span><h1>Cook with what <em>you&apos;ve got.</em></h1><p>Add every ingredient you have. We only show a recipe as ready to cook when you have <b>all</b> of its ingredients.</p></div>
 <div className="pantry-box"><div className="pantry-title"><span className="pantry-illustration">🥬</span><div><h2>What&apos;s in your pantry?</h2><p>Type an ingredient and press Enter. Separate several with commas.</p></div></div>
  <form className="pantry-input" onSubmit={e=>{e.preventDefault();add()}}><input aria-label="Ingredient to add" placeholder="e.g. onion, tomato, toor dal…" value={value} onChange={e=>setValue(e.target.value)} maxLength={200}/><button className="btn btn-dark" type="submit"><Plus size={18}/> Add</button></form>
  <div className="pantry-chips" aria-live="polite">{ingredients.map(x=><span key={x}>{x}<button aria-label={`Remove ${x}`} onClick={()=>{setIngredients(v=>v.filter(i=>i!==x));requestAbort.current?.abort();request.current++;setBusy(false);setAiBusy(false);setNotice('');setError('');setSearched(false)}}><X size={14}/></button></span>)}{!ingredients.length&&<small className="pantry-empty-chips">No ingredients yet.</small>}</div>
  <div className="pantry-options">
   <label><input type="checkbox" checked={includeStaples} onChange={e=>{setIncludeStaples(e.target.checked);requestAbort.current?.abort();request.current++;setBusy(false);setAiBusy(false);setNotice('');setError('');setSearched(false)}}/> Include pantry staples I already have <small>({STAPLES})</small></label>
   <label><input type="checkbox" checked={showNear} onChange={e=>{setShowNear(e.target.checked);requestAbort.current?.abort();request.current++;setBusy(false);setAiBusy(false);setNotice('');setError('');setSearched(false)}}/> Also show recipes missing a few ingredients</label>
  </div>
  <button className="btn btn-dark pantry-find" onClick={()=>find()} disabled={busy||aiBusy||!ingredients.length}>{busy?<LoaderCircle className="spin" size={18}/>:<Search size={18}/>}{aiBusy?'Creating a pantry recipe…':busy?'Checking recipes…':'Find recipes I can make'}<ArrowRight size={18}/></button>
  <p className="pantry-note"><Lightbulb size={16}/> Strict matching: salt, oil and spices count as ingredients too, unless you include staples.</p>{error&&<p className="inline-error" role="alert">{error}</p>}
 </div>
 {searched&&<div className="generate-banner"><div><h3>More ideas with your ingredients</h3><p>Create a recipe beyond the collection. Only ingredients you listed, plus staples you selected, are allowed. Matching checks names, so check that you have enough of each item.</p>{notice&&<p role="status">{notice}</p>}</div><button className="btn btn-dark" disabled={busy||aiBusy||!ingredients.length} onClick={create}>{aiBusy?'Creating a pantry recipe…':'Create a pantry recipe with AI'}</button></div>}
 {searched&&<section className="pantry-results" aria-live="polite">
  <div className="section-header"><div><span className="eyebrow">READY TO COOK</span><h2>Recipes you can <em>make.</em></h2></div></div>
  {matches.length?<div className="pantry-grid">{matches.map(m=><PantryCard key={m.recipe.id} m={m} ready/>)}</div>
   :<div className="empty-state"><h2>Let’s try a simple dish</h2><p>The collection has no complete match for your pantry yet. Use the AI button below to suggest a dish with only these ingredients. You can also add more ingredients{showNear?' or check the recipes below that need a few extra items':' or turn on recipes missing a few ingredients'}.</p></div>}
  {showNear&&near.length>0&&<><div className="section-header pantry-near-head"><div><span className="eyebrow">ALMOST THERE</span><h2>Missing a few <em>ingredients.</em></h2><p>Not ready to cook yet: you&apos;d need to buy what&apos;s listed.</p></div></div>
   <div className="pantry-grid">{near.map(m=><PantryCard key={m.recipe.id} m={m}/>)}</div></>}
 </section>}
 </main>
}

function PantryCard({m,ready=false}:{m:Match;ready?:boolean}){
 const r=m.recipe;
 return <Link href={`/recipe/${r.slug}`} className={`pantry-card ${ready?'is-ready':''}`}>
  <div className="pantry-card-img">{r.imageUrl?<FoodImage src={r.imageUrl} alt={r.name} sizes="(max-width: 700px) 100vw, 360px"/>:<span>✳</span>}
   <span className={`pantry-badge ${ready?'ok':'warn'}`}>{ready?<><Check size={13}/> Ready to cook</>:`Missing ${m.missing.length}`}</span></div>
  <div className="pantry-card-body"><h3>{r.name}</h3><div className="pantry-card-meta"><span><Clock3 size={14}/> {r.prepMinutes+r.cookMinutes} min</span><span>{m.matchedCount} of {m.requiredCount} ingredients matched</span></div>
   {!ready&&<p className="pantry-missing"><b>Missing:</b> {m.missing.join(', ')}</p>}
   <p className="pantry-required"><b>Needs:</b> {m.required.join(', ')}</p>
   <span className="pantry-view">View recipe <ArrowRight size={14}/></span></div>
 </Link>;
}
