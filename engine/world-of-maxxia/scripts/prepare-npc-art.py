"""Pack original generated NPC masters into runtime atlases. Requires Pillow.
Mechanical nearest-neighbour packing; keep Tessa and previous art unchanged.
"""
from pathlib import Path
from PIL import Image
import shutil
p=Path(__file__).resolve().parents[1];source=p/'art-source';out=p/'public/assets/art/npcs';out.mkdir(exist_ok=True)
for key in ['orro','vale','brann']:
 Image.open(source/f'npc-{key}-loop-master.png').convert('RGB').resize((880,560),Image.Resampling.NEAREST).save(out/f'{key}-loop.png')
print('Packed three four-frame NPC scenes at 440x280 per frame')
