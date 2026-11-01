'use client';

import {useEffect,useState,Suspense} from 'react';
import {useSearchParams} from 'next/navigation';
import {RecipeGrid} from '@/components/recipe-grid';import {SearchBox} from '@/components/search-box';import {GenerateRecipe} from '@/components/generate-recipe';
import {rememberSearch} from '@/lib/recent-searches';
import {api,API_URL} from '@/lib/api';import type {RecipeData} from '@/lib/types';
function SearchView(){const params=useSearchParams();const q=(params.get('q')||'').trim().slice(0,80);
useEffect(()=>{if(!q)return;let active=true;api<{user:{id:string}|null}>('/auth/me').then(d=>{if(active&&d.user)rememberSearch(sessionStorage,d.user.id,q)}).catch(()=>{});return()=>{active=false}},[q]);
const [list,setList]=useState<RecipeData[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
useEffect(()=>{let active=true;setLoading(true);setError('');api<{recipes:RecipeData[]}>(`/recipes?q=${encodeURIComponent(q)}`).then(d=>{if(active)setList(d.recipes)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[q]);
return <main className="container subpage"><div className="page-header"><span className="eyebrow">✳ THE RECIPE COLLECTION</span><h1>Find something <em>delicious.</em></h1><p>Search for the dish you have in mind, or explore a new favourite.</p></div><div className="search-page-box"><SearchBox key={q} initial={q}/></div>
{q&&<div className="search-title"><h2>Results for <em>“{q}”</em></h2><p>{loading?'Searching...':`${list.length} recipes found in our kitchen`}</p></div>}
{error&&<div className="inline-error" role="alert">{error}. Ensure the backend is running.</div>}
{loading?<div className="empty-state">Looking through our recipe collection...</div>:list.length?<RecipeGrid recipes={list}/>:<div className="no-results"><div className="no-icon">✳</div><h2>Nothing in our recipe box yet.</h2><p>Try another search, or ask our AI chef to write a recipe for you.</p></div>}
{q&&!loading&&!error&&list.length===0&&<GenerateRecipe query={q}/>}</main>}
export default function SearchPage(){return <Suspense fallback={<main className="container subpage">Loading recipes...</main>}><SearchView/></Suspense>}
