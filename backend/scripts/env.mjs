import dotenv from 'dotenv';
import path from 'node:path';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const parent=fileURLToPath(new URL('..',import.meta.url));
// Compiled code lives in dist/scripts; source scripts live in scripts.
export const backendRoot=existsSync(path.join(parent,'package.json'))?parent:path.resolve(parent,'..');
/** @param {string} value @param {string} root @param {typeof path} [paths] */
export function normalizeDatabaseUrl(value,root,paths=path){
 if(!value?.startsWith('file:'))throw Error('DATABASE_URL must start with file: for this SQLite project.');
 let filename=value.slice(5);
 if(!filename||filename.includes('?')||filename.includes('#'))throw Error('DATABASE_URL must be a file path without query parameters or fragments.');
 if(filename.startsWith('//'))filename=fileURLToPath(value);
 const target=paths.isAbsolute(filename)?paths.normalize(filename):paths.resolve(root,'prisma',filename);
 return `file:${target.replace(/\\/g,'/')}`;
}
export function configureEnvironment(){
 dotenv.config({path:path.join(backendRoot,'.env')});
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is missing. Copy backend/.env.example to backend/.env, then restart.');
 process.env.DATABASE_URL=normalizeDatabaseUrl(process.env.DATABASE_URL,backendRoot);
 return process.env.DATABASE_URL;
}
