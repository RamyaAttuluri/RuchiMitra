import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seeds} from '../prisma/seed-data.js';
test('starter recipes have unique slugs, valid quantities and specific steps',()=>{
 assert.ok(seeds.length>=10);
 assert.equal(new Set(seeds.map(r=>r.slug)).size,seeds.length);
 for(const recipe of seeds){
  assert.ok(recipe.name.length>3,recipe.slug);
  assert.ok(recipe.ingredients.length>=3,recipe.slug);
  assert.ok(recipe.steps.length>=3,recipe.slug);
  assert.ok(recipe.prepMinutes>=0&&recipe.cookMinutes>0);
  assert.ok(recipe.steps.every(x=>x.title.length>3&&x.text.length>15));
 }
});
test('at least three starters have built-in Telugu and Hindi narration',()=>{
 assert.ok(seeds.filter(r=>r.translations?.te&&r.translations?.hi).length>=3);
 for(const r of seeds.filter(r=>r.translations?.te&&r.translations?.hi)){
  assert.equal(r.translations?.te?.steps.length,r.steps.length);
  assert.equal(r.translations?.hi?.steps.length,r.steps.length);
 }
});
