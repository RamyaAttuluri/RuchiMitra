import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canonical,matchPantry} from '../src/matching.js';
import {pantryRecipes} from '../src/pantry-recipes.js';
const pool=pantryRecipes.map(r=>({...r,id:r.slug}));
const find=(available:string[],includeStaples=false)=>matchPantry(pool,available,{includeStaples,nearMatches:true});
test('screenshot: quantity-bearing rice pantry makes jeera rice beyond seed catalogue',()=>{
 const r=find(['Basmati rice 1 cup','Water 1¾ cups','Ghee 1 tbsp','Cumin seeds 1 tsp','Bay leaf 1 whole','Salt']);
 assert.ok(r.exact.some(x=>x.recipe.slug==='pantry-jeera-rice'));
});
test('quantity/unit text and plurals normalise correctly',()=>{
 for(const [a,b] of [['Basmati rice 1 cup','basmati rice'],['Water 1¾ cups','water'],['Ghee 1 tbsp','ghee'],['Potatoes 500 g','potato'],['Cumin seeds 1 tsp','cumin']])assert.equal(canonical(a),b);
});
test('strict matching never assumes salt or water when unchecked',()=>{
 assert.equal(find(['rice']).exact.length,0);
 assert.equal(find(['egg']).exact.length,0);
 assert.ok(find(['rice'],true).exact.some(x=>x.recipe.slug==='pantry-plain-rice'));
 assert.ok(find(['egg','water']).exact.some(x=>x.recipe.slug==='pantry-boiled-eggs'));
});
test('pantry recipes require all ingredients; missing any required item excludes exact',()=>{
 for(const r of pool){const names=r.ingredients.map(i=>i.name);assert.ok(find(names).exact.some(x=>x.recipe.slug===r.slug));for(let i=0;i<names.length;i++)assert.ok(!find(names.filter((_,n)=>i!==n)).exact.some(x=>x.recipe.slug===r.slug),`${r.slug} missing ${names[i]}`)}
});
test('non-food pantry and seasoning-only pantry return no invented dish',()=>{
 assert.equal(find(['detergent','salt']).exact.length,0);assert.equal(find(['salt','water']).exact.length,0);
});
