from __future__ import annotations
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, random

ROOT=Path(__file__).resolve().parents[1]
ITEM_DIR=ROOT/'public/assets/art/items'
SPELL_DIR=ROOT/'public/assets/art/spells'
FEEDBACK_DIR=ROOT/'public/assets/art/feedback'
DOCS=ROOT/'docs'
for d in [ITEM_DIR,SPELL_DIR,FEEDBACK_DIR,DOCS]:
    d.mkdir(parents=True,exist_ok=True)

W=H=64
font_small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',12)
font_label=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',14)

rng=random.Random(30030)

ITEMS=[
'item_dagger','item_staff','item_mace','item_sword','item_axe','item_spear','item_shortbow','item_crossbow','item_heavy_crossbow','item_greatsword','item_cloth_robe','item_leather_coat','item_ring_mail','item_scale_coat','item_plate_harness','item_buckler','item_round_shield','item_tower_shield','item_copper_ring','item_ward_ring','item_ember_ring','item_frost_ring','item_pilgrim_charm','item_glass_lens','item_lucky_token','item_iron_belt','item_healing_draught','item_greater_healing_draught','item_antidote','item_wake_salts','item_courage_tonic','item_torch','item_smoke_bomb','item_acid_flask','item_spark_capsule','item_healing_scroll','item_venom_flask','item_treasure_gem','item_empty_bottle','item_recall_token','item_bellkeeper_blade','item_cistern_carapace','item_regulator_lens','item_quayward_charm','item_echo_staff','item_glass_thorn','item_custodian_seal','item_tessa_silver_brooch']

SPELLS=[
'spell_wizard_spark_lance','spell_wizard_lantern_globe','spell_wizard_frost_needle','spell_wizard_burning_fan','spell_wizard_glass_eye','spell_wizard_binding_thread','spell_wizard_storm_arc','spell_wizard_unseal','spell_wizard_stone_skin','spell_wizard_fold_step','spell_wizard_mirror_ward','spell_wizard_starfall','spell_priest_mend_flesh','spell_priest_sacred_ember','spell_priest_pilgrim_light','spell_priest_cleanse_venom','spell_priest_steadfast','spell_priest_blessing','spell_priest_healing_chorus','spell_priest_turn_the_hollow','spell_priest_sheltering_hand','spell_priest_break_malison','spell_priest_return_breath','spell_priest_dawn_judgment','spell_witch_withering_word','spell_witch_ill_omen','spell_witch_borrowed_face','spell_witch_leech_kiss','spell_witch_sleep_of_thorns','spell_witch_rat_whisper','spell_witch_crooked_bones','spell_witch_briar_mantle','spell_witch_malice_rain','spell_witch_bottle_the_echo','spell_witch_hearth_thread','spell_witch_black_moon']

FEEDBACKS=['attack','miss','guard','run','heal','cure','revive','arcane','fire','cold','lightning','holy','poison','necrotic','ward','debuff','bind','sleep','special']


def jitter(color, amount=12):
    return tuple(max(0,min(255,c+rng.randint(-amount,amount))) for c in color)

def make_canvas():
    return Image.new('RGBA',(W,H),(0,0,0,0))

def add_shadow(im, alpha=90, blur=4, offset=(0,3)):
    shadow=Image.new('RGBA', im.size, (0,0,0,0))
    shadow.alpha_composite(Image.new('RGBA', im.size, (0,0,0,0)), (0,0))
    a=im.getchannel('A')
    shadow.putalpha(a)
    shadow=shadow.filter(ImageFilter.GaussianBlur(blur))
    base=Image.new('RGBA', im.size, (0,0,0,0))
    base.alpha_composite(Image.new('RGBA', im.size, (0,0,0,0)), (0,0))
    # apply black tint
    s=Image.new('RGBA', im.size, (0,0,0,0))
    s.putalpha(shadow.getchannel('A').point(lambda p:int(p*alpha/255)))
    return ImageChops.offset(s,*offset)

# PIL ImageChops imported lazily to keep namespace local.
from PIL import ImageChops

def paint_plate(draw, box, fill, rim, inner=None):
    x0,y0,x1,y1=box
    draw.ellipse(box, fill=fill, outline=rim, width=3)
    draw.ellipse((x0+4,y0+4,x1-4,y1-4), outline=(255,255,255,46), width=1)
    if inner:
        draw.ellipse((x0+8,y0+8,x1-8,y1-8), fill=inner)


def paint_noise(im, amount=10):
    px=im.load()
    for _ in range(240):
        x=rng.randrange(im.width); y=rng.randrange(im.height)
        r,g,b,a=px[x,y]
        if a:
            n=rng.randint(-amount, amount)
            px[x,y]=(max(0,min(255,r+n)),max(0,min(255,g+n)),max(0,min(255,b+n)),a)


def line(draw, pts, fill, width=3):
    draw.line(pts, fill=fill, width=width, joint='curve')


def fill_poly(draw, pts, fill, outline=None, width=2):
    draw.polygon(pts, fill=fill, outline=outline)
    if outline and width>1:
        draw.line(pts+[pts[0]], fill=outline, width=width, joint='curve')


def sword(draw, blade=(220,224,232), hilt=(146,96,46), angle=-20, long=False, heavy=False, flame=None):
    cx,cy=32,34
    length=28 if long else 22
    width=5 if heavy else 3
    rad=math.radians(angle)
    dx=math.cos(rad); dy=math.sin(rad)
    tip=(cx+dx*length, cy+dy*length)
    base=(cx-dx*10, cy-dy*10)
    px=-dy; py=dx
    blade_pts=[(base[0]+px*width, base[1]+py*width), (base[0]-px*width, base[1]-py*width), (tip[0],tip[1])]
    fill_poly(draw, blade_pts, blade, (60,70,88))
    if flame:
        for i in range(3):
            fill_poly(draw,[(tip[0]-px*(5+i),tip[1]-py*(5+i)),(tip[0]+px*(2+i),tip[1]+py*(2+i)),(tip[0]+dx*(7+i*2),tip[1]+dy*(7+i*2))],flame[i%len(flame)],None)
    cross=((base[0]+px*8,base[1]+py*8),(base[0]-px*8,base[1]-py*8))
    line(draw,[cross[0],cross[1]],hilt,4)
    line(draw,[(base[0],base[1]),(base[0]-dx*7,base[1]-dy*7)],hilt,4)
    draw.ellipse((base[0]-5,base[1]-5,base[0]+5,base[1]+5), fill=(190,150,90), outline=(90,60,20))


def dagger(draw):
    sword(draw, blade=(214,220,232), hilt=(136,96,56), angle=-48, long=False)

def greatsword(draw):
    sword(draw, blade=(224,228,235), hilt=(160,110,56), angle=-25, long=True, heavy=True)

def axe(draw):
    line(draw,[(23,46),(40,19)],(129,82,45),5)
    fill_poly(draw,[(31,28),(22,16),(14,22),(18,31),(24,34)],(188,196,204),(70,74,85))
    fill_poly(draw,[(30,27),(40,19),(48,25),(39,34)],(188,196,204),(70,74,85))
    draw.ellipse((20,42,30,52), fill=(166,118,63), outline=(82,50,30))

def mace(draw):
    line(draw,[(24,45),(40,18)],(136,89,47),5)
    draw.ellipse((35,13,50,28), fill=(164,172,184), outline=(72,78,90))
    for ang in range(0,360,60):
        r=math.radians(ang)
        x=42+math.cos(r)*10; y=20+math.sin(r)*10
        fill_poly(draw,[(42,20),(42+math.cos(r+0.25)*9,20+math.sin(r+0.25)*9),(x,y),(42+math.cos(r-0.25)*9,20+math.sin(r-0.25)*9)],(156,164,176),(72,78,90),1)

def spear(draw, crystal=False):
    line(draw,[(17,48),(46,17)],(140,95,53),4)
    pts=[(45,14),(53,21),(42,30),(37,20)]
    fill_poly(draw,pts,(220,224,230),(70,78,88))
    if crystal:
        fill_poly(draw,[(16,47),(26,39),(29,49),(21,56)],(176,230,255),(76,124,160))

def bow(draw, cross=False, heavy=False):
    line(draw,[(20,13),(16,24),(15,34),(19,46)],(146,96,48),4)
    line(draw,[(20,13),(37,18),(48,31),(43,48)],(146,96,48),4)
    line(draw,[(20,13),(43,48)],(227,226,217),2)
    if cross:
        line(draw,[(15,30),(48,30)],(152,98,48),5)
        line(draw,[(31,22),(31,42)],(152,98,48),4)
        fill_poly(draw,[(45,28),(56,31),(45,34)],(188,198,208),(70,82,92))
        if heavy:
            line(draw,[(13,36),(28,31)],(120,75,36),3)
            line(draw,[(13,24),(28,29)],(120,75,36),3)


def staff(draw, echo=False):
    line(draw,[(25,48),(39,14)],(116,79,52),5)
    draw.ellipse((33,8,47,22), fill=(120,210,250) if echo else (146,96,181), outline=(66,50,92), width=2)
    if echo:
        for r in [9,14]:
            draw.arc((40-r,15-r,40+r,15+r), 200, 20, fill=(140,224,255,180), width=2)


def robe(draw, kind='cloth'):
    colors={'cloth':((84,98,132),(44,53,77)),'leather':((132,96,62),(64,44,28)),'ring':((130,140,150),(66,74,86)),'scale':((116,136,120),(54,76,60)),'plate':((180,186,194),(82,88,100))}
    fill,outline=colors[kind]
    fill_poly(draw,[(18,49),(20,25),(31,13),(44,24),(46,49)], fill, outline)
    draw.ellipse((24,12,38,22), fill=(228,210,172), outline=outline)
    if kind in {'ring','scale','plate'}:
        for y in range(24,45,6):
            for x in range(22,43,6):
                if kind=='plate':
                    draw.rectangle((x-2,y-2,x+2,y+2), outline=(225,230,240), fill=(fill[0]+10,fill[1]+10,fill[2]+10))
                else:
                    draw.arc((x-3,y-3,x+3,y+3),0,180,fill=(220,225,230) if kind=='ring' else (177,210,178), width=1)

def shield(draw, kind='round'):
    if kind=='tower':
        pts=[(20,10),(44,10),(48,20),(45,46),(32,55),(19,46),(16,20)]
    elif kind=='buckler':
        draw.ellipse((18,18,46,46), fill=(148,110,70), outline=(82,52,32), width=2)
        draw.ellipse((27,27,37,37), fill=(196,170,100), outline=(96,70,42))
        return
    else:
        pts=[(32,9),(47,17),(43,42),(32,55),(21,42),(17,17)]
    fill_poly(draw,pts,(116,124,154) if kind=='tower' else (124,142,168),(62,72,90))
    line(draw,[(32,15),(32,49)],(220,210,176),2)
    line(draw,[(23,28),(41,28)],(220,210,176),2)

def ring(draw, kind='copper'):
    colors={'copper':((176,112,62),(106,58,26)),'ward':((168,188,220),(68,82,108)),'ember':((238,150,62),(124,52,28)),'frost':((172,230,255),(88,126,150))}
    fill,outline=colors[kind]
    draw.ellipse((18,18,46,46), fill=fill, outline=outline, width=5)
    draw.ellipse((25,25,39,39), fill=(0,0,0,0))
    gem={'copper':(214,190,128),'ward':(160,230,255),'ember':(255,198,88),'frost':(224,255,255)}[kind]
    draw.ellipse((28,11,36,19), fill=gem, outline=(255,255,255,120))

def charm(draw, kind='pilgrim'):
    if kind=='pilgrim':
        line(draw,[(32,12),(32,44)],(224,199,132),4); line(draw,[(22,24),(42,24)],(224,199,132),4)
        draw.ellipse((27,38,37,48), fill=(224,199,132), outline=(90,74,42))
    elif kind=='lens':
        draw.ellipse((18,18,44,44), fill=(160,220,255,100), outline=(144,194,222), width=4); line(draw,[(41,41),(51,51)],(124,84,46),4)
    elif kind=='token':
        draw.ellipse((16,16,48,48), fill=(206,182,102), outline=(104,86,40), width=3); draw.text((25,22),'✦', fill=(92,58,20), font=font_label)
    elif kind=='belt':
        draw.rounded_rectangle((12,27,52,38), radius=6, fill=(110,70,36), outline=(76,45,24), width=2); draw.rectangle((27,24,37,41), fill=(190,170,108), outline=(88,72,30))
    elif kind=='brooch':
        draw.ellipse((17,17,47,47), fill=(212,210,222), outline=(106,104,120), width=3); draw.ellipse((25,25,39,39), fill=(170,220,255), outline=(70,110,150)); draw.arc((22,22,42,42),20,330,fill=(255,255,255,120),width=1)

def bottle(draw, liquid=(220,62,80), stopper=(140,90,52), shape='round', label=None):
    if shape=='vial':
        fill_poly(draw,[(25,18),(39,18),(42,43),(22,43)],(210,230,245,65),(160,192,214),2)
        draw.rectangle((28,12,36,18), fill=stopper, outline=(72,48,24))
        draw.rectangle((25,30,39,42), fill=liquid)
    elif shape=='capsule':
        draw.rounded_rectangle((18,18,46,46), radius=12, fill=(216,222,238,72), outline=(154,178,200), width=2)
        draw.pieslice((21,21,43,43), 200, 20, fill=liquid)
    else:
        fill_poly(draw,[(22,17),(42,17),(45,25),(43,46),(21,46),(19,25)],(215,235,245,70),(158,186,205),2)
        draw.rectangle((27,10,37,17), fill=stopper, outline=(72,48,24))
        draw.rectangle((23,28,41,45), fill=liquid)
    if label:
        draw.rounded_rectangle((25,26,39,35), radius=3, fill=(236,228,205), outline=(132,118,92))
        draw.text((28,26),label,fill=(80,55,28),font=font_small)


def torch(draw):
    line(draw,[(25,49),(35,24)],(128,82,46),5)
    fill_poly(draw,[(28,24),(36,24),(39,31),(25,31)],(196,178,146),(88,62,38))
    for pts,col in [([(20,30),(33,6),(45,30)],(255,176,64)),([(24,31),(33,13),(40,31)],(255,224,120)),([(28,31),(33,20),(36,31)],(255,245,216))]:
        fill_poly(draw,pts,col)

def bomb(draw, toxic=False):
    draw.ellipse((18,20,46,48), fill=(58,62,76) if not toxic else (76,96,58), outline=(188,196,208) if not toxic else (154,206,124), width=2)
    line(draw,[(36,21),(44,13)],(222,198,126),3)
    if toxic:
        for x,y in [(26,27),(36,33),(29,39)]: draw.ellipse((x,y,x+4,y+4), fill=(132,216,84))
    else:
        for x,y in [(26,30),(34,36),(37,28)]: draw.ellipse((x,y,x+3,y+3), fill=(226,230,236))

def scroll(draw, holy=False):
    draw.rounded_rectangle((16,18,48,42), radius=4, fill=(232,216,180), outline=(132,104,72), width=2)
    line(draw,[(20,14),(20,46)],(188,162,110),3); line(draw,[(44,14),(44,46)],(188,162,110),3)
    if holy:
        line(draw,[(32,23),(32,36)],(188,62,72),2); line(draw,[(26,29),(38,29)],(188,62,72),2)
    else:
        for y in [24,29,34]: line(draw,[(24,y),(40,y)],(116,86,58),1)

def gem(draw):
    fill_poly(draw,[(32,10),(47,24),(40,46),(24,46),(17,24)],(112,212,255),(58,96,150),2)
    fill_poly(draw,[(32,14),(41,24),(36,39),(28,39),(23,24)],(214,246,255),(255,255,255,80),1)

def seal(draw):
    draw.ellipse((14,14,50,50), fill=(172,46,52), outline=(92,18,24), width=3)
    draw.ellipse((19,19,45,45), outline=(248,214,132), width=2)
    draw.text((25,22),'⚙', fill=(248,214,132), font=font_label)


def carapace(draw):
    fill_poly(draw,[(32,12),(46,22),(42,46),(22,46),(18,22)],(118,160,132),(56,84,66),2)
    line(draw,[(32,16),(32,42)],(196,224,188),2)
    for x in [26,32,38]: line(draw,[(x,24),(x-5,38)],(196,224,188),1); line(draw,[(x,24),(x+5,38)],(196,224,188),1)


def base_plate(kind='item', cls='wizard'):
    im=make_canvas(); d=ImageDraw.Draw(im)
    if kind=='item':
        paint_plate(d,(6,6,58,58),(46,60,70,235),(164,140,96),(26,36,42,210))
    elif kind=='spell':
        fill={'wizard':(38,62,96,230),'priest':(92,74,36,230),'witch':(74,42,88,230)}[cls]
        rim={'wizard':(140,194,255),'priest':(255,220,140),'witch':(214,144,255)}[cls]
        paint_plate(d,(5,5,59,59),fill,rim,(24,24,38,185))
        for i in range(7):
            r=20+i*2
            d.arc((32-r,32-r,32+r,32+r), 210, 330, fill=(255,255,255,18), width=1)
    else:
        paint_plate(d,(7,7,57,57),(72,58,42,220),(235,198,120),(30,22,18,190))
    return im,d


def finish(im):
    paint_noise(im,9)
    im=im.filter(ImageFilter.GaussianBlur(0.25))
    return im


def draw_item(item_id:str):
    im,d=base_plate('item')
    iid=item_id
    if iid in {'item_dagger','item_bellkeeper_blade'}: dagger(d)
    elif iid in {'item_sword'}: sword(d)
    elif iid in {'item_greatsword'}: greatsword(d)
    elif iid in {'item_axe'}: axe(d)
    elif iid in {'item_mace'}: mace(d)
    elif iid in {'item_spear','item_glass_thorn'}: spear(d, crystal=iid=='item_glass_thorn')
    elif iid in {'item_shortbow'}: bow(d)
    elif iid in {'item_crossbow','item_heavy_crossbow'}: bow(d,cross=True,heavy=iid=='item_heavy_crossbow')
    elif iid in {'item_staff'}: staff(d)
    elif iid in {'item_echo_staff'}: staff(d,echo=True)
    elif iid=='item_cloth_robe': robe(d,'cloth')
    elif iid=='item_leather_coat': robe(d,'leather')
    elif iid=='item_ring_mail': robe(d,'ring')
    elif iid=='item_scale_coat': robe(d,'scale')
    elif iid=='item_plate_harness': robe(d,'plate')
    elif iid=='item_buckler': shield(d,'buckler')
    elif iid=='item_round_shield': shield(d,'round')
    elif iid=='item_tower_shield': shield(d,'tower')
    elif iid=='item_copper_ring': ring(d,'copper')
    elif iid=='item_ward_ring': ring(d,'ward')
    elif iid=='item_ember_ring': ring(d,'ember')
    elif iid=='item_frost_ring': ring(d,'frost')
    elif iid=='item_pilgrim_charm': charm(d,'pilgrim')
    elif iid in {'item_glass_lens','item_regulator_lens'}: charm(d,'lens')
    elif iid=='item_lucky_token': charm(d,'token')
    elif iid=='item_iron_belt': charm(d,'belt')
    elif iid=='item_tessa_silver_brooch': charm(d,'brooch')
    elif iid=='item_healing_draught': bottle(d,(204,60,84),label='H')
    elif iid=='item_greater_healing_draught': bottle(d,(224,82,104),label='H')
    elif iid=='item_antidote': bottle(d,(84,188,72),label='A')
    elif iid=='item_wake_salts': bottle(d,(220,230,240),shape='vial',label='W')
    elif iid=='item_courage_tonic': bottle(d,(244,168,54),label='C')
    elif iid=='item_torch': torch(d)
    elif iid=='item_smoke_bomb': bomb(d)
    elif iid=='item_acid_flask': bottle(d,(126,222,84),label='!')
    elif iid=='item_spark_capsule': bottle(d,(255,230,94),shape='capsule')
    elif iid=='item_healing_scroll': scroll(d,holy=True)
    elif iid=='item_venom_flask': bottle(d,(84,164,56),label='V')
    elif iid=='item_treasure_gem': gem(d)
    elif iid=='item_empty_bottle': bottle(d,(0,0,0,0))
    elif iid=='item_recall_token': charm(d,'token');
    elif iid=='item_cistern_carapace': carapace(d)
    elif iid=='item_quayward_charm': charm(d,'pilgrim'); d.arc((16,16,48,48),0,300,fill=(160,224,250),width=2)
    elif iid=='item_custodian_seal': seal(d)
    else:
        draw.text((18,24),iid.replace('item_','')[:3].upper(),fill=(240,228,200),font=font_label)
    return finish(im)


def spell_class(spell_id:str):
    if '_wizard_' in spell_id: return 'wizard'
    if '_priest_' in spell_id: return 'priest'
    return 'witch'


def star(draw,cx,cy,r,fill):
    pts=[]
    for i in range(10):
        ang=-math.pi/2+i*math.pi/5
        rr=r if i%2==0 else r*0.45
        pts.append((cx+math.cos(ang)*rr,cy+math.sin(ang)*rr))
    fill_poly(draw,pts,fill)


def draw_spell(spell_id:str):
    cls=spell_class(spell_id)
    im,d=base_plate('spell',cls)
    sid=spell_id
    # helper glows
    if 'spark_lance' in sid:
        spear(d,crystal=True)
        for x in [20,30,40]: line(d,[(x,16),(x+5,10),(x+9,18)],(244,232,110),2)
    elif 'lantern_globe' in sid:
        d.ellipse((18,18,46,46), fill=(244,224,130), outline=(255,255,220), width=2)
        d.arc((14,10,50,46),200,340,fill=(228,202,116),width=3)
    elif 'frost_needle' in sid:
        fill_poly(d,[(18,45),(35,14),(46,24),(28,51)],(184,236,255),(90,140,180),2)
        for ang in [0,60,120]:
            r=math.radians(ang); line(d,[(32-10*math.cos(r),32-10*math.sin(r)),(32+10*math.cos(r),32+10*math.sin(r))],(234,250,255),1)
    elif 'burning_fan' in sid:
        for off,col in enumerate([(242,94,40),(255,154,64),(255,228,118)]):
            fill_poly(d,[(16+off*2,43),(32,16+off*2),(48-off*2,43)],col)
    elif 'glass_eye' in sid:
        d.ellipse((15,22,49,42), fill=(224,230,250), outline=(128,152,184), width=2)
        d.ellipse((25,22,39,42), fill=(98,180,220), outline=(50,94,122)); d.ellipse((29,26,35,38), fill=(26,44,60))
    elif 'binding_thread' in sid:
        d.ellipse((20,20,44,44), fill=(164,124,210), outline=(86,60,108), width=3)
        for dx in [0,5,10]: d.arc((20+dx/2,20+dx/2,44-dx/2,44-dx/2), 30, 300, fill=(236,220,255), width=2)
        line(d,[(44,32),(52,16)],(236,220,255),2)
    elif 'storm_arc' in sid:
        for pts in [((18,18),(29,28),(24,28),(39,46)),((44,16),(36,27),(41,27),(27,48))]: line(d,list(pts),(114,220,255),4)
    elif 'unseal' in sid:
        line(d,[(19,32),(43,32)],(224,202,128),5); d.ellipse((14,24,26,36), outline=(224,202,128), width=3); star(d,44,25,8,(160,218,255))
    elif 'stone_skin' in sid:
        shield(d,'round');
        for x,y in [(24,22),(32,20),(39,28),(27,36),(36,39)]: fill_poly(d,[(x,y),(x+6,y+2),(x+1,y+7)],(188,190,194),(110,110,120),1)
    elif 'fold_step' in sid:
        d.arc((15,14,49,48), 220, 20, fill=(142,214,255), width=4)
        fill_poly(d,[(20,44),(28,24),(37,28),(35,50)],(214,178,124),(108,74,46),2)
        line(d,[(45,22),(52,14)],(142,214,255),3)
    elif 'mirror_ward' in sid:
        d.rounded_rectangle((22,14,42,44), radius=6, fill=(170,226,246,110), outline=(182,232,255), width=2)
        line(d,[(32,14),(32,44)],(255,255,255,110),2); shield(d,'buckler')
    elif 'starfall' in sid:
        for pos in [(23,20,8),(41,28,10),(28,40,7)]: star(d,*pos,(255,228,130))
    elif 'mend_flesh' in sid:
        d.ellipse((18,18,46,46), fill=(120,38,44), outline=(238,198,202), width=2); line(d,[(32,21),(32,43)],(255,236,236),4); line(d,[(21,32),(43,32)],(255,236,236),4)
    elif 'sacred_ember' in sid:
        star(d,32,32,16,(246,214,122)); fill_poly(d,[(26,41),(32,17),(39,41)],(255,124,42)); fill_poly(d,[(29,38),(32,24),(36,38)],(255,232,128))
    elif 'pilgrim_light' in sid:
        torch(d); d.arc((17,8,47,38),200,340,fill=(255,220,120),width=3)
    elif 'cleanse_venom' in sid:
        bottle(d,(92,208,108),label='A'); line(d,[(18,45),(46,17)],(255,242,242),3)
    elif 'steadfast' in sid:
        shield(d,'tower'); line(d,[(32,18),(32,42)],(250,236,196),2)
    elif 'blessing' in sid:
        star(d,32,20,10,(255,228,136)); line(d,[(32,28),(32,45)],(255,228,136),4); line(d,[(25,38),(32,45),(39,38)],(255,228,136),4)
    elif 'healing_chorus' in sid:
        for x in [22,32,42]: d.arc((x-5,18,x+5,28), 40, 320, fill=(255,236,170), width=2); line(d,[(x,22),(x,40)],(255,236,170),2); d.ellipse((x-2,38,x+2,42), fill=(255,236,170))
    elif 'turn_the_hollow' in sid:
        d.ellipse((19,23,45,44), fill=(80,82,96), outline=(186,188,210), width=2)
        d.rectangle((25,29,30,35), fill=(0,0,0,0)); d.rectangle((34,29,39,35), fill=(0,0,0,0)); d.rectangle((29,37,35,40), fill=(0,0,0,0))
        line(d,[(32,12),(32,46)],(255,230,146),3); line(d,[(21,22),(43,22)],(255,230,146),3)
    elif 'sheltering_hand' in sid:
        d.rounded_rectangle((18,19,46,45),radius=12, fill=(196,162,96), outline=(90,68,36), width=2); line(d,[(22,31),(42,31)],(244,230,190),2)
    elif 'break_malison' in sid:
        line(d,[(18,44),(29,33),(24,28),(36,18)],(230,220,198),4); line(d,[(36,18),(47,29),(42,34),(50,42)],(230,220,198),4); line(d,[(27,19),(39,45)],(255,110,110),3)
    elif 'return_breath' in sid:
        fill_poly(d,[(22,42),(18,29),(25,18),(33,25),(40,18),(47,29),(42,42),(32,47)],(196,236,255),(110,160,190),2)
        line(d,[(16,32),(24,28),(31,34),(40,28),(49,32)],(255,255,255),2)
    elif 'dawn_judgment' in sid:
        sword(d, blade=(236,242,246), hilt=(198,152,82), angle=-18, long=True)
        for ang in range(200,341,35):
            r=math.radians(ang); line(d,[(32,32),(32+math.cos(r)*18,32+math.sin(r)*18)],(255,226,128),2)
    elif 'withering_word' in sid:
        for i in range(5): d.arc((14+i*2,14+i*2,50-i*2,50-i*2), 220, 320, fill=(164,116,188), width=2)
        d.ellipse((28,26,36,34), fill=(236,222,246))
    elif 'ill_omen' in sid:
        d.ellipse((14,22,50,42), fill=(92,62,114), outline=(220,160,255), width=2); d.ellipse((24,22,40,42), fill=(196,146,255), outline=(80,44,96)); d.ellipse((29,27,35,37), fill=(24,12,38))
    elif 'borrowed_face' in sid:
        fill_poly(d,[(20,19),(44,19),(46,42),(32,49),(18,42)],(238,230,214),(130,110,88),2); d.ellipse((24,27,29,32),fill=(86,70,60)); d.ellipse((35,27,40,32),fill=(86,70,60)); line(d,[(26,39),(38,39)],(86,70,60),2)
    elif 'leech_kiss' in sid:
        fill_poly(d,[(18,30),(28,24),(36,25),(46,30),(36,35),(28,36)],(224,82,110),(120,34,56),2); d.ellipse((30,36,36,45), fill=(214,44,60), outline=(100,20,28))
    elif 'sleep_of_thorns' in sid:
        d.arc((15,16,47,48), 40, 300, fill=(198,168,255), width=3); line(d,[(18,43),(46,18)],(124,186,78),3); line(d,[(22,44),(28,36)],(124,186,78),2); line(d,[(35,28),(44,20)],(124,186,78),2)
    elif 'rat_whisper' in sid:
        fill_poly(d,[(17,40),(20,27),(29,21),(38,22),(45,28),(48,37),(39,35),(28,37)],(126,136,152),(62,70,84),2); line(d,[(46,31),(54,24)],(212,154,220),2)
    elif 'crooked_bones' in sid:
        line(d,[(20,22),(33,35)],(226,220,198),5); d.ellipse((16,18,24,26), fill=(226,220,198)); d.ellipse((29,31,37,39), fill=(226,220,198)); line(d,[(30,18),(43,31)],(226,220,198),5); d.ellipse((26,14,34,22), fill=(226,220,198)); d.ellipse((39,27,47,35), fill=(226,220,198))
    elif 'briar_mantle' in sid:
        for pts in [[(19,46),(24,18),(32,25),(40,18),(45,46)],[(21,40),(27,22),(32,26),(37,22),(43,40)]]: line(d,pts,(102,166,78),4)
    elif 'malice_rain' in sid:
        d.ellipse((16,18,48,34), fill=(98,72,110), outline=(182,142,210), width=2)
        for x in [22,30,38,46]: line(d,[(x,34),(x-3,46)],(116,210,84),2)
    elif 'bottle_the_echo' in sid:
        bottle(d,(130,214,255));
        for r in [8,14]: d.arc((32-r,31-r,32+r,31+r), 210, 330, fill=(180,232,255), width=2)
    elif 'hearth_thread' in sid:
        fill_poly(d,[(22,44),(22,30),(30,30),(30,22),(34,22),(34,30),(42,30),(42,44)],(230,194,116),(122,88,42),2); fill_poly(d,[(24,31),(32,18),(40,31)],(255,134,64)); line(d,[(16,20),(28,32)],(248,224,180),2)
    elif 'black_moon' in sid:
        d.ellipse((17,15,47,45), fill=(38,30,62), outline=(206,162,255), width=2); d.ellipse((26,15,50,45), fill=(24,24,38));
        for p in [(22,20,3),(42,18,2),(18,35,2),(45,39,3)]: star(d,*p,(255,246,196))
    else:
        d.text((16,26),sid.split('_')[-1][:4].upper(),fill=(250,240,220),font=font_small)
    return finish(im)


def burst(draw, color, points=14, inner=16, outer=24):
    pts=[]
    for i in range(points*2):
        ang=-math.pi/2+i*math.pi/points
        rr=outer if i%2==0 else inner
        pts.append((32+math.cos(ang)*rr,32+math.sin(ang)*rr))
    fill_poly(draw, pts, color)


def draw_feedback(name:str):
    im,d=base_plate('feedback')
    if name=='attack': burst(d,(214,82,66)); sword(d, angle=-35)
    elif name=='miss': burst(d,(112,126,148)); line(d,[(18,18),(46,46)],(255,236,196),4); line(d,[(46,18),(18,46)],(255,236,196),4)
    elif name=='guard': shield(d,'round'); line(d,[(20,44),(44,18)],(255,228,160),3)
    elif name=='run': line(d,[(14,32),(42,32)],(226,212,170),4); fill_poly(d,[(42,23),(54,32),(42,41)],(226,212,170)); fill_poly(d,[(18,48),(28,24),(36,28),(34,50)],(214,178,124),(108,74,46),2)
    elif name=='heal': d.ellipse((16,16,48,48), fill=(104,56,62), outline=(238,190,202), width=2); line(d,[(32,20),(32,44)],(255,236,236),5); line(d,[(20,32),(44,32)],(255,236,236),5)
    elif name=='cure': bottle(d,(90,206,102),label='A'); line(d,[(16,46),(48,14)],(255,250,250),4)
    elif name=='revive': fill_poly(d,[(22,42),(18,29),(25,18),(33,25),(40,18),(47,29),(42,42),(32,47)],(196,236,255),(110,160,190),2)
    elif name=='arcane':
        for pts in [((18,18),(29,28),(24,28),(39,46)),((44,16),(36,27),(41,27),(27,48))]:
            line(d,list(pts),(168,210,255),4)
    elif name=='fire': fill_poly(d,[(22,45),(32,16),(44,45)],(255,126,52)); fill_poly(d,[(27,44),(32,25),(39,44)],(255,226,124))
    elif name=='cold': fill_poly(d,[(18,45),(35,14),(46,24),(28,51)],(190,240,255),(90,140,180),2)
    elif name=='lightning':
        for pts in [((22,16),(34,28),(28,28),(42,48)),((40,18),(31,28),(36,28),(24,48))]:
            line(d,list(pts),(244,232,110),4)
    elif name=='holy': star(d,32,28,14,(255,228,136)); line(d,[(32,18),(32,46)],(255,228,136),2)
    elif name=='poison':
        d.ellipse((16,18,48,34), fill=(98,72,110), outline=(182,142,210), width=2)
        for x in [22,30,38,46]:
            line(d,[(x,34),(x-3,46)],(116,210,84),2)
    elif name=='necrotic': d.ellipse((19,23,45,44), fill=(80,82,96), outline=(186,188,210), width=2); d.rectangle((25,29,30,35), fill=(0,0,0,0)); d.rectangle((34,29,39,35), fill=(0,0,0,0)); d.rectangle((29,37,35,40), fill=(0,0,0,0))
    elif name=='ward': shield(d,'tower'); star(d,32,24,8,(255,228,136))
    elif name=='debuff': d.ellipse((14,22,50,42), fill=(92,62,114), outline=(220,160,255), width=2); line(d,[(20,44),(44,20)],(255,110,130),3)
    elif name=='bind':
        d.ellipse((20,20,44,44), fill=(164,124,210), outline=(86,60,108), width=3)
        for i in [0,4,8]:
            d.arc((20+i,20+i,44-i,44-i),30,300,fill=(236,220,255),width=2)
    elif name=='sleep': d.arc((15,16,47,48), 40, 300, fill=(198,168,255), width=3); line(d,[(18,43),(46,18)],(124,186,78),3)
    elif name=='special': seal(d)
    return finish(im)

# Generate assets
for iid in ITEMS:
    draw_item(iid).save(ITEM_DIR/f'{iid}.png')
for sid in SPELLS:
    draw_spell(sid).save(SPELL_DIR/f'{sid}.png')
for fid in FEEDBACKS:
    draw_feedback(fid).save(FEEDBACK_DIR/f'{fid}.png')

# Build preview sheet
sheet=Image.new('RGBA',(1600,1180),(13,18,24,255))
d=ImageDraw.Draw(sheet)
d.text((24,18),'WORLD OF MAXXIA · PHASE 30 ART PREVIEW',fill=(242,214,154),font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',28))
d.text((24,52),'Spell, item and combat feedback art — illustrated raster UI pass',fill=(182,205,214),font=font_label)

def paste_grid(title, folder, names, ox, oy, cols=8, label_mode='short'):
    d.text((ox,oy-28),title,fill=(240,208,144),font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',18))
    for idx,name in enumerate(names):
        x=ox+(idx%cols)*96; y=oy+(idx//cols)*96
        img=Image.open(folder/f'{name}.png')
        sheet.alpha_composite(img,(x,y))
        label=name.replace('item_','').replace('spell_','').replace('_',' ')
        if label_mode=='short' and len(label)>14:
            label=' '.join(label.split()[:2])
        d.text((x,y+68),label[:18],fill=(198,210,214),font=font_small)

paste_grid('Items — sample set', ITEM_DIR, ITEMS[:24], 24, 110, cols=8)
paste_grid('Spells — sample set', SPELL_DIR, SPELLS[:24], 24, 450, cols=8)
paste_grid('Combat feedback icons', FEEDBACK_DIR, FEEDBACKS, 24, 790, cols=8, label_mode='full')
sheet.save(DOCS/'PHASE30_ART_PREVIEW.png')
print('Generated', len(ITEMS), 'items,', len(SPELLS), 'spells,', len(FEEDBACKS), 'feedback icons.')
