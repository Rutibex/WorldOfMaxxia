"""Phase 29: deterministic original 128px RGBA animation cells; no rules/content mutations.
Produce 6 idle / 4 attack / 2 hurt / 4 death for Bell Wraith,
Valve Sentinel and Bell-Heart Custodian; and boss telegraph/discharge/recovery
as 4 frames each in a supplemental 4x4 special atlas.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math, random, json
R=Path(__file__).resolve().parents[1]
OUT=R/'public/assets/art/enemies'; OUT.mkdir(parents=True,exist_ok=True)
SRC=R/'art-source/enemy-batch-three';SRC.mkdir(parents=True,exist_ok=True)
S=128

def C(v,a=255): return tuple(bytes.fromhex(v.lstrip('#')))+(a,)
def image():return Image.new('RGBA',(S,S))
def P(d,points,c,edge='#13212d',w=2):
 ps=[(round(x),round(y)) for x,y in points]
 d.polygon(ps,fill=C(c))
 if edge:d.line(ps+[ps[0]],fill=C(edge),width=w,joint='curve')
def E(d,b,c,outline=None,w=2):d.ellipse(tuple(round(x) for x in b),fill=C(c),outline=C(outline) if outline else None,width=w)
def L(d,ps,c,w=2):d.line([(round(x),round(y)) for x,y in ps],fill=C(c),width=w,joint='curve')
def halo(im,x,y,color,r=27,a=55):
 layer=image();d=ImageDraw.Draw(layer);d.ellipse((x-r,y-r,x+r,y+r),fill=C(color,a));layer=layer.filter(ImageFilter.GaussianBlur(9));im.alpha_composite(layer)
def ground(d,r=37):d.ellipse((64-r,109,64+r,120),fill=C('#080f23',85))
def sparks(d,seed,x,y,color='#b4eaff',num=7,spread=27):
 rnd=random.Random(seed)
 for i in range(num):
  dx=rnd.randrange(-spread,spread+1);dy=rnd.randrange(-spread,spread+1)
  if 4<=x+dx<124 and 4<=y+dy<115:
   L(d,[(x+dx-2,y+dy),(x+dx+2,y+dy)],color,1)
   L(d,[(x+dx,y+dy-2),(x+dx,y+dy+2)],color,1)

def wraith(f):
 mode='idle' if f<6 else 'attack' if f<10 else 'hurt' if f<12 else 'death'
 k=f if f<6 else f-6 if f<10 else f-10 if f<12 else f-12
 im=image();d=ImageDraw.Draw(im);ground(d,29)
 if mode=='death' and k>=1:
  opacity=[150,100,50][k-1]; y=[88,97,107][k-1]
  for j in range(4):
   yy=y-j*5;P(d,[(36+j*6,yy),(63,yy-7),(92-j*4,yy),(74,yy+6)],'#496580','#1c425a',1)
  sparks(d,24+k,65,y,'#9ffffa',max(1,5-k))
  if k==3:d.ellipse((40,108,92,113),fill=C('#a8d9df',opacity))
  return im
 bob=(0,-2,-4,-2,0,2)[k] if mode=='idle' else (0,-5,-10,-4)[k] if mode=='attack' else (3,5)[k] if mode=='hurt' else 2
 shift=(0,0,8,14)[k] if mode=='attack' else 0
 halo(im,64+shift//2,62+bob,'#82cbea',32,50 if mode!='attack' else 90)
 d=ImageDraw.Draw(im)
 # smoky tendrils below a torn spectral shroud
 for i in range(5):
  x=38+i*13; a=math.sin(f*0.75+i*1.4)*5
  P(d,[(x-7,79+bob),(x+10,82+bob),(x+7+a,104+bob),(x-6+a,112+bob)],'#3b5b76','#19314c',1)
  L(d,[(x-3,103+bob),(x+2+a,112+bob)],'#9dc8d3',2)
 P(d,[(44,42+bob),(86,42+bob),(98,74+bob),(83,93+bob),(66,100+bob),(37,89+bob),(27,72+bob)],'#42607d','#152b43',3)
 P(d,[(47,48+bob),(74,47+bob),(91,68+bob),(74,88+bob),(49,86+bob),(37,72+bob)],'#7796aa','#2e5878',2)
 # ghost bell silhouette with cracked lip and suspended clapper
 P(d,[(49,42+bob),(48,30+bob),(54,20+bob),(75,20+bob),(83,31+bob),(82,42+bob)],'#a9c0bc','#324959',2)
 P(d,[(38,44+bob),(44,37+bob),(85,37+bob),(93,44+bob),(89,53+bob),(41,53+bob)],'#a9bea9','#233b55',2)
 E(d,(57,48+bob,71,64+bob),'#21364c','#a3e6e5')
 L(d,[(64,57+bob),(64,76+bob)],'#d8e9d9',3)
 E(d,(59,69+bob,69,78+bob),'#c3cfb4','#274a69')
 # long hooked drifting arms
 for side in (-1,1):
  x=63+side*20
  yy=55+bob
  P(d,[(x,yy),(x+side*17,yy-4),(x+side*(21+shift/3),yy+12),(x+side*(33+shift),yy+17),(x+side*16,yy+24)],'#5d87a3','#193550',2)
  for j in range(3):L(d,[(x+side*(18+shift),yy+21+j*3),(x+side*(26+shift),yy+29+j*3)],'#c1e8e8',2)
 # masked skull and bright eyes
 E(d,(48+shift/5,31+bob,81+shift/5,58+bob),'#d5d2c0','#2d5664',2)
 for x in (54,71): E(d,(x+shift/5,42+bob,x+6+shift/5,49+bob),'#85fff0','#164660',1)
 P(d,[(61,50+bob),(66,50+bob),(64,58+bob)],'#466879','#1d3d51',1)
 if mode=='attack':
  for i in range(k+1):
   d.arc((35-i*3,18-i*2,93+i*3,82+i*2),start=195,end=315,fill=C('#c5ffff',190),width=2)
  sparks(d,f,90+shift,45+bob,'#bafff6',7)
 if mode=='hurt':L(d,[(36,37+bob),(77,73+bob),(51,94+bob)],'#fff0b3',4)
 if mode=='death' and k==0:L(d,[(40,25+bob),(92,89+bob)],'#bffaf2',5)
 return im

def sentinel(f):
 mode='idle' if f<6 else 'attack' if f<10 else 'hurt' if f<12 else 'death'
 k=f if f<6 else f-6 if f<10 else f-10 if f<12 else f-12
 im=image();d=ImageDraw.Draw(im);ground(d,37)
 if mode=='death' and k>=2:
  y=82 if k==2 else 98
  P(d,[(30,y),(44,y-12),(74,y-10),(103,y),(99,109),(36,112)],'#5c686e','#17232b',3)
  E(d,(60,y-16,82,y+3),'#0e3347','#c7a663',2)
  for i in range(5):
   dx=(i-2)*13;P(d,[(58+dx,107),(62+dx,100),(68+dx,106)],'#b5a57d','#233440',1)
  return im
 bob=(0,-1,-2,-1,0,1)[k] if mode=='idle' else (0,-3,-8,-4)[k] if mode=='attack' else (4,7)[k] if mode=='hurt' else 2
 strike=(0,2,17,8)[k] if mode=='attack' else 0
 # pillar legs
 for x in (43,78):
  P(d,[(x-12,77+bob),(x+10,78+bob),(x+13,109),(x-14,109)],'#56606e','#152736',3)
  P(d,[(x-16,104),(x+16,104),(x+17,116),(x-16,116)],'#7e8585','#1d2b34',3)
  L(d,[(x-8,87+bob),(x+7,87+bob)],'#d8b870',3)
 # torso blocks and pressure plates
 P(d,[(38,39+bob),(84,39+bob),(97,84+bob),(34,84+bob)],'#3f4d59','#101f2c',3)
 P(d,[(45,44+bob),(78,44+bob),(88,76+bob),(40,77+bob)],'#83929b','#273947',2)
 for j in range(3):
  y=49+bob+j*9;L(d,[(44,y),(83,y)],'#d3ad66',3)
  for x in (49,77):E(d,(x-2,y-2,x+2,y+2),'#f0d79b','#6b563f',1)
 # central magic valve
 E(d,(52,55+bob,75,78+bob),'#2a5b6e','#d0ae66',3)
 E(d,(59,61+bob,68,70+bob),'#71d9fa','#1c465c',1)
 for ang in range(0,360,90):
  rad=math.radians(ang+f%6*7)
  x=63+math.cos(rad)*11;y=67+bob+math.sin(rad)*11
  L(d,[(63,67+bob),(x,y)],'#e0c68e',2)
 # arms (one lifts for attack)
 arm=(0,0,-14,-6)[k] if mode=='attack' else 0
 P(d,[(34,49+bob),(20,52+bob),(14,79+bob+arm),(30,92+bob+arm),(40,78+bob)],'#6a7981','#1d2f3d',3)
 P(d,[(86,50+bob),(104,45+bob),(113+strike,70+bob+arm),(100+strike,91+bob+arm),(86,82+bob)],'#76858c','#1c303d',3)
 for x in (20,106+strike):
  E(d,(x-11,76+bob+arm,x+11,93+bob+arm),'#8e9694','#263944',2)
 # head = iron bell with gold flanged crest
 P(d,[(43,30+bob),(46,18+bob),(56,11+bob),(74,11+bob),(84,18+bob),(86,30+bob),(80,46+bob),(48,46+bob)],'#707e83','#1b2c3b',3)
 P(d,[(40,23+bob),(89,23+bob),(94,29+bob),(36,29+bob)],'#d0ae6b','#4e453c',2)
 P(d,[(46,33+bob),(82,33+bob),(79,40+bob),(49,40+bob)],'#102c3e','#c0ab7a',2)
 for x in (53,73):E(d,(x,32+bob,x+8,40+bob),'#80e4f7','#1b3948',1)
 if mode=='attack':
  for i in range(4):
   y=65-i*7;L(d,[(102+strike,70+bob+arm),(112+i*3,y+bob+arm)],'#c2f5ff',2)
  sparks(d,f+900,106+strike,66+bob+arm,'#e5ce87',4)
 if mode=='hurt':L(d,[(26,39+bob),(83,83+bob)],'#fff3b0',4)
 if mode=='death' and k==0:L(d,[(45,28+bob),(92,80+bob)],'#e7ecb4',3)
 return im

def boss(f,phase=None):
 if phase:
  mode=phase; k=f
 else:
  mode='idle' if f<6 else 'attack' if f<10 else 'hurt' if f<12 else 'death'
  k=f if f<6 else f-6 if f<10 else f-10 if f<12 else f-12
 im=image();d=ImageDraw.Draw(im);ground(d,42)
 if mode=='death' and k>=2:
  # broken crown / collapsed enormous ribcage
  y=87 if k==2 else 99
  P(d,[(19,y),(36,y-16),(61,y-11),(94,y-14),(114,y+4),(99,115),(31,116)],'#78634b','#162633',3)
  E(d,(54,y-18,83,y+8),'#263c4e','#c5a06a',2)
  sparks(d,198+k,64,y,'#f9ba79',3)
  return im
 bob=(0,-1,-2,-1,0,1)[k] if mode=='idle' else (0,-3,-6,-4)[k] if mode=='attack' else (4,7)[k] if mode=='hurt' else (3 if mode=='death' else 0)
 if phase=='telegraph':bob=(0,-1,-3,-2)[k]
 if phase=='discharge':bob=(-3,-5,-8,-4)[k]
 if phase=='recovery':bob=(2,4,5,3)[k]
 power=phase in ('telegraph','discharge')
 halo(im,64,64+bob,'#f2ad54' if power else '#71bcd9',36,115 if phase=='discharge' else 55 if power else 30)
 d=ImageDraw.Draw(im)
 # broad bronze/iron base and clawed feet
 for x in (40,89):
  P(d,[(x-11,78+bob),(x+11,79+bob),(x+14,110),(x-14,110)],'#5e6369','#162633',3)
  P(d,[(x-16,102),(x+14,104),(x+20,115),(x-18,115)],'#a48a65','#28313a',2)
  for j in range(3):L(d,[(x-12+j*9,109),(x-17+j*10,116)],'#dfc491',2)
 # ribs and central chamber
 P(d,[(26,38+bob),(97,35+bob),(109,79+bob),(99,91+bob),(26,89+bob),(18,71+bob)],'#80664a','#1c2a37',4)
 P(d,[(31,43+bob),(94,41+bob),(100,76+bob),(85,86+bob),(34,86+bob),(27,69+bob)],'#3b4c59','#c4a46f',3)
 for j in range(4):
  yy=45+bob+j*10
  P(d,[(30,yy),(44,yy+3),(54,yy+5),(54,yy+9),(41,yy+7),(29,yy+5)],'#b89b65','#3b3d41',2)
  P(d,[(99,yy-1),(83,yy+3),(75,yy+5),(75,yy+9),(89,yy+7),(101,yy+5)],'#b89b65','#3b3d41',2)
 # ornate toroidal heart core
 E(d,(48,47+bob,81,82+bob),'#a07d53','#ead1a0',3)
 E(d,(53,53+bob,76,76+bob),'#efba58' if power else '#7acbd8','#314657',2)
 E(d,(59,58+bob,70,70+bob),'#fff0ac' if power else '#e0fdff',None,0)
 for a in range(0,360,45):
  r=23; rad=math.radians(a+f*9)
  x=64+math.cos(rad)*r;y=65+bob+math.sin(rad)*r
  E(d,(x-2,y-2,x+3,y+3),'#f5da97' if power else '#9bc9df','#405268',1)
 # arms, shoulders
 for sign in (-1,1):
  x=64+sign*33
  L(d,[(x,42+bob),(x+sign*10,58+bob),(x+sign*13,85+bob)],'#28323c',15)
  L(d,[(x,42+bob),(x+sign*10,58+bob),(x+sign*13,85+bob)],'#9b8361',10)
  P(d,[(x-12,33+bob),(x+12,32+bob),(x+15,48+bob),(x-14,49+bob)],'#b6a174','#35404d',2)
  for j in range(3):
   claw=x+sign*(10+j*6)
   L(d,[(claw,79+bob),(claw+sign*4,91+bob)],'#e4d3a3',3)
 # bell-shaped crown with horns
 P(d,[(42,32+bob),(44,15+bob),(53,8+bob),(75,8+bob),(86,15+bob),(88,32+bob)],'#947e5d','#263443',3)
 for x in (46,79):P(d,[(x-8,19+bob),(x-10,3+bob),(x+4,13+bob)],'#ccad77','#2e3742',2)
 P(d,[(44,33+bob),(85,33+bob),(80,42+bob),(49,42+bob)],'#172c3c','#e5c28a',2)
 for x in (53,70): E(d,(x,31+bob,x+7,39+bob),'#fff7ad' if power else '#91f3fa','#244253',1)
 if mode=='attack':
  angle=(0,8,20,9)[k]
  L(d,[(28,75+bob),(20-angle/3,65+bob),(12,51-angle/2)],'#eac782',3)
  sparks(d,f+200,23,55,'#e8c77b',5)
 if mode=='hurt':L(d,[(36,35+bob),(95,86+bob)],'#f6f8cb',4)
 if mode=='death':
  for i in range(k+1):L(d,[(40-i*6,33),(96-i*5,90)],'#bdfbff',2)
 if phase=='telegraph':
  for j in range(k+1):
   d.arc((17-j*3,25-j*3,111+j*3,106+j*3),190,350,fill=C('#ffde79',205),width=2)
  sparks(d,f+391,64,61,'#ffeaa5',6+k)
 elif phase=='discharge':
  # radiating lightning that visibly crosses the silhouette
  for j in range(12):
   ang=2*math.pi*j/12 + k*.12
   x1=64+math.cos(ang)*25;y1=64+bob+math.sin(ang)*25
   x2=64+math.cos(ang)*(45+5*k);y2=64+bob+math.sin(ang)*(45+5*k)
   x2=max(3,min(124,x2));y2=max(5,min(121,y2))
   L(d,[(x1,y1),((x1+x2)/2+7*math.sin(ang), (y1+y2)/2+7*math.cos(ang)),(x2,y2)],'#fff4ac' if k%2 else '#b5f8ff',2+k//3)
 elif phase=='recovery':
  # exposed pale blue core; drooping arms
  E(d,(46,46+bob,83,84+bob),'#b3e7ec','#ffe7b2',3)
  E(d,(55,55+bob,74,75+bob),'#e2f7ff','#498fa0',2)
  L(d,[(64,40+bob),(61,85+bob)],'#b9fff7',2)
 return im

def atlas(name,render):
 sheet=Image.new('RGBA',(512,512))
 boxes=[];digests=[]
 for i in range(16):
  frame=render(i); boxes.append(frame.getbbox());digests.append(frame.tobytes().__hash__())
  sheet.alpha_composite(frame,((i%4)*S,(i//4)*S))
 assert all(boxes),name
 assert len(set(digests))>8,name
 sheet.save(OUT/f'{name}.png',optimize=True);sheet.save(SRC/f'{name}-master.png',optimize=True)
 return {'frames':16,'canvas':[512,512],'cell':[128,128],'nonempty':True}

report={'bell-wraith':atlas('bell-wraith',wraith),'valve-sentinel':atlas('valve-sentinel',sentinel),'bell-heart':atlas('bell-heart',boss)}
# Supplemental special atlas: 4 telegraph, 4 discharge, 4 recovery, 4 neutral hold cells.
special=Image.new('RGBA',(512,512))
for i in range(16):
 mode='telegraph' if i<4 else 'discharge' if i<8 else 'recovery' if i<12 else 'recovery'
 special.alpha_composite(boss((i%4),mode),((i%4)*S,(i//4)*S))
special.save(OUT/'bell-heart-special.png',optimize=True);special.save(SRC/'bell-heart-special-master.png',optimize=True)
report['bell-heart-special']={'frames':16,'canvas':[512,512],'cell':[128,128],'special_clips':{'telegraph':list(range(4)),'discharge':list(range(4,8)),'recovery':list(range(8,12))}}
(SRC/'asset-manifest.json').write_text(json.dumps({'phase':29,'original':True,'format':'transparent RGBA 4x4 128px cells','standard_clips':{'idle':[0,1,2,3,4,5],'attack':[6,7,8,9],'hurt':[10,11],'death':[12,13,14,15]},'actors':report,'rules_save_changes':False},indent=2)+'\n')
print('Phase 29 original atlases generated:',list(report))
