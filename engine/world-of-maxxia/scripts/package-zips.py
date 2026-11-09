"""Create verified archives atomically from the prepared release tree."""
from pathlib import Path
import zipfile, shutil, os, hashlib
root=Path(__file__).resolve().parent.parent
out=root.parent/'output';out.mkdir(exist_ok=True)
for kind in ['Source','Browser']:
 base=root/('release/World-of-Maxxia-Phase34' if kind=='Source' else 'release/World-of-Maxxia-Phase34-Browser')
 if kind=='Browser':
  if base.exists():shutil.rmtree(base)
  base.mkdir(parents=True)
 for name in ['dist','server.mjs','Start-World-of-Maxxia.cmd','start-world-of-maxxia.sh','README.md','PHASE32G_NOTES.md','PHASE33_NOTES.md','PHASE34_NOTES.md','VERIFICATION.md','THIRD_PARTY_NOTICES.md','licenses']:
  if kind=='Source':continue
  src=root/name;dst=base/name
  if src.is_dir():shutil.copytree(src,dst)
  else:shutil.copy2(src,dst)
 target=out/f'World-of-Maxxia-Phase34-{kind}.zip';temp=target.with_suffix('.zip.partial')
 with open(temp,'wb') as f:
  with zipfile.ZipFile(f,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
   for p in sorted(base.rglob('*')):
    if p.is_file():z.write(p,Path(base.name)/p.relative_to(base))
  f.flush();os.fsync(f.fileno())
 with zipfile.ZipFile(temp) as z:
  assert z.testzip() is None
 os.replace(temp,target)
 print(kind,target.stat().st_size,hashlib.sha256(target.read_bytes()).hexdigest(),flush=True)
