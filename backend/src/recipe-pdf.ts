import {chromium,type Browser} from 'playwright-core';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {backendRoot} from '../scripts/env.mjs';
import {ProviderError} from './ai-error.js';
import {setting} from './inference-queue.js';
const labels={en:{ingredients:'Ingredients',steps:'Cooking instructions',tip:'Cooking tip',prep:'Preparation',cook:'Cooking',total:'Total time',serves:'Servings',minutes:'min',taste:'to taste'},te:{ingredients:'పదార్థాలు',steps:'వంట విధానం',tip:'వంట చిట్కా',prep:'తయారీ',cook:'వంట',total:'మొత్తం సమయం',serves:'వడ్డనలు',minutes:'నిమిషాలు',taste:'రుచికి సరిపడా'},hi:{ingredients:'सामग्री',steps:'पकाने की विधि',tip:'खाना बनाने की सलाह',prep:'तैयारी',cook:'पकाना',total:'कुल समय',serves:'परोसने की संख्या',minutes:'मिनट',taste:'स्वादानुसार'}};
export type PdfLanguage=keyof typeof labels;
export const pdfFilename=(name:string,language:PdfLanguage)=>`${name.normalize('NFKD').replace(/\.pdf/gi,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100)||'Recipe'}-${{en:'English',te:'Telugu',hi:'Hindi'}[language]}.pdf`;
const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
let fontCss:Promise<string>|undefined;
function fonts(){return fontCss??=Promise.all(['notosans','notosanstelugu','notosansdevanagari'].map(async(family,index)=>`@font-face{font-family:F${index};font-weight:400;src:url(data:font/ttf;base64,${(await readFile(path.join(backendRoot,'assets','fonts',`${family}.ttf`))).toString('base64')})}`)).then(rows=>rows.join(''))}
async function imageData(url:string){
 try{
  let bytes:Buffer;
  if(/^\/images\/recipes\/[a-z-]+\.(jpg|png)$/.test(url))bytes=await readFile(path.resolve(backendRoot,'../frontend/public',url.slice(1)));
  else if(/^\/uploads\/[a-f0-9]{24}\.(jpg|png|webp)$/.test(url))bytes=await readFile(path.join(backendRoot,url.slice(1)));
  else{
   const target=new URL(url);if(target.protocol!=='https:'||target.hostname!=='images.unsplash.com'||target.username||target.password)return '';
   const response=await fetch(target,{redirect:'error',signal:AbortSignal.timeout(5000)});if(!response.ok)return '';
   if(Number(response.headers.get('content-length')||0)>4*1024*1024)return '';
   const reader=response.body?.getReader();if(!reader)return '';const parts:Uint8Array[]=[];let size=0;
   while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>4*1024*1024){await reader.cancel();return ''}parts.push(value)}bytes=Buffer.concat(parts);
  }
  if(bytes.length>4*1024*1024)return '';
  const mime=bytes.subarray(0,3).equals(Buffer.from([255,216,255]))?'image/jpeg':bytes.subarray(1,4).toString()==='PNG'?'image/png':bytes.subarray(8,12).toString()==='WEBP'?'image/webp':'';
  return mime?`data:${mime};base64,${bytes.toString('base64')}`:'';
 }catch{return ''}
}
export async function recipeHtml(recipe:any,language:PdfLanguage,servings:number,translation?:any){
 const l=labels[language],ingredients=typeof recipe.ingredients==='string'?JSON.parse(recipe.ingredients):recipe.ingredients,steps=typeof recipe.steps==='string'?JSON.parse(recipe.steps):recipe.steps;
 const image=await imageData(recipe.imageUrl);const t=translation;
 const ingredientRows=ingredients.map((ingredient:any,i:number)=>{
  const amount=ingredient.quantity===null?l.taste:`${Math.round(ingredient.quantity*(ingredient.scalable===false?1:servings/recipe.servings)*100)/100} ${ingredient.unit}`.trim();
  // Validated translated rows contain the translated unit and serving-adjusted amount.
  return `<tr><td>${escape(t?t.ingredients[i]:ingredient.name)}</td>${t?'':`<td>${escape(amount)}</td>`}</tr>`;
 }).join('');
 return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'"><style>${await fonts()}
 @page{size:A4;margin:18mm 16mm 20mm}*{box-sizing:border-box}body{font-family:${language==='te'?'F1':language==='hi'?'F2':'F0'},F0,sans-serif;font-size:11pt;line-height:1.75;color:#302721;margin:0}h1,h2,h3{color:#722f37;line-height:1.45;break-after:avoid}h1{font-size:27pt;margin:8mm 0 4mm}h2{font-size:17pt;border-bottom:1px solid #e8dcc6;padding-bottom:2mm;margin:8mm 0 3mm}h3{font-size:12pt;margin:0 0 2mm}p{margin:0 0 4mm;orphans:3;widows:3;overflow-wrap:anywhere}.brand{font-family:F0;font-size:9pt;letter-spacing:2px;color:#722f37}.hero{width:100%;height:48mm;object-fit:cover;border-radius:4mm;margin:2mm 0 5mm}.facts{background:#f7f3ed;border:1px solid #e8dcc6;padding:4mm;display:grid;grid-template-columns:1fr 1fr;gap:2mm;font-size:10pt;break-inside:avoid}table{width:100%;border-collapse:collapse}td{padding:2.5mm 2mm;border-bottom:1px solid #e8dcc6;overflow-wrap:anywhere}td:last-child:not(:first-child){width:30%;text-align:right}tr{break-inside:avoid}article{margin:0 0 5mm;break-inside:avoid}article p{margin-bottom:0}.number{font-family:F0;color:#a57835;margin-right:3mm}.tip{background:#f7f3ed;padding:4mm;border-left:2px solid #722f37;break-inside:avoid}.attribution{font-family:F0;font-size:8pt;color:#70675e;margin-top:8mm}
 </style></head><body><div class="brand">RUCHIMITRA · RECIPE FINDER</div><h1>${escape(t?.name||recipe.name)}</h1><p>${t&&!t.description?'<small lang="en">Original description (English)</small><br>':''}${escape(t?.description||recipe.description)}</p>${image?`<img class="hero" src="${image}" alt="">`:''}
 <div class="facts"><span>${escape(recipe.cuisine)} · ${escape(recipe.category)}</span><span>${escape(recipe.difficulty)}</span><span>${l.prep}: ${recipe.prepMinutes} ${l.minutes}</span><span>${l.cook}: ${recipe.cookMinutes} ${l.minutes}</span><span>${l.total}: ${recipe.prepMinutes+recipe.cookMinutes} ${l.minutes}</span><strong>${l.serves}: ${servings}</strong></div>
 <h2>${l.ingredients}</h2><table><tbody>${ingredientRows}</tbody></table><h2>${l.steps}</h2>${steps.map((step:any,i:number)=>`<article><h3><span class="number">${String(i+1).padStart(2,'0')}</span>${escape(t?.steps[i]?.title||step.title)}</h3><p>${escape(t?.steps[i]?.text||step.text)}</p>${step.minutes!=null?`<small>${step.minutes} ${l.minutes}</small>`:''}${step.heatLevel||step.temperature?`<p>${escape(step.heatLevel)} ${escape(step.temperature)}</p>`:''}</article>`).join('')}
 ${(t?.tip||recipe.tip)?`<section class="tip"><h3>${l.tip}</h3><p>${escape(t?.tip||recipe.tip)}</p></section>`:''}
 <p class="attribution">RuchiMitra · ${recipe.source==='AI'?'AI-generated recipe. Review measurements, allergies and food safety.':'Curated recipe.'} ${image?'Photography: existing Recipe Finder image collection; see bundled IMAGE_SOURCES.md.':''}</p></body></html>`;
}
let busy=false;const waiters:(()=>void)[]=[];const cache=new Map<string,Buffer>();
async function acquire(signal?:AbortSignal){
 if(signal?.aborted)throw new ProviderError('PDF download cancelled.',499,'PDF_CANCELLED');
 if(!busy){busy=true;return}
 if(waiters.length>=2)throw new ProviderError('PDF renderer is busy. Try again shortly.',503,'PDF_BUSY');
 await new Promise<void>((resolve,reject)=>{let done=false;const clean=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort)};const run=()=>{if(done)return;done=true;clean();resolve()};const fail=()=>{if(done)return;done=true;clean();const i=waiters.indexOf(run);if(i>=0)waiters.splice(i,1);reject(new ProviderError('PDF queue expired or download cancelled. Try again or use Print / Save as PDF.',503,'PDF_QUEUE'))};const abort=fail;const timer=setTimeout(fail,15000);waiters.push(run);signal?.addEventListener('abort',abort,{once:true})});
}
export async function renderRecipePdf(recipe:any,language:PdfLanguage,servings:number,translation?:any,signal?:AbortSignal){
 const key=createHash('sha256').update(JSON.stringify([recipe,language,servings,translation])).digest('hex');const cached=cache.get(key);if(cached)return cached;
 await acquire(signal);let browser:Browser|undefined;
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),setting('PDF_TIMEOUT_MS',45000,5000,120000));
 const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
 const abort=()=>{void browser?.close()};combined.addEventListener('abort',abort,{once:true});
 try{
  combined.throwIfAborted();
  const afterWaiting=cache.get(key);if(afterWaiting)return afterWaiting;
  const html=await recipeHtml(recipe,language,servings,translation);combined.throwIfAborted();
  const executable=process.env.PDF_BROWSER_EXECUTABLE;
  browser=await chromium.launch({headless:true,timeout:15000,...(executable?{executablePath:executable}:process.platform==='win32'?{channel:'msedge'}:{})});
  combined.throwIfAborted();
  const page=await browser.newPage({javaScriptEnabled:false});await page.route('**/*',route=>route.abort());
  await page.setContent(html,{waitUntil:'load',timeout:15000});await page.evaluate(()=>document.fonts.ready);
  const bytes=await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font:9px sans-serif;width:100%;text-align:center;color:#722f37">RuchiMitra · <span class="pageNumber"></span> / <span class="totalPages"></span></div>'});
  combined.throwIfAborted();if(bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Invalid PDF');
  cache.set(key,bytes);while(cache.size>12||[...cache.values()].reduce((sum,b)=>sum+b.length,0)>32*1024*1024)cache.delete(cache.keys().next().value!);return bytes;
 }catch(e){if(signal?.aborted)throw new ProviderError('PDF download cancelled.',499,'PDF_CANCELLED');if(controller.signal.aborted)throw new ProviderError('PDF rendering timed out. Try again or use Print / Save as PDF.',504,'PDF_TIMEOUT');throw new ProviderError('PDF renderer is unavailable. Install a supported browser or use Print / Save as PDF.',503,'PDF_RENDERER');}
 finally{clearTimeout(timer);combined.removeEventListener('abort',abort);await browser?.close().catch(()=>{});const next=waiters.shift();if(next)next();else busy=false}
}
