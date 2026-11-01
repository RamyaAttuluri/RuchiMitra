import type {PrismaClient,Recipe} from '@prisma/client';
import {createHash,randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,readdir,stat,unlink} from 'node:fs/promises';
import path from 'node:path';
import {backendRoot} from '../scripts/env.mjs';
import {translationSchema} from './recipe-content.js';
import {translateRecipe,translationSource} from './translation.js';
import {ProviderError} from './ai-error.js';
import {sharedWork,type SharedMap} from './inference-queue.js';
const pending:SharedMap<any>=new Map();
export const sourceHash=(recipe:any)=>createHash('sha256').update(JSON.stringify([translationSource(recipe),recipe.servings])).digest('hex');
// Exact, reviewed quantity phrases used by the bundled recipes. Match complete words
// only, and only a phrase equal to the source quantity; otherwise require translation.
const quantities:Record<string,string[]>={
 '0.25':['పావు','चौथाई','एक चौथाई'],'0.5':['అర','आधा','आधी'],'1':['ఒక','ఒకటి','एक'],
 '1.5':['ఒకటిన్నర','डेढ़'],'2':['రెండు','दो'],'3':['మూడు','तीन'],'4':['నాలుగు','चार'],
 '5':['ఐదు','पाँच','पांच'],'6':['ఆరు','छह'],'8':['ఎనిమిది','आठ'],
 '100':['వంద','सौ'],'200':['రెండు వందల','दो सौ'],'250':['రెండు వందల యాభై','ढाई सौ'],
 '500':['ఐదు వందల','पाँच सौ','पांच सौ']
};
export function scaleTranslation(recipe:any,translation:any,servings:number){
 const ingredients=typeof recipe.ingredients==='string'?JSON.parse(recipe.ingredients):recipe.ingredients;
 const rows=ingredients.map((ingredient:any,index:number)=>{
  const row=translation.ingredients[index];if(typeof row!=='string')return null;
  if(ingredient.quantity===null||ingredient.scalable===false)return row;
  const numbers=row.match(/\d+(?:\.\d+)?/g)||[];
  const amount=String(Math.round(ingredient.quantity*servings/recipe.servings*100)/100);
  if(numbers.length===1&&Number(numbers[0])===ingredient.quantity)return row.replace(/\d+(?:\.\d+)?/,amount);
  if(numbers.length)return null;
  for(const phrase of [...(quantities[String(ingredient.quantity)]||[])].sort((a,b)=>b.length-a.length)){
   const expression=new RegExp(`(^|[^\\p{L}\\p{M}])(${phrase})(?=$|[^\\p{L}\\p{M}])`,'gu');
   if([...row.matchAll(expression)].length===1)return row.replace(expression,(_match:string,prefix:string)=>prefix+amount);
  }
  return null;
 });
 return rows.some((row:any)=>row===null)?null:{...translation,ingredients:rows,servings};
}
const cacheRoot=()=>path.resolve(process.env.TRANSLATION_CACHE_DIR||path.join(backendRoot,'.cache','translations'));
async function persist(key:string,value:any){
 const root=cacheRoot();await mkdir(root,{recursive:true});
 const temp=path.join(root,`${key}.${randomBytes(5).toString('hex')}.tmp`);
 await writeFile(temp,JSON.stringify(value),'utf8');await rename(temp,path.join(root,`${key}.json`));
 // Bound disk use; content hashes make evicted entries safe to regenerate.
 const files=(await readdir(root)).filter(name=>/^[a-f0-9]{64}\.json$/.test(name));
 if(files.length>500){const dates=await Promise.all(files.map(async name=>({name,time:(await stat(path.join(root,name))).mtimeMs})));for(const file of dates.sort((a,b)=>a.time-b.time).slice(0,files.length-500))await unlink(path.join(root,file.name)).catch(()=>{})}
}
export async function getRecipeTranslation(db:PrismaClient,recipe:Recipe,language:'te'|'hi',servings=recipe.servings,signal?:AbortSignal){
 const stored=JSON.parse(recipe.translations);const base=stored[language];
 if(base){
  const parsed=translationSchema.safeParse(base);const script=language==='te'?/[\u0c00-\u0c7f]/:/[\u0900-\u097f]/;
  if(!parsed.success||base.ingredients.length!==JSON.parse(recipe.ingredients).length||base.steps.length!==JSON.parse(recipe.steps).length||![base.name,...base.ingredients,...base.steps.flatMap((s:any)=>[s.title,s.text])].every((text:string)=>script.test(text)))throw new ProviderError('The saved translation is incomplete. Ask an administrator to review it, or continue in English.',409,'TRANSLATION_STORED_INVALID');
 }
 if(base&&servings===recipe.servings)return translationSchema.parse(base);
 if(base){const scaled=scaleTranslation(recipe,base,servings);if(scaled)return scaled}
 const model=process.env.TRANSLATION_PROVIDER==='gemini'?process.env.GEMINI_MODEL:process.env.OLLAMA_MODEL||'qwen3:4b';
 const key=createHash('sha256').update(JSON.stringify([recipe.id,sourceHash(recipe),base,language,servings,process.env.TRANSLATION_PROVIDER||'ollama',model,process.env.OLLAMA_MODEL_VERSION,'flat-v2'])).digest('hex');
 return sharedWork(pending,key,async sharedSignal=>{
  let translated:any;
  try{const saved=JSON.parse(await readFile(path.join(cacheRoot(),`${key}.json`),'utf8'));if(saved.sourceHash===sourceHash(recipe))translated=translationSchema.parse(saved.translation)}catch{}
  if(!translated){
   if(base){
    const ingredients=JSON.parse(recipe.ingredients).map((i:any)=>({...i,quantity:i.quantity===null?null:i.scalable===false?i.quantity:Math.round(i.quantity*servings/recipe.servings*100)/100}));
    const scaled=await translateRecipe({...recipe,ingredients:JSON.stringify(ingredients),steps:'[]'},language,sharedSignal);
    translated=translationSchema.parse({...base,ingredients:scaled.ingredients});
   }else{
    const full=await translateRecipe(recipe,language,sharedSignal);
    // Save the complete base first, even if this consumer needs scaled ingredients
    // or scaling fails, so the expensive translation is never discarded.
    await saveBase(db,recipe,language,full);
    translated=servings===recipe.servings?full:scaleTranslation(recipe,full,servings);
    if(!translated)throw new ProviderError('The translation needs reviewed numeric ingredient amounts before scaling. Download the original servings or English instead.',409,'TRANSLATION_SCALING');
   }
   await persist(key,{sourceHash:sourceHash(recipe),model,language,servings,translation:translated}).catch(()=>console.warn('Translation disk cache could not be written; database translation remains available.'));
  }
  if(servings===recipe.servings)await saveBase(db,recipe,language,translated);
  return {...translated,servings};
 },signal);
}
async function saveBase(db:PrismaClient,recipe:Recipe,language:string,translation:any){
 await db.$transaction(async tx=>{
  const latest=await tx.recipe.findUniqueOrThrow({where:{id:recipe.id}});
  if(sourceHash(latest)!==sourceHash(recipe))throw new ProviderError('Recipe changed during translation. Reload and try again.',409,'RECIPE_CHANGED');
  const stored=JSON.parse(latest.translations);if(stored[language])return;
  await tx.recipe.update({where:{id:recipe.id},data:{translations:JSON.stringify({...stored,[language]:translation})}});
 });
}
