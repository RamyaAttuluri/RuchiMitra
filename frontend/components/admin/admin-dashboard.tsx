'use client';

import Link from 'next/link';import {useCallback,useEffect,useState} from 'react';
import {BookOpen,ChefHat,CircleCheck,CircleX,FilePen,Flame,LayoutDashboard,Leaf,Plus,Settings,Sparkles,Tags,Users,LoaderCircle,ExternalLink} from 'lucide-react';
import {api} from '@/lib/api';import type {RecipeData} from '@/lib/types';
import {AdminRecipesTable} from './admin-recipes-table';import {AdminRecipeEditor} from './admin-recipe-editor';import {AdminAiGenerator} from './admin-ai-generator';

export type AdminUser={id:string;name:string;email:string;role:string;createdAt:string;_count?:{favorites:number}};
type Stats={total:number;vegetarian:number;vegan:number;nonVegetarian:number;published:number;drafts:number;archived:number;ai:number;users:number;admins:number};
type Count={name:string;count:number};
type Section='overview'|'recipes'|'add'|'categories'|'users'|'ai'|'settings';
const NAV:{id:Section;label:string;icon:typeof BookOpen}[]=[
 {id:'overview',label:'Overview',icon:LayoutDashboard},{id:'recipes',label:'All recipes',icon:BookOpen},{id:'add',label:'Add recipe',icon:Plus},
 {id:'categories',label:'Categories',icon:Tags},{id:'users',label:'Users',icon:Users},{id:'ai',label:'AI-generated',icon:Sparkles},{id:'settings',label:'Settings',icon:Settings},
];

export function AdminDashboard({me}:{me:AdminUser}){
 const [section,setSection]=useState<Section>('overview');
 const [editing,setEditing]=useState<string|null>(null);
 const [stats,setStats]=useState<{stats:Stats;cuisines:Count[];categories:Count[]}|null>(null);
 const [statsError,setStatsError]=useState('');
 const [refreshKey,setRefreshKey]=useState(0);
 const [flashMessage,setFlash]=useState('');
 const [geminiReady,setGeminiReady]=useState(true);
 useEffect(()=>{api<{settings:{gemini:boolean}}>('/admin/settings').then(d=>setGeminiReady(d.settings.gemini)).catch(()=>{})},[]);
 const loadStats=useCallback(()=>{api<{stats:Stats;cuisines:Count[];categories:Count[]}>('/admin/stats').then(d=>{setStats(d);setStatsError('')}).catch(e=>setStatsError(e.message))},[]);
 useEffect(()=>{loadStats()},[loadStats,refreshKey]);
 useEffect(()=>{const s=window.location.hash.slice(1) as Section;if(NAV.some(n=>n.id===s))setSection(s)},[]);
 useEffect(()=>{if(!flashMessage)return;const id=window.setTimeout(()=>setFlash(''),6000);return ()=>window.clearTimeout(id)},[flashMessage]);
 const go=(s:Section)=>{setSection(s);setEditing(null);history.replaceState(null,'',`#${s}`);window.scrollTo({top:0,behavior:'smooth'})};
 const changed=()=>setRefreshKey(k=>k+1);
 const cuisines=stats?.cuisines.map(c=>c.name)??[];
 const editor=(id:string|null)=><AdminRecipeEditor key={id??'new'} recipeId={id} onClose={()=>{setEditing(null);if(section==='add')go('recipes')}} onSaved={(r,created)=>{setFlash(`“${r.name}” ${created?'created':'saved'}${r.status==='PUBLISHED'?' and is live for users.':' as a draft (hidden from users).'}`);setEditing(null);changed();go('recipes')}}/>;

 return <div className="adm-shell">
  <aside className="adm-sidebar" aria-label="Admin navigation">
   <div className="adm-brand"><span>✳</span><div><strong>RuchiMitra</strong><small>Kitchen admin</small></div></div>
   <nav>{NAV.map(({id,label,icon:Icon})=><button key={id} className={section===id?'active':''} aria-current={section===id?'page':undefined} onClick={()=>go(id)}><Icon size={18}/> <span>{label}</span>{id==='recipes'&&stats&&<em>{stats.stats.total}</em>}{id==='ai'&&stats&&<em>{stats.stats.ai}</em>}</button>)}</nav>
   <div className="adm-me"><span>{me.name.slice(0,1).toUpperCase()}</span><div><strong>{me.name}</strong><small>{me.email}</small></div></div>
   <Link className="adm-back" href="/">← Back to website</Link>
  </aside>
  <main className="adm-main">
   <header className="adm-header"><div><span className="adm-eyebrow">RESTRICTED · ADMINISTRATION</span><h1>{NAV.find(n=>n.id===section)?.label}</h1></div>
    {section!=='add'&&<button className="adm-btn adm-btn-primary" onClick={()=>go('add')}><Plus size={16}/> Add recipe</button>}</header>
   {flashMessage&&<p className="adm-flash" role="status">{flashMessage}</p>}
   {section==='overview'&&<Overview data={stats} error={statsError} onGo={go}/>}
   {(section==='recipes'||section==='ai')&&(editing?editor(editing):<>
    {section==='ai'&&<AdminAiGenerator geminiReady={geminiReady} onGenerated={(r,t)=>{setFlash(`“${r.name}” generated as a draft${t.includes('te')&&t.includes('hi')?' with Telugu & Hindi':t.length?' with '+t.map(l=>l==='te'?'Telugu':'Hindi').join(' & '):''}. Review it below, set Status to Published and save.`);changed();setEditing(r.id)}}/>}
    {section==='ai'&&<p className="adm-hint">All AI recipes, from this generator and from users’ “Create with AI” search. Review ingredients and food-safety steps before publishing.</p>}
    <AdminRecipesTable key={section} source={section==='ai'?'AI':undefined} cuisines={cuisines} onEdit={setEditing} refreshKey={refreshKey} onChanged={changed} flash={setFlash}/></>)}
   {section==='add'&&editor(null)}
   {section==='categories'&&<Categories data={stats} onRenamed={(m)=>{setFlash(m);changed()}}/>}
   {section==='users'&&<UsersPanel me={me}/>}
   {section==='settings'&&<SettingsPanel/>}
  </main>
 </div>;
}

function Overview({data,error,onGo}:{data:{stats:Stats;categories:Count[];cuisines:Count[]}|null;error:string;onGo:(s:Section)=>void}){
 const [recent,setRecent]=useState<RecipeData[]>([]);
 useEffect(()=>{api<{recipes:RecipeData[]}>('/admin/recipes?sort=newest&pageSize=5').then(d=>setRecent(d.recipes)).catch(()=>{})},[]);
 if(error)return <p className="adm-alert" role="alert">{error}</p>;
 if(!data)return <div className="adm-card adm-loading"><LoaderCircle className="spin" size={18}/> Loading statistics…</div>;
 const s=data.stats;
 const cards=[
  {label:'Total recipes',value:s.total,icon:BookOpen,hint:'Published + drafts'},{label:'Vegetarian',value:s.vegetarian+s.vegan,icon:Leaf,hint:s.vegan?`incl. ${s.vegan} vegan`:'Veg & vegan'},
  {label:'Non-vegetarian',value:s.nonVegetarian,icon:Flame,hint:'Meat, fish & egg'},{label:'Published',value:s.published,icon:CircleCheck,hint:'Visible to users'},
  {label:'Drafts',value:s.drafts,icon:FilePen,hint:s.archived?`${s.archived} archived`:'Hidden from users'},{label:'Registered users',value:s.users,icon:Users,hint:`${s.admins} admin${s.admins===1?'':'s'}`},
  {label:'AI-generated',value:s.ai,icon:Sparkles,hint:'Created with Gemini'},
 ];
 const max=Math.max(1,...data.cuisines.map(c=>c.count));
 return <>
  <div className="adm-stats">{cards.map(({label,value,icon:Icon,hint})=><div className="adm-stat" key={label}><span className="adm-stat-icon"><Icon size={19}/></span><strong>{value}</strong><span>{label}</span><small>{hint}</small></div>)}</div>
  <div className="adm-grid-2">
   <section className="adm-card"><div className="adm-card-head"><h2>Recipes by cuisine</h2></div>
    <ul className="adm-bars">{data.cuisines.map(c=><li key={c.name}><span>{c.name}</span><div><i style={{width:`${c.count/max*100}%`}}/></div><b>{c.count}</b></li>)}</ul></section>
   <section className="adm-card"><div className="adm-card-head"><h2>Recently added</h2><button className="adm-link" onClick={()=>onGo('recipes')}>View all →</button></div>
    <ul className="adm-recent">{recent.map(r=><li key={r.id}><ChefHat size={16}/><span><strong>{r.name}</strong><small>{r.cuisine} · {r.category}</small></span><span className={`adm-status is-${(r.status||'PUBLISHED').toLowerCase()}`}>{r.status==='DRAFT'?'Draft':'Published'}</span></li>)}</ul></section>
  </div>
 </>;
}

function Categories({data,onRenamed}:{data:{categories:Count[];cuisines:Count[]}|null;onRenamed:(m:string)=>void}){
 const [renaming,setRenaming]=useState<string|null>(null);const [value,setValue]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 if(!data)return <div className="adm-card adm-loading"><LoaderCircle className="spin" size={18}/> Loading…</div>;
 const counts=Object.fromEntries(data.categories.map(c=>[c.name,c.count]));
 async function rename(from:string){setBusy(true);setError('');try{const d=await api<{count:number}>('/admin/cuisines',{method:'PATCH',body:JSON.stringify({from,to:value})});onRenamed(`Renamed cuisine “${from}” to “${value}” on ${d.count} recipe${d.count===1?'':'s'}.`);setRenaming(null)}catch(e){setError(e instanceof Error?e.message:'Rename failed')}finally{setBusy(false)}}
 return <div className="adm-grid-2">
  <section className="adm-card"><div className="adm-card-head"><div><h2>Diet categories</h2><p>Fixed categories used by the site’s filters. Assign them per recipe in the editor.</p></div></div>
   <ul className="adm-list">{['Vegetarian','Vegan','Non-Vegetarian'].map(c=><li key={c}><span className={`adm-pill ${c==='Non-Vegetarian'?'is-nonveg':'is-veg'}`}>{c}</span><b>{counts[c]??0} recipes</b></li>)}</ul></section>
  <section className="adm-card"><div className="adm-card-head"><div><h2>Cuisines</h2><p>Rename a cuisine to merge spellings (e.g. “Andhra” and “andhra”).</p></div></div>
   {error&&<p className="adm-alert" role="alert">{error}</p>}
   <ul className="adm-list">{data.cuisines.map(c=><li key={c.name}>{renaming===c.name?<form className="adm-inline-form" onSubmit={e=>{e.preventDefault();if(value.trim())rename(c.name)}}><input autoFocus aria-label={`New name for ${c.name}`} value={value} maxLength={80} onChange={e=>setValue(e.target.value)}/><button className="adm-btn adm-btn-primary" disabled={busy||!value.trim()}>Save</button><button type="button" className="adm-btn adm-btn-ghost" onClick={()=>setRenaming(null)}>Cancel</button></form>
    :<><span>{c.name}</span><b>{c.count} recipe{c.count===1?'':'s'}</b><button className="adm-link" onClick={()=>{setRenaming(c.name);setValue(c.name)}}>Rename</button></>}</li>)}</ul></section>
 </div>;
}

function UsersPanel({me}:{me:AdminUser}){
 const [users,setUsers]=useState<AdminUser[]>([]);const [q,setQ]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState('');
 const load=useCallback(()=>api<{users:AdminUser[]}>('/admin/users').then(d=>setUsers(d.users)).catch(e=>setError(e.message)),[]);
 useEffect(()=>{load()},[load]);
 async function setRole(u:AdminUser,role:'USER'|'ADMIN'){
  if(!window.confirm(role==='ADMIN'?`Give ${u.name} full administrator access?`:`Remove administrator access from ${u.name}? They will be signed out.`))return;
  setBusy(u.id);setError('');try{await api(`/admin/users/${u.id}/role`,{method:'PATCH',body:JSON.stringify({role})});await load()}catch(e){setError(e instanceof Error?e.message:'Update failed')}finally{setBusy('')}
 }
 const shown=users.filter(u=>`${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()));
 return <div className="adm-card">
  <div className="adm-toolbar"><label className="adm-search"><input aria-label="Search users" placeholder="Search by name or email…" value={q} onChange={e=>setQ(e.target.value)}/></label><span className="adm-muted">{shown.length} of {users.length} accounts</span></div>
  {error&&<p className="adm-alert" role="alert">{error}</p>}
  <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Favourites</th><th>Role</th><th><span className="sr-only">Actions</span></th></tr></thead>
   <tbody>{shown.map(u=><tr key={u.id}><td data-label="Name"><strong>{u.name}</strong></td><td data-label="Email">{u.email}</td><td data-label="Joined">{new Date(u.createdAt).toLocaleDateString()}</td><td data-label="Favourites">{u._count?.favorites??0}</td>
    <td data-label="Role"><span className={`adm-status ${u.role==='ADMIN'?'is-admin':'is-user'}`}>{u.role}</span></td>
    <td data-label="Actions">{u.id===me.id?<span className="adm-muted">You</span>:<button className="adm-btn adm-btn-ghost" disabled={busy===u.id} onClick={()=>setRole(u,u.role==='ADMIN'?'USER':'ADMIN')}>{u.role==='ADMIN'?'Make user':'Make admin'}</button>}</td></tr>)}</tbody></table></div>
 </div>;
}

function SettingsPanel(){
 const [checking,setChecking]=useState(false);const [checkResult,setCheckResult]=useState('');
 async function checkAi(){setChecking(true);setCheckResult('');try{const d=await api<{message:string}>('/admin/ai/check',{method:'POST'});setCheckResult(d.message)}catch(e){setCheckResult(e instanceof Error?e.message:'Connection failed')}finally{setChecking(false)}}
 const [s,setS]=useState<{gemini:boolean;tts:string|null;passwordReset:boolean;frontendOrigin:string;environment:string}|null>(null);const [error,setError]=useState('');
 useEffect(()=>{api<{settings:NonNullable<typeof s>}>('/admin/settings').then(d=>setS(d.settings)).catch(e=>setError(e.message))},[]);
 if(error)return <p className="adm-alert" role="alert">{error}</p>;
 if(!s)return <div className="adm-card adm-loading"><LoaderCircle className="spin" size={18}/> Loading…</div>;
 const row=(ok:boolean,label:string,detail:string)=><li>{ok?<CircleCheck size={18} className="ok"/>:<CircleX size={18} className="off"/>}<span><strong>{label}</strong><small>{detail}</small></span><b>{ok?'Configured':'Not configured'}</b></li>;
 return <section className="adm-card"><div className="adm-card-head"><div><h2>Integrations</h2><p>Secrets live only in <code>backend/.env</code> and are never sent to the browser. Restart the backend after changing them.</p></div></div>
  <ul className="adm-settings">
   {row(s.gemini,'Gemini AI','AI recipe creation and on-demand Telugu / Hindi translation (GEMINI_API_KEY).')}
   {row(Boolean(s.tts),'Cloud narration fallback',s.tts?`Provider: ${s.tts==='google'?'Google Cloud Text-to-Speech':s.tts==='gemini'?'Gemini TTS':'Keyless Google Translate speech (best-effort; add GOOGLE_TTS_API_KEY for production)'}. Used when a browser voice fails.`:'Set GOOGLE_TTS_API_KEY (preferred) or GEMINI_API_KEY to read recipes aloud when the device has no working Telugu / Hindi voice.')}
   {row(s.passwordReset,'Password reset email','RESEND_API_KEY and RESET_FROM_EMAIL.')}
  </ul>
  <button className="adm-btn adm-btn-soft" disabled={checking||!s.gemini} onClick={checkAi}>{checking?'Checking…':'Test AI connection'}</button>{checkResult&&<p role="status">{checkResult}</p>}
  <dl className="adm-dl"><div><dt>Environment</dt><dd>{s.environment}</dd></div><div><dt>Frontend origin</dt><dd>{s.frontendOrigin}</dd></div></dl>
  <p className="adm-hint"><Link href="/" target="_blank">Open the public site <ExternalLink size={13}/></Link></p>
 </section>;
}
