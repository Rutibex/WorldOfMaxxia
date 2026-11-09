from pathlib import Path
base=Path(__file__).resolve().parent.parent/'engine/world-of-maxxia/src'
def p(name,a,b):
 f=base/name;s=f.read_text(); assert a in s,(name,a[:150]);f.write_text(s.replace(a,b,1))
f='shared/content/catalogue.ts'
p(f,"import {readClassDatabase,installClassDatabase,CLASSES,type ClassDefinition} from './classes.ts';", "import {readClassDatabase,installClassDatabase,CLASSES,type ClassDefinition} from './classes.ts';\nimport {RACES,humanRace,readRaceDatabase,readRaceDefinition,installRaceDatabase,type RaceDefinition} from './races.ts';")
p(f,'export interface CatalogueBase{classes:ClassDefinition[];items:ItemDefinition[];monsters:MonsterDefinition[];}', 'export interface CatalogueBase{classes:ClassDefinition[];items:ItemDefinition[];monsters:MonsterDefinition[];races?:RaceDefinition[];}')
p(f,'return structuredClone({classes:Object.values(CLASSES),items:Object.values(ITEMS),monsters:Object.values(MONSTERS)})','return structuredClone({classes:Object.values(CLASSES),items:Object.values(ITEMS),monsters:Object.values(MONSTERS),races:Object.values(RACES)})')
p(f,"const supported=['class','item','monster'", "const supported=['race','class','item','monster'")
p(f,'classes:ClassDefinition[];items:ItemDefinition[];monsters:MonsterDefinition[];resources:', 'classes:ClassDefinition[];races:RaceDefinition[];items:ItemDefinition[];monsters:MonsterDefinition[];resources:')
p(f,'visibleClasses:string[];visibleItems:', 'visibleClasses:string[];visibleRaces:string[];visibleItems:')
p(f,'const classes:ClassDefinition[]=[],items:ItemDefinition[]=[],monsters:MonsterDefinition[]=[],aliases=', 'const classes:ClassDefinition[]=[],races:RaceDefinition[]=[],items:ItemDefinition[]=[],monsters:MonsterDefinition[]=[],aliases=')
p(f,"const classFields=['id','name','primary','hpBase','hpGain','casting','spBase','spGain','spAttributeMultiplier','role','features','equipmentTags','traits','preparedStyles','starterEquipment'];", "const classFields=['id','name','primary','hpBase','hpGain','casting','spBase','spGain','spAttributeMultiplier','role','features','equipmentTags','traits','preparedStyles','starterEquipment','styleDefinitions','abilityGrants','creationChoices'];")
p(f,"if(['class','item','monster'].includes(d.kind)){", """if(d.kind==='race'){
   keys(p,['format','formatVersion','id','record'],['format','formatVersion','id','record'],path);
   if(p.format!=='maxxia-authored-race'||p.formatVersion!==1||p.id!==d.id||!obj(p.record)||p.record.id!==d.id)fail('E_RACE',path,'Invalid race document identity',d.id);
   let r:RaceDefinition;try{r=readRaceDefinition(p.record);}catch(error){fail('E_RACE',path+'.record',String(error),d.id);}
   for(const g of r.abilityGrants){refs.push(g.id);if(!reference(e,g.id,'ability',path+'.record.abilityGrants'))fail('E_RACE',path,'Missing required race ability',d.id);}
   races.push(r);
  }else if(['class','item','monster'].includes(d.kind)){""")
p(f,"for(const [slot,id]of Object.entries(c.starterEquipment??{}))if(id){refs.push(id);if(!reference(e,id,'item',path+'.record.starterEquipment.'+slot))c.starterEquipment![slot as 'melee'|'ranged'|'body'|'offhand']=null;}classes.push(c);", """for(const [slot,id]of Object.entries(c.starterEquipment??{}))if(id){refs.push(id);if(!reference(e,id,'item',path+'.record.starterEquipment.'+slot))c.starterEquipment![slot as 'melee'|'ranged'|'body'|'offhand']=null;}
    for(const g of [...(c.abilityGrants??[]),...(c.creationChoices??[]).flatMap(ch=>ch.abilityGrants??[])]){refs.push(g.id);if(!reference(e,g.id,'ability',path+'.record.abilityGrants'))fail('E_CLASS',path,'Missing required granted ability',d.id);}
    for(const choice of c.creationChoices??[])for(const [slot,id]of Object.entries(choice.starterEquipment??{}))if(id){refs.push(id);if(!reference(e,id,'item',path+'.record.creationChoices'))choice.starterEquipment![slot as 'melee'|'ranged'|'body'|'offhand']=null;}
    classes.push(c);""")
p(f,"if(e.descriptor.visibility==='exported'&&['class','item','monster','resource'", "if(e.descriptor.visibility==='exported'&&['race','class','item','monster','resource'")
p(f,"const nextClasses=merge(base.classes,classes,'class'),nextItems", "const nextRaces=merge(base.races??[humanRace()],races,'race'),nextClasses=merge(base.classes,classes,'class'),nextItems")
p(f,"if(nextClasses.length)readClassDatabase({format:'maxxia-classes',version:1,classes:nextClasses});", "readRaceDatabase(nextRaces);if(nextClasses.length)readClassDatabase({format:'maxxia-classes',version:1,classes:nextClasses});")
p(f,"for(const m of nextMonsters)if(m.guaranteedLootItemId", """for(const c of nextClasses)for(const choice of c.creationChoices??[])for(const [slot,id] of Object.entries(choice.starterEquipment??{}))if(id){const it=itemMap.get(id);if(!it||it.slot!==slot||!(it.equipmentTags??[it.slot==='offhand'?'shield':it.slot==='body'?'armor:'+(it.weight??'medium'):it.slot==='melee'?'melee:general':it.slot]).some(t=>c.equipmentTags.includes(t as typeof c.equipmentTags[number])))fail('E_STARTER_REFERENCE','$.classes.'+c.id+'.creationChoices.'+slot,'Invalid choice equipment.',c.id);}
 for(const m of nextMonsters)if(m.guaranteedLootItemId""")
p(f,"entries:freeze(entries),classes:freeze(nextClasses),items:", "entries:freeze(entries),classes:freeze(nextClasses),races:freeze(nextRaces),items:")
p(f,"visibleClasses:nextClasses.map(v=>v.id),visibleItems:", "visibleClasses:nextClasses.map(v=>v.id),visibleRaces:nextRaces.map(v=>v.id),visibleItems:")
p(f,"const classes=readClassDatabase({format:'maxxia-classes',version:1,classes:value.classes}),items=", "const races=readRaceDatabase(value.races),classes=readClassDatabase({format:'maxxia-classes',version:1,classes:value.classes}),items=")
p(f,"installItemDatabase(items);installClassDatabase(classes);installMonsterDatabase(monsters);", "installItemDatabase(items);installRaceDatabase(races);installClassDatabase(classes);installMonsterDatabase(monsters);")
print('catalogue patched')
