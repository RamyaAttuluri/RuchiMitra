// Only the public address is sent to the browser. Backend secrets stay server-side.
export const API_URL=(process.env.NEXT_PUBLIC_API_URL||'http://localhost:5000/api').replace(/\/$/,'');
export async function api<T=any>(path:string, init:RequestInit={}):Promise<T>{
 const res=await apiFetch(`${API_URL}${path}`,{...init,credentials:'include',headers:{...(init.body?{'Content-Type':'application/json'}:{}),...init.headers},cache:'no-store'});
 const data=await res.json().catch(()=>({error:'Unexpected server response'}));
 if(!res.ok)throw new Error(data.error||`Request failed (${res.status})`);
 return data as T;
}
export const json=(obj:unknown)=>JSON.stringify(obj);

export function apiFetch(input:RequestInfo|URL,init:RequestInit={}){const timeout=AbortSignal.timeout(125000);const signal=init.signal?AbortSignal.any([init.signal,timeout]):timeout;return fetch(input,{...init,signal,credentials:'include',cache:'no-store'});}

// Uploaded photos are stored by the backend as /uploads/<file>; everything else is already an absolute URL.
export const API_ORIGIN=new URL(API_URL).origin;
export const imageSrc=(url:string)=>url.startsWith('/uploads/')?`${API_ORIGIN}${url}`:url;
