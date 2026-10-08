// Архив создаётся только из исходников и файлов, нужных пользователю.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const entries=['.gitignore','package.json','package-lock.json','LICENSE','README.md','VCTS_GUIDE.md','CHANGELOG.md','THIRD_PARTY_LICENSES','sdk','tools','examples'];
const ignored=new Set(['node_modules','build','dist','.idea','.git','.DS_Store','__pycache__']);
function files(){
 const result=[];
 function visit(relative){const full=path.join(root,relative),stat=fs.lstatSync(full);if(stat.isSymbolicLink())throw new Error(`Ссылка не входит в релиз: ${relative}`);if(stat.isDirectory()){for(const name of fs.readdirSync(full).sort())if(!ignored.has(name))visit(path.posix.join(relative,name));}else if(stat.isFile())result.push(relative);}
 for(const entry of entries)visit(entry);return result.sort();
}
const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(data){let n=0xffffffff;for(const b of data)n=table[(n^b)&255]^(n>>>8);return(n^0xffffffff)>>>0;}
function buildRelease(){
 const pkg=require('../package.json');if(!pkg.license)throw new Error('Перед сборкой релиза выберите лицензию VCTS.');
 const folder=`vcts-${pkg.version}`,chunks=[],directory=[];let offset=0;
 const names=files();
 for(const relative of names){const name=Buffer.from(folder+'/'+relative),data=fs.readFileSync(path.join(root,relative)),checksum=crc(data),header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(0x21,12);header.writeUInt32LE(checksum,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(name.length,26);chunks.push(header,name,data);const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);central.writeUInt16LE(0x21,14);central.writeUInt32LE(checksum,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);directory.push(central,name);offset+=header.length+name.length+data.length;}
 const central=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(names.length,8);end.writeUInt16LE(names.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
 const data=Buffer.concat([...chunks,central,end]),dir=path.join(root,'dist');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,folder+'.zip');fs.writeFileSync(file,data);fs.writeFileSync(file+'.sha256',crypto.createHash('sha256').update(data).digest('hex')+'  '+path.basename(file)+'\n');return file;
}
if(require.main===module){try{console.log('Архив:',buildRelease());}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={buildRelease,crc};
