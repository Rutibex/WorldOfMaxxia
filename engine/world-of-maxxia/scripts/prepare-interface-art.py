"""Pack Phase 21 generated artwork and bundled fonts. Requires Pillow and fontTools.
Run python3 scripts/prepare-interface-art.py; regenerate public assets before building.
Original generated masters are preserved; crop/resize is nearest-neighbour.
"""
from pathlib import Path
from PIL import Image
from fontTools.ttLib import TTFont
import shutil,base64
p=Path(__file__).resolve().parents[1];s=p/'art-source';out=p/'public/assets/art';(out/'portraits').mkdir(exist_ok=True);(out/'ui').mkdir(exist_ok=True)
# Generated row boundaries are registered once, not inferred independently per character.
for state in ['normal','hurt','afflicted']:
 im=Image.open(s/f'portraits-{state}-master.png');rows=[0,round(im.height*.326),round(im.height*.653),im.height]
 for i in range(12):
  if i==5:continue # Keep the completed Phase 20 Witch bytes and ID.
  cell=im.crop((round(i%4*im.width/4),rows[i//4],round((i%4+1)*im.width/4),rows[i//4+1]));cell.resize((58,70),Image.Resampling.NEAREST).save(out/'portraits'/f'{i:02}-{state}.png')
for i in range(12):
 if i!=5:shutil.copy2(out/'witch-dead.png',out/'portraits'/f'{i:02}-dead.png')
im=Image.open(s/'interface-materials-master.png')
for name,box,size in [('stone',(0,0,512,508),(128,128)),('button',(512,0,1024,508),(64,64)),('parchment',(1024,0,1536,508),(256,256)),('portrait-frame',(0,512,512,994),(96,112)),('panel',(512,512,1024,994),(128,128)),('parchment-panel',(1024,512,1536,994),(256,256))]:im.crop(box).resize(size,Image.Resampling.NEAREST).save(out/'ui'/f'{name}.png')
im=Image.open(s/'interface-ornaments-master.png').convert('RGBA')
for name,bounds,size in [('gargoyle',(30,0,672,724),(128,76)),('ruby',(672,0,1130,724),(32,32)),('amethyst',(1130,0,1615,724),(40,40)),('compass',(1615,0,2172,724),(64,64))]:
 cell=im.crop(bounds);cell=cell.crop(cell.getbbox());cell.thumbnail(size,Image.Resampling.NEAREST);canvas=Image.new('RGBA',size);canvas.alpha_composite(cell,((size[0]-cell.width)//2,(size[1]-cell.height)//2));canvas.save(out/'ui'/f'{name}.png')
Image.open(s/'title-harbour-master.png').resize((640,400),Image.Resampling.NEAREST).save(out/'ui/title-harbour.png')
# Exact native frame geometry; raster material is embedded so SVG loads independently.
texture=base64.b64encode((out/'ui/stone.png').read_bytes()).decode()
holes=[(8,8,440,280),(456,8,176,136),(456,152,176,136),(8,304,440,88),(456,304,176,88)]
cut=''.join(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="black"/>' for x,y,w,h in holes)
edges=''.join(f'<rect x="{x-2}" y="{y-2}" width="{w+4}" height="{h+4}" fill="none" stroke="#171f25" stroke-width="3"/><rect x="{x-1}" y="{y-1}" width="{w+2}" height="{h+2}" fill="none" stroke="#b5a675" stroke-width="1"/>' for x,y,w,h in holes)
(out/'ui/frame.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><defs><pattern id="stone" width="128" height="128" patternUnits="userSpaceOnUse"><image href="data:image/png;base64,{texture}" width="128" height="128"/></pattern><mask id="cut"><rect width="640" height="400" fill="white"/>{cut}</mask></defs><g mask="url(#cut)"><rect width="640" height="400" fill="url(#stone)"/>{edges}<rect x="1" y="1" width="638" height="398" fill="none" stroke="#9b997f" stroke-width="2"/></g></svg>')
fontdir=p/'public/assets/fonts';fontdir.mkdir(exist_ok=True)
for name,file in [('maxxia-serif','DejaVuSerif.ttf'),('maxxia-mono','DejaVuSansMono.ttf')]:
 font=TTFont(s/'fonts'/file);font.flavor='woff';font.save(fontdir/(name+'.woff'))
# License text is retained under licenses/DejaVu-Fonts.txt.
print('Packed 44 new portrait state files, final interface materials/ornaments, frame and fonts.')
