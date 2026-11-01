import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {recipeHtml,renderRecipePdf,pdfFilename} from '../src/recipe-pdf.js';
import {scaleTranslation,sourceHash} from '../src/recipe-translations.js';
const recipe={name:'Long Recipe',description:'A deliberately long export fixture, never stored in the user database.',imageUrl:'',servings:2,prepMinutes:5,cookMinutes:20,cuisine:'Test',category:'Vegetarian',difficulty:'Easy',source:'TEST',tip:'Use the complete instructions.',ingredients:Array.from({length:40},(_,i)=>({name:`Ingredient ${i+1}`,quantity:i+1,unit:'g'})),steps:Array.from({length:30},(_,i)=>({title:`Complete step ${i+1}`,text:`Instruction ${i+1}: prepare the ingredients carefully and cook until ready. `.repeat(5),minutes:2}))};
test('PDF filename is safe and has exactly one extension; HTML escapes untrusted content',async()=>{
 assert.equal(pdfFilename('../Name.pdf.pdf\r\n"<>','hi'),'Name-Hindi.pdf');
 const html=await recipeHtml({...recipe,name:'<script>alert(1)</script>'},'en',4);
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('Ingredient 40'));assert.ok(html.includes('Complete step 30'));assert.ok(html.includes('80 g'));
});
test('reviewed written quantities scale without AI; ambiguous amounts require translation',()=>{
 const small={...recipe,ingredients:[{name:'Chicken',quantity:500,unit:'g'},{name:'Oil',quantity:2,unit:'tbsp'},{name:'Salt',quantity:null,unit:''},{name:'Fixed',quantity:1,unit:'',scalable:false}]};
 const translated={ingredients:['చికెన్ ఐదు వందల గ్రాములు','నూనె రెండు టేబుల్ స్పూన్లు','ఉప్పు తగినంత','ఒక ఆకు'],steps:[{title:'వండండి',text:'వంట చేయండి'}]};
 const scaled=scaleTranslation(small,translated,4);assert.deepEqual(scaled?.ingredients,['చికెన్ 1000 గ్రాములు','నూనె 4 టేబుల్ స్పూన్లు','ఉప్పు తగినంత','ఒక ఆకు']);assert.deepEqual(scaled?.steps,translated.steps);assert.equal(translated.ingredients[0],'చికెన్ ఐదు వందల గ్రాములు');
 assert.equal(scaleTranslation({...small,ingredients:[{quantity:2}]},{ingredients:['2 or 3 onions']},4),null);
 assert.notEqual(sourceHash(recipe),sourceHash({...recipe,steps:[{title:'Changed',text:'Changed step'}]}));
});
test('real Chromium export contains multiple PDF pages for all 40 ingredients and 30 steps',async()=>{
 const bytes=await renderRecipePdf(recipe,'en',4);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
 assert.ok((bytes.toString('latin1').match(/\/Type \/Page\b/g)||[]).length>3);
 await writeFile(new URL('../../verification/recipe-long.pdf',import.meta.url),bytes);
});
test('missing PDF browser returns an actionable renderer error instead of fake file bytes',async()=>{
 const previous=process.env.PDF_BROWSER_EXECUTABLE;process.env.PDF_BROWSER_EXECUTABLE=pathToMissingBrowser();
 try{await assert.rejects(renderRecipePdf({...recipe,name:'Missing browser fixture'},'en',2),{code:'PDF_RENDERER'})}finally{if(previous===undefined)delete process.env.PDF_BROWSER_EXECUTABLE;else process.env.PDF_BROWSER_EXECUTABLE=previous}
});
function pathToMissingBrowser(){return process.platform==='win32'?'C:/nonexistent-recipe-browser/missing.exe':'/nonexistent-recipe-browser/missing'}
