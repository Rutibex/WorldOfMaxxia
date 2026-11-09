/** MM11 editor-only preview: canonical TypeScript evaluator with fixed illustrative caster stats.
 * Invoke with: node --experimental-strip-types scripts/preview-effect-expression.mjs '2d6 + INT_MOD'
 * No project edits, game state or unsafe expression evaluation.
 */
import {parseAmountExpression,evaluateAmountExpression} from '../src/shared/rules/expressions.ts';
import {SeededRng} from '../src/shared/rules/rng.ts';
try {
 const expr=process.argv[2];if(typeof expr!=='string')throw new Error('Pass an expression.');
 const parsed=parseAmountExpression(expr),rng=new SeededRng('maxxia-mm11-author-preview');
 const sample={LEVEL:3,PROFICIENCY:2,STR_MOD:0,DEX_MOD:1,CON_MOD:1,INT_MOD:2,WIS_MOD:2,CHA_MOD:1};
 let rolls=0;const value=evaluateAmountExpression(parsed,sample,(min,max)=>{rolls++;return rng.integer(min,max);});
 process.stdout.write(JSON.stringify({value,rolls,variables:sample,seed:'maxxia-mm11-author-preview'})+'\n');
} catch(error) {process.stderr.write((error instanceof Error?error.message:String(error))+'\n');process.exitCode=1;}
