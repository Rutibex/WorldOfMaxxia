/** Build/run pure .NET document scenarios; no Windows desktop required. */
import {spawnSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dotnet=process.env.MAXXIA_DOTNET??'dotnet';
for(const args of [
 ['build','editor/MaxxiaMaker.DocumentChecks/MaxxiaMaker.DocumentChecks.csproj','-c','Release','--nologo','--disable-build-servers','-m:1'],
 ['editor/MaxxiaMaker.DocumentChecks/bin/Release/net10.0/MaxxiaMaker.DocumentChecks.dll','contracts/fixtures/manifest/valid-unknown-fields.maxxia']
]){
 const result=spawnSync(dotnet,args,{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
 if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
 if(result.error)throw new Error('Install .NET 10 SDK or set MAXXIA_DOTNET.',{cause:result.error});
 if(result.status!==0)process.exit(result.status??1);
}
