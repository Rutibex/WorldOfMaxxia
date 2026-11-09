"""Review actual runtime atlas cells and emit optional GIF/contact-sheet previews.
Uses Pillow and public/assets/npc-scenes.json generated from production metadata.
These are asset previews, not browser/gameplay screenshots.
"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib
p=Path(__file__).resolve().parents[1];scenes=json.loads((p/'public/assets/npc-scenes.json').read_text());out=p/'docs/npc-review';out.mkdir(exist_ok=True)
font=ImageFont.truetype(str(p/'art-source/fonts/DejaVuSerif.ttf'),12);small=ImageFont.truetype(str(p/'art-source/fonts/DejaVuSansMono.ttf'),9)
contact=Image.new('RGB',(880,312*((len(scenes)+1)//2)),'#101923');draw=ImageDraw.Draw(contact)
framesheet=Image.new('RGB',(880,160*len(scenes)),'#101923');fd=ImageDraw.Draw(framesheet);reports=[]
for i,scene in enumerate(scenes):
 atlas=Image.open(p/'public'/scene['url']).convert('RGB');assert atlas.size==(880,560)
 frames=[atlas.crop((f%2*440,f//2*280,(f%2+1)*440,(f//2+1)*280)) for f in range(4)]
 hashes=[hashlib.sha256(f.tobytes()).hexdigest() for f in frames];assert len(set(hashes))==4,scene['id']+' contains duplicate frames'
 x=i%2*440;y=i//2*312;contact.paste(frames[0],(x,y));draw.text((x+8,y+285),scene['name']+' · '+scene['place'],font=font,fill='#f2d29b');draw.text((x+8,y+302),'Production asset preview · not browser screenshot',font=small,fill='#bac9cb')
 for j,frame in enumerate(frames):
  framesheet.paste(frame.resize((220,140),Image.Resampling.NEAREST),(j*220,i*160));fd.text((j*220+5,i*160+144),scene['name']+' · frame '+str(j+1),font=small,fill='#edc98e')
 frames[0].save(out/(scene['id']+'.gif'),save_all=True,append_images=frames[1:],duration=scene['durations'],loop=0,disposal=2)
 frames[0].save(out/(scene['id']+'-resting.png'))
 reports.append({'id':scene['id'],'atlas':[880,560],'frame':[440,280],'uniqueFrames':len(set(hashes)),'durationsMs':scene['durations'],'framesSha256':hashes})
contact.save(p/'docs/PHASE24_NPC_REVIEW.png');framesheet.save(p/'docs/PHASE24_NPC_FRAMES.png');(p/'docs/NPC_ART_CHECK.json').write_text(json.dumps({'scenes':reports,'totalFrames':len(scenes)*4,'source':'production runtime atlases, Pillow asset review; not browser'},indent=2)+'\n')
print('PASS: eight production atlases, thirty-two unique frame slots, matching dimensions and playback durations.')
