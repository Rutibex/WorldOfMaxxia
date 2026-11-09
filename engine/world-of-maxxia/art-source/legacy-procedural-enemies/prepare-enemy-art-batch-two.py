"""Phase 28: reproducible, original 4x4 animation atlases for three existing vault monsters.
Six idle + four attack + two hurt + four death frames; 128x128 transparent cells.
Run: python3 scripts/prepare-enemy-art-batch-two.py
No gameplay/state content is modified.
"""
from __future__ import annotations
from PIL import Image, ImageDraw
from pathlib import Path
from math import sin, cos, pi
import random, json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/art/enemies'; SRC=ROOT/'art-source/enemy-batch-two';OUT.mkdir(parents=True,exist_ok=True);SRC.mkdir(parents=True,exist_ok=True)
N=128

def col(c,a=255):return tuple(bytes.fromhex(c.strip('#')))+(a,)
def canvas():return Image.new('RGBA',(N,N),(0,0,0,0))
def poly(d,coords,c,outline='#101c25',th=2):
 coords=[(int(x),int(y)) for x,y in coords]
 d.polygon(coords,fill=col(c))
 if outline:d.line(coords+[coords[0]],fill=col(outline),width=th,joint='curve')
def ellipse(d,box,c,outline=None,width=1):
 d.ellipse([int(t) for t in box],fill=col(c) if isinstance(c,str) else c,outline=col(outline) if outline else None,width=width)
def line(d,coords,c,width=2):d.line([(int(x),int(y)) for x,y in coords],fill=col(c) if isinstance(c,str) else c,width=width,joint='curve')
def shadow(d,width=30):ellipse(d,(64-width,114,64+width,120),col('#061019',75))
def debris(d,seed,mid=99,colors=('#638289','#ad9e75','#304653')):
 rnd=random.Random(seed)
 for i in range(18):
  x=rnd.randint(20,107);y=rnd.randint(mid,116)
  ellipse(d,(x,y,x+rnd.randint(1,3),y+rnd.randint(1,2)),col(rnd.choice(colors),160))

def rat(f):
 mode='idle' if f<6 else 'attack' if f<10 else 'hurt' if f<12 else 'death'; k= f if f<6 else f-6 if f<10 else f-10 if f<12 else f-12
 im=canvas();d=ImageDraw.Draw(im);shadow(d,37)
 if mode=='death' and k>=1:
  collapse=[(34,82,105,111),(30,91,103,110),(28,99,110,113)][k-1]
  ellipse(d,collapse,'#4b515b','#202a32',2)
  for a in range(4):line(d,[(40+a*12,105),(34+a*12,113)],'#c6b69c',2)
  line(d,[(105,103),(120,108),(118,113)],'#79615a',3)
  if k==3:debris(d,381)
  return im
 bob=[0,-1,-2,-1,0,1][k] if mode=='idle' else [0,-2,-6,-3][k] if mode=='attack' else [4,6][k] if mode=='hurt' else 4
 reach=0 if mode!='attack' else [0,5,12,7][k]
 # tail moves in the idle cycle; the curve terminates inside 128px
 wave=round(sin(f*pi/3)*9)
 line(d,[(35,94+bob),(23,89+bob+wave//2),(12,72+bob+wave),(10,62+bob+wave//2)],'#1b2730',11)
 line(d,[(35,94+bob),(23,89+bob+wave//2),(12,72+bob+wave),(10,62+bob+wave//2)],'#8b6774',7)
 line(d,[(14,65+bob+wave//2),(10,62+bob+wave//2)],'#d1a0a4',3)
 # feet
 for x,s in [(36,-1),(56,-1),(82,1),(95,1)]:
  y=98+bob+(1 if mode=='idle' and (f+x)%3==0 else 0)
  poly(d,[(x-5,y-10),(x+5,y-10),(x+s*7,y+7),(x+s*13,y+9)],'#7e6f64','#1f262b')
  for i in range(3):line(d,[(x+s*8+i*2,y+8),(x+s*13+i*2,y+11)],'#d5c7aa',2)
 # body patchy grey-green wet fur
 ellipse(d,(29+reach//3,61+bob,98+reach//3,106+bob),'#58636b','#15232e',3)
 poly(d,[(35,79+bob),(50,62+bob),(74,61+bob),(92,73+bob),(89,98+bob),(49,99+bob)],'#839398','#31454d',2)
 for y in (70,77,84,90):
  for x in (48,60,73,84):
   if (x+y+f)%3:line(d,[(x+reach//3,y+bob),(x-3+reach//3,y+4+bob)],'#9ba49c',1)
 # angular snout
 poly(d,[(76+reach,62+bob),(101+reach,69+bob),(116+reach,84+bob),(99+reach,94+bob),(72+reach,83+bob)],'#626b73','#20262e',2)
 ellipse(d,(106+reach,81+bob,116+reach,88+bob),'#d8a1a0','#241a24',2)
 # ears, with scarred pink interiors
 ellipse(d,(49+reach,45+bob,73+reach,69+bob),'#6b6475','#1a2a30',2)
 ellipse(d,(55+reach,49+bob,66+reach,61+bob),'#af858f')
 ellipse(d,(79+reach,49+bob,99+reach,70+bob),'#686774','#1a292e',2)
 ellipse(d,(84+reach,54+bob,93+reach,65+bob),'#b5848c')
 # yellow-bead eyes and fang
 ellipse(d,(91+reach,68+bob,102+reach,79+bob),'#edc975','#19272f',2)
 ellipse(d,(96+reach,70+bob,99+reach,75+bob),'#142229')
 poly(d,[(107+reach,88+bob),(112+reach,88+bob),(109+reach,96+bob)],'#f7e4c0','#38454f',1)
 for dy in (-5,2,9):
  line(d,[(102+reach,83+bob),(119,83+bob+dy)],'#d5c9b5',1)
 if mode=='attack' and k>=1:
  line(d,[(92,91),(109,85),(121,81-k*3)],col('#edf3c9',120),2)
  line(d,[(100,98),(117,91),(124,90)],col('#d9e8e6',100),2)
 if mode=='hurt':
  line(d,[(80,51+bob),(99,65+bob),(83,79+bob)],'#fff0a0',3)
  ellipse(d,(75,58+bob,85,69+bob),col('#ffc66d',150))
 if mode=='death' and k==0:line(d,[(49,48+bob),(91,103+bob)],'#f8dfb0',4)
 return im

def leech(f):
 mode='idle' if f<6 else 'attack' if f<10 else 'hurt' if f<12 else 'death';k= f if f<6 else f-6 if f<10 else f-10 if f<12 else f-12
 im=canvas();d=ImageDraw.Draw(im);shadow(d,36)
 if mode=='death' and k>=1:
  height=[29,16,10][k-1]
  ellipse(d,(22,111-height,107,117),'#304f51','#0a2532',2)
  line(d,[(34,112-height//2),(63,104-height//3),(100,113)],'#9e8c6d',2)
  if k>1:debris(d,f+100,108,('#4c998c','#7ad8c1','#2b4f68'))
  return im
 coil=[0,-3,-5,-3,0,2][k] if mode=='idle' else [0,-5,-15,-7][k] if mode=='attack' else [5,8][k] if mode=='hurt' else 2
 thrust=[0,5,13,7][k] if mode=='attack' else 0
 # suction-laden serpentine bottom body with ribs
 outline=[(22,103),(31,87+coil),(39,75+coil),(51,71+coil),(62,76+coil),(72,83+coil),(83,72+coil),(95,65+coil),(108+thrust,62+coil),(113+thrust,79+coil),(104,94),(94,108),(70,113),(49,108),(35,113)]
 poly(d,outline,'#31545f','#0b2736',3)
 poly(d,[(28,102),(41,83+coil),(57,82+coil),(65,92+coil),(82,94+coil),(103+thrust,77+coil),(102,97),(78,109),(51,104)],'#4a8482','#1c3d4a',2)
 for x in range(36,100,9):
  y=90+int(4*sin((x+f*4)/11))+coil//2
  line(d,[(x,y),(x+2,y+10)],'#a0b59b',2)
  ellipse(d,(x,y+8,x+4,y+12),'#b9a283','#2c4950')
 # strange green slime bulges
 for i,(x,y) in enumerate([(39,86),(51,78),(66,83),(81,88),(94,77)]):
  yy=y+coil//2
  ellipse(d,(x-5,yy-5,x+5,yy+5),'#7bada1','#1a494c')
  ellipse(d,(x-2,yy-3,x+1,yy),'#d9dabc')
 # main maw; opens to lunge
 hx=101+thrust;hy=63+coil
 ellipse(d,(hx-13,hy-17,hx+12,hy+18),'#708b80','#172c3e',3)
 elliptical= (hx-9,hy-12,hx+8,hy+12+(k*2 if mode=='attack' else 0))
 ellipse(d,elliptical,'#240f31','#9dbdb4',3)
 for angle in range(0,360,45):
  x=hx+cos(angle*pi/180)*9;y=hy+sin(angle*pi/180)*13
  px=x+cos(angle*pi/180)*4;py=y+sin(angle*pi/180)*3
  poly(d,[(x-2,y-1),(x+2,y-1),(px,py)],'#f2e0bd','#4a6c75',1)
 ellipse(d,(hx-3,hy-3,hx+1,hy+2),'#b44b7f')
 if mode=='attack' and k>=1:
  for j in range(5):
   px=112+j*3;py=62+coil+(j%3)*5
   ellipse(d,(px,py,px+2+(k%2),py+3),col('#74dfc1',180))
 if mode=='hurt':
  line(d,[(63,55+coil),(81,79+coil),(59,92+coil)],'#ffd4a5',3)
 if mode=='death' and k==0:
  line(d,[(32,80),(92,53)],'#c6eff2',4)
 return im

def goblin(f):
 mode='idle' if f<6 else 'attack' if f<10 else 'hurt' if f<12 else 'death';k= f if f<6 else f-6 if f<10 else f-10 if f<12 else f-12
 im=canvas();d=ImageDraw.Draw(im);shadow(d,29)
 if mode=='death' and k>=1:
  y=[88,95,101][k-1]
  poly(d,[(29,y),(76,y-10),(100,y+12),(39,y+17)],'#62745b','#1b2933',3)
  ellipse(d,(48,y-20,78,y+2),'#8eae77','#16272d',2)
  poly(d,[(68,y-10),(80,y-10),(84,y-20),(68,y-20)],'#9f8e67','#25303b')
  if k==3:debris(d,54,101,('#c1ad7e','#6c965e','#323f39'))
  return im
 bob=[0,-1,-2,-1,0,1][k] if mode=='idle' else [0,-2,-6,-3][k] if mode=='attack' else [5,7][k] if mode=='hurt' else 2
 lunge=[0,2,10,6][k] if mode=='attack' else 0
 # left hand weapon — rusted steam wrench and pipe spear
 line(d,[(28+lunge,107+bob),(39+lunge,43+bob),(53+lunge,23+bob)],'#1d282e',8)
 line(d,[(28+lunge,107+bob),(39+lunge,43+bob),(53+lunge,23+bob)],'#b5a27a',4)
 poly(d,[(49+lunge,18+bob),(61+lunge,14+bob),(67+lunge,26+bob),(58+lunge,34+bob),(58+lunge,26+bob)],'#9bacae','#233841',2)
 # feet heavy boots and knee guards
 for x,y,s in [(48,104,-1),(79,104,1)]:
  poly(d,[(x-7,83+bob),(x+6,84+bob),(x+9+s*3,106+bob),(x-9+s*4,109+bob)],'#55504c','#15232c',2)
  poly(d,[(x-10+s*3,103+bob),(x+12+s*5,105+bob),(x+13+s*5,114),(x-12+s*2,114)],'#645d50','#14232d',2)
  line(d,[(x-5,106+bob),(x+8,106+bob)],'#bca571',2)
 # lean body, leather coat, riveted pipe shoulder armor
 poly(d,[(41+lunge,60+bob),(84+lunge,57+bob),(95+lunge,97+bob),(38+lunge,98+bob)],'#463d3e','#151e29',3)
 poly(d,[(44+lunge,61+bob),(65+lunge,70+bob),(58+lunge,98+bob),(41+lunge,93+bob)],'#75684f','#272930',2)
 poly(d,[(67+lunge,69+bob),(84+lunge,59+bob),(91+lunge,92+bob),(63+lunge,99+bob)],'#706352','#242a30',2)
 for y in (74,82,90):
  line(d,[(52+lunge,y+bob),(80+lunge,y+3+bob)],'#d4ae70',2)
  ellipse(d,(65+lunge,y-2+bob,71+lunge,y+3+bob),'#d9c18b','#55402b',1)
 # weapon arm
 poly(d,[(42+lunge,63+bob),(26+lunge,66+bob),(25+lunge,82+bob),(35+lunge,91+bob),(45+lunge,84+bob)],'#799a69','#25323a',2)
 ellipse(d,(20+lunge,83+bob,39+lunge,99+bob),'#8eaa78','#22323a',2)
 # pointing gauntlet / attack claw
 ang= -4 if mode!='attack' else [0,-6,-16,-10][k]
 poly(d,[(82+lunge,65+bob),(101+lunge,70+bob+ang),(107+lunge,88+bob+ang),(90+lunge,88+bob)],'#718e6e','#1b2930',2)
 poly(d,[(99+lunge,78+bob+ang),(115+lunge,76+bob+ang),(117+lunge,87+bob+ang),(102+lunge,94+bob+ang)],'#8c9d80','#24323b',2)
 for j in range(3):line(d,[(109+lunge+j*3,88+bob+ang),(113+lunge+j*3,93+bob+ang)],'#e2d9bb',2)
 # head, long pointed ears, goggles and spiked helmet
 poly(d,[(40+lunge,39+bob),(20+lunge,24+bob),(38+lunge,50+bob),(46+lunge,62+bob)],'#6b986f','#26333c',2)
 poly(d,[(90+lunge,39+bob),(112+lunge,25+bob),(96+lunge,55+bob),(85+lunge,61+bob)],'#739770','#26343c',2)
 ellipse(d,(40+lunge,26+bob,93+lunge,68+bob),'#779d71','#1c2d32',3)
 poly(d,[(39+lunge,37+bob),(44+lunge,19+bob),(72+lunge,14+bob),(94+lunge,26+bob),(98+lunge,44+bob)],'#424753','#15232b',3)
 for x in (54,73,88):
  poly(d,[(x+lunge,22+bob),(x+4+lunge,8+bob),(x+8+lunge,22+bob)],'#c4b18a','#26343a',2)
 line(d,[(46+lunge,43+bob),(90+lunge,43+bob)],'#b1a574',4)
 # eye lenses and snout
 for x in (48,72):
  ellipse(d,(x+lunge,40+bob,x+19+lunge,55+bob),'#c2ad72','#252f34',2)
  ellipse(d,(x+3+lunge,43+bob,x+16+lunge,52+bob),'#f8d365','#313a3a',1)
  ellipse(d,(x+9+lunge,45+bob,x+12+lunge,50+bob),'#1d2b2d')
 poly(d,[(64+lunge,52+bob),(77+lunge,57+bob),(70+lunge,64+bob)],'#a4bb85','#254036',2)
 line(d,[(63+lunge,67+bob),(80+lunge,65+bob)],'#332b2c',2)
 if mode=='attack' and k>=1:
  line(d,[(102,54),(112,46-k*3),(121,42-k*4)],col('#b3f4df',160),2+k//2)
  ellipse(d,(114,46-k*4,119,52-k*4),col('#f2e3b1',165))
 if mode=='hurt':
  line(d,[(53,24+bob),(81,63+bob),(61,86+bob)],'#f8e4be',4)
 if mode=='death' and k==0:line(d,[(35,39),(99,94)],'#f5e8b7',4)
 return im

creatures={'cistern-rat':rat,'sludge-leech':leech,'pipe-goblin':goblin}
report={}
for name,fn in creatures.items():
 atlas=Image.new('RGBA',(512,512),(0,0,0,0))
 for i in range(16):atlas.alpha_composite(fn(i),((i%4)*N,(i//4)*N))
 atlas.save(OUT/f'{name}.png',optimize=True)
 atlas.save(SRC/f'{name}-master.png',optimize=True)
 # Ensure all 16 frames have opaque footprint and all 4 states differ visually.
 boxes=[fn(i).getbbox() for i in range(16)]
 report[name]={'size':atlas.size,'frames':16,'clip_sizes':{'idle':6,'attack':4,'hurt':2,'death':4},'all_frames_nonempty':all(b is not None for b in boxes),'bbox':boxes}
manifest={'phase':28,'frames':'6 idle / 4 attack / 2 hurt / 4 death','cell':[128,128],'columns':4,'rows':4,'actors':report,'style':'original old-school fantasy 1990s pixel art, transparent RGBA, consistent ground anchor, no changes to gameplay'}
(SRC/'asset-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Produced three Phase 28 enemy atlases at',OUT)
