/** MM07 development bridge: canonical TypeScript class stat preview for the native editor.
 * Requires Node 22.18+ with type stripping. No arbitrary expression execution.
 * Input is one JSON class definition object on stdin; output: a bounded JSON preview.
 */
import {readClassDatabase,installClassDatabase,CLASSES} from '../src/shared/content/classes.ts';
import {createDefaultParty,derived,defaultCombatSetup} from '../src/shared/rules/party.ts';
const parts=[];let bytes=0;
for await (const chunk of process.stdin) {bytes+=chunk.length;if(bytes>24*1024)throw Error('Preview exceeds 24 KiB.');parts.push(chunk);}
const value=JSON.parse(Buffer.concat(parts).toString('utf8'));
const proposed=readClassDatabase({format:'maxxia-classes',version:1,classes:[value]}).classes[0];
const originals=Object.values(CLASSES).filter(v=>v.id!==proposed.id);
installClassDatabase({format:'maxxia-classes',version:1,classes:[...originals,proposed]});
const seed=createDefaultParty().characters.hero_tarin;
const stats={...seed,classId:proposed.id,attributes:{STR:12,DEX:12,CON:14,INT:12,WIS:12,CHA:12},combatSetup:defaultCombatSetup(proposed.id),equipment:{melee:null,ranged:null,body:null,offhand:null,accessoryA:null,accessoryB:null,preferredAttack:'melee'}};
stats.attributes[proposed.primary]=16;
if(proposed.casting)stats.attributes[proposed.casting]=16;
const rows=[1,3,5].map(level=>{const d=derived({...stats,level});return {level,maxHP:d.maxHP,maxSP:d.maxSP,defense:d.defense,spellDC:d.spellDC,preparedDefense:d.preparedDefense};});
process.stdout.write(JSON.stringify({classId:proposed.id,source:'canonical-typescript',assumptions:'CON 14, primary/casting 16, unarmored, no gear or conditions',rows})+'\n');
