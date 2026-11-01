import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildQueue,NarrationController,type Adapter,type Item} from '../../frontend/lib/narration.js';
import {seeds} from '../prisma/seed-data.js';
import type {RecipeData,Lang} from '../../frontend/lib/types.js';
function recipe(slug:string){return {...seeds.find(x=>x.slug===slug)!,id:slug,source:'CURATED'} as RecipeData}
function harness(){
 const calls:{item:Item;events:Parameters<Adapter['start']>[1];stopped:boolean;paused:boolean}[]=[];
 const adapter:Adapter={start(item,events){const call={item,events,stopped:false,paused:false};calls.push(call);return {stop(){call.stopped=true},pause(){call.paused=true},resume(){call.paused=false;events.started()}}}};
 const controller=new NarrationController(adapter,()=>{});
 return {controller,calls,finish(){const c=calls.at(-1)!;c.events.started();c.events.ended();return c}};
}
for(const [slug,language] of [['andhra-chicken-curry','te'],['paneer-butter-masala','hi']] as const)test(`${language}: actual six-step ${slug}, duplicate ends and completion`,()=>{
 const r=recipe(slug);assert.equal(r.steps.length,6);const q=buildQueue(r,language,r.translations[language],'continue');const h=harness();h.controller.play(q,'continue');
 for(let i=0;i<6;i++){assert.equal(h.calls.at(-1)!.item.stepIndex,i);const old=h.finish();old.events.ended();old.events.failed(Error('stale'));assert.equal(h.calls.length,Math.min(i+2,6))}
 assert.equal(h.controller.state.status,'completed');assert.equal(h.calls.length,6);assert.ok(h.calls.at(-1)!.stopped);assert.equal(h.controller.state.queue.filter(x=>x.status==='completed').length,6);
});
test('English full mode narrates introduction once, every ingredient, then all steps',()=>{
 const r=recipe('andhra-chicken-curry');const q=buildQueue(r,'en',null,'full');assert.equal(new Set(q.map(i=>i.id)).size,q.length);const h=harness();h.controller.play(q,'full');
 while(h.controller.state.status!=='completed')h.finish();
 assert.equal(h.calls.length,1+r.ingredients.length+6);assert.equal(h.calls.filter(c=>c.item.type==='introduction').length,1);assert.deepEqual(h.calls.filter(c=>c.item.type==='step').map(c=>c.item.stepIndex),[0,1,2,3,4,5]);
});
test('pause/resume on step 3 keeps cursor and ignores premature end while paused',()=>{
 const r=recipe('andhra-chicken-curry'),h=harness();h.controller.play(buildQueue(r,'en',null,'continue'),'continue');h.finish();h.finish();const c=h.calls.at(-1)!;c.events.started();h.controller.send('PAUSE');assert.equal(c.paused,true);c.events.ended();assert.equal(h.controller.state.cursor,2);h.controller.send('RESUME');assert.equal(h.controller.state.status,'playing');c.events.ended();assert.equal(h.calls.at(-1)!.item.stepIndex,3);
});
test('language and recipe changes stop audio and invalidate pending started/ended/errors',()=>{
 const r=recipe('andhra-chicken-curry'),h=harness();h.controller.play(buildQueue(r,'te',r.translations.te,'continue'),'continue');const old=h.calls[0];h.controller.send('LANGUAGE_CHANGED');assert.ok(old.stopped);h.controller.play(buildQueue(r,'hi',r.translations.hi,'continue'),'continue');old.events.started();old.events.ended();old.events.failed(Error('stale'));assert.equal(h.calls.length,2);assert.equal(h.calls.at(-1)!.item.language,'hi');h.controller.send('RECIPE_CHANGED');assert.ok(h.calls[1].stopped);assert.equal(h.controller.state.status,'idle');
});
test('single step mode, restart mode, next, previous, stop and failed start',()=>{
 const r=recipe('andhra-chicken-curry'),h=harness();h.controller.play(buildQueue(r,'en',null,'single',2),'single');h.finish();assert.equal(h.controller.state.status,'completed');assert.equal(h.calls.length,1);h.controller.send('RESTART');assert.equal(h.calls.at(-1)!.item.stepIndex,2);h.controller.send('STOP');assert.equal(h.controller.state.status,'stopped');
 h.controller.play(buildQueue(r,'en',null,'full'),'full');h.controller.send('NEXT');assert.equal(h.calls.at(-1)!.item.stepIndex,0);h.controller.send('NEXT');assert.equal(h.calls.at(-1)!.item.stepIndex,1);h.controller.send('PREVIOUS');assert.equal(h.calls.at(-1)!.item.stepIndex,0);h.calls.at(-1)!.events.ended();assert.equal(h.controller.state.status,'error');
});
test('no fake progress, no retries after failure; exact approved content and quantities',()=>{
 const r=recipe('paneer-butter-masala'),h=harness();const q=buildQueue(r,'hi',r.translations.hi,'continue');assert.ok(q[0].text.startsWith(`${r.translations.hi.steps[0].title}. ${r.translations.hi.steps[0].text}`));assert.ok(q[0].text.includes('5 मिनट'));h.controller.play(q,'continue');assert.equal(h.controller.state.status,'loading');h.calls[0].events.failed(Error('quota'));assert.equal(h.controller.state.status,'error');assert.equal(h.calls.length,1);assert.equal(h.controller.state.queue.filter(x=>x.status==='completed').length,0);
 const scaled=buildQueue(r,'en',null,'full',0,8);assert.ok(scaled.find(i=>i.type==='ingredient')!.text.startsWith('700'));assert.throws(()=>buildQueue(r,'te',{...r.translations.te,steps:[]},'full'));
 assert.throws(()=>buildQueue(r,'hi',r.translations.hi,'full',0,8));
 const approved={...r.translations.hi,servings:8,ingredients:r.translations.hi.ingredients.map((s,i)=>i===0?'700 g paneer':s)};
 assert.equal(buildQueue(r,'hi',approved,'full',0,8).find(i=>i.type==='ingredient')!.text,'700 g paneer');
});

test('guided narration announces duration, waits without starting step 2, and ignores late callbacks',()=>{
 const r=recipe('fish-curry'),h=harness();const q=buildQueue(r,'en',null,'single');
 assert.match(q[0].text,/about 5 minutes/);assert.match(q[0].text,/Mark done/);
 h.controller.play(q,'single');const old=h.finish();assert.equal(h.controller.state.status,'completed');assert.equal(h.calls.length,1);
 h.controller.play(buildQueue(r,'en',null,'single',1),'single');old.events.ended();old.events.started();
 assert.equal(h.calls.length,2);assert.equal(h.calls[1].item.stepIndex,1);
});
