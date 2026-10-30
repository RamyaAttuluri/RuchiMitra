'use client';

import {useEffect,useRef,useState} from 'react';import {LoaderCircle,Sparkles,Wand2} from 'lucide-react';
import {api} from '@/lib/api';import type {RecipeData} from '@/lib/types';

const IDEAS=['Aloo Fry','Chicken Fry','Gongura Pappu','Kadai Paneer','Pepper Chicken','Sambar'];

/** Type a dish name → Gemini writes the full recipe (ingredients, steps, timings, Telugu & Hindi) → saved as a draft and opened in the editor. */
export function AdminAiGenerator({geminiReady,onGenerated}:{geminiReady:boolean;onGenerated:(r:RecipeData,translated:string[])=>void}){
 const [name,setName]=useState('');const [category,setCategory]=useState('');const [cuisine,setCuisine]=useState('');const [servings,setServings]=useState(4);const [notes,setNotes]=useState('');
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [phase,setPhase]=useState('');const [jobId,setJobId]=useState('');const [partial,setPartial]=useState<RecipeData|null>(null);const [retryable,setRetryable]=useState(false);const generation=useRef(0);const mounted=useRef(true);const finished=useRef(false);
 useEffect(()=>{mounted.current=true;try{const saved=sessionStorage.getItem('admin-ai-job');if(saved){setJobId(saved);void watch(saved)}}catch{}return()=>{mounted.current=false;generation.current++}},[]);
 async function watch(id:string){
  const token=++generation.current;setBusy(true);setError('');setRetryable(false);finished.current=false;
  try{for(let n=0;n<600;n++){
   const d=await api<{job:{status:string;phase:string;error?:string};recipe?:RecipeData;translated?:string[]}>(`/admin/ai-jobs/${encodeURIComponent(id)}`);
   if(!mounted.current||token!==generation.current)return;setPhase(d.job.phase);if(d.recipe)setPartial(d.recipe);
   if(d.job.status==='SUCCEEDED'&&d.recipe){try{sessionStorage.removeItem('admin-ai-job')}catch{};finished.current=true;onGenerated(d.recipe,d.translated||[]);setName('');setNotes('');return}
   if(d.job.status==='FAILED'){setRetryable(true);throw Error((d.recipe?'Your draft is saved. ':'')+(d.job.error||'Generation failed')+' Use Retry to continue the remaining work.')}
   await new Promise(resolve=>setTimeout(resolve,2000));if(!mounted.current||token!==generation.current)return;
  }throw Error('Still processing on the server. Press Check progress to reconnect.');
  }catch(e){if(mounted.current&&token===generation.current)setError(e instanceof Error?e.message:'Could not check progress. Reconnect to the job.')}
  finally{if(mounted.current&&token===generation.current)setBusy(false)}
 }
 async function reconnect(){if(retryable)await api(`/admin/ai-jobs/${encodeURIComponent(jobId)}/retry`,{method:'POST'}).catch(e=>{setError(e.message);throw e});void watch(jobId)}

 async function generate(e:React.FormEvent){
  e.preventDefault();setError('');setBusy(true);
  try{
   const d=await api<{jobId:string}>('/admin/recipes/generate',{method:'POST',body:JSON.stringify({name:name.trim(),servings,...(category?{category}:{}),...(cuisine.trim()?{cuisine:cuisine.trim()}:{}),...(notes.trim()?{notes:notes.trim()}:{})})});
   setJobId(d.jobId);setPartial(null);try{sessionStorage.setItem('admin-ai-job',d.jobId)}catch{};await watch(d.jobId);
  }catch(err){setError(err instanceof Error?err.message:'Generation failed')}finally{setBusy(false)}
 }
 return <form className="adm-card adm-ai" onSubmit={generate}>
  <div className="adm-card-head"><div><h2><Wand2 size={20}/> Generate a recipe with AI</h2><p>Type any dish. AI writes the description, every ingredient with quantities, step-by-step method with timings, a tip, and Telugu &amp; Hindi translations. It is saved as a <b>draft</b> so you can review and publish.</p></div></div>
  {!geminiReady&&<p className="adm-alert" role="alert">Gemini is not configured. Add <code>GEMINI_API_KEY</code> to <code>backend\.env</code> (free key: aistudio.google.com/apikey) and restart the backend.</p>}
  {busy&&<p role="status">{phase||'Queuing recipe'}… You can leave this page and return; work is saved on the server.</p>}
  {jobId&&!busy&&!finished.current&&<div><button type="button" className="adm-btn adm-btn-soft" onClick={()=>reconnect().catch(()=>{})}>{retryable?'Retry remaining work':'Check progress'}</button>{partial&&<button type="button" className="adm-btn adm-btn-soft" onClick={()=>onGenerated(partial,Object.keys(partial.translations))}>Review saved draft</button>}</div>}
  {error&&<p className="adm-alert" role="alert">{error}</p>}
  <div className="adm-ai-row">
   <label className="adm-ai-name">Dish name<input required minLength={3} maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Aloo Fry" disabled={busy}/></label>
   <label>Category<select value={category} onChange={e=>setCategory(e.target.value)} disabled={busy}><option value="">Let AI decide</option><option>Vegetarian</option><option>Non-Vegetarian</option><option>Vegan</option></select></label>
   <label>Cuisine<input value={cuisine} maxLength={80} onChange={e=>setCuisine(e.target.value)} placeholder="e.g. Andhra" disabled={busy}/></label>
   <label>Servings<input type="number" min={1} max={20} value={servings} onChange={e=>setServings(Number(e.target.value)||4)} disabled={busy}/></label>
  </div>
  <label>Notes (optional)<input value={notes} maxLength={300} onChange={e=>setNotes(e.target.value)} placeholder="e.g. less spicy, no onion garlic, crispy" disabled={busy}/></label>
  <div className="adm-ai-ideas"><span>Try:</span>{IDEAS.map(i=><button type="button" key={i} className="adm-chip" disabled={busy} onClick={()=>setName(i)}>{i}</button>)}</div>
  <div className="adm-save-bar"><button className="adm-btn adm-btn-primary" disabled={busy||!geminiReady||name.trim().length<3}>{busy?<LoaderCircle className="spin" size={16}/>:<Sparkles size={16}/>} {busy?'Working… see progress above':'Generate recipe'}</button></div>
 </form>;
}
