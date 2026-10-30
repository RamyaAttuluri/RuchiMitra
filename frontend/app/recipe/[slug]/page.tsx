'use client';

import Link from 'next/link';import {useParams} from 'next/navigation';import {useEffect,useState} from 'react';import {apiFetch,API_URL} from '@/lib/api';import {RecipeDetail} from '@/components/recipe-detail';import type {RecipeData} from '@/lib/types';
export default function RecipePage(){const {slug}=useParams<{slug:string}>();const [recipe,setRecipe]=useState<RecipeData|null>(null);const [error,setError]=useState<{title:string;text:string}|null>(null);
useEffect(()=>{let live=true;setRecipe(null);setError(null);
 apiFetch(`${API_URL}/recipes/${encodeURIComponent(slug)}`).then(async r=>{const d=await r.json().catch(()=>({}));if(!live)return;
  if(r.ok)setRecipe(d.recipe);
  else if(r.status===410)setError({title:'This recipe has been removed',text:'Our kitchen team retired this recipe from the collection. Explore our other dishes instead.'});
  else if(r.status===404)setError({title:'Recipe not found',text:'This recipe may have been unpublished or the link is incorrect.'});
  else setError({title:'Could not load this recipe',text:d.error||'Please try again shortly.'})})
 .catch(()=>{if(live)setError({title:'Could not reach the kitchen',text:'Start the backend on port 5000 and refresh.'})});
 return()=>{live=false}},[slug]);
return recipe?<RecipeDetail key={recipe.id} recipe={recipe}/>:<main className="container subpage"><div className="empty-state" role={error?'alert':'status'}>{error?<><h2>{error.title}</h2><p>{error.text}</p><Link className="btn btn-dark" href="/search">Browse recipes →</Link></>:'Preparing your recipe...'}</div></main>}
