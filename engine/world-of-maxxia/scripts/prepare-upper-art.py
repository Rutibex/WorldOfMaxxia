"""Repack original Phase 25 dungeon masters using Pillow.
Mechanical cell cropping/nearest-neighbour resizing preserves source masters and alpha.
"""
from pathlib import Path
from PIL import Image
import shutil
p=Path(__file__).resolve().parents[1];source=p/'art-source';out=p/'public/assets/art/upper';out.mkdir(exist_ok=True)
def cells(master,nx,ny,names,alpha=False):
 im=Image.open(source/master).convert('RGBA' if alpha else 'RGB')
 for i,name in enumerate(names):
  x=i%nx;y=i//nx;cell=im.crop((round(x*im.width/nx),round(y*im.height/ny),round((x+1)*im.width/nx),round((y+1)*im.height/ny)))
  if alpha:
   cell=cell.crop(cell.getbbox());cell.thumbnail((116,116),Image.Resampling.NEAREST);outimage=Image.new('RGBA',(128,128));outimage.alpha_composite(cell,((128-cell.width)//2,123-cell.height));cell=outimage
  else:cell=cell.resize((128,128),Image.Resampling.NEAREST)
  cell.save(out/(name+'.png'))
cells('upper-materials-master.png',3,3,['wall','moss-wall','pipe-wall','floor','ceiling','grate-floor','oak-door','iron-door','bronze-door'])
cells('upper-props-master.png',4,2,['mirror','brazier','star','banner','copper-bell','moon-plaque','glass-chime','waterwheel'],True)
cells('upper-quest-props-master.png',4,2,['ledger','tools','survey','echo-pipes','stair-sealed','stair-open','stair-up','spring'],True)
cells('upper-states-master.png',3,3,['chest-closed','chest-open','ledger-empty','tools-empty','needle-spent','rune-spent','secret-open','moon-pool','door-open'],True)
print('Packed',len(list(out.glob('*.png'))),'Upper Cistern assets')
