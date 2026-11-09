/** Bounded ZIP transport: stored/deflated, single-disk, no streaming descriptors or ZIP64. */
import {inflateRawSync} from 'node:zlib';
import {problem} from './diagnostics.mjs';
export const ARCHIVE_LIMITS=Object.freeze({compressedBytes:32*1024*1024,expandedBytes:32*1024*1024,fileBytes:1024*1024,entries:4096,ratio:200});
const table=Uint32Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=i&1?(i>>>1)^0xedb88320:i>>>1;return i>>>0;});
export function crc32(buffer){let crc=0xffffffff;for(const b of buffer)crc=table[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
const filePattern=/^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*\.[a-zA-Z0-9]+$/;
const directoryPattern=/^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*\/$/;
export function readPackArchive(bytes,file='<archive>'){
 const fail=(code,message,path='$')=>problem(code,file,path,message);
 if(bytes.length>ARCHIVE_LIMITS.compressedBytes)fail('E_ARCHIVE_LIMIT','Archive exceeds 32 MiB compressed input limit.');
 // EOCD must end at the actual end of the input (an optional comment may precede it).
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50&&i+22+bytes.readUInt16LE(i+20)===bytes.length){end=i;break;}
 if(end<0)fail('E_ARCHIVE_FORMAT','Missing or invalid ZIP end record.');
 const disk=bytes.readUInt16LE(end+4),cdDisk=bytes.readUInt16LE(end+6),count=bytes.readUInt16LE(end+10),diskCount=bytes.readUInt16LE(end+8),size=bytes.readUInt32LE(end+12),offset=bytes.readUInt32LE(end+16);
 if(disk||cdDisk||diskCount!==count||count===65535||size===0xffffffff||offset===0xffffffff)fail('E_ARCHIVE_FORMAT','Multi-disk and ZIP64 archives are unsupported.');
 if(count<1||count>ARCHIVE_LIMITS.entries)fail('E_ARCHIVE_LIMIT','ZIP entry count is outside 1–4096.');
 if(offset+size!==end)fail('E_ARCHIVE_FORMAT','Central directory boundaries are inconsistent.');
 const files=new Map(),seen=new Set(),regions=[];let cursor=offset,total=0;
 for(let i=0;i<count;i++){
  if(cursor+46>end||bytes.readUInt32LE(cursor)!==0x02014b50)fail('E_ARCHIVE_FORMAT','Invalid central-directory entry.');
  const flags=bytes.readUInt16LE(cursor+8),method=bytes.readUInt16LE(cursor+10),crc=bytes.readUInt32LE(cursor+16),compressed=bytes.readUInt32LE(cursor+20),expanded=bytes.readUInt32LE(cursor+24),nameLength=bytes.readUInt16LE(cursor+28),extraLength=bytes.readUInt16LE(cursor+30),commentLength=bytes.readUInt16LE(cursor+32),startDisk=bytes.readUInt16LE(cursor+34),attrs=bytes.readUInt32LE(cursor+38),localOffset=bytes.readUInt32LE(cursor+42);
  if(cursor+46+nameLength+extraLength+commentLength>end)fail('E_ARCHIVE_FORMAT','Truncated central-directory record.');
  const rawName=bytes.subarray(cursor+46,cursor+46+nameLength);let name;try{name=new TextDecoder('utf-8',{fatal:true}).decode(rawName);}catch{fail('E_ARCHIVE_PATH','Entry name must be valid UTF-8.');}
  const directory=name.endsWith('/'),mode=(attrs>>>16)&0xf000;
  if(name.length>240||!(directory?directoryPattern:filePattern).test(name))fail('E_ARCHIVE_PATH','Entry path is absolute, unsafe, noncanonical or outside the supported ASCII path grammar.',name);
  if(seen.has(name.toLowerCase()))fail('E_ARCHIVE_PATH','Duplicate or case-colliding ZIP entry.',name);seen.add(name.toLowerCase());
  if(![0,0x8000,0x4000].includes(mode)||mode===0x4000&&!directory||mode===0x8000&&directory)fail('E_ARCHIVE_PATH','Only regular files and directories are permitted; links/devices are rejected.',name);
  if(flags&~0x0800||![0,8].includes(method)||startDisk)fail('E_ARCHIVE_FORMAT','Encrypted, streaming-descriptor or unsupported ZIP entries are rejected.',name);
  if(compressed===0xffffffff||expanded===0xffffffff||localOffset===0xffffffff)fail('E_ARCHIVE_FORMAT','ZIP64 entries are unsupported.',name);
  if(expanded>ARCHIVE_LIMITS.fileBytes||total+expanded>ARCHIVE_LIMITS.expandedBytes||expanded>Math.max(1,compressed)*ARCHIVE_LIMITS.ratio)fail('E_ARCHIVE_LIMIT','Entry exceeds file, expansion or compression-ratio limits.',name);total+=expanded;
  if(directory&&(compressed||expanded))fail('E_ARCHIVE_FORMAT','Directory entries must be empty.',name);
  if(localOffset+30>offset||bytes.readUInt32LE(localOffset)!==0x04034b50)fail('E_ARCHIVE_FORMAT','Invalid local file header.',name);
  const localName=bytes.readUInt16LE(localOffset+26),localExtra=bytes.readUInt16LE(localOffset+28),dataStart=localOffset+30+localName+localExtra,dataEnd=dataStart+compressed;
  if(dataStart>offset||dataEnd>offset||bytes.readUInt16LE(localOffset+6)!==flags||bytes.readUInt16LE(localOffset+8)!==method||bytes.readUInt32LE(localOffset+14)!==crc||bytes.readUInt32LE(localOffset+18)!==compressed||bytes.readUInt32LE(localOffset+22)!==expanded||!bytes.subarray(localOffset+30,localOffset+30+localName).equals(rawName))fail('E_ARCHIVE_FORMAT','Local and central records disagree or overlap metadata.',name);
  regions.push([localOffset,dataEnd]);let data;
  try{data=method===0?Buffer.from(bytes.subarray(dataStart,dataEnd)):inflateRawSync(bytes.subarray(dataStart,dataEnd),{maxOutputLength:Math.max(1,expanded)});}catch{fail('E_ARCHIVE_FORMAT','Deflate stream is invalid or exceeds declared size.',name);}
  if(data.length!==expanded||crc32(data)!==crc)fail('E_ARCHIVE_INTEGRITY','Expanded length or CRC32 does not match.',name);
  if(!directory)files.set(name,data);cursor+=46+nameLength+extraLength+commentLength;
 }
 if(cursor!==end)fail('E_ARCHIVE_FORMAT','Central directory size does not match entry records.');
 regions.sort((a,b)=>a[0]-b[0]);let prior=0;for(const [start,end] of regions){if(start!==prior)fail('E_ARCHIVE_FORMAT','Overlapping entries, gaps or executable prefixes are rejected.');prior=end;}if(prior!==offset)fail('E_ARCHIVE_FORMAT','Unreferenced archive data is rejected.');
 return {files,expandedBytes:total};
}
export function createPackArchive(files){
 if(files.size<1||files.size>ARCHIVE_LIMITS.entries)problem('E_ARCHIVE_LIMIT',null,'$','Archive entry limit exceeded.');
 const locals=[],central=[],seen=new Set();let offset=0,total=0;
 for(const [name,raw] of [...files.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0)){
  if(seen.has(name.toLowerCase()))problem('E_ARCHIVE_PATH',null,name,'Duplicate or case-colliding snapshot path.');seen.add(name.toLowerCase());
  if(!filePattern.test(name)||name.length>240)problem('E_ARCHIVE_PATH',null,name,'Unsafe snapshot file name.');
  const data=Buffer.from(raw),nameBytes=Buffer.from(name);total+=data.length;
  if(data.length>ARCHIVE_LIMITS.fileBytes||total>ARCHIVE_LIMITS.expandedBytes)problem('E_ARCHIVE_LIMIT',null,name,'Snapshot exceeds admission limits.');
  const crc=crc32(data),local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x0800,6);local.writeUInt16LE(33,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(nameBytes.length,26);
  const cd=Buffer.alloc(46);cd.writeUInt32LE(0x02014b50);cd.writeUInt16LE(0x0314,4);cd.writeUInt16LE(20,6);cd.writeUInt16LE(0x0800,8);cd.writeUInt16LE(33,14);cd.writeUInt32LE(crc,16);cd.writeUInt32LE(data.length,20);cd.writeUInt32LE(data.length,24);cd.writeUInt16LE(nameBytes.length,28);cd.writeUInt32LE((0o100644<<16)>>>0,38);cd.writeUInt32LE(offset,42);
  locals.push(local,nameBytes,data);central.push(cd,nameBytes);offset+=local.length+nameBytes.length+data.length;
 }
 const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.size,8);end.writeUInt16LE(files.size,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
 const result=Buffer.concat([...locals,cd,end]);if(result.length>ARCHIVE_LIMITS.compressedBytes)problem('E_ARCHIVE_LIMIT',null,'$','Snapshot archive exceeds 32 MiB transport limit.');return result;
}
