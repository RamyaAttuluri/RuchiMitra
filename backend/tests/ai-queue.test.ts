import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {withAiBudget,sharedWork,queueStatus,type SharedMap} from '../src/inference-queue.js';
import {askRecipeAI} from '../src/ai.js';
const original=fetch;const env={...process.env};
afterEach(()=>{globalThis.fetch=original;for(const key of ['AI_MAX_CONCURRENT','AI_QUEUE_LIMIT','AI_QUEUE_TIMEOUT_MS','AI_REQUESTS_PER_HOUR','AI_PROVIDER']){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key]}});
test('one active job queues a second and releases it without overlap',async()=>{
 process.env.AI_MAX_CONCURRENT='1';let release!:()=>void;const first=withAiBudget(()=>new Promise<void>(resolve=>release=resolve));let started=false;
 const second=withAiBudget(async()=>{started=true;return 2});assert.equal(started,false);assert.equal(queueStatus().waiting,1);release();await first;assert.equal(await second,2);assert.equal(queueStatus().active,0);
});
test('queue full, queue timeout and caller cancellation have separate codes',async()=>{
 process.env.AI_QUEUE_LIMIT='1';process.env.AI_QUEUE_TIMEOUT_MS='100';let release!:()=>void;const first=withAiBudget(()=>new Promise<void>(resolve=>release=resolve));
 const abort=new AbortController();const cancelled=withAiBudget(async()=>1,abort.signal);const rejection=assert.rejects(cancelled,{code:'AI_CANCELLED'});
 await assert.rejects(withAiBudget(async()=>2),{code:'AI_QUEUE_FULL'});abort.abort();await rejection;
 await assert.rejects(withAiBudget(async()=>3),{code:'AI_QUEUE_TIMEOUT'});release();await first;
});
test('deduplicated callers cancel independently and last cancellation aborts work',async()=>{
 const map:SharedMap<number>=new Map();let release!:(v:number)=>void;let calls=0;let underlying:AbortSignal|undefined;
 const work=(signal:AbortSignal)=>{calls++;underlying=signal;return new Promise<number>(resolve=>release=resolve)};
 const abort=new AbortController();const a=sharedWork(map,'same',work,abort.signal),b=sharedWork(map,'same',work);await Promise.resolve();
 const rejection=assert.rejects(a,{code:'AI_CANCELLED'});abort.abort();await rejection;assert.equal(underlying?.aborted,false);release(7);assert.equal(await b,7);assert.equal(calls,1);
 const last=new AbortController();const c=sharedWork(map,'last',work,last.signal);await Promise.resolve();const rejected=assert.rejects(c,{code:'AI_CANCELLED'});last.abort();await rejected;assert.equal(underlying?.aborted,true);release(1);
});
test('Ollama timeout, cancellation, missing model, invalid response and disconnection are distinct',async()=>{
 const keepAlive=setInterval(()=>{},1000);try{
 process.env.AI_PROVIDER='ollama';
 globalThis.fetch=((_input,init)=>new Promise((_resolve,reject)=>init?.signal?.addEventListener('abort',()=>reject(init.signal?.reason),{once:true}))) as typeof fetch;
 await assert.rejects(askRecipeAI('timeout probe',{timeoutMs:15}),{code:'AI_TIMEOUT'});
 const abort=new AbortController();const job=askRecipeAI('cancel probe',{signal:abort.signal});const rejected=assert.rejects(job,{code:'AI_CANCELLED'});abort.abort();await rejected;
 globalThis.fetch=(async()=>new Response('{}',{status:404})) as typeof fetch;await assert.rejects(askRecipeAI('missing model probe'),{code:'OLLAMA_MODEL'});
 globalThis.fetch=(async()=>Response.json({message:{content:'not json'},done:true})) as typeof fetch;await assert.rejects(askRecipeAI('invalid JSON probe'),{code:'AI_INVALID_JSON'});
 globalThis.fetch=(async()=>{throw Error('offline')}) as typeof fetch;await assert.rejects(askRecipeAI('offline probe'),{code:'OLLAMA_UNAVAILABLE'});
 }finally{clearInterval(keepAlive)}
});
test('application hourly rate limit is separate from a busy model',async()=>{
 process.env.AI_REQUESTS_PER_HOUR='1';await assert.rejects(withAiBudget(async()=>1),{code:'AI_RATE_LIMIT'});
});
