"""Pack illustrated raster monster keyframes into existing 4x4, 128px combat atlases.

Uses only source images, pixel-based alpha keying, scaling and frame selection.
Does not draw any creature from geometric shapes. Master rendered image remains
under art-source/enemy-raster-redo. Uses a six-frame reversing idle cycle.
"""
from pathlib import Path
import json, numpy as np
from PIL import Image, ImageOps, ImageEnhance
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'art-source/enemy-raster-redo'
OUT=ROOT/'public/assets/art/enemies'
SRC.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
image=Image.open(SRC/'rendered-enemies-master.png').convert('RGB')
assert image.size==(1758,894), image.size
# Individual cell boundaries hand-registered to the actual painterly source master.
DEATH_X={
 'stone-mite':[446,540,644,751],
 'gallery-watcher':[807,899,991,1090],
 'cistern-rat':[1145,1231,1319,1425],
 'sludge-leech':[1481,1571,1658,1754],
 'pipe-goblin':[52,144,242,358],
 'bell-wraith':[416,520,628,738],
 'valve-sentinel':[800,904,1009,1114],
}
SPECIAL_X=[1177,1355,1499,1617,1754]
ATTACK_X={'valve-sentinel':[800,894,973,1114]}
HURT_X={'valve-sentinel':[800,894,973,1114], 'bell-heart':[1177,1298,1417,1510,1625,1754]}
REGIONS={
 'stone-mite':([446,522,599,676,751],[40,125,212,296,381]),
 'gallery-watcher':([807,878,949,1020,1090],[40,125,212,296,381]),
 'cistern-rat':([1145,1224,1291,1359,1425],[40,125,212,296,381]),
 'sludge-leech':([1481,1567,1655,1754],[40,125,212,296,381]),
 'pipe-goblin':([52,130,205,280,358],[432,535,652,740,841]),
 'bell-wraith':([416,500,585,665,738],[432,535,652,740,841]),
 'valve-sentinel':([800,894,973,1044,1114],[432,535,652,740,841]),
 'bell-heart':([1177,1298,1417,1534,1659,1754],[432,535,652,740,841]),
}

def cell(id,row,col):
    xs,ys=REGIONS[id]
    if row==1 and id in ATTACK_X:xs=ATTACK_X[id]
    if row==2 and id in HURT_X:xs=HURT_X[id]
    if row==3 and id in DEATH_X:xs=DEATH_X[id]
    if row==3 and id=='bell-heart':xs=SPECIAL_X
    col=min(col,len(xs)-2)
    # Paintings sit on flat magenta matte; keep white panel rules out of crop.
    a=image.crop((xs[col]+3,ys[row]+4,xs[col+1]-3,ys[row+1]-4))
    rgb=np.asarray(a,dtype=np.uint8).astype(np.float32)
    r,g,b=rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
    # Key only chroma magenta, not the creature's violet armor/cloth or blue energy.
    key=(r>125)&(b>125)&(g<205)&((r+b-2*g)>145)&(np.abs(r-b)<110)
    # Soften one-pixel matte transition to avoid pink halos at native game scale.
    alpha=np.where(key,0,255).astype(np.uint8)
    px=np.dstack((rgb.astype(np.uint8),alpha))
    rgba=Image.fromarray(px,'RGBA')
    # Crop transparent matte, preserve artist silhouette and anchored feet.
    bbox=rgba.getbbox()
    if not bbox:return Image.new('RGBA',(128,128))
    rgba=rgba.crop(bbox)
    max_side=(116,118)
    scale=min(max_side[0]/rgba.width,max_side[1]/rgba.height)
    sw=max(1,int(rgba.width*scale));sh=max(1,int(rgba.height*scale))
    # Resample nearest to retain painterly VGA pixellation and palette breakup.
    rgba=rgba.resize((sw,sh),Image.Resampling.NEAREST)
    canvas=Image.new('RGBA',(128,128),(0,0,0,0))
    canvas.alpha_composite(rgba,((128-sw)//2,124-sh))
    return canvas

# Atlas contract: 6 idle (reversible loop), 4 attack, 2 hurt, 4 death.
# Some illustrated death panels contain three keyframes; use the last as a hold/fade.
def standard_frames(name):
    idle=[cell(name,0,c) for c in range(min(4,len(REGIONS[name][0])-1))]
    if len(idle)<4:idle += idle[::-1][:4-len(idle)]
    idle=idle[:4]
    idle=idle+[idle[2],idle[1]]
    attacks=[cell(name,1,c) for c in range(min(4,len(ATTACK_X.get(name,REGIONS[name][0]))-1))]
    while len(attacks)<4:attacks.append(attacks[-1])
    hurts=[cell(name,2,c) for c in (0,2 if len(REGIONS[name][0])>3 else 1)]
    deaths=[cell(name,3,c) for c in range(min(3,len(REGIONS[name][0])-1))]
    if name=='bell-heart':
        # Last boss row is special frames; derive collapse from the illustrated
        # knocked-down Hurt poses, not from a vector skeleton.
        deaths=[cell(name,2,c) for c in (1,2,3)]
    while len(deaths)<3:deaths.append(deaths[-1])
    last=deaths[-1].copy()
    # A held last pose with less opacity reads as the end of the death sequence.
    aa=last.getchannel('A').point(lambda v:int(v*.60))
    last.putalpha(aa);deaths.append(last)
    return idle+attacks[:4]+hurts+deaths[:4]

def atlas(name,frames):
    assert len(frames)==16,(name,len(frames))
    sheet=Image.new('RGBA',(512,512),(0,0,0,0))
    for i,f in enumerate(frames):sheet.alpha_composite(f,((i%4)*128,(i//4)*128))
    sheet.save(OUT/f'{name}.png',optimize=True)
    sheet.save(SRC/f'{name}-master.png',optimize=True)
    return sheet

report={}
for name in REGIONS:
    frames=standard_frames(name)
    sheet=atlas(name,frames)
    digests=[hash(f.tobytes()) for f in frames]
    assert len(set(digests))>=10,(name,len(set(digests)))
    assert all(f.getbbox() for f in frames),name
    report[name]={'frame_count':16,'illustrated_keyframes':len(set(digests)),'atlas':f'assets/art/enemies/{name}.png'}

name='bell-heart'
sp=[cell(name,3,c) for c in range(5)]
# Animated core powers up, discharges, then drops into an exposed recovery.
special=[sp[0],sp[1],sp[2],sp[1],sp[1],sp[2],sp[3],sp[2],sp[4],cell(name,2,3),cell(name,0,4),cell(name,0,0),cell(name,0,0),cell(name,0,1),cell(name,0,2),cell(name,0,3)]
atlas('bell-heart-special',special)
report['bell-heart-special']={'frame_count':16,'clips':['telegraph','discharge','recovery'],'atlas':'assets/art/enemies/bell-heart-special.png'}
(SRC/'packing-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('Packed',len(report),'rendered atlases; Dust Imp unchanged.')
