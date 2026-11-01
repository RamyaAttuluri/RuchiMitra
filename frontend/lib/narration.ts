import type {Lang, RecipeData, Translation} from './types';

export type Status='idle'|'preparing'|'loading'|'playing'|'paused'|'stopped'|'completed'|'error';
export type Mode='full'|'continue'|'single'|'test';
export type Item={id:string;recipeId:string;language:Lang;type:'introduction'|'ingredient'|'step';stepIndex?:number;text:string;audio?:Blob;status:'pending'|'playing'|'completed'};
export type Snapshot={status:Status;queue:Item[];cursor:number;session:number;error:string;mode:Mode};
export type Event='PLAY'|'PAUSE'|'RESUME'|'STOP'|'NEXT'|'PREVIOUS'|'RESTART'|'AUDIO_STARTED'|'AUDIO_ENDED'|'AUDIO_FAILED'|'LANGUAGE_CHANGED'|'RECIPE_CHANGED';
export interface Playback {stop():void;pause():void;resume():void}
export interface Adapter {start(item:Item,events:{loading?():void;started():void;ended():void;failed(error:Error):void}):Playback}

export function buildQueue(recipe:RecipeData,language:Lang,translation:Translation|null,mode:Mode,start=0,servings=recipe.servings):Item[]{
 if(language!=='en'&&(!translation||translation.steps.length!==recipe.steps.length||(mode==='full'&&translation.ingredients.length!==recipe.ingredients.length)))throw Error('A complete translation is required. Retry translation.');
 const make=(type:Item['type'],text:string,stepIndex?:number):Item=>({id:`${recipe.id}:${language}:${servings}:${type}:${stepIndex??'intro'}`,recipeId:recipe.id,language,type,stepIndex,text,status:'pending'});
 const steps=(translation?.steps??recipe.steps).map((s,i)=>{
  const minutes=recipe.steps[i].minutes;
  const duration=minutes&&minutes>0?(language==='te'?` ఈ దశకు సుమారు ${minutes} నిమిషాలు పడుతుంది.`:language==='hi'?` इस चरण में लगभग ${minutes} मिनट लगेंगे।`:` This step takes about ${minutes} minutes.`):'';
  const wait=mode==='single'?(language==='te'?' పూర్తయిన తర్వాత మార్క్ డన్ నొక్కండి.':language==='hi'?' पूरा होने पर मार्क डन दबाएँ।':' When you have finished, select Mark done to continue.') :'';
  return make('step',`${s.title}. ${s.text}${duration}${wait}`,i);
 });
 if(mode==='single')return [steps[start]];
 if(mode==='continue')return steps.slice(start);
 const intro=translation?.intro??`${recipe.name}. ${recipe.description}`;
 // Scaled translations must be validated by the backend, never guessed from number words.
 if(translation&&servings!==(translation.servings??recipe.servings))throw Error('Updated translated quantities are not ready. Wait for local translation or restore the original servings.');
 const ingredients=recipe.ingredients.map((ing,i)=>({...make('ingredient',translation?.ingredients[i]??`${ing.quantity===null?'':`${Math.round((ing.scalable===false?ing.quantity:ing.quantity*servings/recipe.servings)*100)/100} ${ing.unit} `}${ing.name}${ing.quantity===null?', to taste':''}`),id:`${recipe.id}:${language}:${servings}:ingredient:${i}`}));
 return [make('introduction',intro),...ingredients,...steps];
}

/** One cursor and one session. Each segment also has a lease so duplicate/stale events are inert. */
export class NarrationController {
 state:Snapshot={status:'idle',queue:[],cursor:0,session:0,error:'',mode:'continue'};
 private player?:Playback;private lease=0;private started=false;private settled=false;
 constructor(private adapter:Adapter,private notify:(state:Snapshot)=>void){}
 private update(patch:Partial<Snapshot>){this.state={...this.state,...patch};this.notify(this.state)}
 private cancel(){this.lease++;this.player?.stop();this.player=undefined}
 play(queue:Item[],mode:Mode){this.cancel();this.update({status:'preparing',queue:queue.map(x=>({...x,status:'pending'})),cursor:0,session:this.state.session+1,error:'',mode});if(!queue.length){this.update({status:'error',error:'Nothing to narrate.'});return}this.load()}
 private load(){
  this.cancel();const lease=this.lease;this.started=false;this.settled=false;this.update({status:'loading'});
  const valid=()=>lease===this.lease&&!this.settled;
  try{const player=this.adapter.start(this.state.queue[this.state.cursor],{
   loading:()=>{if(valid()&&this.state.status!=='paused')this.update({status:'loading'})},
   started:()=>{if(!valid()||this.state.status==='paused')return;this.started=true;this.update({status:'playing',queue:this.state.queue.map((x,i)=>i===this.state.cursor?{...x,status:'playing'}:x)})},
   ended:()=>{if(!valid()||this.state.status==='paused')return;if(!this.started){this.send('AUDIO_FAILED','Audio ended before playback started.');return}this.settled=true;
    const queue=this.state.queue.map((x,i)=>i===this.state.cursor?{...x,status:'completed' as const}:x);
    if(this.state.cursor===queue.length-1){this.cancel();this.update({queue,status:'completed'});return}
    this.update({queue,cursor:this.state.cursor+1});this.load();},
   failed:e=>{if(valid())this.send('AUDIO_FAILED',e.message)},
  });if(lease===this.lease)this.player=player;else player.stop();}catch(e){this.send('AUDIO_FAILED',e instanceof Error?e.message:'Audio failed.')}
 }
 send(event:Event,message=''){
  if(event==='PAUSE'&&this.state.status==='playing'){this.update({status:'paused'});this.player?.pause()}
  else if(event==='RESUME'&&this.state.status==='paused'){this.update({status:'loading'});this.player?.resume()}
  else if(event==='RESTART'){this.play(this.state.queue,this.state.mode)}
  else if(event==='NEXT'||event==='PREVIOUS'){
   const current=this.state.queue[this.state.cursor]?.stepIndex??-1;
   const next=event==='NEXT'?this.state.queue.findIndex(x=>x.type==='step'&&x.stepIndex!>current):this.state.queue.findIndex(x=>x.type==='step'&&x.stepIndex===Math.max(0,current-1));
   if(next>=0){this.update({cursor:next});this.load()}
  }else if(['STOP','LANGUAGE_CHANGED','RECIPE_CHANGED','AUDIO_FAILED'].includes(event)){
   this.cancel();this.update({session:this.state.session+1,status:event==='AUDIO_FAILED'?'error':event==='STOP'?'stopped':'idle',error:message,...(event.endsWith('CHANGED')?{queue:[],cursor:0}:{})});
  }
 }
}
