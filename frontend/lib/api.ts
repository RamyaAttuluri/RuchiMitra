// Only the public address is sent to the browser. Backend secrets stay server-side.
export const API_URL=(process.env.NEXT_PUBLIC_API_URL||'http://localhost:5000/api').replace(/\/$/,'');
export async function api<T=any>(path:string, init:RequestInit={}):Promise<T>{
 const res=await apiFetch(`${API_URL}${path}`,{...init,credentials:'include',headers:{...(init.body?{'Content-Type':'application/json'}:{}),...init.headers},cache:'no-store'});
 const data=await res.json().catch(()=>({error:'Unexpected server response'}));
 if(!res.ok)throw new Error(data.error||`Request failed (${res.status})`);
 return data as T;
}
export const json=(obj:unknown)=>JSON.stringify(obj);

export async function apiFetch(input:RequestInfo|URL,init:RequestInit={},timeoutMs=20000){
 const timeout=AbortSignal.timeout(timeoutMs);const signal=init.signal?AbortSignal.any([init.signal,timeout]):timeout;
 try{return await fetch(input,{...init,signal,credentials:'include',cache:'no-store'})}
 catch(error){if(timeout.aborted&&!init.signal?.aborted)throw new Error('The browser request timed out. Your recipe remains available; retry this operation.');if(error instanceof TypeError&&!signal.aborted)throw new Error('Cannot reach the recipe server. Check your connection and retry when the server is running. Your recipe remains available.');throw error}
}

// Uploaded photos are stored by the backend as /uploads/<file>; everything else is already an absolute URL.
export const API_ORIGIN=new URL(API_URL).origin;
export const imageSrc=(url:string)=>url.startsWith('/uploads/')?`${API_ORIGIN}${url}`:url;
