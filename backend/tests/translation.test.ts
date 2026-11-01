import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {translateRecipe,validateTranslation,translationSource} from '../src/translation.js';
import {aiStatus,askRecipeAI} from '../src/ai.js';
import {recipeSchema} from '../src/recipe-content.js';
const original=fetch;
afterEach(()=>{globalThis.fetch=original;delete process.env.TRANSLATION_PROVIDER;delete process.env.AI_PROVIDER});
const recipe={name:'Rice',description:'A simple dish.',tip:'Serve warm.',prepMinutes:5,cookMinutes:15,ingredients:[{name:'Rice',quantity:2,unit:'cups'},{name:'Water',quantity:4,unit:'cups'}],steps:[{title:'Boil water',text:'Boil 4 cups water.'},{title:'Simmer rice',text:'Add rice and cook for 15 minutes.'}]};
const valid={name:'चावल',description:'एक सरल व्यंजन।',tip:'गरम परोसें।',intro:'चावल। तैयारी 5 मिनट। पकाना 15 मिनट।',ingredients:['चावल 2 कप','पानी 4 कप'],steps:[{title:'पानी उबालें',text:'4 कप पानी उबालें।'},{title:'चावल पकाएं',text:'चावल डालें और 15 मिनट पकाएं।'}]};
test('translation validates native text, exact numbers, rows and common ingredient identity',()=>{
 assert.equal(validateTranslation(recipe,'hi',valid).name,'चावल');
 for(const raw of [{...valid,ingredients:['पनीर 2 कप','पानी 4 कप']},{...valid,intro:'चावल। तैयारी 5 मिनट। पकाना 10 मिनट।'},{...valid,steps:valid.steps.slice(1)},{...valid,name:'Rice'},{...valid,name:'Rice क'}])assert.throws(()=>validateTranslation(recipe,'hi',raw));
});
test('serving-only translation accepts an empty step array while preserving ingredient measurements',()=>{
 assert.equal(validateTranslation({...recipe,steps:[]},'hi',{...valid,steps:[]}).steps.length,0);
});
test('Ollama translation reconstructs flat rows and preserves measurements',async()=>{
 process.env.TRANSLATION_PROVIDER='ollama';process.env.AI_PROVIDER='gemini';
 globalThis.fetch=(async(_url,init)=>{const request=JSON.parse(String(init?.body));assert.equal(request.think,false);assert.equal(request.stream,false);assert.equal(request.format.properties.rows.minItems,10);
 const rows=[valid.name,valid.description,valid.tip,valid.intro,...valid.ingredients,...valid.steps.flatMap(step=>[step.title,step.text])];
 return Response.json({message:{content:JSON.stringify({rows})},done:true});}) as typeof fetch;
 assert.deepEqual((await translateRecipe(recipe,'hi')).ingredients,valid.ingredients);
});
test('AI status uses actual model tags and reports absent or disconnected model',async()=>{
 globalThis.fetch=(async()=>Response.json({models:[{name:'different-model:4b'}]})) as typeof fetch;assert.deepEqual((await aiStatus()).modelAvailable,false);
 globalThis.fetch=(async()=>{throw Error('offline')}) as typeof fetch;assert.equal((await aiStatus()).connected,false);
});
test('validated generation results are cached; invalid content is not returned as success',async()=>{
 let calls=0;globalThis.fetch=(async()=>{calls++;return Response.json({message:{content:'{"ok":true}'},done:true})}) as typeof fetch;
 const options={schema:{type:'object',properties:{ok:{const:true}}},validate:(value:any)=>{assert.equal(value.ok,true);return value}};
 await askRecipeAI('unique cache test',options);await askRecipeAI('unique cache test',options);assert.equal(calls,1);
});
test('cached AI responses are revalidated before caller transformations',async()=>{
 let calls=0;globalThis.fetch=(async()=>{calls++;return Response.json({message:{content:'{"rows":["translated"]}'},done:true})}) as typeof fetch;
 const options={validate:(raw:any)=>({name:raw.rows[0]})};
 assert.deepEqual(await askRecipeAI('transformed cache test',options),{name:'translated'});
 assert.deepEqual(await askRecipeAI('transformed cache test',options),{name:'translated'});
 assert.equal(calls,1);
});
test('recipe schema rejects repeated and empty generic cooking actions',()=>{
 const data={...recipe,cuisine:'Indian',category:'Vegan',difficulty:'Easy',servings:2,steps:[{title:'First',text:'Follow the steps.',minutes:null},{title:'Second',text:'Follow the steps.',minutes:null}]};assert.equal(recipeSchema.safeParse(data).success,false);
});
