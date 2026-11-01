import {z} from 'zod';
import {askRecipeAI,askGemini,ProviderError} from './ai.js';
import {translateLocally} from './local-services.js';
import {translationSchema} from './recipe-content.js';
import {bundledTranslation} from './bundled-translations.js';

const terms:Record<string,Record<string,string[]>>={hi:{salt:['नमक'],water:['पानी','जल'],oil:['तेल'],onion:['प्याज','प्याज़'],tomato:['टमाटर'],chicken:['चिकन','मुर्ग'],paneer:['पनीर'],rice:['चावल']},te:{salt:['ఉప్పు'],water:['నీరు','నీళ్లు','నీటి'],oil:['నూనె'],onion:['ఉల్లి'],tomato:['టమాట','టమోట'],chicken:['చికెన్','కోడి'],paneer:['పనీర్'],rice:['బియ్యం','బియ్య','అన్నం']}};
export function translationSource(recipe:any){
 const ingredients=typeof recipe.ingredients==='string'?JSON.parse(recipe.ingredients):recipe.ingredients;
 const steps=typeof recipe.steps==='string'?JSON.parse(recipe.steps):recipe.steps;
 return {name:recipe.name,description:recipe.description,tip:recipe.tip||'',intro:`${recipe.name}. Preparation ${recipe.prepMinutes} minutes. Cooking ${recipe.cookMinutes} minutes.`,ingredients:ingredients.map((i:any)=>i.quantity===null?`${i.name}, to taste`:`${i.quantity} ${i.unit} ${i.name}`),steps:steps.map((s:any)=>({title:s.title,text:s.text}))};
}
export function validateTranslation(recipe:any,language:'hi'|'te',raw:unknown){
 const partial=translationSource(recipe).steps.length===0;
 const schema=partial?translationSchema.extend({steps:z.array(translationSchema.shape.steps.element).length(0)}):translationSchema;
 const parsed=schema.safeParse(raw);if(!parsed.success)throw new ProviderError('AI translation is incomplete. Original content has been preserved.',502,'TRANSLATION_INVALID');
 const t=parsed.data,source=translationSource(recipe);
 if(t.ingredients.length!==source.ingredients.length||t.steps.length!==source.steps.length)throw new ProviderError('Translation changed the number or order of recipe rows.',502,'TRANSLATION_ROWS');
 const pairs:[string,string][]=[[source.name,t.name],[source.description,t.description||''],[source.tip,t.tip||''],[source.intro,t.intro],...source.ingredients.map((s:string,i:number)=>[s,t.ingredients[i]] as [string,string]),...source.steps.flatMap((s:any,i:number)=>[[s.title,t.steps[i].title],[s.text,t.steps[i].text]] as [string,string][])];
 const digits=(s:string)=>s.match(/\d+(?:\.\d+)?/g)?.sort().join('|')||'';
 const script=language==='te'?/[\u0c00-\u0c7f]/:/[\u0900-\u097f]/;
 const nativeText=(text:string)=>{const native=[...text].filter(c=>script.test(c)).length;const latin=text.match(/[a-z]/gi)?.length||0;return native>0&&native>=latin};
 const invalid=pairs.findIndex(([original,translated])=>digits(original)!==digits(translated)||original.trim()&&!nativeText(translated));
 if(invalid>=0)throw new ProviderError(`Translation lost native-language text or measurements in row ${invalid+1}. Original content has been preserved.`,502,'TRANSLATION_CONTENT');
 const ingredients=typeof recipe.ingredients==='string'?JSON.parse(recipe.ingredients):recipe.ingredients;
 if(ingredients.some((i:any,index:number)=>{const expected=terms[language][i.name.trim().toLowerCase()];return expected&&!expected.some(term=>t.ingredients[index].includes(term))}))throw new ProviderError('Translation changed a common ingredient identity. Review it before saving.',502,'TRANSLATION_INGREDIENT');
 if(new Set(t.steps.map(s=>s.text.trim())).size!==t.steps.length)throw new ProviderError('Translation repeated a cooking instruction.',502,'TRANSLATION_REPEATED');
 return t;
}
export async function translateRecipe(recipe:any,language:'hi'|'te',signal?:AbortSignal){
 const bundled=bundledTranslation(recipe,language,translationSource);
 if(bundled)return validateTranslation(recipe,language,bundled);
 const provider=process.env.TRANSLATION_PROVIDER||'ollama';
 if(provider==='local'||provider==='indictrans2')return validateTranslation(recipe,language,await translateLocally(recipe,language));
 if(provider!=='ollama'&&provider!=='gemini')throw new ProviderError('Unsupported TRANSLATION_PROVIDER.',503,'TRANSLATION_PROVIDER');
 const source=translationSource(recipe);
 // A flat array avoids repeated JSON keys and expensive regex grammars on a small CPU.
 // All fields remain in one request; runtime validation reconstructs and checks every row.
 const rows=[source.name,source.description,source.tip,source.intro,...source.ingredients,...source.steps.flatMap((s:any)=>[s.title,s.text])];
 const schema=z.object({rows:z.array(z.string().max(1600)).length(rows.length)});
 const example=language==='te'?'Rice → బియ్యం; Boil 2 cups water. → 2 కప్పుల నీరు మరిగించండి.':'Rice → चावल; Boil 2 cups water. → 2 कप पानी उबालें।';
 const prompt=`Translate every string in this array into ${language==='te'?'Telugu (తెలుగు)':'Hindi (हिन्दी)'}. Use native script, including names and units. ${example} Keep Arabic digits such as 2 and 15 unchanged. Keep empty strings empty. Preserve meaning, ingredient identities and array order. Return only {"rows":[...translated strings...]} with exactly ${rows.length} rows. Do not copy the English sentences. Input: ${JSON.stringify(rows)}`;
 const rebuild=(raw:unknown)=>{
  const parsed=schema.safeParse(raw);if(!parsed.success)throw new ProviderError('AI translation is incomplete. Original content has been preserved.',502,'TRANSLATION_INVALID');
  const output=parsed.data.rows;let offset=4+source.ingredients.length;
  return validateTranslation(recipe,language,{name:output[0],description:output[1],tip:output[2],intro:output[3],ingredients:output.slice(4,offset),steps:source.steps.map(()=>({title:output[offset++],text:output[offset++]}))});
 };
 if(provider==='gemini'){
  // Cloud replies occasionally drop a row or keep English; one retry fixes most of these cheaply.
  for(let attempt=0;;attempt++){
   // Accept the structured recipe shape too, in case the model ignores the flat-row format.
   try{const raw=await askGemini(prompt,{timeoutMs:120000});return raw&&typeof raw==='object'&&'rows' in raw?rebuild(raw):validateTranslation(recipe,language,raw)}
   catch(e){if(attempt>0||!(e instanceof ProviderError&&/^(TRANSLATION_|AI_INVALID_JSON|AI_EMPTY)/.test(e.code)))throw e;signal?.throwIfAborted()}
  }
 }
 return askRecipeAI(prompt,{provider:'ollama',operation:'translation',signal,maxOutputTokens:Math.min(4500,Math.max(600,Math.ceil(JSON.stringify(rows).length*1.7))),schema:z.toJSONSchema(schema) as Record<string,unknown>,validate:rebuild});
}
