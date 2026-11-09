"""Generate original, deterministic pixel-art enemy motion atlases.

Each atlas: 4x4 cells of 128px, consistent bottom-center anchor; 6 idle,
4 attack, 2 hurt, 4 death frames. No gameplay content is modified.
Run: python3 scripts/prepare-enemy-art-batch-one.py
"""
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
import math, random, json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/art/enemies'
OUT.mkdir(parents=True,exist_ok=True)
SRC=ROOT/'art-source/enemy-batch-one'
SRC.mkdir(parents=True,exist_ok=True)
CELL=128
R=(lambda x: round(x))

def rgba(hex,a=255):
    hex=hex.lstrip('#')
    return (*tuple(int(hex[i:i+2],16) for i in (0,2,4)),a)

def layer():return Image.new('RGBA',(CELL,CELL),(0,0,0,0))

def poly(d,seq,fill,outline=None,width=1):
    pts=[(int(x),int(y)) for x,y in seq]
    d.polygon(pts,fill=rgba(fill) if isinstance(fill,str) else fill)
    if outline:d.line(pts+[pts[0]], fill=rgba(outline), width=width, joint='curve')

def ell(d,coords,fill,outline=None,width=1):
    d.ellipse(tuple(map(int,coords)),fill=rgba(fill) if isinstance(fill,str) else fill,
              outline=rgba(outline) if isinstance(outline,str) else outline,width=width)

def ln(d,coords,color,width=1):d.line([tuple(map(int,p)) for p in coords],fill=rgba(color) if isinstance(color,str) else color,width=width,joint='curve')

def shadow(im,cx=64,cy=115,r=34):
    sh=layer();d=ImageDraw.Draw(sh)
    for j in range(5,0,-1):
        ell(d,(cx-r-j,cy-3-j//2,cx+r+j,cy+4+j//2),rgba('#051018',max(6,26-j*3)))
    im.alpha_composite(sh)

def noise_in_mask(im,seed,area, density=120, palette=('#a2a3b1','#101c24')):
    rnd=random.Random(seed)
    pixels=im.load();x0,y0,x1,y1=area
    for _ in range(density):
        x=rnd.randint(x0,x1);y=rnd.randint(y0,y1)
        if 0<=x<CELL and 0<=y<CELL and pixels[x,y][3]>240:
            color=rgba(palette[rnd.randrange(len(palette))],rnd.choice([38,65,91]))
            ov=layer();ImageDraw.Draw(ov).point((x,y),fill=color);im.alpha_composite(ov)

def stone_mite(frame):
    im=layer();d=ImageDraw.Draw(im)
    mode='idle' if frame<6 else 'attack' if frame<10 else 'hurt' if frame<12 else 'death'
    idx=frame if mode=='idle' else frame-6 if mode=='attack' else frame-10 if mode=='hurt' else frame-12
    phase=frame*math.pi/3
    bob=(0,1,2,1,0,-1)[frame] if mode=='idle' else (0,-1,-5,-2)[idx] if mode=='attack' else (2,3)[idx] if mode=='hurt' else (0,7,12,14)[idx]
    lunge=(0,5,11,7)[idx] if mode=='attack' else 0
    damage=mode=='hurt';dead=mode=='death'
    shadow(im,64,115,37)
    d=ImageDraw.Draw(im)
    # bodies get crushed through four death frames, staying anchored in world space
    if dead:
        pieces=[(49,86,79,106),(27,95,52,113),(81,94,105,113)]
        if idx==0:
            im=stone_mite(10);d=ImageDraw.Draw(im)
            ln(d,[(42,54),(66,72),(53,82)],'#ffdeab',3)
            ln(d,[(71,52),(60,70),(78,84)],'#1b2128',3)
        else:
            for j,(x0,y0,x1,y1) in enumerate(pieces):
                y0+=min(9,idx*3);y1+=min(9,idx*3)
                col=['#4e6570','#6c7b83','#34434d'][j]
                poly(d,[(x0,y0),(x1-7,y0-6),(x1,y1-10),(x0+7,y1)],col,'#121d26',2)
                ln(d,[(x0+4,y0+3),(x1-8,y1-11)],'#a7b3af',2)
            if idx>=2:
                for j in range(13):
                    rr=random.Random(100+j).random()
                    x=R(24+j*7.3);y=R(99+(j%3)*5)
                    ell(d,(x,y,x+2,y+2),rgba('#8ca7ae',70 if idx==3 else 170))
        return im
    y=bob
    # six stilted claw/rock legs behind shell
    for side in (-1,1):
        for j in range(3):
            cx=64+side*(15+j*11)+lunge//3
            ankle_x=cx+side*(10+j*2+(5 if mode=='attack' and idx==2 else 0))
            ankle_y=102+((j+frame)%3 if mode=='idle' else 0)
            joints=[(cx,76+y),(cx+side*(7+j),87+y),(ankle_x,ankle_y)]
            ln(d,joints,'#101e26',8)
            ln(d,joints,'#6e7f83',5)
            poly(d,[(ankle_x-4,ankle_y-1),(ankle_x+side*8,ankle_y-4),(ankle_x+side*5,ankle_y+6)],'#adb8ae','#1f2d30',1)
            ell(d,(cx-2,78+y,cx+3,83+y),'#b2a987','#263842')
    # underside and front gripping mandibles
    ell(d,(33+lunge,68+y,95+lunge,99+y),'#24313b','#0d1820',3)
    for sx in (-1,1):
        ant=65+sx*22+lunge
        poly(d,[(ant,78+y),(ant+sx*12,83+y),(ant+sx*20,99+y),(ant+sx*9,95+y)],'#5a7079','#15212b',2)
        poly(d,[(ant+sx*18,95+y),(ant+sx*28,99+y),(ant+sx*18,105+y)],'#c9bd97','#172832',1)
    # segmented stony shell in a rough beetle shape
    shell=[(22+lunge,70+y),(27+lunge,54+y),(40+lunge,44+y),(55+lunge,40+y),(72+lunge,43+y),(88+lunge,51+y),(103+lunge,69+y),(92+lunge,88+y),(68+lunge,93+y),(46+lunge,89+y)]
    poly(d,shell,'#364b57','#0a151d',3)
    poly(d,[(27+lunge,66+y),(39+lunge,51+y),(57+lunge,46+y),(70+lunge,50+y),(63+lunge,79+y),(45+lunge,84+y)],'#77898c','#283a45',2)
    poly(d,[(70+lunge,47+y),(86+lunge,53+y),(98+lunge,70+y),(88+lunge,83+y),(65+lunge,81+y)],'#556d78','#223543',2)
    for p in ((37,53),(51,46),(79,51),(93,69)):
        x,yy=p;poly(d,[(x+lunge,yy+y),(x+8+lunge,yy+1+y),(x+4+lunge,yy-9+y)],'#a3b1af','#253440',1)
    ln(d,[(65+lunge,49+y),(62+lunge,76+y),(69+lunge,88+y)],'#142936',2)
    ln(d,[(40+lunge,58+y),(52+lunge,62+y),(47+lunge,77+y)],'#aeb4ad',2)
    ln(d,[(74+lunge,55+y),(83+lunge,64+y),(76+lunge,76+y)],'#93a3a9',2)
    # face/eye plates
    ell(d,(38+lunge,69+y,56+lunge,84+y),'#0b1c28','#b88a49',2)
    ell(d,(75+lunge,69+y,93+lunge,84+y),'#0b1c28','#b88a49',2)
    eye_glow='#ffead3' if damage else '#73f1dd'
    ell(d,(44+lunge,74+y,52+lunge,81+y),eye_glow,'#246675')
    ell(d,(79+lunge,74+y,87+lunge,81+y),eye_glow,'#246675')
    for p in [(49,63),(59,69),(81,60)]:
        xx,yy=p;ell(d,(xx+lunge-1,yy+y,xx+lunge+1,yy+y+1),'#c9c6ad')
    # battle effects
    if mode=='attack':
        j=idx
        if j>0:
            ln(d,[(104,74),(113,66-j*7),(123,64-j*12)],rgba('#71f5ea',100+j*30),2+j)
            ln(d,[(112,62-j*7),(121,69-j*5)],'#d3ffff',2)
    if damage:
        ell(d,(48+lunge,50+y,73+lunge,70+y),rgba('#fbdfba',105))
        ln(d,[(40,49+y),(67,61+y),(54,83+y)],'#f3d3a8',2)
    noise_in_mask(im,frame+410,(25,44,101,93),190,('#cad1bb','#111b26','#cdbf9e'))
    return im

def watcher(frame):
    im=layer();d=ImageDraw.Draw(im)
    mode='idle' if frame<6 else 'attack' if frame<10 else 'hurt' if frame<12 else 'death'
    idx=frame if mode=='idle' else frame-6 if mode=='attack' else frame-10 if mode=='hurt' else frame-12
    bob=(0,-1,0,2,1,-1)[frame] if mode=='idle' else (0,-2,-4,0)[idx] if mode=='attack' else (1,4)[idx] if mode=='hurt' else (0,9,13,15)[idx]
    angle=(-3,0,3,2,-2,-1)[frame] if mode=='idle' else 0
    lunge=(0,5,12,2)[idx] if mode=='attack' else 0
    shadow(im,64,115,26)
    d=ImageDraw.Draw(im)
    if mode=='death' and idx>=1:
        # collapsed stone helm, shattered eye, severed chain links
        for j,p in enumerate([[(35,99),(59,86),(77,99),(62,112)],[(76,95),(95,101),(86,114),(69,109)],[(40,102),(48,100),(56,114),(35,115)]]):
            off=idx*2
            poly(d,[(x,y+off) for x,y in p],['#42546e','#695878','#817265'][j],'#111b2a',2)
            ln(d,[(p[0][0],p[0][1]+off),(p[2][0],p[2][1]+off)],'#b5af9c',2)
        ell(d,(53,101,74,111),'#cb9a50','#392b2b',2)
        if idx==3:
            for x,y in [(28,106),(100,113),(92,92),(35,96)]:ell(d,(x,y,x+2,y+2),rgba('#e0ae6e',145))
        return im
    y=bob;cx=63+lunge
    # rear hovering cloak with ragged hem
    poly(d,[(cx-25,55+y),(cx+18,48+y),(cx+34,70+y),(cx+35,100+y),(cx+22,93+y),(cx+10,108+y),(cx-5,99+y),(cx-26,110+y),(cx-38,99+y)],'#342c53','#15172d',3)
    poly(d,[(cx-21,56+y),(cx+3,61+y),(cx-6,104+y),(cx-32,96+y)],'#634b79','#2a264b',2)
    poly(d,[(cx+7,61+y),(cx+25,66+y),(cx+29,92+y),(cx+16,100+y)],'#4a3d67','#1d213b',2)
    for side in (-1,1):
        # dangling floating arm/chain with articulated gauntlets
        hx=cx+side*26;hy=57+y
        armx=hx+side*(10+(3 if mode=='attack' else 0));army=76+y-(7 if mode=='attack' else 0)
        ln(d,[(hx,hy),(hx+side*5,67+y),(armx,army)],'#182433',9)
        ln(d,[(hx,hy),(hx+side*5,67+y),(armx,army)],'#a89f87',5)
        for k in range(3):
            ell(d,(armx-3+side*k,army-1+k*4,armx+4+side*k,army+4+k*4),'#7c8fa0','#303a48')
        poly(d,[(armx-8,army+9),(armx+7,army+8),(armx+5,army+24),(armx-7,army+21)],'#9d9aa1','#283043',2)
        for k in range(3):ln(d,[(armx-5+k*4,army+22),(armx-6+k*4,army+29)],'#d5c8ab',2)
    # shoulder guards bronze
    for side in (-1,1):
        x=cx+side*25
        ell(d,(x-10,53+y,x+11,70+y),'#836c56','#242338',3)
        poly(d,[(x-7,56+y),(x+4,55+y),(x+8,63+y),(x-5,65+y)],'#c0ae85','#584956',1)
    # floating torc, stone mask face, golden eye
    ell(d,(cx-25,24+y,cx+25,75+y),'#344658','#0f192d',3)
    poly(d,[(cx-23,47+y),(cx-20,28+y),(cx-6,22+y),(cx+17,27+y),(cx+26,47+y),(cx+17,70+y),(cx-11,74+y)],'#8c8390','#24263b',3)
    poly(d,[(cx-17,33+y),(cx-6,24+y),(cx+13,33+y),(cx+18,48+y),(cx-12,48+y)],'#b4aaa3','#4a465a',2)
    poly(d,[(cx-13,51+y),(cx+16,52+y),(cx+10,68+y),(cx-8,65+y)],'#565a6f','#2b3041',2)
    # cracks
    ln(d,[(cx-16,32+y),(cx-6,44+y),(cx-12,54+y)],'#2a2638',2)
    ln(d,[(cx+15,39+y),(cx+8,48+y),(cx+14,57+y)],'#282633',2)
    # central ominous gemstone eye
    eye_y=46+y
    ell(d,(cx-14,eye_y-9,cx+14,eye_y+8),'#272330','#ddb778',3)
    ell(d,(cx-10,eye_y-7,cx+9,eye_y+6),'#e9b964','#4f3c29',2)
    pupil=cx+int(3*math.sin(frame*math.pi/3)) if mode=='idle' else cx+3
    ell(d,(pupil-5,eye_y-5,pupil+4,eye_y+6),'#183642','#283a44',2)
    ell(d,(pupil-3,eye_y-5,pupil-1,eye_y-3),'#bdf8e1')
    # crown-spikes arranged in an arc
    for i in range(7):
        theta=(190+i*27)*math.pi/180
        x=cx+29*math.cos(theta);yy=48+y+28*math.sin(theta)
        tip=(x+8*math.cos(theta),yy+9*math.sin(theta))
        poly(d,[(x-3,yy+4),(x+3,yy+4),tip],'#c1a775','#3d3647',1)
    ln(d,[(cx-20,27+y),(cx,16+y),(cx+21,27+y)],'#dfc88a',3)
    # binding chains across collar
    for i in range(4):
        xx=cx-14+i*10
        ell(d,(xx-4,70+y,xx+4,78+y),'#655a66','#c4ad86',2)
    # attack: dark floating energy ribbons, several advance states
    if mode=='attack' and idx>0:
        r=idx*4
        for i in range(3):
            sx=cx-26+i*26
            ln(d,[(sx,84+y),(sx+(i-1)*7,68+y-r),(sx+(i-1)*12,47+y-r)],rgba('#a878e7',200),4)
            ln(d,[(sx,84+y),(sx+(i-1)*8,66+y-r)],'#e6ddff',2)
            ell(d,(sx-3,62-r+y,sx+5,70-r+y),rgba('#c2faff',160))
    if mode=='hurt':
        for i in range(4):
            sx=28+i*19
            ln(d,[(sx,45),(sx+5,56),(sx-2,62)],rgba('#ffe6b7',190),2)
    noise_in_mask(im,frame+625,(30,22,102,110),125,('#d6c4ab','#141c38','#9578af'))
    return im

specs={
 'stone-mite':stone_mite,
 'gallery-watcher':watcher,
}
for name,fn in specs.items():
    atlas=Image.new('RGBA',(4*CELL,4*CELL),(0,0,0,0))
    for idx in range(16):
        frame=fn(idx)
        atlas.alpha_composite(frame,((idx%4)*CELL,(idx//4)*CELL))
    atlas.save(OUT/f'{name}.png')
    # Original authored master is retained for re-packing/review.
    atlas.save(SRC/f'{name}-master.png')
    print('Built', name,atlas.size, (OUT/f'{name}.png').stat().st_size)

# Optional contact sheet for visual review, cells are individually selectable in gallery.
contact=Image.new('RGBA',(4*CELL,8*CELL),(16,26,35,255))
for index,name in enumerate(specs):
    atlas=Image.open(OUT/f'{name}.png')
    contact.alpha_composite(atlas,(0,index*4*CELL))
contact.convert('RGB').save(ROOT/'docs/PHASE27_ENEMY_ATLAS_REVIEW.png')
(SRC/'asset-manifest.json').write_text(json.dumps({
 'phase':27,'cell':CELL,'columns':4,'rows':4,'enemyKinds':['dust_imp','stone_mite','gallery_watcher'],
 'newAtlases':list(specs),
 'clips':{'idle':[0,1,2,3,4,5],'attack':[6,7,8,9],'hurt':[10,11],'death':[12,13,14,15]},
 'notes':'Deterministically authored original full-colour painted-pixel fantasy silhouettes. Existing Dust Imp master from Phase 20 retained unchanged.'
},indent=2)+'\n')
