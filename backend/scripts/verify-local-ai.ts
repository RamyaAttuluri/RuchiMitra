import {writeFile,readFile} from 'node:fs/promises';
import {configureEnvironment} from './env.mjs';
import {askRecipeAI,aiStatus} from '../src/ai.js';
import {recipeSchema} from '../src/recipe-content.js';
import {translateRecipe} from '../src/translation.js';
import {z} from 'zod';
configureEnvironment();
const outputName=process.argv.find(arg=>arg.startsWith('--output='))?.slice(9);
if(outputName&&!/^[a-z0-9-]+\.json$/i.test(outputName))throw Error('Use a verification JSON filename for --output');
// Capture only this script's public test fixture output, never application requests.
const originalFetch=globalThis.fetch;
globalThis.fetch=async(...args:Parameters<typeof fetch>)=>{
 const response=await originalFetch(...args);
 if(String(args[0]).endsWith('/api/chat')){
  const body=await response.clone().json().catch(()=>null);
  await writeFile(new URL(`../../verification/${outputName?outputName.replace('.json','-last-response.json'):'real-ollama-last-response.json'}`,import.meta.url),JSON.stringify(body,null,2));
 }
 return response;
};
const translationOnly=process.argv.includes('--translate-only');
const small=process.argv.includes('--small');
const prior=small?{recipe:{name:'Rice',description:'Rice cooked in water.',tip:'Serve warm.',prepMinutes:5,cookMinutes:15,servings:2,ingredients:[{name:'Rice',quantity:1,unit:'cup'},{name:'Water',quantity:2,unit:'cups'}],steps:[{title:'Rinse rice',text:'Rinse the rice.'},{title:'Cook rice',text:'Cook rice in water for 15 minutes.'}]}}:translationOnly?JSON.parse(await readFile(new URL('../../verification/real-ollama-results.json',import.meta.url),'utf8')):null;
const results:any={status:await aiStatus(),tests:[],...(prior?{recipe:prior.recipe}:{})};
console.log(JSON.stringify(results.status));
if(!results.status.modelAvailable)process.exitCode=1;
else {
 let recipe:any=prior?.recipe;
 for(const stage of (translationOnly||small?['hi','te']:['recipe','hi','te'])){
  const started=Date.now();
  try{
   if(stage==='recipe')recipe=await askRecipeAI('Write a simple vegetarian Tomato Rice recipe for 2 servings with exactly 6 distinct useful cooking steps. Each instruction must explain a cooking action. Include measured rice, water, tomato, onion, oil and salt. Keep description and step instructions concise. Output only the recipe JSON matching the schema; imageUrl must be empty. No translations.',{schema:z.toJSONSchema(recipeSchema) as Record<string,unknown>,maxOutputTokens:2000,validate:value=>recipeSchema.parse(value)});
   else if(recipe){const translation=await translateRecipe(recipe,stage as 'hi'|'te');results[stage]=translation}
   else throw Error('Recipe generation did not complete');
   if(stage==='recipe'){results.recipe=recipe;if(recipe.steps.length!==6)throw Error('Expected six generated steps')}
   results.tests.push({stage,passed:true,elapsedMs:Date.now()-started});
  }catch(e){results.tests.push({stage,passed:false,elapsedMs:Date.now()-started,error:e instanceof Error?e.message:'Unknown error'});process.exitCode=1}
  console.log(JSON.stringify(results.tests.at(-1)));
  await writeFile(new URL(outputName?`../../verification/${outputName}`:small?'../../verification/real-ollama-small-results.json':translationOnly?'../../verification/real-ollama-translation-results.json':'../../verification/real-ollama-results.json',import.meta.url),JSON.stringify(results,null,2));
 }
}
await writeFile(new URL(outputName?`../../verification/${outputName}`:small?'../../verification/real-ollama-small-results.json':translationOnly?'../../verification/real-ollama-translation-results.json':'../../verification/real-ollama-results.json',import.meta.url),JSON.stringify(results,null,2));
