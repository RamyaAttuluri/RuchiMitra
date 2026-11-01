// Run from project root after generating english-device-sample.wav with Windows SAPI.
// This checks real decoding/playback events, not physical speaker audibility.
const {chromium}=require('../.local/browser-check/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 try{
  const page=await browser.newPage();
  const bytes=fs.readFileSync('verification/english-device-sample.wav').toString('base64');
  const result=await page.evaluate(async(base64)=>{
   const data=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
   const context=new AudioContext();const decoded=await context.decodeAudioData(data.buffer.slice(0));
   let peak=0,sum=0,n=0;for(let c=0;c<decoded.numberOfChannels;c++)for(const value of decoded.getChannelData(c)){peak=Math.max(peak,Math.abs(value));sum+=value*value;n++}
   const audio=new Audio(URL.createObjectURL(new Blob([data],{type:'audio/wav'})));const events=[];
   await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Playback timeout')),30000);audio.onplaying=()=>events.push('playing');audio.onended=()=>{events.push('ended');clearTimeout(timeout);resolve()};audio.onerror=()=>reject(Error('Decode/playback failure'));audio.play().catch(reject)});
   await context.close();return {bytes:data.length,duration:decoded.duration,channels:decoded.numberOfChannels,peak,rms:Math.sqrt(sum/n),events,physicalAudibility:'NOT VERIFIED: automated headless browser'};
  },bytes);
  if(!result.bytes||result.peak<.001||result.rms<.0001||result.events.join(',')!=='playing,ended')throw Error('Audio validation failed');
  fs.writeFileSync('verification/browser-audio-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
