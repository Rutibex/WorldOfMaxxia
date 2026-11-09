from pathlib import Path
import json
root=Path(__file__).resolve().parent.parent
schema=root/'toolkit/schemas'
common_attr={'type':'integer','minimum':-3,'maximum':3}
attrs={'type':'object','additionalProperties':False,'properties':{k:common_attr for k in ['STR','DEX','CON','INT','WIS','CHA']}}
resists={'type':'object','additionalProperties':False,'properties':{k:{'type':'integer','minimum':-25,'maximum':25} for k in ['physical','fire','cold','lightning','poison','arcane','holy','necrotic']}}
ref={'type':'string','pattern':'^[a-z][a-z0-9_]{0,47}:ability:[a-z][a-z0-9_]{0,79}$'}
grants={'type':'array','maxItems':32,'items':{'type':'object','additionalProperties':False,'properties':{'id':ref,'minLevel':{'type':'integer','minimum':1,'maximum':20}},'required':['id','minLevel']}}
traits={'type':'array','maxItems':12,'uniqueItems':True,'items':{'type':'string','pattern':'^[a-z][a-z0-9_]{0,47}:[a-z][a-z0-9_]{0,47}:[a-z][a-z0-9_]{0,79}$'}}
race={'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'https://maxxia.invalid/toolkit/mp20/race.schema.json','type':'object','additionalProperties':False,'properties':{'format':{'const':'maxxia-authored-race'},'formatVersion':{'const':1},'id':{'type':'string','pattern':'^[a-z][a-z0-9_]{0,47}:race:[a-z][a-z0-9_]{0,79}$'},'record':{'type':'object','additionalProperties':False,'properties':{'id':{'type':'string','pattern':'^[a-z][a-z0-9_]{0,47}:race:[a-z][a-z0-9_]{0,79}$'},'name':{'type':'string','minLength':1,'maxLength':100},'description':{'type':'string','maxLength':1500},'attributeBonuses':attrs,'resistances':resists,'traits':traits,'abilityGrants':grants},'required':['id','name','description']}},'required':['format','formatVersion','id','record']}
(schema/'race.schema.json').write_text(json.dumps(race,indent=2)+'\n')
cls=json.loads((schema/'class.schema.json').read_text());p=cls['properties']['record']['properties']
p['traits']={'type':'array','maxItems':12,'uniqueItems':True,'items':{'type':'string','pattern':'^(?:martial_mastery|device_training|mutant_biology|thornhide|[a-z][a-z0-9_]{0,47}:trait:[a-z][a-z0-9_]{0,79})$'}}
p['preparedStyles']={'type':'array','minItems':1,'maxItems':12,'uniqueItems':True,'items':{'type':'string','pattern':'^(?:measured|power|bastion|needle|spark|claws|carapace|standard|[a-z][a-z0-9_]{0,47}:style:[a-z][a-z0-9_]{0,79})$'}}
p['abilityGrants']=grants
string={'type':'string','minLength':1,'maxLength':100}
nullableDice={'anyOf':[{'type':'string','pattern':'^(?:[1-9][0-9]?d(?:4|6|8|10|12|20)|[1-9][0-9]?)$'},{'type':'null'}]}
style={'type':'object','additionalProperties':False,'properties':{'id':{'type':'string','pattern':'^[a-z][a-z0-9_]{0,47}:style:[a-z][a-z0-9_]{0,79}$'},'name':string,'description':{'type':'string','maxLength':500},'operation':{'enum':['weapon','device','natural']},'requiredTrait':{'anyOf':[{'type':'string'}, {'type':'null'}]},'attackBonus':{'type':'integer','minimum':-20,'maximum':20},'attackBonusAtVeteran':{'type':'integer','minimum':0,'maximum':20},'damageBonus':{'type':'integer','minimum':0,'maximum':20},'damageBonusAtMilestone':{'type':'integer','minimum':0,'maximum':20},'damageBonusAtMilestoneReplacesBase':{'type':'boolean'},'ignoreDefense':{'type':'integer','minimum':0,'maximum':20},'damageType':{'enum':['physical','lightning']},'dice':{'type':'string','pattern':'^(?:[1-9][0-9]?d(?:4|6|8|10|12|20)|[1-9][0-9]?)$'},'diceAtMilestone':nullableDice,'diceAtVeteran':nullableDice,'defenseBonus':{'type':'integer','minimum':0,'maximum':20},'defenseAtVeteran':{'type':'integer','minimum':0,'maximum':20}},'required':['id','name','description','operation','requiredTrait','attackBonus','attackBonusAtVeteran','damageBonus','damageBonusAtMilestone','damageBonusAtMilestoneReplacesBase','ignoreDefense','damageType','dice','diceAtMilestone','diceAtVeteran','defenseBonus','defenseAtVeteran']}
p['styleDefinitions']={'type':'array','maxItems':12,'items':style}
choice={'type':'object','additionalProperties':False,'properties':{'id':{'type':'string','pattern':'^[a-z][a-z0-9_]{0,79}$'},'name':string,'description':{'type':'string','maxLength':500},'attributeBonuses':attrs,'starterEquipment':p['starterEquipment'],'abilityGrants':grants},'required':['id','name','description']}
p['creationChoices']={'type':'array','minItems':1,'maxItems':12,'items':choice}
cls['$id']='https://maxxia.invalid/toolkit/mp04/class.schema.json'
(schema/'class.schema.json').write_text(json.dumps(cls,indent=2)+'\n')
print('wrote schemas')
