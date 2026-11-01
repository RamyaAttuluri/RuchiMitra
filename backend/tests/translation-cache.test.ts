import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';
import type {PrismaClient,Recipe} from '@prisma/client';
import {getRecipeTranslation} from '../src/recipe-translations.js';
test('serving variants persist on disk, survive in-flight eviction and invalidate on source changes',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'recipe-translation-cache-'));const previous={provider:process.env.TRANSLATION_PROVIDER,key:process.env.GEMINI_API_KEY,directory:process.env.TRANSLATION_CACHE_DIR};const original=fetch;
 const translation={name:'चावल',description:'सरल भोजन।',tip:'गरम परोसें।',intro:'तैयारी 5 मिनट। पकाना 15 मिनट।',ingredients:['चावल सात कप','पानी चौदह कप'],steps:[{title:'चावल धोएं',text:'चावल को धो लें।'},{title:'चावल पकाएं',text:'पानी में चावल पकाएं।'}]};
 const recipe={id:'cache-fixture',name:'Rice',description:'Simple rice.',tip:'Serve warm.',prepMinutes:5,cookMinutes:15,servings:2,ingredients:JSON.stringify([{name:'Rice',quantity:7,unit:'cups'},{name:'Water',quantity:14,unit:'cups'}]),steps:JSON.stringify([{title:'Rinse rice',text:'Rinse the rice.'},{title:'Cook rice',text:'Cook rice in water.'}]),translations:JSON.stringify({hi:translation})} as Recipe;
 let calls=0;try{
  process.env.TRANSLATION_PROVIDER='gemini';process.env.GEMINI_API_KEY='test-only';process.env.TRANSLATION_CACHE_DIR=directory;
  globalThis.fetch=(async()=>{calls++;return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({...translation,ingredients:['चावल 14 कप','पानी 28 कप'],steps:[]})}]}}]})}) as typeof fetch;
  const first=await getRecipeTranslation({} as PrismaClient,recipe,'hi',4);assert.deepEqual(first.ingredients,['चावल 14 कप','पानी 28 कप']);assert.deepEqual(first.steps,translation.steps);assert.equal((await readdir(directory)).filter(name=>name.endsWith('.json')).length,1);
  globalThis.fetch=(async()=>{throw Error('provider offline')}) as typeof fetch;
  const second=await getRecipeTranslation({} as PrismaClient,recipe,'hi',4);assert.deepEqual(second,first);assert.equal(calls,1);assert.equal(JSON.parse(recipe.translations).hi.ingredients[0],'चावल सात कप');
  await assert.rejects(getRecipeTranslation({} as PrismaClient,{...recipe,translations:JSON.stringify({hi:{...translation,steps:[]}})},'hi'),{code:'TRANSLATION_STORED_INVALID'});
  await assert.rejects(getRecipeTranslation({} as PrismaClient,{...recipe,description:'Changed source recipe.'},'hi',4),{code:'AI_NETWORK'});
 }finally{
  globalThis.fetch=original;for(const [key,value] of Object.entries({TRANSLATION_PROVIDER:previous.provider,GEMINI_API_KEY:previous.key,TRANSLATION_CACHE_DIR:previous.directory})){if(value===undefined)delete process.env[key];else process.env[key]=value}await rm(directory,{recursive:true,force:true});
 }
});
