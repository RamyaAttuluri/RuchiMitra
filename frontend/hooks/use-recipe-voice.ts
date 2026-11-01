'use client';
import {useEffect,useRef,useState} from 'react';
import {apiFetch,API_URL} from '@/lib/api';
import type {Lang,RecipeData,Translation} from '@/lib/types';
import {buildQueue,NarrationController,type Adapter,type Item,type Mode,type Snapshot} from '@/lib/narration';
export const LANGS={en:{locale:'en-IN',label:'English',native:'English'},te:{locale:'te-IN',label:'Telugu',native:'తెలుగు'},hi:{locale:'hi-IN',label:'Hindi',native:'हिन्दी'}};
const SAMPLE={en:'This is a voice test. Let us start cooking.',te:'ఇది వాయిస్ పరీక్ష. వంట మొదలు పెడదాం.',hi:'यह आवाज़ परीक्षण है। चलिए खाना बनाना शुरू करें।'};
export const voicesFor=(all:SpeechSynthesisVoice[],language:Lang)=>all.filter(v=>v.lang.replace('_','-').split('-')[0]===language).sort((a,b)=>Number(b.localService)-Number(a.localService));
export function chunkText(text:string,max=180){
 const result:string[]=[];let rest=text.replace(/\s+/g,' ').trim();
 while(rest.length>max){const boundary=Math.max(rest.lastIndexOf('. ',max),rest.lastIndexOf('\u0964',max),rest.lastIndexOf(' ',max));const end=boundary>0?boundary+1:max;result.push(rest.slice(0,end).trim());rest=rest.slice(end).trim()}
 if(rest)result.push(rest);return result;
}
export function useRecipeVoice(recipe:RecipeData,servings=recipe.servings){
 const [autoPlay,setAutoPlay]=useState(false);const [done,setDone]=useState<number[]>([]);const doneRef=useRef<number[]>([]);const began=useRef(new Map<number,number>());
 const [snapshot,setSnapshot]=useState<Snapshot>({status:'idle',queue:[],cursor:0,session:0,error:'',mode:'continue'});
 const [lang,setLang]=useState<Lang>('en');const [translations,setTranslations]=useState(recipe.translations||{});
 const [usedEngine,setUsedEngine]=useState('');const cachedEngines=useRef(new Map<string,string>());
 const [translationBusy,setTranslationBusy]=useState(false);const [quantityBusy,setQuantityBusy]=useState(false);const [servingTranslations,setServingTranslations]=useState<Record<string,Translation>>({});const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const [allVoices,setAllVoices]=useState<SpeechSynthesisVoice[]>([]);const [voicesLoaded,setVoicesLoaded]=useState(false);
 const [capabilities,setCapabilities]=useState<{available:boolean;provider:string;languages:string[];engine?:string;version?:string;cacheEnabled?:boolean;voices?:{id:string;language:Lang;engine:string;license:string;developmentOnly:boolean}[]}>({available:false,provider:'local',languages:[]});
 const [voiceUri,setVoiceUri]=useState('');const [rate,setRateState]=useState(1);const [volume,setVolumeState]=useState(1);const [index,setIndex]=useState(0);
 const translationAbort=useRef<AbortController|null>(null);const translationToken=useRef(0);
 const cache=useRef(new Map<string,Blob>());const output=useRef<AudioContext|null>(null);const element=useRef<HTMLAudioElement|null>(null);
 const live=useRef({lang,voiceUri,rate,volume,capabilities});live.current={lang,voiceUri,rate,volume,capabilities};
 const adapter=useRef<Adapter>({start(item,events){
  let stopped=false,paused=false,settled=false,started=false,chunk=0,generation=0,url='';let utterance:SpeechSynthesisUtterance|null=null;
  let timer:ReturnType<typeof setTimeout>|undefined;let watchdog:ReturnType<typeof setTimeout>|undefined;
  const controller=new AbortController();const parts=chunkText(item.text);const settings={...live.current};
  let server=settings.voiceUri==='server'||settings.voiceUri.startsWith('server:')||(!settings.voiceUri&&item.language!=='en'&&settings.capabilities.available&&settings.capabilities.languages.includes(item.language))||!voicesFor(window.speechSynthesis?.getVoices()||[],item.language).length;
  const alive=()=>!stopped&&!settled;
  const clear=()=>{clearTimeout(timer);clearTimeout(watchdog)};
  const failed=(e:Error)=>{if(!alive())return;
   if(!server&&settings.capabilities.available&&settings.capabilities.languages.includes(item.language)){clear();generation++;if(utterance){utterance.onstart=utterance.onend=utterance.onerror=null;window.speechSynthesis.cancel()}server=true;settings.voiceUri='server';live.current.voiceUri='server';setVoiceUri('server');events.loading?.();setNotice(`Browser speech failed. Trying the configured local voice once.`);void runServer();return}
   settled=true;clear();events.failed(e)};
  const ended=()=>{if(!alive()||paused)return;settled=true;clear();events.ended()};
  const browserChunk=()=>{
   if(!alive()||paused)return;if(chunk===parts.length){ended();return}
   const voice=voicesFor(window.speechSynthesis.getVoices(),item.language).find(v=>v.voiceURI===settings.voiceUri)||voicesFor(window.speechSynthesis.getVoices(),item.language)[0];
   if(!voice){failed(Error('No matching browser voice. Configure local narration or install a system voice.'));return}
   const u=new SpeechSynthesisUtterance(parts[chunk]);utterance=u;let done=false,didStart=false;
   const lease=++generation;const current=()=>alive()&&lease===generation&&!paused;
   u.voice=voice;u.lang=voice.lang;u.rate=live.current.rate;u.volume=live.current.volume;
   u.onstart=()=>{if(!current()||done)return;didStart=true;started=true;events.started()};
   u.onend=()=>{if(!current()||done)return;done=true;clear();if(!didStart){failed(Error('Browser voice ended without starting audio. Choose local narration.'));return}chunk++;browserChunk()};
   u.onerror=e=>{if(current()&&!done)failed(Error(`Browser speech failed (${e.error}). Choose a working local voice or configure the local service.`))};
   timer=setTimeout(()=>{if(!didStart&&current())failed(Error('Browser voice did not start. Choose local narration.'))},10000);
   watchdog=setTimeout(()=>{if(current())failed(Error('Browser voice stopped responding. Retry this step.'))},Math.max(30000,parts[chunk].length*300));
   window.speechSynthesis.speak(u);
  };
  const runServer=async()=>{
   try{
    const key=JSON.stringify([recipe.id,recipe.updatedAt,item.id,item.language,item.text,settings.voiceUri,settings.capabilities.provider,settings.capabilities.version]);let blob=settings.capabilities.cacheEnabled===false?undefined:cache.current.get(key);
    if(!blob){const r=await apiFetch(`${API_URL}/tts/synthesize`,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(180000)]),body:JSON.stringify({recipeId:item.recipeId,recipeVersion:recipe.updatedAt,stepId:item.id,language:item.language,text:item.text,speed:1,voice:settings.voiceUri.startsWith('server:')?settings.voiceUri.slice(7):'default'})},185000);
     if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(`${d.code||'TTS_FAILED'}: ${d.error||'Narration failed'}`)}
     if(!r.headers.get('content-type')?.startsWith('audio/'))throw Error('TTS_INVALID_AUDIO: server returned no audio');
     cachedEngines.current.set(key,r.headers.get('X-Narration-Engine')||settings.capabilities.engine||settings.capabilities.provider);
     blob=await r.blob();if(blob.size<44)throw Error('TTS_INVALID_AUDIO: empty audio');
    }
    if(!alive())return;const ctx=output.current??(output.current=new AudioContext());await ctx.resume();
    const decoded=await ctx.decodeAudioData(await blob.arrayBuffer());let peak=0,sum=0,count=0;
    for(let c=0;c<decoded.numberOfChannels;c++){const samples=decoded.getChannelData(c);for(let i=0;i<samples.length;i++){peak=Math.max(peak,Math.abs(samples[i]));sum+=samples[i]*samples[i];count++}}
    if(!count||peak<.001||Math.sqrt(sum/count)<.0001)throw Error('TTS_SILENT_AUDIO: generated audio is silent');
    if(!alive())return;setUsedEngine(cachedEngines.current.get(key)||settings.capabilities.engine||settings.capabilities.provider);if(settings.capabilities.cacheEnabled!==false)cache.current.set(key,blob);item.audio=blob;let bytes=[...cache.current.values()].reduce((n,b)=>n+b.size,0);while(bytes>24*1024*1024||cache.current.size>80){const first=cache.current.keys().next().value!;bytes-=cache.current.get(first)!.size;cache.current.delete(first);cachedEngines.current.delete(first)}
    const audio=new Audio();element.current=audio;url=URL.createObjectURL(blob);audio.src=url;audio.volume=live.current.volume;audio.playbackRate=live.current.rate;
    audio.onplaying=()=>{if(alive()&&!paused){started=true;events.started()}};
    audio.onended=()=>{if(started)ended();else failed(Error('Audio ended before playback began.'))};
    audio.onerror=()=>failed(Error('AUDIO_DECODE: browser could not play the narration.'));
    await audio.play();
   }catch(e){if(alive())failed(e instanceof Error?e:Error('Local narration failed.'))}
  };
  if(server){void runServer()}else{window.speechSynthesis.cancel();timer=setTimeout(browserChunk,120)}
  return {
   stop(){stopped=true;clear();controller.abort();if(utterance){utterance.onend=utterance.onstart=utterance.onerror=null;window.speechSynthesis.cancel()}if(url){element.current?.pause();element.current?.removeAttribute('src');element.current?.load();URL.revokeObjectURL(url)}},
   pause(){paused=true;generation++;clear();if(server)element.current?.pause();else{if(utterance){utterance.onend=utterance.onstart=utterance.onerror=null}window.speechSynthesis.cancel();setNotice('Paused. Resume repeats the current short segment with this browser voice.')}},
   resume(){paused=false;if(server){void element.current?.play().catch(failed)}else timer=setTimeout(browserChunk,120)},
  };
 }});
 const controller=useRef<NarrationController|null>(null);if(!controller.current)controller.current=new NarrationController(adapter.current,s=>{setSnapshot(s);const step=s.queue[s.cursor]?.stepIndex;if(step!==undefined&&['loading','playing','completed'].includes(s.status)){setIndex(step);if(s.status==='playing'&&!began.current.has(step))began.current.set(step,Date.now())}});
 function unlock(){const ctx=output.current??(output.current=new AudioContext());void ctx.resume().catch(()=>{})}
 useEffect(()=>{
  const load=()=>setAllVoices(window.speechSynthesis?.getVoices()||[]);load();window.speechSynthesis?.addEventListener('voiceschanged',load);setVoicesLoaded(true);
  const abort=new AbortController();apiFetch(`${API_URL}/tts/status`,{signal:abort.signal}).then(r=>r.json()).then(d=>{if(!abort.signal.aborted)setCapabilities({...d,languages:d.languages||[]})}).catch(()=>{});
  return()=>{abort.abort();window.speechSynthesis?.removeEventListener('voiceschanged',load)};
 },[]);
 useEffect(()=>{controller.current?.send('RECIPE_CHANGED');translationToken.current++;translationAbort.current?.abort();setTranslations(recipe.translations||{});setServingTranslations({});setTranslationBusy(false);setQuantityBusy(false);setError('');setNotice('');setVoiceUri('');setLang('en');setIndex(0);setDone([]);doneRef.current=[];began.current.clear();setAutoPlay(false);return()=>{controller.current?.send('RECIPE_CHANGED');translationToken.current++;translationAbort.current?.abort()}},[recipe.id,recipe.updatedAt]);
 useEffect(()=>{controller.current?.send('STOP')},[servings]);
 useEffect(()=>{
  setQuantityBusy(false);setError('');
  if(lang==='en'||servings===recipe.servings||!translations[lang]||servingTranslations[`${lang}:${servings}`])return;
  const abort=new AbortController();setQuantityBusy(true);
  apiFetch(`${API_URL}/recipes/${encodeURIComponent(recipe.id)}/translate`,{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.signal,body:JSON.stringify({lang,servings})},410000)
   .then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Updated ingredient translation failed');return d.translation as Translation})
   .then(t=>{if(!abort.signal.aborted)setServingTranslations(p=>({...p,[`${lang}:${servings}`]:t}))})
   .catch(e=>{if(!abort.signal.aborted)setError(`${e.message}. Restore the original servings or start local translation.`)})
   .finally(()=>{if(!abort.signal.aborted)setQuantityBusy(false)});
  return()=>abort.abort();
 },[lang,servings,recipe.id,translations]);
 const currentTranslation=lang==='en'?null:(servingTranslations[`${lang}:${servings}`]||translations[lang]||null);

 useEffect(()=>()=>{void output.current?.close()},[]);
 const voices=voicesFor(allVoices,lang);const serverAvailable=capabilities.available&&capabilities.languages.includes(lang);
 const selectedVoice=voices.find(v=>v.voiceURI===voiceUri)||voices[0]||null;
 const engine=voiceUri==='server'||voiceUri.startsWith('server:')||(!voiceUri&&lang!=='en'&&serverAvailable)||!selectedVoice?'server':'browser';
 const ready=engine==='server'?serverAvailable:!!selectedVoice;
 function selectLanguage(next:Lang){
  controller.current!.send('LANGUAGE_CHANGED');translationAbort.current?.abort();const token=++translationToken.current;setLang(next);setIndex(0);setVoiceUri('');setError('');setNotice('');setTranslationBusy(false);
  if(next==='en'||translations[next])return;
  const abort=new AbortController();translationAbort.current=abort;setTranslationBusy(true);
  apiFetch(`${API_URL}/recipes/${encodeURIComponent(recipe.id)}/translate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lang:next}),signal:abort.signal},410000).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||`Server error (${r.status}).`);return d.translation as Translation}).then(t=>{if(token===translationToken.current)setTranslations(p=>({...p,[next]:t}))}).catch(e=>{if(token===translationToken.current)setError(`${LANGS[next].label} translation is temporarily unavailable. ${e.message} Retry or continue in English.`)}).finally(()=>{if(token===translationToken.current)setTranslationBusy(false)});
 }
 function start(mode:Mode,at=index){if((mode==='single'||mode==='continue')&&!began.current.has(at))began.current.set(at,Date.now());unlock();setError('');setNotice('');setUsedEngine('');try{if(mode==='full'&&lang!=='en'&&servings!==recipe.servings&&!servingTranslations[`${lang}:${servings}`])throw Error('Ingredient amounts are still being translated. Play the cooking steps, restore original servings, or continue in English.');const queue=mode==='test'?[{id:`${recipe.id}:${lang}:test`,recipeId:recipe.id,language:lang,type:'introduction',text:SAMPLE[lang],status:'pending'} as Item]:buildQueue(recipe,lang,currentTranslation,mode,at,servings);controller.current!.play(queue,mode)}catch(e){setError((e as Error).message)}}
 function markDone(at:number,on=true){
  if(!on){began.current.delete(at);doneRef.current=doneRef.current.filter(i=>i!==at);setDone(doneRef.current);return}
  if(doneRef.current.includes(at))return;
  doneRef.current=[...doneRef.current,at];setDone(doneRef.current);
  if(at!==index)return;
  controller.current!.send('STOP');
  const seconds=began.current.has(at)?Math.max(0,Math.round((Date.now()-began.current.get(at)!)/1000)):null;
  const elapsed=seconds===null?'':lang==='te'?` గడిచిన సమయం ${Math.floor(seconds/60)} నిమిషాలు ${seconds%60} సెకన్లు.`:lang==='hi'?` बीता समय ${Math.floor(seconds/60)} मिनट ${seconds%60} सेकंड।`:` Elapsed time: ${Math.floor(seconds/60)} minutes ${seconds%60} seconds.`;
  const complete=lang==='te'?`${at+1}వ దశ పూర్తయింది.`:lang==='hi'?`चरण ${at+1} पूरा हुआ।`:`Step ${at+1} complete.`;
  const following=recipe.steps.findIndex((_,i)=>i>at&&!doneRef.current.includes(i));
  const next=following>=0?following:recipe.steps.findIndex((_,i)=>!doneRef.current.includes(i));
  setNotice(`${complete}${elapsed}${next<0?' All steps done. Enjoy your meal!':''}`);
  if(next>=0)setIndex(next);
  if(!ready||translationBusy||(lang!=='en'&&!translations[lang]))return;
  unlock();
  if(next>=0){
   began.current.set(next,Date.now());const queue=buildQueue(recipe,lang,currentTranslation,autoPlay?'continue':'single',next,servings);
   queue[0].text=`${complete}${elapsed} ${queue[0].text}`;controller.current!.play(queue,autoPlay?'continue':'single');
  }else{
   const closing=lang==='te'?' అన్ని దశలు పూర్తయ్యాయి. మీ భోజనాన్ని ఆస్వాదించండి!':lang==='hi'?' सभी चरण पूरे हुए। भोजन का आनंद लें!':' All steps done. Enjoy your meal!';
   controller.current!.play([{id:`${recipe.id}:finished`,recipeId:recipe.id,language:lang,type:'introduction',text:complete+elapsed+closing,status:'pending'}],'single');
  }
 }
 const current=snapshot.queue[snapshot.cursor];const active=['preparing','loading','playing','paused'].includes(snapshot.status);
 const completed=snapshot.queue.filter(i=>i.type==='step'&&i.status==='completed').length;
 return {status:snapshot.status,error:error||snapshot.error,notice:snapshot.status==='completed'&&snapshot.mode==='test'?`Voice test completed using ${engine==='server'?usedEngine||capabilities.engine||capabilities.provider:selectedVoice?.name}. Audio decoded and playback events completed; verify audible output on your device.`:notice,
  lang,selectLanguage,translations,translationBusy:translationBusy||quantityBusy,activeTranslation:currentTranslation&&lang!=='en'&&servings!==recipe.servings&&!servingTranslations[`${lang}:${servings}`]?{...currentTranslation,ingredients:[]}:currentTranslation,
  voices,voicesLoaded,supported:typeof window!=='undefined'&&'speechSynthesis' in window,selectedVoice,failedVoices:[] as string[],voiceUri:engine==='server'?(voiceUri.startsWith('server:')?voiceUri:'server'):selectedVoice?.voiceURI||'',
  chooseVoice:(uri:string)=>{controller.current!.send('STOP');setUsedEngine('');setVoiceUri(uri)},serverAvailable,serverVoices:(capabilities.voices||[]).filter(v=>v.language===lang),providerLabel:usedEngine?`Server audio (${usedEngine})`:['auto','local','piper','espeak'].includes(capabilities.provider)?`Local ${capabilities.engine||'TTS'}`:`Cloud (${capabilities.provider})`,engine,
  canPlay:ready&&!translationBusy&&(lang==='en'||!!translations[lang]),canPlayAll:ready&&!translationBusy&&!quantityBusy&&(lang==='en'||!!translations[lang])&&(lang==='en'||servings===recipe.servings||!!servingTranslations[`${lang}:${servings}`]),canTest:ready,active,index,setIndex,
  segment:active||snapshot.status==='completed'?(snapshot.mode==='test'?-3:current?.type==='introduction'?-2:current?.type==='ingredient'?-1:current?.stepIndex??null):null,
  chunks:current?[current.text]:[],chunkIndex:0,progress:recipe.steps.length?completed/recipe.steps.length:0,
  rate,setRate:(v:number)=>{setRateState(v);if(element.current)element.current.playbackRate=v},volume,setVolume:(v:number)=>{setVolumeState(v);if(element.current)element.current.volume=v},
  testSound:()=>{unlock();const ctx=output.current!;const oscillator=ctx.createOscillator(),gain=ctx.createGain();gain.gain.value=.1;oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+.3);setNotice('Test tone sent. Check device volume and tab mute if it is inaudible.')},
  done,markDone,autoPlay,setAutoPlay:(on:boolean)=>{controller.current!.send('STOP');setAutoPlay(on)},
  waiting:snapshot.status==='completed'&&snapshot.mode==='single'&&current?.type==='step'&&!done.includes(index),
  useServerNow:()=>{setVoiceUri('server');live.current.voiceUri='server';start(autoPlay?'continue':'single')},
  playAll:()=>start('full'),playStep:(at=index)=>start(autoPlay?'continue':'single',at),readStep:(at:number)=>start('single',at),repeat:()=>start('single'),testVoice:()=>start('test'),
  restart:()=>{doneRef.current=[];setDone([]);began.current.clear();start(autoPlay?'continue':'single',0)},
  next:()=>{if(active&&snapshot.queue.some(x=>x.stepIndex===index+1))controller.current!.send('NEXT');else if(active)start(autoPlay?'continue':'single',Math.min(index+1,recipe.steps.length-1));else{controller.current!.send('STOP');setIndex(Math.min(index+1,recipe.steps.length-1))}},
  previous:()=>{if(active&&snapshot.queue.some(x=>x.stepIndex===Math.max(0,index-1)))controller.current!.send('PREVIOUS');else if(active)start(autoPlay?'continue':'single',Math.max(0,index-1));else{controller.current!.send('STOP');setIndex(Math.max(0,index-1))}},
  goTo:(at:number)=>{if(active)start(autoPlay?'continue':'single',at);else{controller.current!.send('STOP');setIndex(at)}},pause:()=>controller.current!.send('PAUSE'),resume:()=>{unlock();controller.current!.send('RESUME')},stop:()=>controller.current!.send('STOP'),
 };
}
