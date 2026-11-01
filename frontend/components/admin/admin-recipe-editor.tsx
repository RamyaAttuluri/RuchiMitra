'use client';

import {useEffect,useRef,useState} from 'react';
import {ArrowDown,ArrowUp,ImagePlus,LoaderCircle,Plus,Save,Trash2,X} from 'lucide-react';
import type {CookingStep,Ingredient,RecipeData,RecipeStatus,Translation} from '@/lib/types';
import {api,imageSrc} from '@/lib/api';

type TLang='te'|'hi';
type TDraft={name:string;intro:string;description:string;tip:string;ingredients:string[];steps:{title:string;text:string}[]};
type Draft=Pick<RecipeData,'name'|'description'|'cuisine'|'category'|'difficulty'|'prepMinutes'|'cookMinutes'|'servings'|'imageUrl'|'ingredients'|'steps'|'tip'|'tags'>&{status:Exclude<RecipeStatus,'ARCHIVED'>};
const T_LANGS:{code:TLang;label:string}[]=[{code:'te',label:'Telugu · తెలుగు'},{code:'hi',label:'Hindi · हिन्दी'}];
const newIngredient=():Ingredient=>({name:'',quantity:null,unit:''});
const newStep=():CookingStep=>({title:'',text:'',minutes:null});
const emptyDraft=():Draft=>({name:'',description:'',cuisine:'Indian',category:'Vegetarian',difficulty:'Easy',prepMinutes:10,cookMinutes:20,servings:2,imageUrl:'',tip:'',tags:[],ingredients:[newIngredient(),newIngredient()],steps:[newStep(),newStep()],status:'DRAFT'});
const toTDraft=(t:Translation|undefined,d:Draft):TDraft=>({name:t?.name??'',intro:t?.intro??'',description:t?.description??'',tip:t?.tip??'',
 ingredients:d.ingredients.map((_,i)=>t?.ingredients[i]??''),steps:d.steps.map((_,i)=>({title:t?.steps[i]?.title??'',text:t?.steps[i]?.text??''}))});
const move=<T,>(list:T[],from:number,to:number)=>{const copy=[...list];const [item]=copy.splice(from,1);copy.splice(to,0,item);return copy};

export function AdminRecipeEditor({recipeId,onClose,onSaved}:{recipeId:string|null;onClose:()=>void;onSaved:(r:RecipeData,created:boolean)=>void}){
 const [draft,setDraft]=useState<Draft>(emptyDraft);
 const [trans,setTrans]=useState<Record<TLang,TDraft>>({te:toTDraft(undefined,emptyDraft()),hi:toTDraft(undefined,emptyDraft())});
 const [enabled,setEnabled]=useState<Record<TLang,boolean>>({te:false,hi:false});
 const [tagInput,setTagInput]=useState('');
 const [loading,setLoading]=useState(Boolean(recipeId));const [busy,setBusy]=useState(false);const [uploading,setUploading]=useState(false);
 const [error,setError]=useState('');
 const top=useRef<HTMLFormElement>(null);

 // Always edit the current server copy, not whatever the table had cached.
 useEffect(()=>{
  if(!recipeId){const d=emptyDraft();setDraft(d);setTrans({te:toTDraft(undefined,d),hi:toTDraft(undefined,d)});setEnabled({te:false,hi:false});setTagInput('');setLoading(false);return}
  let live=true;setLoading(true);setError('');
  api<{recipe:RecipeData}>(`/admin/recipes/${recipeId}`).then(({recipe:r})=>{if(!live)return;
   const d:Draft={name:r.name,description:r.description,cuisine:r.cuisine,category:r.category,difficulty:r.difficulty,prepMinutes:r.prepMinutes,cookMinutes:r.cookMinutes,servings:r.servings,imageUrl:r.imageUrl,tip:r.tip,tags:[...r.tags],
    ingredients:r.ingredients.map(i=>({...i})),steps:r.steps.map(s=>({...s})),status:r.status==='PUBLISHED'?'PUBLISHED':'DRAFT'};
   setDraft(d);setTagInput(r.tags.join(', '));
   setTrans({te:toTDraft(r.translations.te,d),hi:toTDraft(r.translations.hi,d)});setEnabled({te:Boolean(r.translations.te),hi:Boolean(r.translations.hi)});
  }).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});
  return ()=>{live=false};
 },[recipeId]);

 const field=<K extends keyof Draft>(key:K,value:Draft[K])=>setDraft(p=>({...p,[key]:value}));
 const ingredientField=(i:number,key:keyof Ingredient,value:string|number|boolean|null)=>setDraft(p=>({...p,ingredients:p.ingredients.map((x,n)=>n===i?{...x,[key]:value}:x)}));
 const stepField=(i:number,key:keyof CookingStep,value:string|number|boolean|null)=>setDraft(p=>({...p,steps:p.steps.map((x,n)=>n===i?{...x,[key]:value}:x)}));
 // Structural edits are mirrored into both translations so their rows stay aligned with the English rows.
 const mirror=(fn:(t:TDraft)=>TDraft)=>setTrans(p=>({te:fn(p.te),hi:fn(p.hi)}));
 const addIngredient=()=>{field('ingredients',[...draft.ingredients,newIngredient()]);mirror(t=>({...t,ingredients:[...t.ingredients,'']}))};
 const removeIngredient=(i:number)=>{field('ingredients',draft.ingredients.filter((_,n)=>n!==i));mirror(t=>({...t,ingredients:t.ingredients.filter((_,n)=>n!==i)}))};
 const moveIngredient=(i:number,to:number)=>{field('ingredients',move(draft.ingredients,i,to));mirror(t=>({...t,ingredients:move(t.ingredients,i,to)}))};
 const addStep=()=>{field('steps',[...draft.steps,newStep()]);mirror(t=>({...t,steps:[...t.steps,{title:'',text:''}]}))};
 const removeStep=(i:number)=>{field('steps',draft.steps.filter((_,n)=>n!==i));mirror(t=>({...t,steps:t.steps.filter((_,n)=>n!==i)}))};
 const moveStep=(i:number,to:number)=>{field('steps',move(draft.steps,i,to));mirror(t=>({...t,steps:move(t.steps,i,to)}))};
 const tField=(l:TLang,patch:Partial<TDraft>)=>setTrans(p=>({...p,[l]:{...p[l],...patch}}));

 async function upload(file:File){
  setError('');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))return setError('Choose a JPEG, PNG or WebP image.');
  if(file.size>2_500_000)return setError('Image must be 2.5 MB or smaller.');
  setUploading(true);
  try{
   const dataUrl=await new Promise<string>((ok,fail)=>{const r=new FileReader();r.onload=()=>ok(String(r.result));r.onerror=()=>fail(Error('Could not read the file'));r.readAsDataURL(file)});
   const {url}=await api<{url:string}>('/admin/uploads',{method:'POST',body:JSON.stringify({dataUrl})});field('imageUrl',url);
  }catch(e){setError(e instanceof Error?e.message:'Upload failed')}finally{setUploading(false)}
 }

 async function save(e:React.FormEvent){
  e.preventDefault();setError('');
  try{
   if(draft.ingredients.some(i=>!i.name.trim())||draft.steps.some(s=>s.title.trim().length<2||s.text.trim().length<10))throw Error('Complete every ingredient name, step title (2+ characters) and step instruction (10+ characters).');
   const translations:Partial<Record<TLang,Translation>>={};
   for(const {code,label} of T_LANGS){if(!enabled[code])continue;const t=trans[code];
    if(!t.name.trim()||!t.intro.trim()||t.ingredients.some(x=>!x.trim())||t.steps.some(s=>!s.title.trim()||!s.text.trim()))throw Error(`${label}: fill in the name, introduction, every ingredient and every step, or switch the translation off.`);
    translations[code]={name:t.name,intro:t.intro,ingredients:t.ingredients,steps:t.steps,...(t.description.trim()?{description:t.description}:{}),...(t.tip.trim()?{tip:t.tip}:{})};}
   setBusy(true);
   const payload={...draft,tags:tagInput.split(',').map(s=>s.trim()).filter(Boolean),translations};
   const {recipe}=recipeId
    ?await api<{recipe:RecipeData}>(`/admin/recipes/${recipeId}`,{method:'PUT',body:JSON.stringify(payload)})
    :await api<{recipe:RecipeData}>('/admin/recipes',{method:'POST',body:JSON.stringify(payload)});
   onSaved(recipe,!recipeId);
  }catch(err){setError(err instanceof Error?err.message:'Could not save recipe.');top.current?.scrollIntoView({behavior:'smooth'})}finally{setBusy(false)}
 }

 if(loading)return <div className="adm-card adm-loading"><LoaderCircle className="spin" size={20}/> Loading recipe…</div>;
 return <form className="adm-card adm-editor" onSubmit={save} ref={top}>
  <div className="adm-card-head"><div><h2>{recipeId?'Edit recipe':'Add a recipe'}</h2><p>{recipeId?'Changes go live for users as soon as you save a published recipe.':'Save as draft to review it first, or publish straight away.'}</p></div><button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}><X size={16}/> Close</button></div>
  {error&&<p className="adm-alert" role="alert">{error}</p>}
  <fieldset className="adm-fieldset"><legend>Basics</legend><div className="adm-form-grid">
   <label className="adm-wide">Recipe name<input required minLength={3} maxLength={100} value={draft.name} onChange={e=>field('name',e.target.value)} placeholder="e.g. Andhra Chicken Curry"/></label>
   <label className="adm-wide">Description<textarea required rows={3} minLength={10} maxLength={700} value={draft.description} onChange={e=>field('description',e.target.value)}/></label>
   <label>Cuisine<input required maxLength={80} value={draft.cuisine} onChange={e=>field('cuisine',e.target.value)} placeholder="e.g. Andhra"/></label>
   <label>Category<select value={draft.category} onChange={e=>field('category',e.target.value)}><option>Vegetarian</option><option>Non-Vegetarian</option><option>Vegan</option></select></label>
   <label>Difficulty<select value={draft.difficulty} onChange={e=>field('difficulty',e.target.value)}><option>Easy</option><option>Medium</option><option>Advanced</option></select></label>
   <label>Status<select value={draft.status} onChange={e=>field('status',e.target.value as Draft['status'])}><option value="DRAFT">Draft (admins only)</option><option value="PUBLISHED">Published (visible to users)</option></select></label>
   <label>Preparation time (min)<input type="number" min={0} max={1200} value={draft.prepMinutes} onChange={e=>field('prepMinutes',Number(e.target.value))}/></label>
   <label>Cooking time (min)<input type="number" min={1} max={1200} value={draft.cookMinutes} onChange={e=>field('cookMinutes',Number(e.target.value))}/></label>
   <label>Default servings<input type="number" min={1} max={50} value={draft.servings} onChange={e=>field('servings',Number(e.target.value))}/></label>
   <label>Tags (comma separated)<input value={tagInput} maxLength={300} onChange={e=>setTagInput(e.target.value)} placeholder="Spicy, South Indian"/></label>
   <label className="adm-wide">Cooking tip<textarea rows={2} maxLength={500} value={draft.tip} onChange={e=>field('tip',e.target.value)}/></label>
  </div></fieldset>
  <fieldset className="adm-fieldset"><legend>Photo</legend><div className="adm-photo">
   <div className="adm-photo-preview">{draft.imageUrl?<img src={imageSrc(draft.imageUrl)} alt="Recipe preview"/>:<span>No photo</span>}</div>
   <div className="adm-photo-fields">
    <label className="adm-btn adm-btn-soft adm-upload">{uploading?<LoaderCircle className="spin" size={16}/>:<ImagePlus size={16}/>} {uploading?'Uploading…':draft.imageUrl?'Replace photo':'Upload photo'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e=>{const f=e.target.files?.[0];if(f)upload(f);e.target.value=''}}/></label>
    <label>…or image URL<input value={draft.imageUrl} maxLength={500} onChange={e=>field('imageUrl',e.target.value)} placeholder="https://images.unsplash.com/…"/></label>
    <small>JPEG, PNG or WebP up to 2.5 MB. External URLs must be from images.unsplash.com to display on the site.</small>
   </div></div></fieldset>
  <fieldset className="adm-fieldset"><legend>Ingredients</legend>
   {draft.ingredients.map((ing,i)=><div className="adm-row-edit" key={i}>
    <label>Ingredient<input required maxLength={100} value={ing.name} onChange={e=>ingredientField(i,'name',e.target.value)} placeholder="e.g. Paneer"/></label>
    <label>Quantity<input type="number" step="any" min="0" value={ing.quantity??''} onChange={e=>ingredientField(i,'quantity',e.target.value===''?null:Number(e.target.value))} placeholder="To taste"/></label>
    <label>Unit<input maxLength={30} value={ing.unit} onChange={e=>ingredientField(i,'unit',e.target.value)} placeholder="g, tbsp, cups"/></label>
    <div className="adm-ingredient-flags"><label><input type="checkbox" checked={Boolean(ing.optional)} onChange={e=>ingredientField(i,'optional',e.target.checked)}/> Optional ingredient</label><label><input type="checkbox" checked={ing.scalable!==false} onChange={e=>ingredientField(i,'scalable',e.target.checked)}/> Scale with servings</label></div>
    <div className="adm-row-tools"><button type="button" aria-label={`Move ingredient ${i+1} up`} disabled={i===0} onClick={()=>moveIngredient(i,i-1)}><ArrowUp size={15}/></button><button type="button" aria-label={`Move ingredient ${i+1} down`} disabled={i===draft.ingredients.length-1} onClick={()=>moveIngredient(i,i+1)}><ArrowDown size={15}/></button><button type="button" className="danger" aria-label={`Remove ingredient ${i+1}`} disabled={draft.ingredients.length<=2} onClick={()=>removeIngredient(i)}><Trash2 size={15}/></button></div>
   </div>)}
   <button type="button" className="adm-btn adm-btn-soft" onClick={addIngredient}><Plus size={16}/> Add ingredient</button>
  </fieldset>
  <fieldset className="adm-fieldset"><legend>Cooking instructions</legend>
   {draft.steps.map((s,i)=><div className="adm-step-edit" key={i}>
    <div className="adm-step-top"><strong>Step {i+1}</strong><div className="adm-row-tools"><button type="button" aria-label={`Move step ${i+1} up`} disabled={i===0} onClick={()=>moveStep(i,i-1)}><ArrowUp size={15}/></button><button type="button" aria-label={`Move step ${i+1} down`} disabled={i===draft.steps.length-1} onClick={()=>moveStep(i,i+1)}><ArrowDown size={15}/></button><button type="button" className="danger" aria-label={`Remove step ${i+1}`} disabled={draft.steps.length<=2} onClick={()=>removeStep(i)}><Trash2 size={15}/></button></div></div>
    <div className="adm-form-grid adm-step-grid"><label>Step title<input required minLength={2} maxLength={120} value={s.title} onChange={e=>stepField(i,'title',e.target.value)} placeholder="e.g. Toast the spices"/></label>
    <label>Duration (min)<input type="number" min={0} max={600} value={s.minutes??''} onChange={e=>stepField(i,'minutes',e.target.value===''?null:Number(e.target.value))} placeholder="Optional"/></label>
    <label>Heat level<input maxLength={80} value={s.heatLevel||''} onChange={e=>stepField(i,'heatLevel',e.target.value)} placeholder="e.g. medium-low"/></label><label>Temperature<input maxLength={80} value={s.temperature||''} onChange={e=>stepField(i,'temperature',e.target.value)} placeholder="e.g. 180 C"/></label>
    <label className="adm-wide">Instruction<textarea required minLength={10} maxLength={1200} rows={3} value={s.text} onChange={e=>stepField(i,'text',e.target.value)}/></label></div>
   </div>)}
   <button type="button" className="adm-btn adm-btn-soft" onClick={addStep}><Plus size={16}/> Add step</button>
  </fieldset>
  <fieldset className="adm-fieldset"><legend>Translations (optional)</legend>
   <p className="adm-hint">English is the main content. Add Telugu or Hindi here to control the wording; otherwise the site can translate on demand using the configured backend AI provider. Rows follow the English ingredient and step order.</p>
   {T_LANGS.map(({code,label})=>{const t=trans[code];return <details key={code} className="adm-translation" open={enabled[code]}>
    <summary><label className="adm-switch" onClick={e=>e.stopPropagation()}><input type="checkbox" checked={enabled[code]} onChange={e=>setEnabled(p=>({...p,[code]:e.target.checked}))}/> {label}</label><span>{enabled[code]?'Included':'Not included'}</span></summary>
    <div className="adm-form-grid" lang={code}>
     <label>Recipe name<input value={t.name} maxLength={150} onChange={e=>tField(code,{name:e.target.value})} disabled={!enabled[code]}/></label>
     <label>Spoken introduction<input value={t.intro} maxLength={600} onChange={e=>tField(code,{intro:e.target.value})} disabled={!enabled[code]}/></label>
     <label className="adm-wide">Description<textarea rows={2} maxLength={900} value={t.description} onChange={e=>tField(code,{description:e.target.value})} disabled={!enabled[code]}/></label>
     <label className="adm-wide">Tip<textarea rows={2} maxLength={700} value={t.tip} onChange={e=>tField(code,{tip:e.target.value})} disabled={!enabled[code]}/></label>
     {t.ingredients.map((x,i)=><label key={`i${i}`}>Ingredient {i+1}: <em lang="en">{draft.ingredients[i]?.name||'…'}</em><input value={x} maxLength={300} onChange={e=>tField(code,{ingredients:t.ingredients.map((y,n)=>n===i?e.target.value:y)})} disabled={!enabled[code]}/></label>)}
     {t.steps.map((s,i)=><div key={`s${i}`} className="adm-wide adm-tstep"><label>Step {i+1} title: <em lang="en">{draft.steps[i]?.title||'…'}</em><input value={s.title} maxLength={160} onChange={e=>tField(code,{steps:t.steps.map((y,n)=>n===i?{...y,title:e.target.value}:y)})} disabled={!enabled[code]}/></label>
      <label>Step {i+1} instruction<textarea rows={2} maxLength={1300} value={s.text} onChange={e=>tField(code,{steps:t.steps.map((y,n)=>n===i?{...y,text:e.target.value}:y)})} disabled={!enabled[code]}/></label></div>)}
    </div></details>})}
  </fieldset>
  <div className="adm-save-bar"><button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>Cancel</button><button type="submit" className="adm-btn adm-btn-primary" disabled={busy||uploading}>{busy?<LoaderCircle className="spin" size={16}/>:<Save size={16}/>} {busy?'Saving…':draft.status==='PUBLISHED'?'Save & publish':'Save draft'}</button></div>
 </form>;
}
