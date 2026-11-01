import {existsSync,readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {backendRoot} from './env.mjs';
const require=createRequire(import.meta.url);
const generated=path.join(backendRoot,'node_modules','.prisma','client');
let current=false;
try{
 // Prisma formats punctuation and whitespace in its snapshot. Compare tokens, preserving quoted defaults.
 const normalize=value=>value.replace(/"(?:\\.|[^"\\])*"|\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|\s+/g,token=>token.startsWith('"')?token:'');
 const schema=normalize(readFileSync(path.join(backendRoot,'prisma','schema.prisma'),'utf8'));
 const snapshot=normalize(readFileSync(path.join(generated,'schema.prisma'),'utf8'));
 const expected=require('@prisma/client/package.json').version;
 const actual=require('@prisma/client').Prisma.prismaVersion.client;
 current=schema===snapshot&&expected===actual&&existsSync(path.join(generated,'index.js'))&&readdirSync(generated).some(file=>/^(?:libquery_engine.*\.(?:so|dylib)\.node|query_engine-windows\.dll\.node)$/.test(file));
}catch{}
if(current&&!process.argv.includes('--force'))console.log('Prisma client schema, version and engine verified; no DLL rewrite needed.');
else {
 const cli=path.join(path.dirname(require.resolve('prisma/package.json')),'build','index.js');
 const result=spawnSync(process.execPath,[cli,'generate'],{cwd:backendRoot,env:process.env,stdio:'inherit'});
 if(result.status!==0){console.error('Client generation failed. On Windows, stop this workspace backend before regenerating a changed schema; do not terminate unrelated applications.');process.exit(result.status||1)}
}
