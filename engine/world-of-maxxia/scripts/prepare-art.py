"""Mechanically pack generated masters into runtime assets. Requires Python + Pillow.
No repainting or procedural replacement: preserve original generated master files.
Run from any directory: python3 scripts/prepare-art.py
"""
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
source=root/'art-source';out=root/'public/assets/art';out.mkdir(parents=True,exist_ok=True)
Image.open(source/'dust-imp-master.png').convert('RGBA').resize((512,512),Image.Resampling.NEAREST).save(out/'dust-imp.png')
por=Image.open(source/'witch-master.png')
for i,state in enumerate(['normal','hurt','afflicted','dead']):
    por.crop((i*por.width//4,0,(i+1)*por.width//4,por.height)).resize((58,70),Image.Resampling.NEAREST).save(out/f'witch-{state}.png')
Image.open(source/'tessa-loop-master.png').resize((880,560),Image.Resampling.NEAREST).save(out/'tessa-loop.png')
Image.open(source/'tessa-master.png').resize((440,280),Image.Resampling.NEAREST).save(out/'tessa.png')
print('Packed one transparent sprite atlas, four portraits, and tavern scene assets.')
