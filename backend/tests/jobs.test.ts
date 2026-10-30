import {test} from 'node:test';import assert from 'node:assert/strict';import {createJobWorker} from '../src/jobs.js';
// State-machine isolation: the real SQLite/HTTP generation contract is covered in api.test.ts.
test('worker claims once, exposes failure and resumes interrupted jobs',async()=>{
 let row:any={id:'one',status:'QUEUED',createdAt:new Date(),recipeId:'saved-draft'};let calls=0;
 const fake:any={aiJob:{findFirst:async()=>row.status==='QUEUED'?{...row}:null,updateMany:async({where,data}:any)=>{if(row.status!==where.status)return {count:0};Object.assign(row,data);return {count:1}},update:async({data}:any)=>Object.assign(row,data)}};
 const worker=createJobWorker(fake,async job=>{calls++;assert.equal(job.recipeId,'saved-draft');await new Promise(r=>setTimeout(r,10));throw Error('Provider timeout')});await Promise.all([worker.tick(),worker.tick()]);assert.equal(calls,1);assert.equal(row.status,'FAILED');assert.equal(row.error,'Provider timeout');
 row.status='RUNNING';const resumed=createJobWorker(fake,async()=>{calls++});const stop=await resumed.start();for(let n=0;n<20&&row.status!=='SUCCEEDED';n++)await new Promise(r=>setTimeout(r,5));stop();assert.equal(row.status,'SUCCEEDED');assert.equal(calls,2);assert.equal(row.recipeId,'saved-draft');
});
