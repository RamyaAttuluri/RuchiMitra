'use client';

import {useRef,useState} from 'react';import {RecipeCard} from './recipe-card';import type {RecipeData} from '@/lib/types';import {useScrollReveal} from '@/lib/motion';
const filters=['All recipes','Vegetarian','Non-Vegetarian','Vegan'];
export function RecipeGrid({recipes,filtersEnabled=true}:{recipes:RecipeData[];filtersEnabled?:boolean}){
 const [active,setActive]=useState('All recipes');const shown=active==='All recipes'?recipes:recipes.filter(r=>active==='Vegetarian'?r.category==='Vegetarian'||r.category==='Vegan':r.category===active);
 const grid=useRef<HTMLDivElement>(null);useScrollReveal(grid,'.recipe-card',shown.map(r=>r.id).join());
 return <><div className="grid-topline">{filtersEnabled&&<div className="filter-tabs" role="group" aria-label="Filter by diet">{filters.map(t=><button className={t===active?'active':''} key={t} onClick={()=>setActive(t)}>{t}</button>)}</div>}<span className="results-count">{shown.length} delicious recipes</span></div>
 {shown.length?<div className="recipes-grid" ref={grid}>{shown.map((r,i)=><RecipeCard key={r.id} recipe={r} index={i}/>)}</div>:<div className="empty-state">No recipes in this category yet. Try another filter.</div>}</>
}
