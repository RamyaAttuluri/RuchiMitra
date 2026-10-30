'use client';

import Link from 'next/link';import {ArrowUpRight,Clock3,Heart,Leaf,Flame} from 'lucide-react';import type {RecipeData} from '@/lib/types';import {FoodImage} from './food-image';
export function RecipeCard({recipe}:{recipe:RecipeData;index?:number}){
 return <Link className="recipe-card" href={`/recipe/${recipe.slug}`}>
 <div className="card-image">{recipe.imageUrl?<FoodImage src={recipe.imageUrl} alt={recipe.name} sizes="(max-width: 700px) 100vw, (max-width: 900px) 50vw, 400px"/>:<div className="ai-image"><span>✳</span><small>Fresh from the kitchen</small></div>}
 <span className="card-category">{recipe.category==='Non-Vegetarian'?<Flame size={12}/>:<Leaf size={12}/>} {recipe.category}</span>
 <span className="card-arrow"><ArrowUpRight size={18}/></span></div>
 <div className="card-content"><div className="card-eyebrow">{recipe.cuisine} <span>·</span> {recipe.difficulty}</div><h3>{recipe.name}</h3><p>{recipe.description}</p>
 <div className="card-meta"><span><Clock3 size={15}/> {recipe.prepMinutes+recipe.cookMinutes} min</span><span><Heart size={15}/> Made with love</span></div></div>
 </Link>
}
