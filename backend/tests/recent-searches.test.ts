import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rememberSearch,recentSearches,clearSearches} from '../../frontend/lib/recent-searches.js';
test('recent searches are bounded, deduplicated, user-scoped and clearable',()=>{
 const values=new Map<string,string>();const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)},removeItem:(key:string)=>{values.delete(key)}};
 for(let i=0;i<15;i++)rememberSearch(storage,'alice',`Curry ${i}`);rememberSearch(storage,'alice','CURRY 14');assert.equal(recentSearches(storage,'alice').length,10);assert.equal(recentSearches(storage,'alice')[0],'CURRY 14');assert.deepEqual(recentSearches(storage,'bob'),[]);clearSearches(storage,'alice');assert.deepEqual(recentSearches(storage,'alice'),[]);
});
