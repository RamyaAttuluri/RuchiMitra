// Real browser media events with an explicitly substituted English WAV fixture.
// This verifies React/HTMLAudio sequencing, NOT Telugu/Hindi synthesis or pronunciation.
const {chromium}=require('../.local/browser-check/node_modules/playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
const base=process.env.VERIFY_APP_URL||'http://localhost:3011';
const audio=fs.readFileSync('verification/english-device-sample.wav');
// Keep a short real speech segment so six-step browser checks finish promptly.
let dataOffset=12;while(audio.toString('ascii',dataOffset,dataOffset+4)!=='data'){const length=audio.readUInt32LE(dataOffset+4);dataOffset+=8+length+(length%2)}
const fixture=Buffer.from(audio.subarray(0,Math.min(audio.length,dataOffset+8+44100)));
fixture.writeUInt32LE(fixture.length-8,4);fixture.writeUInt32LE(fixture.length-dataOffset-8,dataOffset+4);
(async()=>{
 const recipes={};for(const slug of ['andhra-chicken-curry','paneer-butter-masala']){const response=await fetch(`http://localhost:5000/api/recipes/${slug}`,{signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);recipes[slug]=(await response.json()).recipe}
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 const results=[];
 try{
  for(const [slug,language,mode] of [['andhra-chicken-curry','te','continue'],['paneer-butter-masala','hi','continue'],['andhra-chicken-curry','en','full']]){
   const page=await browser.newPage({viewport:{width:1440,height:2600},reducedMotion:'reduce'});const requests=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const headers={'Access-Control-Allow-Origin':base,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, GET, OPTIONS'};
   await page.route('**/api/**',async route=>{
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
    if(route.request().url().endsWith('/status'))return route.fulfill({json:{available:true,provider:'local',engine:'english-test-fixture',languages:['en','te','hi']},headers});
    if(!route.request().url().endsWith('/tts/synthesize')){
     const url=new URL(route.request().url());const recipe=recipes[url.pathname.split('/').at(-1)];
     return route.fulfill({json:recipe?{recipe}:url.pathname.endsWith('/related')?{related:[]}:{user:null,recipes:[]},headers});
    }
    const data=route.request().postDataJSON();requests.push(data);
    return route.fulfill({status:200,body:fixture,headers:{...headers,'Content-Type':'audio/wav','X-Narration-Engine':'english-test-fixture'}});
   });
   console.log('Checking',language,mode);
   await page.goto(`${base}/recipe/${slug}`,{waitUntil:'domcontentloaded'});
   const player=page.locator('.voice-player');await player.waitFor();
   await player.getByRole('combobox').nth(0).selectOption(language);
   await player.getByRole('combobox').nth(1).selectOption('server');
   await player.getByRole('combobox').nth(2).selectOption('1.5');
   const recipe=recipes[slug];
   await player.getByRole('button',{name:mode==='full'?'Play full recipe':'Play step & continue',exact:true}).click();
   if(language==='te'){
    await page.waitForFunction(()=>document.querySelector('.voice-current-top>span')?.textContent==='STEP 3 OF 6'&&document.querySelector('.voice-player')?.getAttribute('data-status')==='playing');
    await player.getByRole('button',{name:'Pause',exact:true}).click();assert.equal(await player.getAttribute('data-status'),'paused');
    await player.getByRole('button',{name:'Resume',exact:true}).click();
   }
   await page.waitForFunction(()=>document.querySelector('.voice-player')?.getAttribute('data-status')==='completed',null,{timeout:60000});
   const steps=(language==='en'?recipe.steps:recipe.translations[language].steps).map(s=>`${s.title}. ${s.text}`);
   assert.deepEqual(requests.filter(r=>steps.includes(r.text)).map(r=>r.text),steps);
   assert.equal(requests.length,mode==='full'?recipe.ingredients.length+7:6);
   assert.ok(requests.every(r=>r.language===language));assert.deepEqual(errors,[]);
   assert.equal(await player.getByRole('progressbar').getAttribute('aria-valuenow'),'6');
   results.push({language,mode,requests:requests.length,steps:6,status:'completed',pauseResume:language==='te'?'passed':'not exercised',audio:'English WAV fixture: actual decode/play/end; target-language synthesis NOT tested'});
   await page.close();
  }
  fs.writeFileSync('verification/browser-queue-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
