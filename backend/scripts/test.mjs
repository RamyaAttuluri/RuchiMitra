import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=readdirSync(new URL('../tests/',import.meta.url)).filter(x=>x.endsWith('.test.ts')).map(x=>`tests/${x}`);
const result=spawnSync(process.execPath,['--import','tsx','--test','--test-concurrency=1',...files],{stdio:'inherit',cwd:new URL('..',import.meta.url)});
process.exit(result.status??1);
