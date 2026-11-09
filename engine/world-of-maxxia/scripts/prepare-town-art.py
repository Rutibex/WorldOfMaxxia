"""Repack Phase 22 town art from bundled original generated masters. Requires Pillow.
Run python3 scripts/prepare-town-art.py; source masters remain unchanged.
"""
from pathlib import Path
from PIL import Image
import shutil
p=Path(__file__).resolve().parents[1];s=p/'art-source';out=p/'public/assets/art/town';out.mkdir(exist_ok=True)
def cells(master,nx,ny,names,transparent=False):
 im=Image.open(s/master).convert('RGBA' if transparent else 'RGB')
 for i,name in enumerate(names):
  x=i%nx;y=i//nx;cell=im.crop((round(x*im.width/nx),round(y*im.height/ny),round((x+1)*im.width/nx),round((y+1)*im.height/ny)))
  if transparent:
   bbox=cell.getbbox();assert bbox;cell=cell.crop(bbox);cell.thumbnail((112,116),Image.Resampling.NEAREST);dst=Image.new('RGBA',(128,128));dst.alpha_composite(cell,((128-cell.width)//2,123-cell.height));cell=dst
  else:cell=cell.resize((128,128),Image.Resampling.NEAREST)
  cell.save(out/(name+'.png'))
cells('town-facades-master.png',2,2,['house','forge','shrine','guild'])
cells('town-materials-master.png',2,2,['cobbles','roof','gate-closed','blue-door'])
cells('town-signs-master.png',4,2,['sign-tavern','sign-forge','sign-temple','sign-training','sign-wizard','sign-priest','sign-witch','sign-office'],True)
cells('town-landmarks-master.png',3,3,['foundry','river-steps','notice','clock','market','well','cistern-stair','lantern','marker'],True)
im=Image.open(s/'town-open-gate-master.png').convert('RGBA');im=im.crop(im.getbbox());im.thumbnail((124,124),Image.Resampling.NEAREST);dst=Image.new('RGBA',(128,128));dst.alpha_composite(im,((128-im.width)//2,126-im.height));dst.save(out/'gate-open.png')
Image.open(s/'town-sky-master.png').convert('RGB').resize((1320,440),Image.Resampling.NEAREST).save(out/'sky.png')
print('Packed',len(list(out.glob('*.png'))),'town environment assets')
