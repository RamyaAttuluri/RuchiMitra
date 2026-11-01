type SearchStorage={getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void};
const key=(userId:string)=>`recipe-searches:${userId}`;
export function recentSearches(storage:SearchStorage,userId:string):string[]{try{const value=JSON.parse(storage.getItem(key(userId))||'[]');return Array.isArray(value)?value.filter((q):q is string=>typeof q==='string'&&q.length>0&&q.length<=80).slice(0,10):[]}catch{return []}}
export function rememberSearch(storage:SearchStorage,userId:string,query:string){const text=query.trim().slice(0,80);if(!text||!userId)return;try{storage.setItem(key(userId),JSON.stringify([text,...recentSearches(storage,userId).filter(q=>q.toLowerCase()!==text.toLowerCase())].slice(0,10)))}catch{}}
export function clearSearches(storage:SearchStorage,userId:string){try{storage.removeItem(key(userId))}catch{}}
