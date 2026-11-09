"""Pack illustrated Resonator Vault raster master sheets, without drawing or painting.

Each finished asset is one pre-rendered 128×128 cell; cropping copies its pixels.
The old Pillow ImageDraw/vector-shape generator was deliberately removed.
To rebuild the raster composites from the source paintings, run
  python3 scripts/build-rendered-vault-masters.py
before running this packer.
"""
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'art-source'
OUT=ROOT/'public/assets/art/vault';OUT.mkdir(parents=True,exist_ok=True)
MATERIAL=['wall','wet-wall','brass-wall','floor','channel-floor','grate-floor','ceiling','seal-door']
SPRITES=['door-open','maintenance-score','copper-valve','copper-valve-on','moon-valve','moon-valve-on','glass-valve','glass-valve-on','echo-shrine','echo-empty','regulator','regulator-empty','rest-alcove','bypass-sign','warning-tablet','chest-closed','chest-open','secret-open','leech-spent','spark-spent','spring','spring-spent','stair-up']
for filename,cols,rows,names in [('vault-rendered-materials-master.png',4,2,MATERIAL),('vault-rendered-props-master.png',6,4,SPRITES)]:
    image=Image.open(SRC/filename).convert('RGBA')
    assert image.size==(cols*128,rows*128),filename
    for i,name in enumerate(names):
        x=i%cols*128;y=i//cols*128
        image.crop((x,y,x+128,y+128)).save(OUT/(name+'.png'))
assert len(list(OUT.glob('*.png')))==31
print('Packed 31 finished painted-raster vault art assets (no generated geometry)')
