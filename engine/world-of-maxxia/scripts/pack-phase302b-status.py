"""Pack rendered impact flashes and condition marks for Phase 30.2B.

All art is cropped from the rendered Phase 30 master boards. Code is used only for
packing, transparency cleanup, scaling, compositing, and strip animation assembly.
"""
from pathlib import Path
from PIL import Image, ImageOps, ImageEnhance, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art-source'/'phase30-rendered'
OUT_IMPACT=ROOT/'public'/'assets'/'art'/'impacts'
OUT_COND=ROOT/'public'/'assets'/'art'/'conditions'
DOCS=ROOT/'docs'
master=Image.open(ART/'painted-equipment-spells-master.png').convert('RGB')

# Shared crop helpers -------------------------------------------------------
REGIONS={
  'spell': (master,(734,135,1506,463),8,4),
  'item': (master,(21,134,691,642),8,6),
  'feedback': (master,(728,548,1488,666),9,2),
}

def trim_black(img):
    img=img.convert('RGBA')
    px=img.load()
    for y in range(img.height):
        for x in range(img.width):
            r,g,b,a=px[x,y]
            if r<20 and g<20 and b<20:
                px[x,y]=(0,0,0,0)
            elif r<40 and g<40 and b<40:
                px[x,y]=(r,g,b,int(a*0.3))
    return img

def crop_grid(source,index,size=96,trim=(8,8,80,80)):
    im,b,nx,ny=REGIONS[source]
    x=index%nx;y=index//nx
    x0=round(b[0]+(b[2]-b[0])*x/nx)
    x1=round(b[0]+(b[2]-b[0])*(x+1)/nx)
    y0=round(b[1]+(b[3]-b[1])*y/ny)
    y1=round(b[1]+(b[3]-b[1])*(y+1)/ny)
    cell=im.crop((x0,y0,x1,y1)).crop(trim).resize((size,size),Image.Resampling.LANCZOS)
    return trim_black(cell)

def fit(img, cell=96, scale=1.0, rotate=0, dx=0, dy=0, mirror=False, brighten=1.0):
    img=img.copy()
    if brighten!=1.0:
        img=ImageEnhance.Brightness(img).enhance(brighten)
    if mirror:
        img=ImageOps.mirror(img)
    if scale!=1.0:
        w=max(1,round(img.width*scale));h=max(1,round(img.height*scale))
        img=img.resize((w,h),Image.Resampling.LANCZOS)
    if rotate:
        img=img.rotate(rotate,resample=Image.Resampling.BICUBIC,expand=True)
    out=Image.new('RGBA',(cell,cell),(0,0,0,0))
    x=(cell-img.width)//2+dx; y=(cell-img.height)//2+dy
    out.alpha_composite(img,(x,y))
    return out

def glow_mask(img, blur_steps=3, strength=0.8, color=(255,255,255)):
    alpha=img.getchannel('A')
    base=Image.new('RGBA',img.size,(0,0,0,0))
    for i in range(blur_steps):
        spread=max(1,(i+1)*2)
        expanded=Image.new('L',img.size,0)
        for dx in range(-spread, spread+1, spread):
            for dy in range(-spread, spread+1, spread):
                expanded.paste(alpha,(dx,dy))
        col=(color[0],color[1],color[2],int(55*strength/(i+1)))
        lay=Image.new('RGBA',img.size,col)
        lay.putalpha(expanded)
        base.alpha_composite(lay)
    return base

def impact_frame(core, cell=96, scale=1.0, rotate=0, color=(255,255,255), secondary=None, sec_scale=1.0, sec_rotate=0, dx=0, dy=0):
    canvas=Image.new('RGBA',(cell,cell),(0,0,0,0))
    core_fit=fit(core,cell=cell,scale=scale,rotate=rotate,dx=dx,dy=dy)
    canvas.alpha_composite(glow_mask(core_fit,4,0.9,color))
    if secondary is not None:
        sec=fit(secondary,cell=cell,scale=sec_scale,rotate=sec_rotate,dx=dx,dy=dy)
        canvas.alpha_composite(glow_mask(sec,3,0.6,color))
        canvas.alpha_composite(sec)
    canvas.alpha_composite(core_fit)
    return canvas

def save_strip(path,frames):
    cell=frames[0].width
    sheet=Image.new('RGBA',(cell*len(frames),cell),(0,0,0,0))
    for i,frame in enumerate(frames):
        sheet.alpha_composite(frame,(i*cell,0))
    sheet.save(path,optimize=True)

# Source crops --------------------------------------------------------------
# feedback icons row (18 total, 9x2)
fb_swords=crop_grid('feedback',0)
fb_shield=crop_grid('feedback',1)
fb_miss=crop_grid('feedback',2)
fb_star=crop_grid('feedback',3)
fb_heal=crop_grid('feedback',4)
fb_spark=crop_grid('feedback',5)
fb_shield2=crop_grid('feedback',6)
fb_weak=crop_grid('feedback',7)
fb_buff=crop_grid('feedback',8)
fb_poison=crop_grid('feedback',9)
fb_fire=crop_grid('feedback',10)
fb_ice=crop_grid('feedback',11)
fb_shock=crop_grid('feedback',12)
fb_tears=crop_grid('feedback',13)
fb_rock=crop_grid('feedback',14)
fb_spark2=crop_grid('feedback',15)
fb_spiral=crop_grid('feedback',16)
fb_sleep=crop_grid('feedback',17)

# selected spell / item icons
spell_hands=crop_grid('spell',8)
spell_cross=crop_grid('spell',10)
spell_shield=crop_grid('spell',11)
spell_skull=crop_grid('spell',16)
spell_hood=crop_grid('spell',17)
spell_clover=crop_grid('spell',20)
spell_eye=crop_grid('spell',15)
spell_firepillar=crop_grid('spell',23)
item_bread=crop_grid('item',34)
item_mushroom=crop_grid('item',37)
item_bottle=crop_grid('item',31)
item_cheese=crop_grid('item',33)
item_ham=crop_grid('item',32)

OUT_IMPACT.mkdir(parents=True,exist_ok=True)
OUT_COND.mkdir(parents=True,exist_ok=True)

impact_manifest={}
cond_manifest={}

def add_impact(name,frames):
    save_strip(OUT_IMPACT/f'{name}.png',frames)
    impact_manifest[name]={'frames':len(frames),'cell':96,'art_type':'rendered raster crop/composite'}

def add_cond(name,img):
    img.save(OUT_COND/f'{name}.png',optimize=True)
    cond_manifest[name]={'size':[img.width,img.height],'art_type':'rendered raster crop/composite'}

# Impact strips -------------------------------------------------------------
add_impact('impact_physical',[
    impact_frame(fb_swords,scale=.62,rotate=-18,color=(255,220,150),secondary=fb_star,sec_scale=.44),
    impact_frame(fb_swords,scale=.78,rotate=-9,color=(255,210,120),secondary=fb_star,sec_scale=.58),
    impact_frame(fb_swords,scale=.92,rotate=0,color=(255,200,90),secondary=fb_star,sec_scale=.72),
    impact_frame(fb_swords,scale=1.05,rotate=8,color=(255,190,70),secondary=fb_star,sec_scale=.84),
])
add_impact('impact_fire',[
    impact_frame(fb_fire,scale=.62,rotate=-12,color=(255,170,60),secondary=spell_firepillar,sec_scale=.38),
    impact_frame(fb_fire,scale=.78,rotate=-4,color=(255,150,40),secondary=spell_firepillar,sec_scale=.54),
    impact_frame(fb_fire,scale=.92,rotate=4,color=(255,135,25),secondary=spell_firepillar,sec_scale=.66),
    impact_frame(fb_fire,scale=1.04,rotate=10,color=(255,120,15),secondary=spell_firepillar,sec_scale=.76),
])
add_impact('impact_cold',[
    impact_frame(fb_ice,scale=.60,rotate=-14,color=(185,230,255),secondary=fb_tears,sec_scale=.36),
    impact_frame(fb_ice,scale=.76,rotate=-6,color=(170,220,255),secondary=fb_tears,sec_scale=.52),
    impact_frame(fb_ice,scale=.90,rotate=2,color=(155,210,255),secondary=fb_tears,sec_scale=.66),
    impact_frame(fb_ice,scale=1.02,rotate=8,color=(145,205,255),secondary=fb_tears,sec_scale=.78),
])
add_impact('impact_lightning',[
    impact_frame(fb_shock,scale=.60,rotate=-10,color=(175,205,255),secondary=fb_star,sec_scale=.28),
    impact_frame(fb_shock,scale=.76,rotate=-2,color=(145,185,255),secondary=fb_star,sec_scale=.42),
    impact_frame(fb_shock,scale=.90,rotate=8,color=(120,165,255),secondary=fb_star,sec_scale=.56),
    impact_frame(fb_shock,scale=1.02,rotate=16,color=(100,150,255),secondary=fb_star,sec_scale=.72),
])
add_impact('impact_poison',[
    impact_frame(fb_poison,scale=.62,rotate=-10,color=(140,230,110),secondary=spell_clover,sec_scale=.34),
    impact_frame(fb_poison,scale=.78,rotate=-2,color=(120,205,85),secondary=spell_clover,sec_scale=.50),
    impact_frame(fb_poison,scale=.92,rotate=6,color=(100,185,70),secondary=spell_clover,sec_scale=.64),
    impact_frame(fb_poison,scale=1.06,rotate=12,color=(85,165,55),secondary=spell_clover,sec_scale=.78),
])
add_impact('impact_arcane',[
    impact_frame(fb_spiral,scale=.60,rotate=-8,color=(210,170,255),secondary=fb_spark2,sec_scale=.30),
    impact_frame(fb_spiral,scale=.76,rotate=2,color=(195,150,255),secondary=fb_spark2,sec_scale=.44),
    impact_frame(fb_spiral,scale=.90,rotate=12,color=(180,130,255),secondary=fb_spark2,sec_scale=.58),
    impact_frame(fb_spiral,scale=1.04,rotate=22,color=(170,120,245),secondary=fb_spark2,sec_scale=.70),
])
add_impact('impact_holy',[
    impact_frame(spell_cross,scale=.56,rotate=0,color=(255,230,155),secondary=fb_heal,sec_scale=.30),
    impact_frame(spell_cross,scale=.72,rotate=4,color=(255,220,125),secondary=fb_heal,sec_scale=.44),
    impact_frame(spell_cross,scale=.86,rotate=8,color=(255,210,100),secondary=fb_heal,sec_scale=.58),
    impact_frame(spell_cross,scale=.98,rotate=12,color=(255,205,90),secondary=fb_spark2,sec_scale=.72),
])
add_impact('impact_necrotic',[
    impact_frame(spell_skull,scale=.60,rotate=-12,color=(198,120,255),secondary=spell_hood,sec_scale=.34),
    impact_frame(spell_skull,scale=.76,rotate=-4,color=(180,95,245),secondary=spell_hood,sec_scale=.48),
    impact_frame(spell_skull,scale=.90,rotate=6,color=(160,80,225),secondary=spell_hood,sec_scale=.60),
    impact_frame(spell_skull,scale=1.04,rotate=14,color=(145,70,210),secondary=spell_hood,sec_scale=.74),
])
add_impact('impact_heal',[
    impact_frame(spell_hands,scale=.56,rotate=0,color=(170,255,165),secondary=fb_heal,sec_scale=.32),
    impact_frame(spell_hands,scale=.72,rotate=0,color=(140,240,130),secondary=fb_heal,sec_scale=.46),
    impact_frame(spell_hands,scale=.86,rotate=0,color=(120,225,110),secondary=fb_spark,sec_scale=.58),
    impact_frame(spell_hands,scale=.98,rotate=0,color=(105,210,96),secondary=fb_spark,sec_scale=.74),
])
add_impact('impact_guard',[
    impact_frame(fb_shield,scale=.58,rotate=0,color=(160,205,255),secondary=spell_shield,sec_scale=.34),
    impact_frame(fb_shield,scale=.74,rotate=0,color=(145,190,255),secondary=spell_shield,sec_scale=.48),
    impact_frame(fb_shield,scale=.88,rotate=0,color=(130,175,245),secondary=spell_shield,sec_scale=.62),
    impact_frame(fb_shield,scale=1.00,rotate=0,color=(115,160,235),secondary=spell_shield,sec_scale=.76),
])

# Condition marks -----------------------------------------------------------
def mark(img, cell=40, glow=(255,255,255), bg=(12,18,25,220), border=(151,129,87,255)):
    out=Image.new('RGBA',(cell,cell),(0,0,0,0))
    plate=Image.new('RGBA',(cell,cell),bg)
    out.alpha_composite(plate)
    # border
    dr=ImageDraw.Draw(out)
    dr.rectangle((0,0,cell-1,cell-1),outline=border,width=1)
    fitted=fit(img,cell=cell,scale=.52)
    out.alpha_composite(glow_mask(fitted,3,0.55,glow))
    out.alpha_composite(fitted)
    return out

add_cond('poisoned', mark(fb_poison,glow=(145,230,110)))
add_cond('asleep', mark(fb_sleep,glow=(190,145,255)))
add_cond('frightened', mark(spell_hood,glow=(175,120,230)))
add_cond('cursed', mark(spell_eye,glow=(225,90,70)))
add_cond('drunk', mark(item_bottle,glow=(235,190,110)))
# hungry: composite bread + ham to read clearly at small size
hungry=Image.new('RGBA',(40,40),(0,0,0,0))
hungry.alpha_composite(fit(item_bread,cell=40,scale=.42,dx=-6,dy=0))
hungry.alpha_composite(fit(item_ham,cell=40,scale=.36,dx=7,dy=1))
add_cond('hungry', mark(hungry,glow=(235,205,135)))

(DOCS/'PHASE302B_IMPACT_MANIFEST.json').write_text(json.dumps(impact_manifest,indent=2)+'\n')
(DOCS/'PHASE302B_CONDITION_MANIFEST.json').write_text(json.dumps(cond_manifest,indent=2)+'\n')

# Preview sheet -------------------------------------------------------------
head_font='/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
body_font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
head=ImageFont.truetype(head_font,22)
sub=ImageFont.truetype(body_font,14)
small=ImageFont.truetype(body_font,12)
impact_names=list(impact_manifest.keys())
cond_names=list(cond_manifest.keys())
W=1300; H=980
prev=Image.new('RGB',(W,H),'#0f171d'); d=ImageDraw.Draw(prev)
d.text((20,16),'WORLD OF MAXXIA / PHASE 30.2B — RENDERED IMPACT FLASHES & CONDITION MARKS',font=head,fill='#efcf96')
d.text((20,48),'All assets are packed from the rendered Phase 30 master boards. These are presentation-only art layers.',font=sub,fill='#bfd0d5')
# impacts
cols=5; cellw=248; cellh=120
for i,name in enumerate(impact_names):
    x=22+(i%cols)*cellw; y=96+(i//cols)*cellh
    sheet=Image.open(OUT_IMPACT/f'{name}.png').convert('RGBA').resize((192,48),Image.Resampling.NEAREST)
    prev.paste(sheet,(x+16,y+10),sheet)
    d.text((x+16,y+68),name.replace('_',' '),font=sub,fill='#f1e6ca')
    d.text((x+16,y+88),'impact flash · 4 frames',font=small,fill='#9ab1b9')
# conditions
base_y=96+((len(impact_names)+cols-1)//cols)*cellh+26
d.text((20,base_y-28),'Condition marks',font=head,fill='#efcf96')
for i,name in enumerate(cond_names):
    x=30+(i%6)*200; y=base_y+(i//6)*86
    img=Image.open(OUT_COND/f'{name}.png').convert('RGBA').resize((60,60),Image.Resampling.NEAREST)
    prev.paste(img,(x,y),img)
    d.text((x+72,y+8),name.capitalize(),font=sub,fill='#f1e6ca')
    d.text((x+72,y+31),'portrait / status badge',font=small,fill='#9ab1b9')
prev.save(DOCS/'PHASE302B_STATUS_PREVIEW.png')
print('Packed impacts:', len(impact_names), 'conditions:', len(cond_names))
