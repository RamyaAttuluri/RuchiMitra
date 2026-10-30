'use client';
import {apiFetch,API_URL} from '@/lib/api';
import {useRouter} from 'next/navigation';import {useState} from 'react';import {Sparkles,ArrowRight,LoaderCircle} from 'lucide-react';
export function GenerateRecipe({query}:{query:string}){const [busy,setBusy]=useState(false);const [error,setError]=useState('');const router=useRouter();
 async function generate(){setBusy(true);setError('');try{const response=await apiFetch(`${API_URL}/recipes/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:query})});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not generate recipe');router.push(`/recipe/${data.recipe.slug}`);router.refresh()}catch(e){setError(e instanceof Error?e.message:'Something went wrong')}finally{setBusy(false)}}
 return <div className="generate-banner"><div className="generate-icon"><Sparkles size={28}/></div><div><h3>Can't find what you're craving?</h3><p>Let our AI kitchen assistant create a recipe for “{query}”. AI recipes are clearly marked and should be reviewed before cooking.</p>{error&&<p className="inline-error">{error}</p>}</div><button className="btn btn-dark" onClick={generate} disabled={busy}>{busy?<LoaderCircle className="spin" size={18}/>:<Sparkles size={17}/>} {busy?'Creating...':'Create with AI'} <ArrowRight size={17}/></button></div>
}
