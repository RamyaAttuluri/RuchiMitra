// Uses the real Express API, SQLite recipes, and local TTS. No audio fixtures or mocked media events.
// Requests are proxied only to give the separate validation port the app's configured Origin.
const {chromium}=require('../.local/browser-check/node_modules/playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
const base='http://localhost:3011',api='http://localhost:5000/api';
(async()=>{
 const results={cases:[],controls:[],physicalAudibility:'Human listening still required. Headless Edge verifies real target-language audio decoding and media events.'};
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 try{
  for(const [slug,language,mode] of [['andhra-chicken-curry','te','continue'],['paneer-butter-masala','hi','continue'],['andhra-chicken-curry','en','full']]){
   if(process.env.LIVE_CASE&&process.env.LIVE_CASE!==language)continue;
   console.log('Live narration',language,mode);
   const page=await browser.newPage({viewport:{width:1440,height:2600},reducedMotion:'reduce'});const requests=[],clips=[],errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{
    window.__clips=[];window.__maxActive=0;window.__speed=4;window.__audioEvents=[];window.__progress=[];
    new MutationObserver(()=>{const player=document.querySelector('.voice-player');if(!player)return;const state=player.getAttribute('data-status')+' '+document.querySelector('.voice-current-top>span')?.textContent;if(window.__progress.at(-1)?.state!==state)window.__progress.push({state,time:Date.now()})}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['data-status']});
    const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){if(!window.__clips.includes(this)){window.__clips.push(this);for(const event of ['playing','pause','ended','waiting','error'])this.addEventListener(event,()=>window.__audioEvents.push({event,time:Date.now(),position:this.currentTime,duration:this.duration}));this.addEventListener('playing',()=>{window.__maxActive=Math.max(window.__maxActive,window.__clips.filter(a=>!a.paused&&!a.ended).length)})}this.playbackRate=window.__speed;return play.call(this)};
   });
   await page.route('**/api/**',async route=>{
    const request=route.request(),headers={'Access-Control-Allow-Origin':base,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
    try{
     const body=request.postData();if(request.url().endsWith('/tts/synthesize'))requests.push(JSON.parse(body));
     const response=await fetch(request.url(),{method:request.method(),headers:{Origin:'http://localhost:3000',...(body?{'Content-Type':'application/json'}:{})},...(body?{body}:{}),signal:AbortSignal.timeout(190000)});
     const bytes=Buffer.from(await response.arrayBuffer());
     if(request.url().endsWith('/tts/synthesize'))clips.push({status:response.status,bytes:bytes.length,engine:response.headers.get('x-narration-engine'),voice:response.headers.get('x-narration-voice'),contentType:response.headers.get('content-type')});
     return route.fulfill({status:response.status,body:bytes,headers:{...headers,'Content-Type':response.headers.get('content-type')||'application/json','X-Narration-Engine':response.headers.get('x-narration-engine')||'','Access-Control-Expose-Headers':'X-Narration-Engine'}});
    }catch(e){errors.push(e.message);return route.fulfill({status:502,json:{error:'Verification proxy request failed'},headers})}
   });
   await page.goto(`${base}/recipe/${slug}`,{waitUntil:'domcontentloaded'});
   const player=page.locator('.voice-player');await player.waitFor();
   await player.getByRole('combobox').nth(0).selectOption(language);
   await player.getByRole('combobox').nth(1).selectOption('server');
   const {recipe}=await (await fetch(`${api}/recipes/${slug}`)).json();
   await player.getByRole('button',{name:mode==='full'?'Play full recipe':'Play step & continue',exact:true}).click();
   if(language==='te'){
    await page.waitForFunction(()=>document.querySelector('.voice-current-top>span')?.textContent==='STEP 3 OF 6'&&document.querySelector('.voice-player')?.getAttribute('data-status')==='playing',null,{timeout:90000});
    await player.getByRole('button',{name:'Pause',exact:true}).click();assert.equal(await player.getAttribute('data-status'),'paused');await player.getByRole('button',{name:'Resume',exact:true}).click();
   }
   try{await page.waitForFunction(()=>['completed','error'].includes(document.querySelector('.voice-player')?.getAttribute('data-status')),null,{timeout:60000})}catch(error){const diagnostics=await page.evaluate(()=>({progress:window.__progress,events:window.__audioEvents,clips:window.__clips.map(a=>({paused:a.paused,ended:a.ended,current:a.currentTime,duration:a.duration,ready:a.readyState,error:a.error?.code})),player:document.querySelector('.voice-player')?.textContent}));fs.writeFileSync('verification/browser-live-failure.json',JSON.stringify({language,requests,clips,errors,...diagnostics},null,2));throw error}
   assert.equal(await player.getAttribute('data-status'),'completed',await player.textContent());
   const steps=(language==='en'?recipe.steps:recipe.translations[language].steps).map(s=>`${s.title}. ${s.text}`);
   assert.deepEqual(requests.filter(r=>steps.includes(r.text)).map(r=>r.text),steps);
   assert.equal(requests.length,mode==='full'?recipe.ingredients.length+7:6);assert.ok(clips.every(c=>c.status===200&&c.bytes>3200&&c.contentType.startsWith('audio/wav')));assert.deepEqual(errors,[]);
   const maxActive=await page.evaluate(()=>window.__maxActive);assert.ok(maxActive<=1);
   results.cases.push({language,mode,steps:6,requests:requests.length,engines:[...new Set(clips.map(c=>c.engine))],voices:[...new Set(clips.map(c=>c.voice))],completed:true,maxSimultaneousAudio:maxActive,actualAudio:true});
   if(language==='te'){
    await page.evaluate(()=>{window.__speed=1.5});
    await page.locator('.step-item').nth(2).getByRole('button',{name:'Read step',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.voice-player')?.getAttribute('data-status')==='playing');
    await player.getByRole('button',{name:'Next step',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.voice-current-top>span')?.textContent==='STEP 4 OF 6');
    await player.getByRole('button',{name:'Previous step',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.voice-current-top>span')?.textContent==='STEP 3 OF 6');
    await player.getByRole('button',{name:'Stop narration',exact:true}).click();assert.equal(await player.getAttribute('data-status'),'stopped');
    await page.waitForFunction(()=>window.__clips.every(a=>a.paused||a.ended));
    await player.getByRole('button',{name:'Play step & continue',exact:true}).click();await player.getByRole('combobox').nth(0).selectOption('hi');
    await page.waitForFunction(()=>window.__clips.every(a=>a.paused||a.ended));assert.equal(await player.getByRole('combobox').nth(0).inputValue(),'hi');
    results.controls.push('pause/resume step 3','read one step','next/previous','stop','language switch cancels old audio');
    await player.getByRole('button',{name:'Play step & continue',exact:true}).click();const related=page.locator('.related-card').first();const next=await related.getAttribute('href');await related.click();await page.waitForURL('**'+next);await page.waitForFunction(()=>window.__clips.every(a=>a.paused||a.ended));assert.ok((await page.locator('.voice-player').getAttribute('data-status'))!=='playing');results.controls.push('related recipe navigation cancels audio');
   }
   await page.close();
  }
  fs.writeFileSync('verification/browser-live-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
