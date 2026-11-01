// Deliberately fail the translation network request to verify recovery controls.
const {chromium}=require('../backend/node_modules/playwright-core');const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await page.goto('http://localhost:3000/recipe/egg-curry',{waitUntil:'domcontentloaded'});const player=page.locator('.voice-player');await player.waitFor();
  await page.route('**/translate',r=>r.abort('connectionfailed'));
  await player.getByRole('combobox').nth(0).selectOption('te');
  await player.getByRole('alert').filter({hasText:'Cannot reach the recipe server'}).waitFor();
  assert.equal(await player.getByRole('button',{name:'Read this step',exact:true}).isDisabled(),true);
  assert.equal(await player.locator('.voice-current').getAttribute('lang'),'en');
  await player.getByRole('button',{name:'Continue in English',exact:true}).click();
  await player.getByRole('button',{name:'Read this step',exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('.voice-main-control')?.disabled);
  assert.equal(await player.getByRole('combobox').nth(0).inputValue(),'en');assert.equal(await player.locator('.voice-warning').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await player.screenshot({path:'verification/guided-cooking-mobile.png'});
  fs.writeFileSync('verification/guided-cooking-recovery-results.json',JSON.stringify({injectedNetworkFailure:true,clearError:true,nativePlaybackBlocked:true,englishFallback:true,mobileOverflow:false},null,2));console.log('Network failure, English recovery and mobile layout passed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
