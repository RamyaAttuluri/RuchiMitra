import {ProviderError} from './ai-error.js';
export const setting=(key:string,fallback:number,min:number,max:number)=>{const n=Number(process.env[key]??fallback);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback};
type Entry={resolve:()=>void;reject:(e:Error)=>void;signal?:AbortSignal;abort:()=>void;timer:ReturnType<typeof setTimeout>};
const waiting:Entry[]=[];let active=0;const calls:number[]=[];
export const queueStatus=()=>({active,waiting:waiting.length,limit:setting('AI_MAX_CONCURRENT',1,1,4)});
function drain(){while(waiting.length&&active<queueStatus().limit){const entry=waiting.shift()!;clearTimeout(entry.timer);entry.signal?.removeEventListener('abort',entry.abort);active++;entry.resolve()}}
export async function withAiBudget<T>(fn:()=>Promise<T>,signal?:AbortSignal):Promise<T>{
 signal?.throwIfAborted();
 const now=Date.now();while(calls.length&&calls[0]<now-3600000)calls.shift();
 if(calls.length>=setting('AI_REQUESTS_PER_HOUR',120,1,10000))throw new ProviderError('The application hourly AI request limit is reached. Try again later.',429,'AI_RATE_LIMIT');
 if(active>=queueStatus().limit){
  if(waiting.length>=setting('AI_QUEUE_LIMIT',6,0,20))throw new ProviderError('The local AI queue is full. Try again after the current requests finish.',503,'AI_QUEUE_FULL');
  await new Promise<void>((resolve,reject)=>{
   const remove=(error:Error)=>{const index=waiting.indexOf(entry);if(index>=0)waiting.splice(index,1);clearTimeout(entry.timer);signal?.removeEventListener('abort',entry.abort);reject(error)};
   const entry:Entry={resolve,reject,signal,abort:()=>remove(new ProviderError('AI request cancelled by the caller.',499,'AI_CANCELLED')),timer:setTimeout(()=>remove(new ProviderError('The local AI queue wait expired. Retry later; your recipe remains available.',503,'AI_QUEUE_TIMEOUT')),setting('AI_QUEUE_TIMEOUT_MS',90000,100,600000))};
   signal?.addEventListener('abort',entry.abort,{once:true});waiting.push(entry);if(signal?.aborted)entry.abort();
  });
 }else active++;
 try{
  signal?.throwIfAborted();
  // Check again after waiting, because another job may have consumed the budget.
  const start=Date.now();while(calls.length&&calls[0]<start-3600000)calls.shift();
  if(calls.length>=setting('AI_REQUESTS_PER_HOUR',120,1,10000))throw new ProviderError('The application hourly AI request limit is reached.',429,'AI_RATE_LIMIT');
  calls.push(start);return await fn();
 }finally{active--;drain()}
}

type Shared<T>={promise:Promise<T>;controller:AbortController;users:number};
// Each consumer can cancel independently. Abort the underlying job only when none remain.
export function sharedWork<T>(map:Map<string,Shared<T>>,key:string,work:(signal:AbortSignal)=>Promise<T>,signal?:AbortSignal):Promise<T>{
 if(signal?.aborted)return Promise.reject(new ProviderError('Request cancelled.',499,'AI_CANCELLED'));
 let entry=map.get(key);
 if(!entry){const controller=new AbortController();entry={controller,users:0,promise:Promise.resolve().then(()=>work(controller.signal))};map.set(key,entry);const current=entry;void entry.promise.finally(()=>{if(map.get(key)===current)map.delete(key)}).catch(()=>{})}
 const current=entry;current.users++;
 return new Promise<T>((resolve,reject)=>{
  let done=false;const finish=()=>{if(done)return false;done=true;signal?.removeEventListener('abort',abort);current.users--;if(!current.users){if(map.get(key)===current)map.delete(key);current.controller.abort()}return true};
  const abort=()=>{if(finish())reject(new ProviderError('Request cancelled by the caller.',499,'AI_CANCELLED'))};
  signal?.addEventListener('abort',abort,{once:true});
  current.promise.then(value=>{if(finish())resolve(structuredClone(value))},error=>{if(finish())reject(error)});
  if(signal?.aborted)abort();
 });
}
export type SharedMap<T>=Map<string,Shared<T>>;
