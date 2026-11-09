"""Assemble finished Resonator Vault artwork from *rendered raster* masters.

No vector drawing, procedural geometry, Pillow ImageDraw or dynamically painted
sprites. Operations are cropping, compositing, color grading and transparency
masking of rendered paintings; save the finished master sheets for simple packing.
This corrects the previous shapes-first Phase 26 art generator.
"""
from pathlib import Path
from PIL import Image,ImageEnhance,ImageChops,ImageFilter,ImageOps
import numpy as np

R=Path(__file__).resolve().parents[1]
A=R/'art-source'; U=R/'public/assets/art/upper'
PAINT=Image.open(A/'vault-painted-reference-1.png').convert('RGB')
SCENES=Image.open(A/'vault-painted-reference-2.png').convert('RGB')
POSTER=Image.open(A/'vault-painted-reference-3.png').convert('RGB')
SIZE=128
MATERIAL=['wall','wet-wall','brass-wall','floor','channel-floor','grate-floor','ceiling','seal-door']
SPRITES=['door-open','maintenance-score','copper-valve','copper-valve-on','moon-valve','moon-valve-on','glass-valve','glass-valve-on','echo-shrine','echo-empty','regulator','regulator-empty','rest-alcove','bypass-sign','warning-tablet','chest-closed','chest-open','secret-open','leech-spent','spark-spent','spring','spring-spent','stair-up']

def upper(name):return Image.open(U/(name+'.png')).convert('RGBA')
def rgbgrading(im,r=1,g=1,b=1,contrast=1.0,sat=1):
 arr=np.asarray(im.convert('RGBA')).copy().astype(np.float32)
 arr[...,:3]*=np.array([r,g,b])[None,None,:]
 arr=np.uint8(np.clip(arr,0,255));out=Image.fromarray(arr,'RGBA')
 out=ImageEnhance.Contrast(out).enhance(contrast)
 out=ImageEnhance.Color(out).enhance(sat)
 return out

def scene_crop(im,box,output=(128,128)):
 return im.crop(box).resize(output,Image.Resampling.LANCZOS).convert('RGBA')

def surface(original, ref, strength=.2, grade=(1,1,1)):
 base=rgbgrading(upper(original),*grade,contrast=1.08,sat=1.14)
 if ref:
  # Image texture and brush detail are derived from the original rendered painting.
  gloss=scene_crop(*ref)
  base=Image.blend(base,gloss,strength)
 return base.convert('RGBA')

def tinted(name,r,g,b):return rgbgrading(upper(name),r,g,b,contrast=1.1,sat=1.13)
def opacity(im,alpha):
 out=im.copy();out.putalpha(out.getchannel('A').point(lambda a:int(a*alpha)));return out

def paste_center(base,overlay,scale=.5,offset=(0,0),alpha=.85):
 x=overlay.copy();x.thumbnail((int(SIZE*scale),int(SIZE*scale)),Image.Resampling.LANCZOS)
 x=opacity(x,alpha);dst=base.copy()
 dst.alpha_composite(x,((SIZE-x.width)//2+offset[0],(SIZE-x.height)//2+offset[1]))
 return dst

def variant(im,color,lum=1.16):
 im=rgbgrading(im,*color,contrast=lum,sat=1.16)
 crystal=upper('star');return paste_center(im,crystal,.25,offset=(0,-6),alpha=.57)

materials={
 'wall':surface('wall',(POSTER,(55,72,158,177)),.16,(.96,.9,1.22)),
 'wet-wall':surface('moss-wall',(SCENES,(45,33,170,145)),.22,(.84,.96,1.28)),
 'brass-wall':surface('pipe-wall',(POSTER,(787,68,891,173)),.27,(1.23,.88,1.13)),
 'floor':surface('floor',(POSTER,(109,162,216,220)),.18,(.83,.93,1.16)),
 'channel-floor':surface('grate-floor',(PAINT,(437,114,554,173)),.28,(.78,1.0,1.28)),
 'grate-floor':surface('grate-floor',(POSTER,(678,612,785,678)),.28,(1.03,.97,1.13)),
 'ceiling':surface('ceiling',(POSTER,(160,64,260,160)),.19,(.86,.86,1.17)),
 # The closed Bell-Heart gate is cropped from a rendered fantasy painting, not drawn.
 'seal-door':scene_crop(POSTER,(566,720,730,910))
}

# Transparent rendered props from the illustration pipeline. The three valve
# assemblies are distinct regrades of the rendered waterwheel/piping master,
# with rendered crystal details added for visible alignment states.
valve_base=upper('waterwheel')
valves={
 'copper-valve':rgbgrading(valve_base,1.22,.87,.68,contrast=1.14,sat=1.27),
 'moon-valve':rgbgrading(valve_base,.83,1.02,1.25,contrast=1.16,sat=.86),
 'glass-valve':rgbgrading(valve_base,.67,1.17,1.34,contrast=1.12,sat=1.36)
}
props={}
props['door-open']=rgbgrading(upper('door-open'),.79,.83,1.19)
score=tinted('survey',1.12,.93,1.08)
score=paste_center(score,upper('copper-bell'),.24,(-23,-9),.9)
score=paste_center(score,upper('moon-plaque'),.24,(0,-9),.9)
score=paste_center(score,upper('glass-chime'),.24,(23,-9),.9)
props['maintenance-score']=score
for key,base in valves.items():
 props[key]=base
 if key=='copper-valve':on=variant(base,(1.22,1.12,.79))
 elif key=='moon-valve':on=variant(base,(.94,1.15,1.32))
 else:on=variant(base,(.7,1.35,1.55))
 props[key+'-on']=on
# Echo shrine remains recognizable both before and after collecting the plot item.
echo_base=tinted('glass-chime',.91,1.06,1.24)
props['echo-empty']=echo_base
props['echo-shrine']=paste_center(echo_base,upper('star'),.62,(0,-15),.93)
reg=tinted('mirror',.96,.89,1.22)
props['regulator-empty']=reg
props['regulator']=paste_center(reg,upper('star'),.42,(0,-8),.94)
props['rest-alcove']=tinted('brazier',1.14,.91,1.06)
props['bypass-sign']=tinted('survey',.83,1.07,1.18)
props['warning-tablet']=tinted('banner',1.16,.82,1.16)
props['chest-closed']=tinted('chest-closed',.95,.9,1.13)
props['chest-open']=tinted('chest-open',.95,.9,1.13)
props['secret-open']=tinted('secret-open',.85,.86,1.16)
props['leech-spent']=tinted('needle-spent',.73,1.17,1.29)
props['spark-spent']=tinted('rune-spent',1.17,1.08,1.32)
props['spring']=tinted('spring',.8,1.07,1.32)
props['spring-spent']=rgbgrading(upper('spring'),.68,.71,.81,contrast=.89,sat=.65)
props['stair-up']=tinted('stair-up',.88,.89,1.13)
assert set(props)==set(SPRITES),(set(SPRITES)-set(props),set(props)-set(SPRITES))

# Native sheet size permits pixel-exact extracting with zero geometry heuristics.
master_m=Image.new('RGBA',(4*SIZE,2*SIZE),(0,0,0,0))
for i,k in enumerate(MATERIAL):master_m.alpha_composite(materials[k],((i%4)*SIZE,(i//4)*SIZE))
master_s=Image.new('RGBA',(6*SIZE,4*SIZE),(0,0,0,0))
for i,k in enumerate(SPRITES):master_s.alpha_composite(props[k],((i%6)*SIZE,(i//6)*SIZE))
master_m.save(A/'vault-rendered-materials-master.png')
master_s.save(A/'vault-rendered-props-master.png')
print('Assembled',len(MATERIAL),'surface and',len(SPRITES),'sprite assets from rendered raster paintings/masters, with zero shape drawing')
