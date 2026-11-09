/** Generate field/reference docs from schemas and the shared diagnostic vocabulary. */
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {TOOL_DIAGNOSTICS} from '../toolkit/diagnostics.mjs';
const root=new URL('../',import.meta.url),sections=[];
function fields(schema,path='$',required=true,result=[]){
 const type=schema.const!==undefined?'const '+JSON.stringify(schema.const):schema.enum?'enum '+schema.enum.join(', '):schema.$ref?'ref '+schema.$ref:Array.isArray(schema.type)?schema.type.join(' | '):schema.type??(schema.oneOf?'oneOf':schema.allOf?'allOf':'constraint');
 const constraints=['pattern','minLength','maxLength','minimum','maximum','minItems','maxItems'].filter(k=>schema[k]!==undefined).map(k=>k+'='+schema[k]);
 result.push(`| \`${path}\` | ${required?'yes':'no'} | ${String(type).replaceAll('|','\\|')} | ${constraints.map(x=>'`'+x.replaceAll('|','\\|')+'`').join(' ')} |`);
 for(const [k,s] of Object.entries(schema.properties??{}))fields(s,path+'.'+k,(schema.required??[]).includes(k),result);
 if(schema.items)fields(schema.items,path+'[]',true,result);
 for(const [i,s] of (schema.oneOf??schema.allOf??[]).entries())fields(s,path+'<'+i+'>',true,result);
 for(const [k,s] of Object.entries(schema.$defs??{}))fields(s,'#/$defs/'+k,true,result);
 return result;
}
for(const directory of ['contracts/mp01/schemas/','toolkit/schemas/'])for(const file of (await readdir(new URL(directory,root))).sort()){
 if(!file.endsWith('.json'))continue;const s=JSON.parse(await readFile(new URL(directory+file,root),'utf8'));
 sections.push('## '+directory+file+'\n\nSchema ID: `'+s.$id+'`\n\n| Field | Required | Type | Constraints |\n|---|---|---|---|\n'+fields(s).join('\n')+'\n');
}
const source=await readFile(new URL('contracts/mp01/validate.mjs',root),'utf8');
const inherited=[...new Set([...source.matchAll(/fail\('(E_[A-Z_]+)'/g)].map(m=>m[1]))].sort();
const runtimeSource=await readFile(new URL('engine/world-of-maxxia/src/shared/content/catalogue.ts',root),'utf8')+await readFile(new URL('engine/world-of-maxxia/src/shared/content/catalogue-build.ts',root),'utf8');
const runtimeCodes=[...new Set([...runtimeSource.matchAll(/fail\('(E_[A-Z_]+)'/g)].map(m=>m[1]))].sort();
const text='# MP04 generated schema and diagnostic reference\n\nGenerated from the seven frozen MP01 schemas, six authored-payload schemas and diagnostic registry. Edit sources and regenerate. Schema tables describe shape; semantic validation additionally checks IDs, visibility, dependencies, positions and references. `[]` denotes an array item; `<n>` denotes a schema alternative or intersection branch.\n\n'+sections.join('\n')+'\n## Tool diagnostics\n\n| Code | Meaning |\n|---|---|\n'+Object.entries(TOOL_DIAGNOSTICS).sort(([a],[b])=>a<b?-1:1).map(([k,v])=>'| `'+k+'` | '+v+' |').join('\n')+'\n\n## Inherited contract diagnostics\n\nThese preserve the MP01 semantic codes and report paths against the actual manifest or index file. See the MP01 normative contract and invalid fixtures for each rule.\n\n'+inherited.map(k=>'- `'+k+'`').join('\n')+'\n\n## Runtime catalogue diagnostics\n\n'+runtimeCodes.map(k=>'- `'+k+'`').join('\n')+'\n';
function tsType(v){
 if(v.const!==undefined)return JSON.stringify(v.const);
 if(v.enum)return v.enum.map(x=>JSON.stringify(x)).join(' | ');
 if(v.oneOf)return v.oneOf.map(x=>'('+tsType(x)+')').join(' | ');
 if(Array.isArray(v.type))return v.type.map(t=>tsType({...v,type:t})).join(' | ');
 if(v.type==='array')return 'Array<'+tsType(v.items)+'>';
 if(v.type==='object'){const p=Object.entries(v.properties??{}).map(([k,x])=>JSON.stringify(k)+((v.required??[]).includes(k)?'':'?')+': '+tsType(x)+';');if(v.additionalProperties&&typeof v.additionalProperties==='object')p.push('[key: string]: '+tsType(v.additionalProperties)+';');return '{ '+p.join(' ')+' }';}
 return {string:'string',integer:'number',number:'number',boolean:'boolean',null:'null'}[v.type]??'unknown';
}
let types='// Generated from toolkit/schemas by generate-toolkit-reference.mjs.\n// Runtime validators enforce bounds, patterns and reference rules.\n';
for(const kind of ['map','routine','class','item','monster','resource']){const schema=JSON.parse(await readFile(new URL('toolkit/schemas/'+kind+'.schema.json',root),'utf8'));types+='export type Authored'+kind[0].toUpperCase()+kind.slice(1)+' = '+tsType(schema)+';\n';}
const typePath=new URL('toolkit/types.d.ts',root);
if(process.argv.includes('--check')){if(await readFile(typePath,'utf8')!==types)throw Error('E_GENERATED_DRIFT: regenerate MP03 types');}else await writeFile(typePath,types);
const path=new URL('docs/MP04/GENERATED_REFERENCE.md',root);
if(process.argv.includes('--check')){if(await readFile(path,'utf8')!==text)throw Error('E_GENERATED_DRIFT: regenerate MP03 reference');console.log('PASS: generated schema/diagnostic reference matches sources.');}else{await mkdir(new URL('docs/MP04/',root),{recursive:true});await writeFile(path,text);console.log('Generated MP04 schema/diagnostic reference.');}
