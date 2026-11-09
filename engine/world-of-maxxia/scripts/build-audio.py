"""Original MIDI scores and synthesized WAV sound design for World of Maxxia.
No third-party samples, soundfonts or borrowed melodies. Reproducible seed per cue.
"""
from pathlib import Path
import struct, math, wave, random, json
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public/assets/audio';PPQ=480

def vlq(n):
 b=[n&127];n>>=7
 while n:b.insert(0,(n&127)|128);n>>=7
 return bytes(b)
def chunk(events):
 data=b'';previous=0
 for tick,order,msg in sorted(events,key=lambda e:(e[0],e[1])):
  data+=vlq(tick-previous)+msg;previous=tick
 data+=b'\x00\xff\x2f\x00';return b'MTrk'+struct.pack('>I',len(data))+data

def midi(name,title,bpm,key,minor,program,melody):
 # 16 bars: four-chord ground bass, a developing eight-bar phrase and its answer.
 progression=[0,5,3,4] if minor else [0,3,5,4]
 scale=[0,2,3,5,7,8,10] if minor else [0,2,4,5,7,9,11]
 def degree(d,octave=0):return key+scale[d%7]+12*(d//7+octave)
 end=16*4*PPQ
 tempo=round(60_000_000/bpm)
 conductor=[(0,0,b'\xff\x03'+vlq(len(title.encode()))+title.encode()),(0,1,b'\xff\x51\x03'+tempo.to_bytes(3,'big')),(0,2,b'\xff\x58\x04\x04\x02\x18\x08'),(end,1,b'\xff\x01\x00')]
 tracks=[chunk(conductor)]
 for channel,patch in [(0,program),(1,48),(2,6),(3,32)]:
  events=[(0,0,bytes([0xC0|channel,patch])),(0,1,bytes([0xB0|channel,7,[88,47,48,60][channel]])),(0,1,bytes([0xB0|channel,10,[64,40,86,64][channel]]))]
  def note(t,duration,pitch,velocity):
   events.extend([(round(t*PPQ),2,bytes([0x90|channel,pitch,velocity])),(round((t+duration)*PPQ),1,bytes([0x80|channel,pitch,0]))])
  for bar in range(16):
   root=progression[(bar//2)%4];base=bar*4
   if channel==0:
    phrase=melody[bar%8]
    for beat,duration,d in phrase:
     shift=0 if bar<8 else (2 if bar%4 in [0,1] else 0)
     # Resolve the final two measures to the tonic rather than an endless random tune.
     if bar==15:d=0 if beat>=2 else 4
     note(base+beat,duration*.88,degree(d+shift,1),82+(bar%3)*3)
   elif channel==1:
    for d in [root,root+2,root+4]:note(base,3.8,degree(d,-1),42)
   elif channel==2:
    for beat in range(8):note(base+beat/2,.37,degree(root+[0,4,2,4][beat%4]),44 if beat%2 else 55)
   else:
    note(base,1.7,degree(root,-2),70);note(base+2,1.65,degree(root+4,-2),60)
  events.append((end,9,b'\xff\x01\x00'));tracks.append(chunk(events))
 data=b'MThd'+struct.pack('>IHHH',6,1,len(tracks),PPQ)+b''.join(tracks)
 path=OUT/'music'/f'{name}.mid';path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
 return {'id':name,'title':title,'url':f'assets/audio/music/{name}.mid','bpm':bpm,'bars':16,'seconds':round(16*4*60/bpm,3),'programs':[program,48,6,32],'origin':'Original score, authored for this demo; synthesized in-browser without external samples.'}
# Eight original melodic contours, phrase durations are in quarter-note beats.
lyric=[[(0,1,0),(1,.5,2),(1.5,.5,3),(2,1,4),(3,1,2)],[(0,1.5,1),(1.5,.5,0),(2,2,-1)],[(0,.5,2),(.5,.5,3),(1,1,4),(2,1,6),(3,1,4)],[(0,2,3),(2,1,2),(3,1,1)],[(0,1,0),(1,1,4),(2,.5,5),(2.5,.5,4),(3,1,2)],[(0,1,3),(1,1,2),(2,2,1)],[(0,.5,2),(.5,.5,4),(1,1,3),(2,1,1),(3,1,-1)],[(0,2,1),(2,2,0)]]
quiet=[[(0,2,0),(2,1,2),(3,1,1)],[(0,3,-1),(3,1,0)],[(0,1,3),(1,2,2),(3,1,0)],[(0,4,1)],[(0,1,4),(1,1,3),(2,2,2)],[(0,2,0),(2,2,-1)],[(0,1,1),(1,1,3),(2,1,2),(3,1,-1)],[(0,4,0)]]
battle=[[(0,.5,0),(.5,.5,0),(1,.5,2),(1.5,.5,4),(2,1,3),(3,1,2)],[(0,.5,1),(.5,.5,1),(1,1,3),(2,1,2),(3,1,0)],[(0,1,4),(1,.5,3),(1.5,.5,2),(2,1,5),(3,1,4)],[(0,1,3),(1,1,1),(2,.5,2),(2.5,.5,1),(3,1,-1)],[(0,.5,0),(.5,.5,2),(1,1,4),(2,1,6),(3,1,5)],[(0,1,4),(1,1,3),(2,1,1),(3,1,2)],[(0,.5,3),(.5,.5,4),(1,.5,5),(1.5,.5,3),(2,1,2),(3,1,1)],[(0,1,4),(1,1,2),(2,2,0)]]
tracks=[]
for args in [('title','A Light Beyond the Mirror',88,60,False,10,lyric),('town','Firstlight Promenade',104,62,False,73,lyric),('cistern','Under Copper Bells',70,57,True,11,quiet),('vault','The Sleeping Resonator',64,50,True,89,quiet),('combat','Steel in the Galleries',136,57,True,6,battle),('boss','The Brass Heart Wakes',148,50,True,19,battle),('ending','Water Returns to Firstlight',80,65,False,73,lyric),('defeat','A Candle in the Dark',56,57,True,11,quiet)]:tracks.append(midi(*args))
# Layered original sound design: deterministic noise, filtered resonances and smooth envelopes.
SR=22050
fx={'ui':(.07,1000,'click'),'step_stone':(.16,90,'step'),'step_town':(.18,140,'step'),'door':(.65,85,'door'),'chest':(.5,440,'chime'),'rest':(1.3,330,'chime'),'coin':(.25,1320,'chime'),'trap':(.4,160,'hit'),'attack':(.25,230,'swoosh'),'enemy':(.35,95,'growl'),'metal':(.3,760,'hit'),'ghost':(.55,310,'ghost'),'shot':(.25,690,'shot'),'miss':(.22,350,'swoosh'),'cast_arcane':(.38,420,'cast'),'cast_fire':(.38,120,'fire'),'cast_cold':(.4,1100,'ice'),'cast_lightning':(.25,180,'zap'),'cast_poison':(.4,190,'bubble'),'cast_holy':(.5,660,'chime'),'cast_necrotic':(.45,150,'ghost'),'cast_heal':(.6,530,'chime'),'cast_guard':(.4,850,'chime'),'hit_physical':(.23,150,'hit'),'hit_arcane':(.33,620,'cast'),'hit_fire':(.4,110,'fire'),'hit_cold':(.35,1500,'ice'),'hit_lightning':(.25,220,'zap'),'hit_poison':(.35,150,'bubble'),'hit_holy':(.5,880,'chime'),'hit_necrotic':(.45,120,'ghost'),'hit_heal':(.6,590,'chime'),'hit_guard':(.35,1050,'hit'),'victory':(1.6,440,'victory'),'defeat':(2,220,'defeat'),'quest':(1.2,520,'victory'),'boss_warning':(1.1,110,'bell'),'boss_wave':(.9,70,'wave')}
def wav(path,seconds,kind,freq=100,seed=1,ambient=False):
 n=int(seconds*SR);rng=random.Random(seed);samples=[];low=0;peak=0
 for i in range(n):
  t=i/SR;u=t/seconds;noise=rng.uniform(-1,1);low=.94*low+.06*noise
  env=min(1,t/.008)*math.exp(-u*(3 if ambient else 6))*(min(1,(seconds-t)/.025))
  if ambient:env=1
  if kind in ['click','hit','step']:v=(noise*.4+math.sin(2*math.pi*freq*t*(1-.4*u))*.5)*env
  elif kind in ['door','growl']:v=(low*4+math.sin(2*math.pi*freq*t+2*math.sin(2*math.pi*19*t))*.35)*env
  elif kind in ['swoosh','shot']:v=(noise-low)*math.sin(math.pi*u)**2*.6
  elif kind in ['chime','bell','victory','defeat']:
   tones=[1,1.25,1.5,2] if kind in ['chime','victory'] else [1,1.189,1.498,2.71]
   v=0
   for j,r in enumerate(tones):
    start=j*(.13 if kind in ['victory','defeat'] else .018);dt=t-start
    if dt>=0:v+=math.sin(2*math.pi*freq*r*dt)*math.exp(-dt*(3+j))*.25
   v*=min(1,t/.008)*min(1,(seconds-t)/.05)
  elif kind in ['cast','ghost']:v=(math.sin(2*math.pi*freq*t+2*math.sin(2*math.pi*(freq*.502)*t))*.5+low*.5)*math.sin(math.pi*u)**.6
  elif kind=='fire':v=(low*5+noise*.15+math.sin(2*math.pi*freq*t)*.25)*env
  elif kind in ['ice','zap']:v=(noise*.25+math.sin(2*math.pi*freq*t+6*math.sin(2*math.pi*43*t))*.35)*env
  elif kind=='bubble':v=math.sin(2*math.pi*(freq*t+90*t*t)+math.sin(2*math.pi*9*t)*3)*env*.6
  elif kind=='wave':v=(low*5+math.sin(2*math.pi*freq*t)*.5)*math.sin(math.pi*u)
  elif kind=='water':v=low*2*(.5+.25*math.sin(2*math.pi*3*t))+.025*math.sin(2*math.pi*720*t+math.sin(t*2)*8)
  elif kind=='wind':v=low*3*(.6+.2*math.sin(2*math.pi*t/seconds))
  else:v=(math.sin(2*math.pi*55*t)*.25+math.sin(2*math.pi*82.5*t)*.15+low*.7)
  if ambient:
   # Smooth circular boundary crossfade; avoids a click when the ambience loops.
   v*=min(1,t/.4,(seconds-t)/.4)
  samples.append(v);peak=max(peak,abs(v))
 gain=(.6 if ambient else .78)/max(.001,peak)
 path.parent.mkdir(parents=True,exist_ok=True)
 with wave.open(str(path),'wb') as w:w.setparams((1,2,SR,0,'NONE','not compressed'));w.writeframes(b''.join(struct.pack('<h',max(-32767,min(32767,round(v*gain*32767)))) for v in samples))
for i,(name,(seconds,freq,kind)) in enumerate(fx.items()):wav(OUT/'sfx'/f'{name}.wav',seconds,kind,freq,i+100)
for i,(name,kind) in enumerate([('town','wind'),('cistern','water'),('vault','hum')]):wav(OUT/'ambience'/f'{name}.wav',8,kind,seed=i+300,ambient=True)
(OUT/'manifest.json').write_text(json.dumps({'music':tracks,'sfx':list(fx),'ambience':['town','cistern','vault'],'license':'Original project assets. No third-party recordings or soundfont samples.','synth':'Built-in Web Audio MIDI renderer with original General-MIDI-inspired timbres; not a full General MIDI sound bank.'},indent=2)+'\n')
print(f'Built {len(tracks)} Standard MIDI files, {len(fx)} original WAV cues, three ambience loops.')
