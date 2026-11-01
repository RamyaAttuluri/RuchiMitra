import {createHash} from 'node:crypto';
import {ProviderError} from './ai.js';
import {assertAudibleWav} from './audio.js';
export type AudioClip={type:string;audio:Buffer;engine?:string;voice?:string};
const base=()=> (process.env.LOCAL_INFERENCE_URL||'http://127.0.0.1:8001').replace(/\/$/,'');
let activeModelVersion=process.env.TTS_MODEL_VERSION||'unprobed';
export async function localCapabilities(){
 const read=async(url:string)=>{const r=await fetch(`${url}/health`,{signal:AbortSignal.timeout(3000)});if(!r.ok)throw Error();return r.json()};
 const translationBase=(process.env.TRANSLATION_INFERENCE_URL||base()).replace(/\/$/,'');
 const [speech,translation]=await Promise.allSettled([read(base()),read(translationBase)]);
 if(speech.status==='fulfilled'&&typeof speech.value?.tts?.version==='string')activeModelVersion=speech.value.tts.version;
 const missing={available:false,languages:[] as string[],voices:[] as {id:string;language:string;engine:string;license:string;developmentOnly:boolean;available:boolean}[],engine:'auto',version:'unconfigured',error:'Start the internal inference service and configure authorized reference voices.'};
 return {tts:speech.status==='fulfilled'&&Array.isArray(speech.value?.tts?.languages)?speech.value.tts as typeof missing:missing,translation:translation.status==='fulfilled'?translation.value?.translation??{available:false}:{available:false}};
}
const cache=new Map<string,AudioClip>();const pending=new Map<string,Promise<AudioClip>>();let active=0;
export async function cachedSynthesis(text:string,language:string,speed:number,voice:string,cloud?:()=>Promise<AudioClip>,context:{recipeId?:string;recipeVersion?:string;stepId?:string}={}){
 const configured=process.env.TTS_PROVIDER||'auto';const provider=['auto','local','piper','espeak'].includes(configured)?'local':configured;const enabled=process.env.TTS_CACHE_ENABLED!=='false';
 const key=createHash('sha256').update(JSON.stringify([context,configured,process.env.TTS_MODEL_VERSION||activeModelVersion,process.env.GEMINI_TTS_MODEL,process.env.GEMINI_TTS_VOICE,text.normalize('NFC').replace(/\s+/g,' ').trim(),language,voice,speed])).digest('hex');
 const hit=enabled?cache.get(key):undefined;if(hit){cache.delete(key);cache.set(key,hit);return hit}
 const existing=pending.get(key);if(existing)return existing;
 if(active>=1)throw new ProviderError('Local narration is busy. Wait for the current synthesis to finish.',503,'TTS_BUSY');
 const task=(async()=>{active++;try{
  let clip:AudioClip;
  if(provider==='local'){
   const r=await fetch(`${base()}/synthesize`,{method:'POST',signal:AbortSignal.timeout(Number(process.env.TTS_TIMEOUT_MS)||180000),headers:{'Content-Type':'application/json'},body:JSON.stringify({text,language,speed,voice})});
   if(!r.ok){const error=await r.json().catch(()=>null);throw new ProviderError(error?.detail||'Local synthesis failed. Check reference voice configuration and model installation.',r.status===422?400:503,'LOCAL_TTS_FAILED')}
   if(!r.headers.get('content-type')?.startsWith('audio/wav'))throw new ProviderError('Local TTS returned a non-audio response.',502,'TTS_INVALID_AUDIO');
   if(Number(r.headers.get('content-length'))>16*1024*1024)throw new ProviderError('Audio exceeds size limit.',502);
   const reader=r.body!.getReader();const buffers:Buffer[]=[];let bytes=0;
   try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>16*1024*1024)throw new ProviderError('Audio exceeds size limit.',502,'TTS_INVALID_AUDIO');buffers.push(Buffer.from(value))}}finally{await reader.cancel()}
   clip={type:'audio/wav',audio:Buffer.concat(buffers),engine:r.headers.get('X-Narration-Engine')||'local',voice:r.headers.get('X-Narration-Voice')||voice};
  }else if(cloud){
   try{clip={...await cloud(),engine:provider}}
   catch(e){
    // A quota failure is never retried against the exhausted cloud. Try local once, if configured.
    if(!(e instanceof ProviderError)||e.code!=='AI_QUOTA')throw e;
    const health=await localCapabilities();if(!health.tts.available||!health.tts.languages.includes(language))throw e;
    const response=await fetch(`${base()}/synthesize`,{method:'POST',signal:AbortSignal.timeout(Number(process.env.TTS_TIMEOUT_MS)||180000),headers:{'Content-Type':'application/json'},body:JSON.stringify({text,language,speed,voice})});
    if(!response.ok||!response.headers.get('content-type')?.startsWith('audio/wav'))throw new ProviderError('Cloud quota is exhausted and the configured local fallback failed. Check /api/tts/status.',503,'TTS_FALLBACK_FAILED');
    // Keep the same bounded streaming reader for fallback audio.
    const reader=response.body!.getReader(),buffers:Buffer[]=[];let bytes=0;
    try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>16*1024*1024)throw new ProviderError('Audio exceeds size limit.',502,'TTS_INVALID_AUDIO');buffers.push(Buffer.from(value))}}finally{await reader.cancel()}
    clip={type:'audio/wav',audio:Buffer.concat(buffers),engine:health.tts.engine};
   }
  }else throw new ProviderError('Selected narration provider is not configured.',503,'TTS_UNAVAILABLE');
  assertAudibleWav(clip.audio);
  if(enabled)cache.set(key,clip);let bytes=[...cache.values()].reduce((n,c)=>n+c.audio.length,0);while(cache.size>80||bytes>32*1024*1024){const first=cache.keys().next().value!;bytes-=cache.get(first)!.audio.length;cache.delete(first)}return clip;
 }catch(e){if(e instanceof ProviderError)throw e;throw new ProviderError('Local narration is unavailable or timed out. Start the inference service and check /api/tts/status.',503,'LOCAL_TTS_UNAVAILABLE')}finally{active--}})();
 pending.set(key,task);try{return await task}finally{pending.delete(key)}
}
const translationsPending=new Map<string,Promise<any>>();
export async function translateLocally(recipe:any,language:'te'|'hi'){
 const key=createHash('sha256').update(JSON.stringify([recipe.name,recipe.description,recipe.tip,recipe.prepMinutes,recipe.cookMinutes,recipe.ingredients,recipe.steps,language])).digest('hex');
 const existing=translationsPending.get(key);if(existing)return existing;
 if(translationsPending.size>=1)throw new ProviderError('Translation is busy. Try again after the current recipe finishes.',503,'TRANSLATION_BUSY');
 const task=translateUncached(recipe,language);translationsPending.set(key,task);
 try{return await task}finally{translationsPending.delete(key)}
}
async function translateUncached(recipe:any,language:'te'|'hi'){
 const ingredients=typeof recipe.ingredients==='string'?JSON.parse(recipe.ingredients):recipe.ingredients;
 const steps=typeof recipe.steps==='string'?JSON.parse(recipe.steps):recipe.steps;
 const texts=[recipe.name,recipe.description,recipe.tip||'',`${recipe.name}. Preparation: ${recipe.prepMinutes} minutes. Cooking: ${recipe.cookMinutes} minutes.`,...ingredients.map((i:any)=>`${i.quantity??'to taste'} ${i.unit} ${i.name}`),...steps.flatMap((s:any)=>[s.title,s.text])];
 let r:Response;try{r=await fetch(`${(process.env.TRANSLATION_INFERENCE_URL||base()).replace(/\/$/,'')}/translate`,{method:'POST',signal:AbortSignal.timeout(180000),headers:{'Content-Type':'application/json'},body:JSON.stringify({texts,language})})}catch{throw new ProviderError('Local translation is unavailable. Start IndicTrans2; saved translations are still available.',503,'TRANSLATION_UNAVAILABLE')}
 if(!r.ok)throw new ProviderError('IndicTrans2 could not translate this recipe. Check the internal service model configuration.',503,'TRANSLATION_UNAVAILABLE');
 const {translations:t}=await r.json();if(!Array.isArray(t)||t.length!==texts.length||t.some(x=>typeof x!=='string'))throw new ProviderError('Incomplete local translation.',502,'TRANSLATION_INVALID');
 // Reject lost or altered numeric quantities, times and temperatures before saving.
 const numbers=(s:string)=>s.match(/\d+(?:\.\d+)?/g)?.sort().join('|')||'';
 if(texts.some((s:string,i:number)=>numbers(s)!==numbers(t[i])))throw new ProviderError('Translation changed a measurement or cooking time. Review the translation manually.',502,'TRANSLATION_NUMBERS');
 return {name:t[0],description:t[1],tip:t[2],intro:t[3],ingredients:t.slice(4,4+ingredients.length),steps:steps.map((_:any,i:number)=>({title:t[4+ingredients.length+i*2],text:t[5+ingredients.length+i*2]}))};
}
