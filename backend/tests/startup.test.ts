import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {PrismaClient} from '@prisma/client';
import {normalizeDatabaseUrl,backendRoot} from '../scripts/env.mjs';

test('Windows relative and absolute SQLite paths resolve consistently',()=>{
 assert.equal(normalizeDatabaseUrl('file:./dev.db','C:\\Projects\\RecipeFinder\\backend',path.win32),'file:C:/Projects/RecipeFinder/backend/prisma/dev.db');
 assert.equal(normalizeDatabaseUrl('file:C:\\Data\\recipes.db','C:\\Projects\\backend',path.win32),'file:C:/Data/recipes.db');
 assert.throws(()=>normalizeDatabaseUrl('file:','/project'));
 assert.throws(()=>normalizeDatabaseUrl('https://example.com','/project'));
});

test('first startup initializes relative-path database; repeat startup preserves data and custom photos',async()=>{
 const folder=mkdtempSync(path.join(tmpdir(),'recipe-startup-'));const filename=path.join(folder,'fresh.db');
 const relative=path.relative(path.join(backendRoot,'prisma'),filename).replace(/\\/g,'/');
 const env={...process.env,NODE_ENV:'development',DATABASE_URL:`file:${relative}`,ADMIN_EMAIL:'startup@example.test',ADMIN_PASSWORD:'TestStartupPassword123!'};
 const run=()=>spawnSync(process.execPath,[path.join(backendRoot,'scripts/bootstrap.mjs')],{cwd:folder,env,encoding:'utf8',timeout:30000});
 const db=new PrismaClient({datasourceUrl:`file:${filename}`});
 try{
  const first=run();assert.equal(first.status,0,first.stdout+first.stderr);assert.equal(await db.recipe.count(),12);assert.equal(await db.user.count(),1);
  const recipes=await db.recipe.findMany();assert.ok(recipes.every(r=>/^\/images\/recipes\/.+\.(jpg|png)$/.test(r.imageUrl)));
  const admin=await db.user.findUniqueOrThrow({where:{email:env.ADMIN_EMAIL}});
  const original=recipes[0];await db.recipe.update({where:{id:original.id},data:{description:'A description edited by the administrator.',imageUrl:'/uploads/abcdefabcdefabcdefabcdef.png',status:'DRAFT'}});
  await db.user.create({data:{name:'Existing User',email:'existing@example.test',passwordHash:'preserve-this-hash'}});
  const again=run();assert.equal(again.status,0,again.stdout+again.stderr);assert.equal(await db.recipe.count(),12);assert.equal(await db.user.count(),2);
  const saved=await db.recipe.findUniqueOrThrow({where:{id:original.id}});assert.equal(saved.description,'A description edited by the administrator.');assert.equal(saved.imageUrl,'/uploads/abcdefabcdefabcdefabcdef.png');assert.equal(saved.status,'DRAFT');assert.equal((await db.user.findUniqueOrThrow({where:{id:admin.id}})).passwordHash,admin.passwordHash);
 }finally{await db.$disconnect();rmSync(folder,{recursive:true,force:true})}
});

test('unbaselined existing database is not reset or overwritten',async()=>{
 const folder=mkdtempSync(path.join(tmpdir(),'recipe-legacy-'));const filename=path.join(folder,'legacy.db');const url=`file:${filename}`;
 const db=new PrismaClient({datasourceUrl:url});
 try{
  await db.$executeRawUnsafe('CREATE TABLE KeepMe (value TEXT)');await db.$executeRawUnsafe("INSERT INTO KeepMe VALUES ('important existing data')");
  const run=spawnSync(process.execPath,[path.join(backendRoot,'scripts/bootstrap.mjs')],{env:{...process.env,NODE_ENV:'development',DATABASE_URL:url,ADMIN_EMAIL:'',ADMIN_PASSWORD:''},encoding:'utf8',timeout:30000});
  assert.notEqual(run.status,0);assert.match(run.stderr,/STARTUP STOPPED/);const rows=await db.$queryRawUnsafe<{value:string}[]>('SELECT value FROM KeepMe');assert.equal(rows[0].value,'important existing data');
 }finally{await db.$disconnect();rmSync(folder,{recursive:true,force:true})}
});

test('production rejects demo administrator settings before creating a database',()=>{
 const folder=mkdtempSync(path.join(tmpdir(),'recipe-production-'));const filename=path.join(folder,'production.db');
 try{const run=spawnSync(process.execPath,[path.join(backendRoot,'scripts/bootstrap.mjs')],{env:{...process.env,NODE_ENV:'production',DATABASE_URL:`file:${filename}`,ADMIN_EMAIL:'admin@recipefinder.com',ADMIN_PASSWORD:'RecipeAdminLocal@2026'},encoding:'utf8'});assert.notEqual(run.status,0);assert.match(run.stderr,/Production requires/);assert.equal(existsSync(filename),false)}finally{rmSync(folder,{recursive:true,force:true})}
});
