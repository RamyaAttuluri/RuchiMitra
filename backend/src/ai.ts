// Never return provider bodies: they may contain credentials or user data.
export class ProviderError extends Error {
 constructor(message:string,public status=502,public code='AI_UNAVAILABLE'){super(message)}
}
export function providerError(status:number,body:any,service='Recipe AI'){
 const reason=String(body?.error?.message||'').toLowerCase();
 if(status===429)return new ProviderError(`${service} quota or rate limit reached. Check Google AI Studio usage and billing, then try later.`,503,'AI_QUOTA');
 if(status===402)return new ProviderError(`${service} credits are depleted. Add credits in Google AI Studio.`,503,'AI_BILLING');
 if(status===401||status===403||reason.includes('api key'))return new ProviderError(`${service} credentials were rejected. Check the backend API key, API restrictions, project access and billing; replace any leaked or blocked key and restart the backend.`,503,'AI_CREDENTIALS');
 if(status===404)return new ProviderError(`${service} model is unavailable. Set a supported model in the backend environment and restart.`,503,'AI_MODEL');
 if(status===400)return new ProviderError(`${service} rejected the request. Check model compatibility, project region and billing in Google AI Studio.`,502,'AI_REQUEST');
 return new ProviderError(`${service} is temporarily unavailable. Please try again shortly.`);
}
let active=0;
const calls:number[]=[];
// A process-wide budget also protects anonymous routes; scale out only with shared quotas.
export async function withAiBudget<T>(fn:()=>Promise<T>):Promise<T>{
 const now=Date.now();while(calls.length&&calls[0]<now-3600000)calls.shift();
 const configured=Number(process.env.AI_REQUESTS_PER_HOUR||120);const max=Number.isFinite(configured)&&configured>=1?Math.floor(configured):120;
 if(active>=4||calls.length>=max)throw new ProviderError('AI is busy or its hourly budget is reached. Please try later.',503,'AI_BUDGET');
 calls.push(now);active++;
 try{return await fn()}finally{active--}
}
export async function askGemini(prompt:string,options:{timeoutMs?:number;maxOutputTokens?:number}={}):Promise<any>{
 const key=process.env.GEMINI_API_KEY?.trim();
 if(!key)throw new ProviderError('Recipe AI is not configured. Add GEMINI_API_KEY to backend/.env and restart.',503,'AI_NOT_CONFIGURED');
 return withAiBudget(async()=>{
  const model=process.env.GEMINI_MODEL?.trim()||'gemini-3.8-flash';
  try{
   for(let attempt=0;attempt<2;attempt++){
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
     method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},signal:AbortSignal.timeout(options.timeoutMs??55000),
     body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:options.maxOutputTokens??8192,...(/^gemini-[34]/.test(model)?{thinkingConfig:{thinkingLevel:'low'}}:{temperature:0.2})}})
    });
    const data=await response.json().catch(()=>null);
    // Only retry transient server failures, once. Do not repeatedly consume exhausted quota.
    if(!response.ok){if(response.status>=500&&attempt===0){await new Promise(r=>setTimeout(r,600+Math.random()*400));continue}throw providerError(response.status,data)}
    const candidate=data?.candidates?.[0];
    if(candidate?.finishReason==='MAX_TOKENS')throw new ProviderError('AI response was too long. Try a simpler recipe.',502,'AI_TRUNCATED');
    const result=candidate?.content?.parts?.filter((p:any)=>typeof p.text==='string'&&!p.thought).map((p:any)=>p.text).join('');
    if(!result)throw new ProviderError('AI could not produce this content. Try a different dish.',502,'AI_EMPTY');
    try{return JSON.parse(result.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''))}catch{throw new ProviderError('AI returned incomplete data. Please try again.',502,'AI_INVALID_JSON')}
   }
  }catch(e){
   if(e instanceof ProviderError)throw e;
   if(e instanceof Error&&['TimeoutError','AbortError'].includes(e.name))throw new ProviderError('AI request timed out. Please try again.',504,'AI_TIMEOUT');
   throw new ProviderError('Could not connect to Google AI. Check the backend network connection.',502,'AI_NETWORK');
  }
 });
}
