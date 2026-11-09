from pathlib import Path
p=Path(__file__).resolve().parent.parent/'engine/world-of-maxxia/src/shared/saves/portable-roster.ts'
s=p.read_text()
pos=s.find("import {",0)
s="import {RACES,DEFAULT_RACE_ID} from '../content/races.ts';\n"+s
# add helper before exportPortableCharacter
marker='/** Portable character files retain the same permanent IDs across an export/import inspection. */'
assert marker in s
insert='''/** Include future level-grants as well as already learned powers in definition snapshots. */
function portableRelatedAbilities(hero:import('../rules/party.ts').Character){
 const cls=CLASSES[hero.classId],race=RACES[hero.raceId??DEFAULT_RACE_ID];
 const grants=new Set([...(cls?.abilityGrants??[]),...(cls?.creationChoices?.find(c=>c.id===hero.creationChoiceId)?.abilityGrants??[]),...(race?.abilityGrants??[])].map(g=>g.id));
 return listedEffects().filter(e=>e.activation && (e.activation.classes.includes(hero.classId)||grants.has(e.id)||hero.abilityState?.learned.includes(e.id)||Object.hasOwn(hero.abilityState?.cooldowns??{},e.id)));
}
'''
s=s.replace(marker,insert+marker)
old="listedEffects().filter(e=>e.activation && (e.activation.classes.includes(record.character.classId)||record.character.abilityState?.learned.includes(e.id)||Object.hasOwn(record.character.abilityState?.cooldowns??{},e.id)))"
assert old in s;s=s.replace(old,'portableRelatedAbilities(record.character)')
old="listedEffects().filter(e=>e.activation&&(e.activation.classes.includes(raw.character.classId)||raw.character.abilityState?.learned.includes(e.id)||Object.hasOwn(raw.character.abilityState?.cooldowns??{},e.id)))"
assert old in s;s=s.replace(old,'portableRelatedAbilities(raw.character)')
old='const definitions=Object.fromEntries([[record.character.classId,CLASSES[record.character.classId]],...related.map(e=>[e.id,e])'
assert old in s;s=s.replace(old,'const raceId=record.character.raceId??DEFAULT_RACE_ID;const race=RACES[raceId];if(!race)throw new TypeError("Missing portable race provider: "+raceId);const definitions=Object.fromEntries([[record.character.classId,CLASSES[record.character.classId]],[raceId,race],...related.map(e=>[e.id,e])')
old='const data=JSON.stringify(includeDefinitions?{...record,definitionSnapshots:definitions,conditionProviders,abilityProviders}:record,null,2)'
assert old in s;s=s.replace(old,"const raceProviderVersion=providers.find(p=>p.id===raceId.split(':')[0])?.version;if(includeDefinitions&&!raceProviderVersion)throw new TypeError('Missing race provider version: '+raceId);const raceProviders={[raceId.split(':')[0]]:raceProviderVersion};const data=JSON.stringify(includeDefinitions?{...record,definitionSnapshots:definitions,conditionProviders,abilityProviders,raceProviders}:record,null,2)")
old='if(asObject(raw.abilityProviders))for(const [ns,v]of Object.entries(raw.abilityProviders))'
assert old in s;s=s.replace(old,"if(asObject(raw.raceProviders))for(const [ns,v]of Object.entries(raw.raceProviders)){if(typeof v!=='string'||!lock.providers.some(p=>p.id===ns&&p.version===v))missing.add(`${ns}@${String(v)}`);}\n if(asObject(raw.abilityProviders))for(const [ns,v]of Object.entries(raw.abilityProviders))")
old="if(!Object.hasOwn(CLASSES,raw.character.classId as string))throw new TypeError('Portable character class definition is not installed.');"
assert old in s;s=s.replace(old,old+"\n  if(!Object.hasOwn(RACES,(raw.character.raceId as string|undefined)??DEFAULT_RACE_ID))throw new TypeError('Portable character race definition is not installed.');")
old="conditionProviders?:Record<string,string>;abilityProviders?:Record<string,string>"
assert old in s;s=s.replace(old,"conditionProviders?:Record<string,string>;abilityProviders?:Record<string,string>;raceProviders?:Record<string,string>")
old="check(raw.character.classId,CLASSES[raw.character.classId]);for(const i of raw.items)"
assert old in s;s=s.replace(old,"check(raw.character.classId,CLASSES[raw.character.classId]);const sourceRaceId=raw.character.raceId??DEFAULT_RACE_ID;if(sourceRaceId!==DEFAULT_RACE_ID||raw.raceProviders){check(sourceRaceId,RACES[sourceRaceId]);const ns=sourceRaceId.split(':')[0];if(!raw.raceProviders?.[ns]||!lock.providers.some(p=>p.id===ns&&p.version===raw.raceProviders![ns]))throw new TypeError('Missing race provider version');}for(const i of raw.items)")
p.write_text(s)
print('portable patched')
