"""Pack rendered spell-effect and missile art for Phase 30.2A.

This script crops from rendered raster master boards only. It never draws the spell
or missile illustration from primitives; code is limited to cropping, compositing,
rotation, scaling, transparency cleanup and strip packing.
"""
from pathlib import Path
from PIL import Image, ImageStat, ImageOps, ImageEnhance, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art-source'/'phase30-rendered'
OUT=ROOT/'public'/'assets'/'art'/'effects'
DOCS=ROOT/'docs'
master1=Image.open(ART/'painted-equipment-spells-master.png').convert('RGB')
master2=Image.open(ART/'painted-icons-master.png').convert('RGB')
item=Image.open(ART/'painted-equipment-spells-master.png').convert('RGB')

REGIONS={
  'spell1': (master1,(734,135,1506,463),8,4),
  'spell2': (master2,(857,116,1506,585),6,6),
  'item1': (item,(21,134,691,642),8,6),
}

def crop_cell(source,index):
    im,b,nx,ny=REGIONS[source]
    x=index%nx;y=index//nx
    x0=round(b[0]+(b[2]-b[0])*x/nx)
    x1=round(b[0]+(b[2]-b[0])*(x+1)/nx)
    y0=round(b[1]+(b[3]-b[1])*y/ny)
    y1=round(b[1]+(b[3]-b[1])*(y+1)/ny)
    cell=im.crop((x0,y0,x1,y1))
    w,h=cell.size
    trim=(7,7,w-8,h-8) if source=='spell1' else (10,7,w-10,h-9) if source=='spell2' else (7,6,w-8,h-8)
    cell=cell.crop(trim).resize((96,96),Image.Resampling.LANCZOS).convert('RGBA')
    # remove frame and near-black matte while preserving painted edges
    px=cell.load()
    for yy in range(cell.height):
        for xx in range(cell.width):
            r,g,b,a=px[xx,yy]
            if r<18 and g<18 and b<18:
                px[xx,yy]=(0,0,0,0)
            elif r<45 and g<45 and b<45:
                px[xx,yy]=(r,g,b,int(a*0.2))
    return cell

def fit(img,scale=1.0,rotate=0,dx=0,dy=0,mirror=False, brighten=1.0):
    img=img.copy()
    if brighten!=1.0: img=ImageEnhance.Brightness(img).enhance(brighten)
    if mirror: img=ImageOps.mirror(img)
    if scale!=1.0:
        w=max(1,round(img.width*scale));h=max(1,round(img.height*scale))
        img=img.resize((w,h),Image.Resampling.LANCZOS)
    if rotate:
        img=img.rotate(rotate,resample=Image.Resampling.BICUBIC,expand=True)
    out=Image.new('RGBA',(96,96),(0,0,0,0))
    x=(96-img.width)//2+dx; y=(96-img.height)//2+dy
    out.alpha_composite(img,(x,y))
    return out

def strip(frames, name):
    sheet=Image.new('RGBA',(96*len(frames),96),(0,0,0,0))
    for i,frame in enumerate(frames):
        sheet.alpha_composite(frame,(i*96,0))
    sheet.save(OUT/f'{name}.png', optimize=True)

# rendered source crops
fire=crop_cell('spell1',0)
frost=crop_cell('spell1',1)
lightning=crop_cell('spell1',2)
sunburst=crop_cell('spell1',3)
poison=crop_cell('spell1',4)
vortex=crop_cell('spell1',5)
crystals=crop_cell('spell1',6)
wardbody=crop_cell('spell1',7)
hands=crop_cell('spell1',8)
blesshand=crop_cell('spell1',9)
cross=crop_cell('spell1',10)
shield=crop_cell('spell1',11)
aura_body=crop_cell('spell1',12)
target=crop_cell('spell1',14)
eye=crop_cell('spell1',15)
skull=crop_cell('spell1',16)
hood=crop_cell('spell1',17)
sleep=crop_cell('spell1',18)
chain=crop_cell('spell1',19)
clover=crop_cell('spell1',20)
wave=crop_cell('spell1',21)
wave2=crop_cell('spell1',22)
firepillar=crop_cell('spell1',23)
book=crop_cell('spell1',25)
mask=crop_cell('spell1',26)
chorus=crop_cell('spell1',27)
crow=crop_cell('spell1',28)
starfall=crop_cell('spell1',29)
portal=crop_cell('spell1',30)
tri_eye=crop_cell('spell1',31)

hand_shadow=crop_cell('spell2',0)
fire2=crop_cell('spell2',1)
lightning2=crop_cell('spell2',2)
icespikes=crop_cell('spell2',3)
vortex2=crop_cell('spell2',4)
rocks=crop_cell('spell2',5)
wave3=crop_cell('spell2',6)
icebody=crop_cell('spell2',7)
skull_green=crop_cell('spell2',8)
shadow_body=crop_cell('spell2',9)
lightbody=crop_cell('spell2',10)
sword=crop_cell('spell2',11)
shield2=crop_cell('spell2',12)
stonebody=crop_cell('spell2',13)
party=crop_cell('spell2',14)
dove=crop_cell('spell2',15)
red_eye=crop_cell('spell2',16)
gold_body=crop_cell('spell2',17)
heal_cross=crop_cell('spell2',18)
heart=crop_cell('spell2',19)
toxic_skull=crop_cell('spell2',20)
sleep2=crop_cell('spell2',21)
spiral=crop_cell('spell2',22)
chain2=crop_cell('spell2',23)
portal2=crop_cell('spell2',24)
doorlight=crop_cell('spell2',25)
arcane_star=crop_cell('spell2',26)
purple_eye=crop_cell('spell2',27)
fountain=crop_cell('spell2',28)
island=crop_cell('spell2',29)
fire3=crop_cell('spell2',30)
ice_rain=crop_cell('spell2',31)
vines=crop_cell('spell2',32)
dome=crop_cell('spell2',33)
hourglass=crop_cell('spell2',34)
galaxy=crop_cell('spell2',35)

bow=crop_cell('item1',4)
quiver=crop_cell('item1',5)
xbow=crop_cell('item1',6)
spear=crop_cell('item1',3)

OUT.mkdir(parents=True, exist_ok=True)
manifest={}

def add(name, frames, kind):
    strip(frames,name)
    manifest[name]={"kind":kind,"frames":len(frames),"cell":96,"art_type":"rendered raster crop/composite"}

# Missiles
add('missile_arrow',[fit(spear,.50,-25,-6,10),fit(spear,.56,-18,-2,6),fit(spear,.62,-12,2,2),fit(spear,.68,-6,4,-2)],'missile')
add('missile_arcane',[fit(arcane_star,.52,0),fit(arcane_star,.60,9),fit(arcane_star,.68,18),fit(arcane_star,.78,27)],'missile')
add('missile_fire',[fit(fire,.52,-18,-10,4),fit(fire2,.60,-10,-4,2),fit(fire3,.70,-3,1,0),fit(fire,.82,5,5,-2,False,1.06)],'missile')
add('missile_frost',[fit(frost,.54,-22,-6,4),fit(icespikes,.62,-14,-1,1),fit(frost,.72,-7,4,-1),fit(ice_rain,.84,0,7,-3)],'missile')
add('missile_lightning',[fit(lightning,.56,0),fit(lightning2,.64,6),fit(lightning,.74,12),fit(lightning2,.84,18)],'missile')
add('missile_holy',[fit(sunburst,.52,0),fit(cross,.62,8),fit(lightbody,.74,0),fit(gold_body,.84,0)],'missile')
add('missile_shadow',[fit(skull,.54,0),fit(hand_shadow,.62,6),fit(shadow_body,.70,0),fit(galaxy,.82,0)],'missile')
add('missile_bind',[fit(chain,.55,-12),fit(chain2,.62,-6),fit(vines,.70,-4),fit(chain,.78,2)],'missile')

# Bursts / auras
add('burst_heal',[fit(heal_cross,.60,0),fit(heart,.72,0),fit(hands,.86,0),fit(chorus,.96,0)],'burst')
add('burst_ward',[fit(shield,.60,0),fit(shield2,.72,0),fit(wardbody,.84,0),fit(dome,.96,0)],'burst')
add('burst_holy',[fit(cross,.58,0),fit(sunburst,.74,0),fit(dove,.88,0),fit(lightbody,.98,0)],'burst')
add('burst_shadow',[fit(skull_green,.58,0),fit(toxic_skull,.72,0),fit(hood,.84,0),fit(galaxy,.96,0)],'burst')
add('burst_poison',[fit(poison,.58,0),fit(vines,.72,0),fit(toxic_skull,.84,0),fit(poison,.96,0,0,0,False,1.08)],'burst')
add('burst_portal',[fit(portal,.60,0),fit(portal2,.76,0),fit(doorlight,.90,0),fit(fountain,.96,0)],'burst')
add('burst_starfall',[fit(starfall,.56,0,-4,-6),fit(starfall,.68,0,8,-2),fit(arcane_star,.82,0,-8,4),fit(starfall,.96,0,0,0)],'burst')
add('burst_firefan',[fit(firepillar,.64,-14),fit(fire3,.76,-8),fit(firepillar,.88,0),fit(fire3,1.0,6)],'burst')
add('burst_storm',[fit(lightning2,.62,0),fit(wave,.74,0),fit(lightning,.88,0),fit(vortex,.98,0)],'burst')
add('burst_arcane',[fit(eye,.58,0),fit(target,.72,0),fit(tri_eye,.84,0),fit(arcane_star,.98,0)],'burst')

(DOCS/'PHASE302A_EFFECT_MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
# preview
names=list(manifest)
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
head=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',22)
label=ImageFont.truetype(font,12)
cols=4; cellw=250; cellh=132
W=cols*cellw+24; H=((len(names)+cols-1)//cols)*cellh+96
preview=Image.new('RGB',(W,H),'#10171d'); d=ImageDraw.Draw(preview)
d.text((16,14),'WORLD OF MAXXIA / PHASE 30.2A RENDERED SPELL EFFECTS & MISSILES',font=head,fill='#efcf96')
for i,name in enumerate(names):
    x=16+(i%cols)*cellw; y=60+(i//cols)*cellh
    im=Image.open(OUT/f'{name}.png').convert('RGBA')
    im=im.resize((192,48),Image.Resampling.NEAREST)
    preview.paste(im,(x+20,y+8),im)
    d.text((x+20,y+68),name.replace('_',' '),font=label,fill='#d7d7c9')
    d.text((x+20,y+86),manifest[name]['kind'],font=label,fill='#9db7c0')
preview.save(DOCS/'PHASE302A_EFFECTS_PREVIEW.png')
print('Packed', len(names), 'effect sheets.')
