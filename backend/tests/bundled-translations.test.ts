import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seeds} from '../prisma/seed-data.js';
import {translateRecipe,translationSource,validateTranslation} from '../src/translation.js';
import {bundledTranslation} from '../src/bundled-translations.js';
import {scaleTranslation} from '../src/recipe-translations.js';
test('unchanged fish recipe has complete validated offline Telugu and Hindi, with scaled amounts',async()=>{
 const recipe=seeds.find(r=>r.slug==='fish-curry')!;
 for(const lang of ['te','hi'] as const){
  const t=await translateRecipe(recipe,lang);assert.equal(t.steps.length,5);assert.equal(t.ingredients.length,10);
  assert.deepEqual(validateTranslation(recipe,lang,t),t);assert.match(scaleTranslation(recipe,t,8).ingredients[0],/1000/);
  assert.equal(bundledTranslation({...recipe,description:'Edited recipe'},lang,translationSource),null);
  assert.equal(bundledTranslation({...recipe,servings:2},lang,translationSource),null);
 }
});
