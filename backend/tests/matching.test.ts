import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canonical,matchPantry,relatedRecipes} from '../src/matching.js';
import {seeds} from '../prisma/seed-data.js';

const recipes=seeds.map((r,i)=>({...r,id:String(i)}));
const names=(rows:{recipe:{name:string}}[])=>rows.map(r=>r.recipe.name);

test('normalises plurals, synonyms and Indian-language names',()=>{
 assert.equal(canonical('Tomatoes'),'tomato');
 assert.equal(canonical(' Onions '),'onion');
 assert.equal(canonical('Red chili powder'),'chilli powder');
 assert.equal(canonical('Cilantro'),'coriander leaves');
 assert.equal(canonical('టమాటా'),'tomato');
 assert.equal(canonical('प्याज'),'onion');
 assert.notEqual(canonical('Chilli powder'),canonical('Green chillies'));
 assert.notEqual(canonical('Butter'),canonical('Oil'));
});
test('Example A: onion + tomato alone makes nothing (strict, no staples)',()=>{
 const r=matchPantry(recipes,['Onion','Tomato'],{includeStaples:false,nearMatches:true});
 assert.equal(r.exact.length,0);
 for(const n of r.near as any[])assert.ok(n.missing.length>0);
});
test('Example B: chicken pantry makes Andhra Chicken Curry only if every ingredient is present',()=>{
 const base=['Chicken','Onion','Tomato','Ginger','Garlic','Oil','Salt','Chilli powder','Turmeric'];
 assert.ok(!names(matchPantry(recipes,base,{includeStaples:false,nearMatches:false}).exact).includes('Andhra Chicken Curry'),'coriander powder, garam masala, curry leaves and water are still missing');
 const full=[...base,'Coriander powder','Garam masala','Curry leaves','Water'];
 const exact=names(matchPantry(recipes,full,{includeStaples:false,nearMatches:false}).exact);
 assert.ok(exact.includes('Andhra Chicken Curry'));
 assert.ok(!exact.some(n=>/paneer|egg/i.test(n)));
});
test('Example C: dal pantry never returns chicken or paneer',()=>{
 const r=matchPantry(recipes,['Rice','Dal','Tomato','Onion','Turmeric','Oil','Salt'],{includeStaples:false,nearMatches:true});
 for(const row of [...r.exact,...r.near] as any[]){
  if(r.exact.includes(row))assert.equal(row.missing.length,0);
 }
 assert.ok(!names(r.exact as any).some(n=>/chicken|paneer/i.test(n)));
});
test('related: paneer -> paneer first, dal -> dal, no self, no filler',()=>{
 const by=(slug:string)=>recipes.find(r=>r.slug===slug)!;
 const paneer=relatedRecipes(by('paneer-butter-masala'),recipes);
 assert.equal(paneer[0].recipe.slug,'palak-paneer');
 assert.ok(!paneer.some(x=>x.recipe.slug==='paneer-butter-masala'));
 const dal=relatedRecipes(by('tomato-pappu'),recipes);
 assert.equal(dal[0].recipe.slug,'dal-tadka');
 const chicken=relatedRecipes(by('andhra-chicken-curry'),recipes);
 assert.ok(chicken.length>0&&chicken.every(x=>x.recipe.category==='Non-Vegetarian'));
 console.log('chicken ->',chicken.map(x=>x.recipe.name),'| dal ->',dal.map(x=>x.recipe.name),'| paneer ->',paneer.map(x=>x.recipe.name));
});
