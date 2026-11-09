"""Crop and pack illustrated raster master art into Phase 30 icons.

SOURCE: supplied rendered image master boards in art-source/phase30-rendered/.
Only image cropping, matte feathering, scaling, and optional recoloring are used.
NO code-drawn item or spell geometry, no vector paths, and no asset recreation from primitives.
The final dark vignette is part of the illustrated source boards; edges are feathered to alpha.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageEnhance
import json

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art-source/phase30-rendered'
OUT=ROOT/'public/assets/art'
DOCS=ROOT/'docs'
master_one=Image.open(ART/'painted-equipment-spells-master.png').convert('RGB')
master_two=Image.open(ART/'painted-icons-master.png').convert('RGB')
# Half-open bounds were measured on original 1536x1024 rendered masters.
REGIONS={
  'item1': (master_one,(21,134,691,642),8,6),
  'item2': (master_two,(20,117,814,582),9,5),
  'spell1': (master_one,(734,135,1506,463),8,4),
  'spell2': (master_two,(857,116,1506,585),6,6),
  'feedback2': (master_two,(18,643,1515,726),19,1),
}

def sample(source,index):
    im,b,nx,ny=REGIONS[source]
    x=index%nx;y=index//nx
    assert 0<=index<nx*ny,(source,index)
    x0=round(b[0]+(b[2]-b[0])*x/nx)
    x1=round(b[0]+(b[2]-b[0])*(x+1)/nx)
    y0=round(b[1]+(b[3]-b[1])*y/ny)
    y1=round(b[1]+(b[3]-b[1])*(y+1)/ny)
    cell=im.crop((x0,y0,x1,y1))
    w,h=cell.size
    if source=='item1':
        # Exclude ornate gold tile frame; keep the painted object and shadow.
        trim=(7,6,w-8,h-8)
    elif source=='item2':trim=(9,8,w-9,h-9)
    elif source=='spell1':trim=(7,7,w-8,h-9)
    elif source=='spell2':trim=(10,7,w-10,h-9)
    else:trim=(6,7,w-6,h-18) # drop bottom printed label
    cell=cell.crop(trim)
    # Fit in 64px without recreating any graphic content.
    cell=cell.resize((60,60),Image.Resampling.LANCZOS)
    out=Image.new('RGBA',(64,64),(0,0,0,0))
    rgba=cell.convert('RGBA')
    a=rgba.getchannel('A')
    pix=a.load()
    for yy in range(60):
        for xx in range(60):
            edge=min(xx,yy,59-xx,59-yy)
            if edge<6:pix[xx,yy]=int(255*edge/6)
    rgba.putalpha(a)
    out.alpha_composite(rgba,(2,2))
    return out

ITEMS=[
'item_dagger','item_staff','item_mace','item_sword','item_axe','item_spear','item_shortbow','item_crossbow','item_heavy_crossbow','item_greatsword','item_cloth_robe','item_leather_coat','item_ring_mail','item_scale_coat','item_plate_harness','item_buckler','item_round_shield','item_tower_shield','item_copper_ring','item_ward_ring','item_ember_ring','item_frost_ring','item_pilgrim_charm','item_glass_lens','item_lucky_token','item_iron_belt','item_healing_draught','item_greater_healing_draught','item_antidote','item_wake_salts','item_courage_tonic','item_torch','item_smoke_bomb','item_acid_flask','item_spark_capsule','item_healing_scroll','item_venom_flask','item_treasure_gem','item_empty_bottle','item_recall_token','item_bellkeeper_blade','item_cistern_carapace','item_regulator_lens','item_quayward_charm','item_echo_staff','item_glass_thorn','item_custodian_seal','item_tessa_silver_brooch']
item_refs=[
('item1',0),('item1',7),('item1',2),('item2',0),('item1',1),('item1',3),('item1',4),('item2',7),('item1',6),('item2',1),
('item1',14),('item2',15),('item1',9),('item2',14),('item1',10),('item2',10),('item1',11),('item2',9),('item2',19),('item2',20),
('item1',15),('item2',21),('item2',22),('item1',43),('item2',24),('item2',25),('item1',16),('item2',27),('item2',29),('item1',28),
('item2',30),('item1',29),('item2',35),('item1',18),('item1',19),('item1',20),('item2',29),('item1',25),('item2',28),('item1',42),
('item2',1),('item1',27),('item1',44),('item1',47),('item2',8),('item2',4),('item1',45),('item1',47)]
SPELLS=[
'spell_wizard_spark_lance','spell_wizard_lantern_globe','spell_wizard_frost_needle','spell_wizard_burning_fan','spell_wizard_glass_eye','spell_wizard_binding_thread','spell_wizard_storm_arc','spell_wizard_unseal','spell_wizard_stone_skin','spell_wizard_fold_step','spell_wizard_mirror_ward','spell_wizard_starfall','spell_priest_mend_flesh','spell_priest_sacred_ember','spell_priest_pilgrim_light','spell_priest_cleanse_venom','spell_priest_steadfast','spell_priest_blessing','spell_priest_healing_chorus','spell_priest_turn_the_hollow','spell_priest_sheltering_hand','spell_priest_break_malison','spell_priest_return_breath','spell_priest_dawn_judgment','spell_witch_withering_word','spell_witch_ill_omen','spell_witch_borrowed_face','spell_witch_leech_kiss','spell_witch_sleep_of_thorns','spell_witch_rat_whisper','spell_witch_crooked_bones','spell_witch_briar_mantle','spell_witch_malice_rain','spell_witch_bottle_the_echo','spell_witch_hearth_thread','spell_witch_black_moon']
spell_refs=[
('spell1',2),('spell1',3),('spell1',1),('spell1',0),('spell1',15),('spell1',19),('spell2',2),('spell2',24),('spell1',12),('spell1',30),('spell2',12),('spell1',29),
('spell1',8),('spell2',1),('spell1',10),('spell1',20),('spell2',13),('spell1',9),('spell1',27),('spell2',8),('spell2',33),('spell2',26),('spell2',19),('spell2',17),
('spell2',20),('spell1',17),('spell1',26),('spell1',16),('spell2',21),('spell1',31),('spell2',5),('spell2',32),('spell2',6),('spell1',25),('spell2',25),('spell2',35)]
FEEDBACK=['attack','miss','guard','run','heal','cure','revive','arcane','fire','cold','lightning','holy','poison','necrotic','ward','debuff','bind','sleep','special']
feedback_refs=[('spell1',13),('spell1',14),('spell2',12),('spell2',24),('spell2',19),('spell1',20),('spell2',10),('spell1',3),('spell2',1),('spell2',3),('spell2',2),('spell2',15),('spell2',8),('spell1',16),('spell2',33),('spell1',17),('spell2',23),('spell2',21),('spell2',26)]
assert len(ITEMS)==len(item_refs)==48
assert len(SPELLS)==len(spell_refs)==36
assert len(FEEDBACK)==len(feedback_refs)==19

manifest={}
for category,names,refs in [('items',ITEMS,item_refs),('spells',SPELLS,spell_refs),('feedback',FEEDBACK,feedback_refs)]:
    folder=OUT/category;folder.mkdir(parents=True,exist_ok=True)
    manifest[category]={}
    for name,(source,idx) in zip(names,refs):
        im=sample(source,idx)
        # Source-based color grade, not drawing geometry; distinguish enchantments from base item.
        if name=='item_empty_bottle': im=ImageEnhance.Color(im).enhance(.16)
        if name=='item_venom_flask': im=ImageEnhance.Color(im).enhance(1.25)
        if name=='item_frost_ring': im=ImageEnhance.Color(im).enhance(.65)
        im.save(folder/(name+'.png'),optimize=True)
        manifest[category][name]={'master':source,'cell':idx,'size':[64,64],'art_type':'rendered raster image crop'}

(ART/'source-mapping.json').write_text(json.dumps(manifest,indent=2)+'\n')
# Build presentation-only preview from actual packed sprites (not a mockup).
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
heading_font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',22)
label_font=ImageFont.truetype(font,10)
COLS=8;CELLW=126;CELLH=100
W=COLS*CELLW+24
rows=(48+7)//8+(36+7)//8+(19+7)//8
H=74+rows*CELLH+3*62
preview=Image.new('RGB',(W,H),'#10171d');d=ImageDraw.Draw(preview)
y=13
d.text((16,y),'WORLD OF MAXXIA  /  PHASE 30 RENDERED ART REPLACEMENT',font=heading_font,fill='#efcf96');y+=60
for category,names,refs in [('items',ITEMS,item_refs),('spells',SPELLS,spell_refs),('feedback',FEEDBACK,feedback_refs)]:
    d.text((17,y),f'{category.upper()}  —  {len(names)} illustrated raster icons',font=heading_font,fill='#f2d5a2');y+=42
    for i,name in enumerate(names):
        cx=16+(i%COLS)*CELLW;cy=y+(i//COLS)*CELLH
        im=Image.open(OUT/category/(name+'.png')).convert('RGBA')
        im=im.resize((68,68),Image.Resampling.NEAREST)
        preview.paste(im,(cx+18,cy),im)
        short=name.replace('item_','').replace('spell_','').replace('_',' ')
        if len(short)>18:short=short[:17]+'…'
        d.text((cx+3,cy+70),short,font=label_font,fill='#d7d7c9')
    y+=((len(names)+COLS-1)//COLS)*CELLH+24
preview=preview.crop((0,0,W,min(H,y+12)))
DOCS.mkdir(exist_ok=True)
preview.save(DOCS/'PHASE30_RENDERED_ART_PREVIEW.png')
print(f'Packed {len(ITEMS)} items, {len(SPELLS)} spells, {len(FEEDBACK)} feedback icons from illustrated raster masters.')
