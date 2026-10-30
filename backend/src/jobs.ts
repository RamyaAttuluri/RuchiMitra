import type {PrismaClient,AiJob} from '@prisma/client';
// One worker per single-instance SQLite deployment. Claims are atomic.
export function createJobWorker(db:PrismaClient,execute:(job:AiJob)=>Promise<void>){
 let busy=false;
 const tick=async()=>{
  if(busy)return;busy=true;
  try{
   const job=await db.aiJob.findFirst({where:{status:'QUEUED'},orderBy:{createdAt:'asc'}});if(!job)return;
   const claimed=await db.aiJob.updateMany({where:{id:job.id,status:'QUEUED'},data:{status:'RUNNING',phase:'Writing recipe',error:null}});if(!claimed.count)return;
   try{await execute(job);await db.aiJob.update({where:{id:job.id},data:{status:'SUCCEEDED',phase:'Complete',error:null}})}
   catch(e){await db.aiJob.update({where:{id:job.id},data:{status:'FAILED',phase:'Needs retry',error:e instanceof Error?e.message:'Generation failed'}})}
  }finally{busy=false}
 };
 return {tick,start:async()=>{await db.aiJob.updateMany({where:{status:'RUNNING'},data:{status:'QUEUED',phase:'Resuming after restart'}});const timer=setInterval(()=>{void tick().catch(()=>console.error('AI job worker failed'))},1000).unref();void tick().catch(()=>{});return()=>clearInterval(timer)}};
}
