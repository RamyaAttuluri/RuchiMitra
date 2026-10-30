import {mkdir,open} from 'node:fs/promises';
import path from 'node:path';
import {configureEnvironment} from './env.mjs';
const target=configureEnvironment().slice(5);
await mkdir(path.dirname(target),{recursive:true});
const file=await open(target,'a');await file.close();
