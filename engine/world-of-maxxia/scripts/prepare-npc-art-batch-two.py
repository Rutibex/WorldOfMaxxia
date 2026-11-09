"""Pack Phase 24 generated NPC masters. Requires Pillow.
Preserve original masters; mechanically strip central gutters and resize uniform cells.
"""
from pathlib import Path
from PIL import Image
import shutil
p=Path(__file__).resolve().parents[1];source=p/'art-source';out=p/'public/assets/art/npcs';out.mkdir(exist_ok=True)
for key in ['pell','nera','vell','iona']:
 im=Image.open(source/f'npc-{key}-loop-master.png').convert('RGB');atlas=Image.new('RGB',(880,560))
 for frame in range(4):
  col=frame%2;row=frame//2
  # Remove central divider/gutter pixels, then pack exact independent runtime cells.
  x0=0 if col==0 else im.width//2+3;x1=im.width//2-3 if col==0 else im.width
  y0=0 if row==0 else im.height//2+3;y1=im.height//2-3 if row==0 else im.height
  cell=im.crop((x0,y0,x1,y1)).resize((440,280),Image.Resampling.NEAREST);atlas.paste(cell,(col*440,row*280))
 atlas.save(out/f'{key}-loop.png')
print('Packed four batch-two NPC atlases with exact 440x280 cells')
