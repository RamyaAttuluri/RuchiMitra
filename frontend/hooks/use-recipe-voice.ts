'use client';
import {apiFetch,API_URL} from '@/lib/api';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Lang,RecipeData,Translation} from '@/lib/types';

/*
 Narration engine for the recipe page.

 Why the old hook failed with "synthesis-failed" on Edge's online voices (e.g. Microsoft Swara Online):
  - speechSynthesis.cancel() was immediately followed by speak() in the same tick. Online voices abort the
    freshly queued utterance when that happens.
  - Whole steps were sent as one long utterance; online voices reject or drop long requests.
  - A failing voice was never replaced, so one bad voice blocked narration entirely.
 This hook queues short sentence chunks after cancel() has settled, retries with the next compatible voice for
 that language, and finally falls back to server-generated audio (POST /api/tts) when the backend has a provider.
*/

export type VoiceStatus='ready'|'loading'|'speaking'|'paused'|'completed'|'error';
export type Engine='browser'|'cloud';
export const LANGS:Record<Lang,{locale:string;label:string;native:string}>={
 en:{locale:'en-IN',label:'English',native:'English'},
 te:{locale:'te-IN',label:'Telugu',native:'తెలుగు'},
 hi:{locale:'hi-IN',label:'Hindi',native:'हिन्दी'},
};
// Segment -2 is the introduction, -1 the ingredient list, 0..n the cooking steps.
const INTRO=-2,INGREDIENTS=-1,TEST=-3;
const SAMPLE:Record<Lang,string>={en:'This is a voice test. Let us start cooking.',te:'ఇది వాయిస్ పరీక్ష. వంట మొదలు పెడదాం.',hi:'यह आवाज़ परीक्षण है। चलिए खाना बनाना शुरू करें।'};
const START_TIMEOUT_MS=7000;
// Errors that mean "this voice can't speak right now": try another voice rather than giving up.
const VOICE_FAILURES=new Set(['synthesis-failed','synthesis-unavailable','voice-unavailable','language-unavailable','network','audio-busy','audio-hardware','text-too-long']);

const norm=(l:string)=>l.replace('_','-').toLowerCase();
export const voicesFor=(all:SpeechSynthesisVoice[],lang:Lang)=>{
 const locale=norm(LANGS[lang].locale);
 // Exact regional locale first, then installed (local) voices, which are more reliable than online ones.
 return all.filter(v=>norm(v.lang).split('-')[0]===lang)
  .sort((a,b)=>Number(norm(b.lang)===locale)-Number(norm(a.lang)===locale)||Number(b.localService)-Number(a.localService));
};
// Short chunks keep online voices and Chrome's ~15s utterance limit happy.
export function chunkText(text:string,max=180){
 const sentences=text.replace(/\s+/g,' ').trim().match(/[^.!?।॥]+[.!?।॥]*/g)?.map(s=>s.trim()).filter(Boolean)??[];
 const out:string[]=[];
 for(const s of sentences){
  if(s.length<=max){out.push(s);continue}
  let rest=s;
  while(rest.length>max){const cut=Math.max(rest.lastIndexOf(',',max),rest.lastIndexOf(' ',max));const at=cut>40?cut+1:max;out.push(rest.slice(0,at).trim());rest=rest.slice(at)}
  if(rest.trim())out.push(rest.trim());
 }
 return out;
}

export function useRecipeVoice(recipe:RecipeData){
 const [supported,setSupported]=useState(false);
 const [voicesLoaded,setVoicesLoaded]=useState(false);
 const [allVoices,setAllVoices]=useState<SpeechSynthesisVoice[]>([]);
 const [failedVoices,setFailedVoicesState]=useState<string[]>([]);
 const setFailedVoices=useCallback((next:string[]|((p:string[])=>string[]))=>setFailedVoicesState(prev=>{const v=typeof next==='function'?next(prev):next;return v}),[]);

 const [cloudAvailable,setCloudAvailable]=useState(false);
 const [engine,setEngine]=useState<Engine>('browser');
 const [lang,setLang]=useState<Lang>('en');
 const [translations,setTranslations]=useState<Record<string,Translation>>(recipe.translations||{});
 const [translationBusy,setTranslationBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [status,setStatus]=useState<VoiceStatus>('ready');
 const [index,setIndex]=useState(0);
 const [segment,setSegment]=useState<number|null>(null);
 const [chunks,setChunks]=useState<string[]>([]);
 const [chunkIndex,setChunkIndex]=useState(0);
 const [rate,setRateState]=useState(1);
 const [volume,setVolumeState]=useState(1);const output=useRef<AudioContext|null>(null);const gain=useRef<GainNode|null>(null);const connected=useRef(false);const volumeRef=useRef(1);
 function unlockOutput(){
  try{const Context=window.AudioContext;if(!Context)return;const ctx=output.current??(output.current=new Context());const el=audio.current??(audio.current=new Audio());el.muted=false;el.volume=1;
   if(!connected.current){const node=ctx.createMediaElementSource(el);gain.current=ctx.createGain();node.connect(gain.current);gain.current.connect(ctx.destination);connected.current=true}
   if(gain.current)gain.current.gain.value=volumeRef.current;void ctx.resume().catch(()=>{});
  }catch{}
 }
 function setVolume(value:number){const safe=Math.max(0,Math.min(1,value));volumeRef.current=safe;setVolumeState(safe);if(gain.current)gain.current.gain.value=safe;else if(audio.current)audio.current.volume=safe}
 function testSound(){unlockOutput();const ctx=output.current;if(!ctx){setError('This browser cannot run the speaker test. Try cloud narration.');return}void ctx.resume().then(()=>{const tone=ctx.createOscillator();const level=ctx.createGain();tone.frequency.value=660;level.gain.setValueAtTime(.12,ctx.currentTime);level.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.4);tone.connect(level);level.connect(ctx.destination);tone.start();tone.stop(ctx.currentTime+.45);setNotice('A short test tone was sent to your speakers. If you cannot hear it, unmute this tab and check device volume and audio output. The app cannot change system mute settings.');}).catch(()=>setError('Audio output was blocked. Allow sound for this site and try again.'))}
 function useCloudNow(){if(!live.current.cloudAvailable){setError('Configure a cloud narration provider on the backend to use server audio.');return}setEngine('cloud');live.current.engine='cloud';play(index,true)}
 const [voiceUri,setVoiceUri]=useState('');

 // Every playback "run" gets a token; callbacks from cancelled runs compare tokens and bail out.
 const run=useRef(0);
 const utterance=useRef<SpeechSynthesisUtterance|null>(null);
 const translationRequest=useRef(0);
 const translationAbort=useRef<AbortController|null>(null);
 const timers=useRef<number[]>([]);
 const audio=useRef<HTMLAudioElement|null>(null);
 const audioUrl=useRef('');
 const fetchAbort=useRef<AbortController|null>(null);
 // Where browser narration is, so pause/resume can restart from the current sentence (online voices ignore speechSynthesis.pause()).
 const position=useRef<{at:number;continuous:boolean;parts:string[];i:number}|null>(null);
 const live=useRef({lang,translations,rate,voiceUri,engine,failedVoices,cloudAvailable,index});
 live.current={lang,translations,rate,voiceUri,engine,failedVoices,cloudAvailable,index};

 const clearTimers=()=>{timers.current.forEach(t=>window.clearTimeout(t));timers.current=[]};
 const later=(fn:()=>void,ms:number)=>{timers.current.push(window.setTimeout(fn,ms))};
 const releaseAudio=useCallback(()=>{
  fetchAbort.current?.abort();fetchAbort.current=null;
  if(audio.current){audio.current.onended=audio.current.onerror=audio.current.onplaying=audio.current.onwaiting=null;audio.current.pause();audio.current.removeAttribute('src');audio.current.load()}
  if(audioUrl.current){URL.revokeObjectURL(audioUrl.current);audioUrl.current=''}
 },[]);
 const halt=useCallback(()=>{
  run.current++;clearTimers();utterance.current=null;
  if(typeof window!=='undefined'&&'speechSynthesis' in window)window.speechSynthesis.cancel();
  releaseAudio();
 },[releaseAudio]);

 useEffect(()=>{
  if(typeof window!=='undefined'&&'speechSynthesis' in window&&'SpeechSynthesisUtterance' in window){
   setSupported(true);
   const synth=window.speechSynthesis;
   const load=()=>{const v=synth.getVoices();setAllVoices(v);if(v.length)setVoicesLoaded(true)};
   load();synth.addEventListener('voiceschanged',load);
   // Some browsers never fire voiceschanged when there are no voices at all.
   const giveUp=window.setTimeout(()=>setVoicesLoaded(true),2500);
   return ()=>{synth.removeEventListener('voiceschanged',load);window.clearTimeout(giveUp)};
  }
  setVoicesLoaded(true);
 },[]);
 useEffect(()=>{apiFetch(`${API_URL}/tts/status`).then(r=>r.ok?r.json():null).then(d=>{const available=Boolean(d?.available);setCloudAvailable(available);live.current.cloudAvailable=available;if(available){setEngine('cloud');live.current.engine='cloud'}}).catch(()=>{})},[]);
 // Stop everything on recipe change / unmount so no stale callback touches the next page.
 useEffect(()=>()=>{translationRequest.current++;translationAbort.current?.abort();halt();void output.current?.close().catch(()=>{});output.current=null;gain.current=null;connected.current=false;audio.current=null},[recipe.id,halt]);

 const candidates=voicesFor(allVoices,lang);
 const usable=candidates.filter(v=>!failedVoices.includes(v.voiceURI));
 const selectedVoice=usable.find(v=>v.voiceURI===voiceUri)||usable[0]||null;
 const hasText=lang==='en'||Boolean(translations[lang]);
 const engineReady=engine==='cloud'?cloudAvailable:supported&&Boolean(selectedVoice);
 const canTest=!translationBusy&&(engineReady||cloudAvailable);
 const canPlay=hasText&&!translationBusy&&(engineReady||cloudAvailable);

 function segmentText(language:Lang,at:number){
  const t=live.current.translations[language];
  if(at===TEST)return SAMPLE[language];
  if(language!=='en'&&!t)return '';
  if(at===INTRO)return language==='en'?`Welcome to RuchiMitra, your cooking companion. Today we're making ${recipe.name}. Preparation takes ${recipe.prepMinutes} minutes and cooking takes ${recipe.cookMinutes} minutes.`:t.intro;
  if(at===INGREDIENTS)return language==='en'
   ?`Let's gather the ingredients. ${recipe.ingredients.map(i=>`${i.quantity===null?'':`${i.quantity} ${i.unit} `}${i.name}${i.quantity===null?', to taste':''}`).join('. ')}.`
   :`${language==='te'?'మనకు కావాల్సిన పదార్థాలు.':'आवश्यक सामग्री।'} ${t.ingredients.join('. ')}.`;
  const step=language==='en'?recipe.steps[at]:t.steps[at];
  if(!step)return '';
  const label=language==='en'?`Step ${at+1}`:language==='te'?`దశ ${at+1}`:`चरण ${at+1}`;
  return `${label}. ${step.title}. ${step.text}`;
 }

 function fail(message:string){halt();setStatus('error');setError(message)}
 function finishSegment(token:number,at:number,continuous:boolean){
  if(run.current!==token)return;
  if(at===TEST){setStatus('ready');setSegment(null);setNotice(`Voice test finished with “${live.current.engine==='cloud'?'Cloud narration':live.current.voiceUri||'default voice'}”. If you heard nothing, pick another voice or Cloud narration and test again.`);return}
  if(continuous&&at<recipe.steps.length-1){play(at+1,true,token);return}
  setStatus(continuous?'completed':'ready');setSegment(null);
 }

 /** Start narrating a segment. `token` is passed when chaining inside the same run. */
 function play(at:number,continuous:boolean,token?:number){
  if(token===undefined)unlockOutput();
  const language=live.current.lang;
  const text=segmentText(language,at);
  if(!text){fail(language==='en'?'Nothing to read for this step.':'Translation has not been loaded yet.');return}
  if(token===undefined){halt();token=run.current}
  if(run.current!==token)return;
  const parts=chunkText(text);
  setError('');setSegment(at);setChunks(parts);setChunkIndex(0);if(at>=0)setIndex(at);
  const useCloud=live.current.engine==='cloud'||!supported||voicesFor(window.speechSynthesis.getVoices(),language).every(v=>live.current.failedVoices.includes(v.voiceURI));
  if(useCloud){
   if(!live.current.cloudAvailable){fail(`No working ${LANGS[language].label} voice on this device, and cloud narration is not configured on the server. Install a ${LANGS[language].label} speech voice in your system settings, or ask the administrator to enable cloud narration.`);return}
   if(live.current.engine!=='cloud'){setEngine('cloud');live.current.engine='cloud'}
   playCloud(token,at,continuous,parts,0);
  }else{
   // 'speaking' is set only from onstart, i.e. once the engine actually starts audio.
   setStatus('loading');
   // Let cancel() settle before queueing; online voices drop utterances queued in the same tick.
   later(()=>speakChunk(token!,at,continuous,parts,0,0),120);
  }
 }

 function speakChunk(token:number,at:number,continuous:boolean,parts:string[],i:number,attempt:number){
  if(run.current!==token)return;
  if(i>=parts.length){finishSegment(token,at,continuous);return}
  position.current={at,continuous,parts,i};
  const language=live.current.lang;
  const synth=window.speechSynthesis;
  const usableNow=voicesFor(synth.getVoices(),language).filter(v=>!live.current.failedVoices.includes(v.voiceURI));
  const voice=usableNow.find(v=>v.voiceURI===live.current.voiceUri)||usableNow[0];
  if(!voice){play(at,continuous,token);return} // re-enters and switches to cloud (or reports clearly)
  const u=new SpeechSynthesisUtterance(parts[i]);
  u.voice=voice;u.lang=voice.lang||LANGS[language].locale;u.rate=live.current.rate;u.pitch=1;u.volume=volumeRef.current;
  let started=false,settled=false;
  const giveUp=(reason:string)=>{
   if(settled||run.current!==token)return;settled=true;
   if(reason==='audio-busy'&&attempt<2){synth.cancel();later(()=>speakChunk(token,at,continuous,parts,i,attempt+1),400);return}
   // Blacklist this voice for the session and retry the same sentence with the next one.
   const failed=[...live.current.failedVoices,voice.voiceURI];
   live.current.failedVoices=failed;setFailedVoices(failed);
   const next=voicesFor(synth.getVoices(),language).find(v=>!failed.includes(v.voiceURI));
   setNotice(next?`“${voice.name}” could not speak (${reason}). Switched to “${next.name}”.`:`“${voice.name}” could not speak (${reason}).`);
   if(next){live.current.voiceUri=next.voiceURI;setVoiceUri(next.voiceURI);synth.cancel();later(()=>speakChunk(token,at,continuous,parts,i,0),150);return}
   synth.cancel();
   if(live.current.cloudAvailable){setEngine('cloud');live.current.engine='cloud';setNotice(`No ${LANGS[language].label} browser voice worked. Using cloud narration instead.`);playCloud(token,at,continuous,parts,i);return}
   fail(`Speech error: ${reason}. None of the ${LANGS[language].label} voices on this device could speak, and cloud narration is not configured on the server.`);
  };
  u.onstart=()=>{if(run.current!==token)return;started=true;setStatus('speaking');setChunkIndex(i)};
  setChunkIndex(i);
  u.onend=()=>{if(settled||run.current!==token)return;settled=true;
   // Some engines report "end" without ever starting when they silently fail.
   if(!started&&attempt===0){settled=false;giveUp('synthesis-failed');return}
   speakChunk(token,at,continuous,parts,i+1,0)};
  u.onerror=e=>{
   if(run.current!==token)return;
   // Our own cancel()/stop produces these; they are not failures.
   if(e.error==='canceled'||e.error==='interrupted')return;
   if(VOICE_FAILURES.has(e.error))giveUp(e.error);
   else if(!settled){settled=true;fail(`Speech error: ${e.error}`)}
  };
  // Watchdog: online voices sometimes never start and never error.
  later(()=>{if(!started&&!settled&&run.current===token)giveUp('synthesis-failed')},START_TIMEOUT_MS);
  later(()=>{if(!settled&&run.current===token)giveUp('synthesis-failed')},Math.max(15000,parts[i].length*180));
  if(synth.paused)synth.resume();
  utterance.current=u;synth.speak(u);
 }

 // Server-generated audio, one sentence per request (exact highlighting, fast first sound); the next sentence is prefetched.
 const clipCache=useRef(new Map<string,Blob>());
 async function fetchClip(text:string,lang:Lang,signal:AbortSignal){
  const key=lang+'|'+text;const cached=clipCache.current.get(key);if(cached)return cached;
  const res=await apiFetch(`${API_URL}/tts`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,lang}),signal});
  if(!res.ok){const d=await res.json().catch(()=>({}));throw Error(d.error||'Cloud narration unavailable')}
  const blob=await res.blob();if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  clipCache.current.set(key,blob);let bytes=[...clipCache.current.values()].reduce((n,b)=>n+b.size,0);while(clipCache.current.size>80||bytes>12*1024*1024){const first=clipCache.current.keys().next().value!;bytes-=clipCache.current.get(first)!.size;clipCache.current.delete(first)}return blob;
 }
 async function playCloud(token:number,at:number,continuous:boolean,parts:string[],i:number){
  if(run.current!==token)return;
  if(i>=parts.length){finishSegment(token,at,continuous);return}
  position.current={at,continuous,parts,i};
  setStatus('loading');setChunkIndex(i);
  const lang=live.current.lang;
  const controller=new AbortController();fetchAbort.current=controller;
  try{
   const blob=await fetchClip(parts[i],lang,controller.signal);
   if(run.current!==token)return;
   if(output.current){const decoded=await output.current.decodeAudioData(await blob.arrayBuffer());let peak=0,sum=0,count=0;for(let channel=0;channel<decoded.numberOfChannels;channel++){const samples=decoded.getChannelData(channel);for(let n=0;n<samples.length;n+=Math.max(1,Math.floor(samples.length/50000))){const sample=samples[n];peak=Math.max(peak,Math.abs(sample));sum+=sample*sample;count++}}if(peak<.001||Math.sqrt(sum/Math.max(count,1))<.0001)throw Error('The narration contains silence. Choose another voice or check your cloud TTS provider.');}
   if(run.current!==token)return;
   if(parts[i+1])fetchClip(parts[i+1],lang,controller.signal).catch(()=>{});
   if(audioUrl.current){URL.revokeObjectURL(audioUrl.current);audioUrl.current=''}
   const url=URL.createObjectURL(blob);audioUrl.current=url;
   const el=audio.current??(audio.current=new Audio());
   el.muted=false;el.volume=gain.current?1:volumeRef.current;el.src=url;el.playbackRate=live.current.rate;
   if(output.current&&output.current.state!=='running')throw Error('Audio output is suspended. Press play again to enable sound.');
   el.onplaying=()=>{if(run.current===token)setStatus('speaking')};
   el.onwaiting=()=>{if(run.current===token)setStatus('loading')};
   el.onended=()=>{if(run.current===token)playCloud(token,at,continuous,parts,i+1)};
   el.onerror=()=>{if(run.current===token)fail('The narration audio could not be played.')};
   await el.play();
  }catch(e){
   if(run.current!==token||(e instanceof DOMException&&e.name==='AbortError'))return;
   clipCache.current.delete(lang+'|'+parts[i]);
   fail(e instanceof Error&&e.name==='NotAllowedError'?'Your browser blocked audio playback. Press play again.':e instanceof Error?e.message:'Cloud narration unavailable');
  }
 }

 function selectLanguage(next:Lang){
  const token=++translationRequest.current;translationAbort.current?.abort();translationAbort.current=null;setTranslationBusy(false);
  halt();position.current=null;live.current.lang=next;setLang(next);setIndex(0);setSegment(null);setChunks([]);setError('');setNotice('');setVoiceUri('');setStatus('ready');
  // A new language gets a fresh chance with browser voices.
  const preferred=live.current.cloudAvailable?'cloud':'browser';setEngine(preferred);live.current.engine=preferred;
  if(next==='en'||translations[next])return;
  setTranslationBusy(true);setStatus('loading');
  const controller=new AbortController();translationAbort.current=controller;
  apiFetch(`${API_URL}/recipes/${encodeURIComponent(recipe.id)}/translate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lang:next}),signal:controller.signal})
   .then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'Translation unavailable');return data.translation as Translation})
   .then(t=>{if(token!==translationRequest.current)return;live.current.translations={...live.current.translations,[next]:t};setTranslations(p=>({...p,[next]:t}));setStatus('ready')})
   .catch(e=>{if(token!==translationRequest.current)return;setStatus('error');setError(`${LANGS[next].label} translation unavailable: ${e.message||'unknown error'}`)})
   .finally(()=>{if(token===translationRequest.current)setTranslationBusy(false)});
 }
 function chooseVoice(uri:string){
  halt();position.current=null;setStatus('ready');setVoiceUri(uri);setEngine(uri==='cloud'?'cloud':'browser');live.current.engine=uri==='cloud'?'cloud':'browser';live.current.voiceUri=uri;
  // Choosing a voice explicitly gives it another chance.
  if(uri!=='cloud')setFailedVoices(f=>f.filter(x=>x!==uri));
 }
 function setRate(next:number){setRateState(next);if(audio.current)audio.current.playbackRate=next}

 const active=status==='speaking'||status==='paused'||(status==='loading'&&segment!==null);
 function pause(){
  if(status!=='speaking')return;
  if(engine==='cloud')audio.current?.pause();
  else{const keep=position.current;halt();position.current=keep}
  setStatus('paused');
 }
 function resume(){
  unlockOutput();
  if(status!=='paused')return;
  if(engine==='cloud'){audio.current?.play().catch(()=>{const p=position.current;if(p)playCloud(run.current,p.at,p.continuous,p.parts,p.i)})}
  else{
   const p=position.current;if(!p){setStatus('ready');return}
   const token=run.current;setStatus('loading');
   later(()=>speakChunk(token,p.at,p.continuous,p.parts,p.i,0),120);
   return;
  }
  setStatus('loading');
 }
 function stop(){halt();position.current=null;setSegment(null);setStatus('ready')}
 return {
  supported,voicesLoaded,voices:candidates,failedVoices,selectedVoice,voiceUri:engine==='cloud'?'cloud':selectedVoice?.voiceURI||'',chooseVoice,
  cloudAvailable,engine,lang,selectLanguage,translationBusy,translations,
  volume,setVolume,testSound,useCloudNow,
  error,notice,status,index,setIndex,segment,chunks,chunkIndex,rate,setRate,canPlay,canTest,active,
  activeTranslation:lang==='en'?null:translations[lang]??null,
  playAll:()=>play(INTRO,true),
  testVoice:()=>play(TEST,false),
  playStep:(at=index)=>play(at,true),
  readStep:(at:number)=>play(at,false),
  repeat:()=>play(index,false),
  restart:()=>play(0,true),
  next:()=>{const at=Math.min(index+1,recipe.steps.length-1);if(active)play(at,true);else setIndex(at)},
  previous:()=>{const at=Math.max(0,index-1);if(active)play(at,true);else setIndex(at)},
  goTo:(at:number)=>{if(active)play(at,true);else setIndex(at)},
  pause,resume,stop,
 };
}
