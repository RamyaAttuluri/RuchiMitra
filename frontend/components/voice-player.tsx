'use client';

import {Headphones,Pause,Play,RotateCcw,SkipBack,SkipForward,Square,Volume2,LoaderCircle,ListRestart,Cloud,AudioLines} from 'lucide-react';
import type {Lang,RecipeData} from '@/lib/types';import {LANGS,type useRecipeVoice} from '@/hooks/use-recipe-voice';
const STATUS_LABEL={idle:'Ready',preparing:'Preparing',loading:'Loading voice',playing:'Playing',paused:'Paused',stopped:'Stopped',completed:'Completed',error:'Error'} as const;
export function VoicePlayer({recipe,voice}:{recipe:RecipeData;voice:ReturnType<typeof useRecipeVoice>}){
 const t=voice.activeTranslation;const step=voice.index;
 const title=t?.steps[step]?.title||recipe.steps[step]?.title;
 const heading=voice.segment===-3?'Voice test':voice.segment===-2?(t?.name||recipe.name):voice.segment===-1?(voice.lang==='te'?'పదార్థాలు':voice.lang==='hi'?'सामग्री':'Ingredients'):title;
 const showChunks=voice.segment!==null&&voice.chunks.length>0;
 const label=LANGS[voice.lang].label;
 const blocked=!voice.canPlay&&!voice.translationBusy&&voice.voicesLoaded;
 const message=voice.error||(blocked?(voice.lang!=='en'&&!voice.translations[voice.lang]?`${label} translation has not been loaded yet.`:!voice.supported?'Your browser does not support speech synthesis and local narration is unavailable.':`No ${label} voice is installed on this device and local narration is unavailable on the server. Install a ${label} speech voice in your system settings.`):'');
 const playing=voice.status==='playing';
 const starting=voice.status==='loading'&&voice.segment!==null;
 return <section className="voice-player" aria-label="Voice cooking assistant" data-status={voice.status}>
 <div className="voice-head"><div className="voice-icon"><Headphones size={22}/></div><div><span>YOUR PERSONAL COOKING COMPANION</span><h3>Listen &amp; cook along</h3></div>
  <span className={`voice-status is-${voice.status}`} role="status" aria-live="polite"><span/>{voice.translationBusy?'Preparing translation':voice.waiting?'Waiting for you':voice.status==='completed'?'Narration finished':STATUS_LABEL[voice.status]}</span></div>
 <div className="voice-settings">
  <label>Language<select value={voice.lang} onChange={e=>voice.selectLanguage(e.target.value as Lang)}>{(Object.keys(LANGS) as Lang[]).map(l=><option key={l} value={l}>{l==='en'?'English':`${LANGS[l].native} · ${LANGS[l].label}`}</option>)}</select></label>
  <label>Voice<select value={voice.voiceUri} onChange={e=>voice.chooseVoice(e.target.value)} disabled={!voice.voicesLoaded}>
   {!voice.voicesLoaded&&<option value="">Loading voices…</option>}
   {voice.voices.map((v,i)=><option key={v.voiceURI+i} value={v.voiceURI}>{v.name}{v.localService?'':' · online'}{voice.failedVoices.includes(v.voiceURI)?' (failed)':''}</option>)}
   {voice.serverVoices.map(v=><option key={v.id} value={`server:${v.id}`}>{v.engine}: {v.id}{v.developmentOnly?' (development only)':''}</option>)}
   {voice.serverAvailable&&<option value="server">{voice.providerLabel} ({label})</option>}
   {voice.voicesLoaded&&!voice.voices.length&&!voice.serverAvailable&&<option value="">No {label} voice installed</option>}
  </select></label>
  <label>Speed<select value={voice.rate} onChange={e=>voice.setRate(Number(e.target.value))}>{[0.75,1,1.25,1.5].map(r=><option key={r} value={r}>{r}×</option>)}</select></label>
 </div>
 <div className="voice-footer"><label>Volume <input aria-label="Narration volume" type="range" min={0} max={1} step={0.05} value={voice.volume} onChange={e=>voice.setVolume(Number(e.target.value))}/> {Math.round(voice.volume*100)}%</label><button onClick={voice.testSound}>Test speakers</button><button onClick={voice.useServerNow} disabled={!voice.serverAvailable}>Use server audio</button></div>
 <div className="voice-current" lang={t?voice.lang:'en'}>
  <div className="voice-current-top"><span>{voice.segment===-3?'TESTING VOICE':voice.segment===-2?'INTRODUCTION':voice.segment===-1?'INGREDIENTS':`STEP ${step+1} OF ${recipe.steps.length}`}</span>
   <div className={`waveform ${playing?'is-live':''}`} aria-hidden="true">{Array.from({length:14},(_,i)=><i key={i} style={{animationDelay:`${(i%7)*90}ms`}}/>)}</div></div>
  <h4>{heading}</h4>
  {showChunks?<p className="voice-sentences">{voice.chunks.map((c,i)=><span key={i} className={i===voice.chunkIndex&&voice.status==='playing'?'is-spoken':i<voice.chunkIndex?'is-done':''}>{c} </span>)}</p>
   :<p>{t?.steps[step]?.text||recipe.steps[step]?.text}</p>}
  {recipe.steps[step]?.minutes!=null&&<p className="step-duration">Estimated time: {recipe.steps[step].minutes} min</p>}
  <div className="voice-progress" role="progressbar" aria-label="Cooking progress" aria-valuemin={0} aria-valuemax={recipe.steps.length} aria-valuenow={voice.done.length}><span style={{width:`${voice.done.length/recipe.steps.length*100}%`}}/></div>
 </div>
 <div className="voice-guided-mode"><label><input type="checkbox" checked={voice.autoPlay} onChange={e=>voice.setAutoPlay(e.target.checked)}/> Auto-play all steps</label><p>{voice.autoPlay?'Reads the remaining steps continuously. Cooking completion is still marked by you.':'Read one step, take the time you need, then select Mark done to hear the next step.'}</p>
 <button className="outline-button" disabled={voice.done.includes(step)} onClick={()=>voice.markDone(step)}>Mark done{step<recipe.steps.length-1?' & continue':''}</button>
 {voice.waiting&&<p role="status">Step {step+1} has been read. Finish cooking this step, then mark it done.</p>}</div>
 <div className="voice-controls">
  <button title="Previous step" aria-label="Previous step" disabled={!voice.canPlay||step===0} onClick={voice.previous}><SkipBack size={18}/></button>
  <button title="Repeat current step" aria-label="Repeat current step" disabled={!voice.canPlay} onClick={voice.repeat}><RotateCcw size={18}/></button>
  {/* Pause appears only once the engine reports that audio actually started. */}
  <button className="voice-main-control" disabled={starting||(!voice.canPlay&&voice.status!=='paused')} onClick={playing?voice.pause:voice.status==='paused'?voice.resume:()=>voice.playStep()}>
   {starting?<LoaderCircle className="spin" size={19}/>:playing?<Pause size={19} fill="currentColor"/>:<Play size={19} fill="currentColor"/>}
   {starting?'Starting audio…':playing?'Pause':voice.status==='paused'?'Resume':voice.autoPlay?'Play all remaining steps':'Read this step'}</button>
  <button title="Next step" aria-label="Next step" disabled={!voice.canPlay||step===recipe.steps.length-1} onClick={voice.next}><SkipForward size={18}/></button>
  <button title="Stop narration" aria-label="Stop narration" disabled={!voice.active} onClick={voice.stop}><Square size={16}/></button>
 </div>
 <div className="voice-footer">
  <div><button onClick={voice.playAll} disabled={!voice.canPlayAll}><Volume2 size={16}/> Read full recipe continuously</button><button onClick={voice.restart} disabled={!voice.canPlay}><ListRestart size={16}/> Restart cooking</button><button onClick={voice.testVoice} disabled={!voice.canTest||starting||playing}><AudioLines size={16}/> Test voice</button></div>
  <span>{voice.translationBusy?<><LoaderCircle className="spin" size={14}/> Translating…</>:voice.engine==='server'?<><Cloud size={14}/> {voice.providerLabel}</>:voice.selectedVoice?`Voice: ${voice.selectedVoice.name}`:''}</span>
 </div>
 {voice.lang!=='en'&&!voice.translationBusy&&!voice.translations[voice.lang]&&<button className="outline-button" onClick={()=>voice.selectLanguage(voice.lang)}>Retry translation</button>}
 {voice.lang!=='en'&&(voice.translationBusy||voice.error)&&<button className="outline-button" onClick={()=>voice.selectLanguage('en')}>Continue in English</button>}
 {voice.translationBusy&&<p className="voice-notice" role="status">Ollama is preparing your translation. Your recipe remains available in English. You can continue in English to cancel this request.</p>}
 {voice.notice&&!voice.error&&<div className="voice-notice" role="status">{voice.notice}</div>}
 {message&&<div className="voice-warning" role="alert">{message}</div>}
 <div className="voice-steps"><span>JUMP TO STEP</span><div>{recipe.steps.map((s,i)=><button key={i} aria-label={`Go to step ${i+1}`} aria-current={step===i?'step':undefined} title={t?.steps[i]?.title||s.title} className={step===i?'current':''} onClick={()=>voice.goTo(i)}>{i+1}</button>)}</div></div>
 </section>
}
