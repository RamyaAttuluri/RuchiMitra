// Safe startup: deploy versioned migrations and idempotently seed, never reset or db push.
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {createRequire} from 'node:module';
import {configureEnvironment,backendRoot} from './env.mjs';
const require=createRequire(import.meta.url);
function run(args){const result=spawnSync(process.execPath,args,{cwd:backendRoot,env:process.env,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw Error(`Database startup step failed (exit ${result.status}).`)}
try{
 const url=configureEnvironment();
 console.log(`Database: ${url.slice(5)}`);
 // Validate administrator settings BEFORE changing a database.
 const email=process.env.ADMIN_EMAIL?.trim().toLowerCase(),password=process.env.ADMIN_PASSWORD;
 if(Boolean(email)!==Boolean(password))throw Error('Set both ADMIN_EMAIL and ADMIN_PASSWORD, or leave both empty.');
 if(password&&password.length<12)throw Error('ADMIN_PASSWORD must be at least 12 characters.');
 if(process.env.NODE_ENV==='production'&&(!email||!password||email==='admin@recipefinder.com'||password==='RecipeAdminLocal@2026'))throw Error('Production requires your own ADMIN_EMAIL and ADMIN_PASSWORD. Replace the demo credentials.');
 const prisma=path.join(path.dirname(require.resolve('prisma/package.json')),'build','index.js');
 if(process.argv.includes('--generate'))run([prisma,'generate']);
 run([path.join(backendRoot,'scripts','ensure-db.mjs')]);
 run([prisma,'migrate','deploy']);
 run(['--import','tsx',path.join(backendRoot,'prisma','seed.ts')]);
 console.log('Database ready: migrations and starter recipes verified.');
}catch(e){
 console.error('\nSTARTUP STOPPED:',e instanceof Error?e.message:'Database initialization failed.');
 console.error('The API was not started. Do not delete or reset an existing database. See DATABASE_REPAIR.md.');
 process.exitCode=1;
}
