'use client';

import Link from 'next/link';import {useCallback,useEffect,useRef,useState} from 'react';
import {Eye,LoaderCircle,Pencil,RotateCcw,Search,Sparkles,Trash2} from 'lucide-react';
import type {RecipeData} from '@/lib/types';import {api,imageSrc} from '@/lib/api';

type Filters={q:string;category:string;cuisine:string;status:string;sort:string;page:number};
const initial:Filters={q:'',category:'',cuisine:'',status:'',sort:'newest',page:1};
const PAGE_SIZE=10;

export function AdminRecipesTable({source,cuisines,onEdit,refreshKey,onChanged,flash}:{source?:'AI';cuisines:string[];onEdit:(id:string)=>void;refreshKey:number;onChanged:()=>void;flash:(m:string)=>void}){
 const [filters,setFilters]=useState(initial);const [query,setQuery]=useState('');
 const [rows,setRows]=useState<RecipeData[]>([]);const [total,setTotal]=useState(0);
 const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 const [selected,setSelected]=useState<string[]>([]);const [busy,setBusy]=useState(false);
 const [confirming,setConfirming]=useState<RecipeData[]|null>(null);
 const loadRequest=useRef(0);
 const dialog=useRef<HTMLDialogElement>(null);

 const load=useCallback(async()=>{
  const token=++loadRequest.current;setLoading(true);setError('');
  const params=new URLSearchParams({sort:filters.sort,page:String(filters.page),pageSize:String(PAGE_SIZE)});
  for(const k of ['q','category','cuisine','status'] as const)if(filters[k])params.set(k,filters[k]);
  if(source)params.set('source',source);
  try{const d=await api<{recipes:RecipeData[];total:number}>(`/admin/recipes?${params}`);if(token!==loadRequest.current)return;const lastPage=Math.max(1,Math.ceil(d.total/PAGE_SIZE));if(filters.page>lastPage){setFilters(f=>({...f,page:lastPage}));return}setRows(d.recipes);setTotal(d.total);setSelected([])}
  catch(e){if(token===loadRequest.current)setError(e instanceof Error?e.message:'Could not load recipes')}finally{if(token===loadRequest.current)setLoading(false)}
 },[filters,source]);
 useEffect(()=>{load()},[load,refreshKey]);
 // Debounced name search.
 useEffect(()=>{const id=window.setTimeout(()=>setFilters(f=>f.q===query.trim()?f:{...f,q:query.trim(),page:1}),300);return ()=>window.clearTimeout(id)},[query]);
 useEffect(()=>{if(confirming)dialog.current?.showModal();else dialog.current?.close()},[confirming]);

 const set=(patch:Partial<Filters>)=>setFilters(f=>({...f,page:1,...patch}));
 const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
 const allOnPage=rows.length>0&&rows.every(r=>selected.includes(r.id));

 async function archive(list:RecipeData[]){
  setBusy(true);setError('');
  try{
   if(list.length===1)await api(`/admin/recipes/${list[0].id}`,{method:'DELETE'});
   else await api('/admin/recipes/bulk',{method:'POST',body:JSON.stringify({ids:list.map(r=>r.id),action:'archive'})});
   flash(list.length===1?`“${list[0].name}” was deleted. It is no longer visible to users and can be restored from the Archived filter.`:`${list.length} recipes deleted.`);
   setConfirming(null);await load();onChanged();
  }catch(e){setError(e instanceof Error?e.message:'Delete failed')}finally{setBusy(false)}
 }
 async function bulk(action:'publish'|'draft'){
  setBusy(true);setError('');
  try{const d=await api<{count:number}>('/admin/recipes/bulk',{method:'POST',body:JSON.stringify({ids:selected,action})});flash(`${d.count} recipe${d.count===1?'':'s'} ${action==='publish'?'published':'moved to drafts'}.`);await load();onChanged()}
  catch(e){setError(e instanceof Error?e.message:'Update failed')}finally{setBusy(false)}
 }
 async function restore(r:RecipeData){
  setBusy(true);
  try{await api(`/admin/recipes/${r.id}/restore`,{method:'POST'});flash(`“${r.name}” restored as a draft. Publish it to show it to users again.`);await load();onChanged()}
  catch(e){setError(e instanceof Error?e.message:'Restore failed')}finally{setBusy(false)}
 }

 return <div className="adm-card">
  <div className="adm-toolbar">
   <label className="adm-search"><Search size={16}/><input aria-label="Search recipes by name" placeholder="Search recipes by name…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <select aria-label="Filter by category" value={filters.category} onChange={e=>set({category:e.target.value})}><option value="">All categories</option><option>Vegetarian</option><option>Non-Vegetarian</option><option>Vegan</option></select>
   <select aria-label="Filter by cuisine" value={filters.cuisine} onChange={e=>set({cuisine:e.target.value})}><option value="">All cuisines</option>{cuisines.map(c=><option key={c}>{c}</option>)}</select>
   <select aria-label="Filter by status" value={filters.status} onChange={e=>set({status:e.target.value})}><option value="">Published &amp; drafts</option><option value="PUBLISHED">Published</option><option value="DRAFT">Drafts</option><option value="ARCHIVED">Archived (deleted)</option></select>
   <select aria-label="Sort" value={filters.sort} onChange={e=>set({sort:e.target.value})}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option></select>
  </div>
  {selected.length>0&&<div className="adm-bulkbar" role="region" aria-label="Bulk actions"><strong>{selected.length} selected</strong><button className="adm-btn adm-btn-soft" disabled={busy} onClick={()=>bulk('publish')}>Publish</button><button className="adm-btn adm-btn-soft" disabled={busy} onClick={()=>bulk('draft')}>Move to drafts</button><button className="adm-btn adm-btn-danger" disabled={busy} onClick={()=>setConfirming(rows.filter(r=>selected.includes(r.id)))}><Trash2 size={15}/> Delete</button><button className="adm-link" onClick={()=>setSelected([])}>Clear</button></div>}
  {error&&<p className="adm-alert" role="alert">{error}</p>}
  <div className="adm-table-wrap"><table className="adm-table">
   <thead><tr><th><input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={e=>setSelected(e.target.checked?rows.filter(r=>r.status!=='ARCHIVED').map(r=>r.id):[])}/></th><th>Recipe</th><th>Category</th><th>Cuisine</th><th>Time</th><th>Serves</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
   <tbody>{loading&&!rows.length?<tr><td colSpan={8} className="adm-empty"><LoaderCircle className="spin" size={18}/> Loading recipes…</td></tr>
    :!rows.length?<tr><td colSpan={8} className="adm-empty">No recipes match these filters.</td></tr>
    :rows.map(r=><tr key={r.id} className={selected.includes(r.id)?'is-selected':''}>
     <td data-label="Select"><input type="checkbox" aria-label={`Select ${r.name}`} disabled={r.status==='ARCHIVED'} checked={selected.includes(r.id)} onChange={e=>setSelected(s=>e.target.checked?[...s,r.id]:s.filter(x=>x!==r.id))}/></td>
     <td data-label="Recipe"><div className="adm-recipe-cell"><span className="adm-thumb">{r.imageUrl?<img src={imageSrc(r.imageUrl)} alt="" loading="lazy"/>:<span>✳</span>}</span><span><strong>{r.name}</strong><small>{r.source==='AI'?<><Sparkles size={11}/> AI-generated</>:'Curated'} · {r.difficulty}</small></span></div></td>
     <td data-label="Category"><span className={`adm-pill ${r.category==='Non-Vegetarian'?'is-nonveg':'is-veg'}`}>{r.category==='Non-Vegetarian'?'Non-Veg':r.category==='Vegan'?'Vegan':'Veg'}</span></td>
     <td data-label="Cuisine">{r.cuisine}</td>
     <td data-label="Time">{r.prepMinutes+r.cookMinutes} min</td>
     <td data-label="Serves">{r.servings}</td>
     <td data-label="Status"><span className={`adm-status is-${(r.status||'PUBLISHED').toLowerCase()}`}>{r.status==='ARCHIVED'?'Archived':r.status==='DRAFT'?'Draft':'Published'}</span></td>
     <td data-label="Actions"><div className="adm-actions">
      {r.status!=='ARCHIVED'&&<Link className="adm-icon-btn" href={`/recipe/${r.slug}`} target="_blank" title={`View ${r.name}`} aria-label={`View ${r.name}`}><Eye size={16}/></Link>}
      {r.status!=='ARCHIVED'&&<button className="adm-icon-btn" title={`Edit ${r.name}`} aria-label={`Edit ${r.name}`} onClick={()=>onEdit(r.id)}><Pencil size={16}/></button>}
      {r.status==='ARCHIVED'?<button className="adm-icon-btn" disabled={busy} title={`Restore ${r.name}`} aria-label={`Restore ${r.name}`} onClick={()=>restore(r)}><RotateCcw size={16}/></button>
       :<button className="adm-icon-btn danger" disabled={busy} title={`Delete ${r.name}`} aria-label={`Delete ${r.name}`} onClick={()=>setConfirming([r])}><Trash2 size={16}/></button>}
     </div></td>
    </tr>)}</tbody>
  </table></div>
  <div className="adm-pager"><span>{total} recipe{total===1?'':'s'} · page {filters.page} of {pages}</span><div><button className="adm-btn adm-btn-ghost" disabled={filters.page<=1||loading} onClick={()=>setFilters(f=>({...f,page:f.page-1}))}>Previous</button><button className="adm-btn adm-btn-ghost" disabled={filters.page>=pages||loading} onClick={()=>setFilters(f=>({...f,page:f.page+1}))}>Next</button></div></div>

  <dialog ref={dialog} className="adm-dialog" onClose={()=>setConfirming(null)} aria-labelledby="delete-title">
   {confirming&&<form method="dialog" onSubmit={e=>{e.preventDefault();archive(confirming)}}>
    <h3 id="delete-title">Delete {confirming.length===1?`“${confirming[0].name}”`:`${confirming.length} recipes`}?</h3>
    <p>{confirming.length===1?'This recipe':'These recipes'} will disappear from search, listings and users’ favourites right away. Saved favourites are kept, so you can restore {confirming.length===1?'it':'them'} later from the <b>Archived</b> filter. Shopping-list items users already added are not affected.</p>
    {confirming.length>1&&<ul>{confirming.map(r=><li key={r.id}>{r.name}</li>)}</ul>}
    <div className="adm-dialog-actions"><button type="button" className="adm-btn adm-btn-ghost" onClick={()=>setConfirming(null)} autoFocus>Cancel</button><button type="submit" className="adm-btn adm-btn-danger" disabled={busy}>{busy?<LoaderCircle className="spin" size={15}/>:<Trash2 size={15}/>} Yes, delete</button></div>
   </form>}
  </dialog>
 </div>;
}
