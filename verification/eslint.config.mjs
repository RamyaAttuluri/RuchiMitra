import {createRequire} from 'node:module';
const require=createRequire(new URL('../.local/lint/package.json',import.meta.url));
const parser=require('@typescript-eslint/parser');
const hooks=require('eslint-plugin-react-hooks');
export default [{
 ignores:['**/node_modules/**','**/dist/**','**/.next*/**','**/.venv*/**','**/models/**','**/*.d.ts','.local/**'],
},{
 files:['frontend/**/*.{ts,tsx}','backend/**/*.{ts,mjs}'],
 plugins:{'react-hooks':hooks},
 linterOptions:{reportUnusedDisableDirectives:'off'},
 languageOptions:{parser,parserOptions:{ecmaVersion:'latest',sourceType:'module',ecmaFeatures:{jsx:true}}},
 rules:{'no-eval':'error','no-implied-eval':'error','no-new-func':'error','no-unreachable':'error','no-debugger':'error','no-unsafe-finally':'error','no-sparse-arrays':'error','no-constant-binary-expression':'error'},
}];
