'use client';
import {useEffect,useRef,useState} from 'react';
import {Download,FileText,LoaderCircle,X} from 'lucide-react';
import {apiFetch,API_URL} from '@/lib/api';
import type {Lang,RecipeData} from '@/lib/types';
import {FoodImage} from './food-image';
const languages={en:'English',te:'Telugu',hi:'Hindi'};
export function RecipeDownloadDialog({recipe,servings,onClose,onSuccess}:{recipe:RecipeData;servings:number;onClose:()=>void;onSuccess:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),request=useRef<AbortController|null>(null);
 const [language,setLanguage]=useState<Lang>('en'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[printFallback,setPrintFallback]=useState(false);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const element=dialog.current;element?.showModal();element?.querySelector('select')?.focus();return()=>{request.current?.abort();element?.close();previous?.focus()}},[]);
 function close(){request.current?.abort();onClose()}
 async function download(){
  const abort=new AbortController();request.current=abort;setBusy(true);setError('');setPrintFallback(false);
  try{
   const response=await apiFetch(`${API_URL}/recipes/${encodeURIComponent(recipe.slug)}/download`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lang:language,servings}),signal:abort.signal},480000);
   if(!response.ok){const data=await response.json().catch(()=>({}));if(String(data.code).startsWith('PDF_'))setPrintFallback(true);throw Error(data.error||'Could not download this recipe. Try again.')}
   if(!response.headers.get('content-type')?.startsWith('application/pdf'))throw Error('The server did not return a PDF. Please try again.');
   const blob=await response.blob();if(abort.signal.aborted)return;
   if(await blob.slice(0,5).text()!=='%PDF-')throw Error('The downloaded file is not a valid PDF.');
   const fallback=`${recipe.slug}-${languages[language]}.pdf`;
   const filename=response.headers.get('Content-Disposition')?.match(/filename="([a-zA-Z0-9-]+\.pdf)"/)?.[1]||fallback;
   const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);onSuccess();onClose();
  }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Download failed.')}
  finally{if(!abort.signal.aborted)setBusy(false)}
 }
 return <dialog ref={dialog} className="recipe-download-dialog" aria-labelledby="download-title" aria-describedby="download-description" onCancel={event=>{event.preventDefault();close()}} onKeyDown={event=>{
  if(event.key!=='Tab')return;const items=[...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')].filter(item=>item.getClientRects().length);const first=items[0],last=items.at(-1);if(!first||!last)return;
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
 }} onClick={event=>{if(event.target===dialog.current)close()}}>
  <button className="download-close" aria-label="Close download dialog" onClick={close}><X size={20}/></button>
  <span className="download-emblem" aria-hidden="true"><Download size={24}/></span>
  <span className="eyebrow">FROM OUR KITCHEN TO YOURS</span><h2 id="download-title">Download Your Recipe</h2>
  <p id="download-description">Save the complete recipe to cook anytime, even without internet.</p>
  <div className="download-recipe-preview">{recipe.imageUrl&&<div><FoodImage src={recipe.imageUrl} alt="" sizes="80px"/></div>}<div><strong>{recipe.name}</strong><span>{servings} servings · {recipe.ingredients.length} ingredients · {recipe.steps.length} steps</span></div><span className="pdf-format"><FileText size={15}/> PDF</span></div>
  <label className="download-language">Recipe language<select value={language} disabled={busy} onChange={event=>{setLanguage(event.target.value as Lang);setError('');setPrintFallback(false)}}><option value="en">English — Default</option><option value="te">తెలుగు — Telugu</option><option value="hi">हिन्दी — Hindi</option></select></label>
  <p className="download-confirmation">Would you like to download this recipe in {languages[language]}?</p>
  {busy&&<p role="status" className="download-progress"><LoaderCircle className="spin" size={17}/>{language==='en'?'Preparing your complete PDF…':'Preparing your PDF. A missing translation may take several minutes; your English recipe remains available.'}</p>}
  {error&&<div className="download-error" role="alert"><p>{error}</p>{language!=='en'&&<button className="simple-link" onClick={()=>{setLanguage('en');setError('');setPrintFallback(false)}}>Choose English instead</button>}{printFallback&&<button className="simple-link" onClick={()=>{close();window.print()}}>Print / Save as PDF using the page’s current language</button>}</div>}
  <div className="download-dialog-actions"><button className="outline-button" onClick={close}>{busy?'Cancel download':'Cancel'}</button><button className="btn btn-dark" disabled={busy} onClick={download}>{busy?<LoaderCircle size={17} className="spin"/>:<Download size={17}/>}Download PDF</button></div>
 </dialog>;
}
