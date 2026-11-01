import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {cachedSynthesis,localCapabilities,translateLocally} from '../src/local-services.js';
import {askRecipeAI,providerError} from '../src/ai.js';
const original=fetch;afterEach(()=>{globalThis.fetch=original;delete process.env.TTS_PROVIDER;delete process.env.AI_PROVIDER});
function wav(){const b=Buffer.alloc(4844);b.write('RIFF');b.writeUInt32LE(4836,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(24000,24);b.writeUInt32LE(48000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(4800,40);for(let i=44;i<b.length;i+=2)b.writeInt16LE(Math.round(5000*Math.sin(i)),i);return b}
test('local audio deduplicates, caches and remains usable after Gemini 429',async()=>{
 process.env.TTS_PROVIDER='local';let calls=0;globalThis.fetch=(async()=>{calls++;return new Response(wav(),{headers:{'Content-Type':'audio/wav'}})}) as typeof fetch;
 const [a,b]=await Promise.all([cachedSynthesis('cached local sample','te',1,'default'),cachedSynthesis('cached local sample','te',1,'default')]);assert.equal(calls,1);assert.equal(a,b);
 globalThis.fetch=(async()=>{calls++;throw providerError(429,{})}) as typeof fetch;assert.equal(await cachedSynthesis('cached local sample','te',1,'default'),a);assert.equal(calls,1);
});
test('invalid audio is not cached and failures are never retried automatically',async()=>{
 process.env.TTS_PROVIDER='local';let calls=0;globalThis.fetch=(async()=>{calls++;return Response.json({audio:'fake'})}) as typeof fetch;
 for(let i=0;i<2;i++)await assert.rejects(cachedSynthesis('invalid sample','hi',1,'default'),(e:any)=>e.code==='TTS_INVALID_AUDIO');assert.equal(calls,2);
});
test('explicit cloud quota error tries working local engine exactly once',async()=>{
 process.env.TTS_PROVIDER='gemini';let cloudCalls=0,localCalls=0;
 globalThis.fetch=(async(url)=>{if(String(url).endsWith('/health'))return Response.json({tts:{available:true,languages:['hi'],engine:'espeak',version:'1'}});localCalls++;return new Response(wav(),{headers:{'Content-Type':'audio/wav'}})}) as typeof fetch;
 const clip=await cachedSynthesis('cloud quota fallback sample','hi',1,'default',async()=>{cloudCalls++;throw providerError(429,{})});
 assert.equal(cloudCalls,1);assert.equal(localCalls,1);assert.equal(clip.engine,'espeak');
});
test('missing internal service reports no available languages',async()=>{globalThis.fetch=(async()=>{throw Error('offline')}) as typeof fetch;const d=await localCapabilities();assert.equal(d.tts.available,false);assert.deepEqual(d.tts.languages,[])});
test('Ollama receives schema, no thinking, cancellation signal and private model defaults',async()=>{
 globalThis.fetch=(async(url,init)=>{assert.match(String(url),/^http:\/\/127.0.0.1:11434\/api\/chat$/);const body=JSON.parse(String(init?.body));assert.equal(body.model,'qwen3:4b');assert.equal(body.think,false);assert.equal(body.format.type,'object');assert.ok(init?.signal);return Response.json({message:{content:'{"name":"Curry"}'},done:true})}) as typeof fetch;
 assert.deepEqual(await askRecipeAI('recipe',{schema:{type:'object'}}),{name:'Curry'});
});
test('local AI unavailable is actionable; translation rejects changed numbers',async()=>{
 globalThis.fetch=(async()=>{throw Error('offline')}) as typeof fetch;await assert.rejects(askRecipeAI('recipe'),(e:any)=>e.code==='OLLAMA_UNAVAILABLE');
 globalThis.fetch=(async()=>Response.json({translations:['Curry','Description','','Curry 99 minutes','2 g salt','Heat','Heat for 3 minutes']})) as typeof fetch;
 await assert.rejects(translateLocally({name:'Curry',description:'Description',prepMinutes:2,cookMinutes:3,ingredients:[{quantity:2,unit:'g',name:'salt'}],steps:[{title:'Heat',text:'Heat for 3 minutes'}]},'hi'),(e:any)=>e.code==='TRANSLATION_NUMBERS');
});
