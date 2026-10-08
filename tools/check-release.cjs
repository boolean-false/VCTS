// Проверяем архив в новой папке с новой установкой npm-зависимостей.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const {buildRelease,crc}=require('./release.cjs');
function extract(archive,destination){const data=fs.readFileSync(archive);let offset=0;while(data.readUInt32LE(offset)===0x04034b50){const size=data.readUInt32LE(offset+18),nameLength=data.readUInt16LE(offset+26),extra=data.readUInt16LE(offset+28),name=data.subarray(offset+30,offset+30+nameLength).toString();if(data.readUInt16LE(offset+8)!==0||name.includes('\\')||name.split('/').some(part=>part==='..'||!part)||path.isAbsolute(name))throw new Error('Неподдерживаемый элемент архива');const start=offset+30+nameLength+extra,body=data.subarray(start,start+size);if(crc(body)!==data.readUInt32LE(offset+14))throw new Error('Повреждён архив');const target=path.join(destination,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,body);offset=start+size;}}
function run(command,args,cwd,env){const result=spawnSync(command,args,{cwd,env,encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});if(result.error||result.status!==0)throw new Error(result.error?.message||result.stderr||result.stdout);return result.stdout;}
function npm(args,cwd,env){
 const cli=process.env.npm_execpath;
 if(cli&&fs.existsSync(cli))return run(process.execPath,[cli,...args],cwd,env);
 if(process.platform==='win32')throw new Error('Запустите проверку через npm run release:check.');
 return run('npm',args,cwd,env);
}
function checkRelease(){
 const archive=buildRelease(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'vcts-release-install-'));
 try{
  extract(archive,temp);const source=path.join(temp,'vcts-'+require('../package.json').version),cache=path.join(temp,'npm-cache'),env={...process.env,npm_config_cache:cache};const offline=process.argv.includes('--offline');
  if(offline){const lock=JSON.parse(fs.readFileSync(path.join(source,'package-lock.json'),'utf8'));for(const entry of Object.values(lock.packages)){if(!entry.integrity)continue;const [algorithm,integrity]=entry.integrity.split('-'),hash=Buffer.from(integrity,'base64').toString('hex'),rel=path.join('_cacache','content-v2',algorithm,hash.slice(0,2),hash.slice(2,4),hash.slice(4)),original=path.join(process.env.npm_config_cache||path.join(os.homedir(),'.npm'),rel);if(!fs.existsSync(original))throw new Error('Нет кэшированного пакета для проверки offline. Повторите без --offline.');const target=path.join(cache,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(original,target);}}
  console.log(npm(['ci','--ignore-scripts','--no-audit','--no-fund',...(offline?['--offline']:[])],source,env));
  const cli=path.join(source,'tools/vcts.cjs');run(process.execPath,[cli,'--help'],temp,env);
  for(const kind of ['mod','game']){const project=path.join(temp,kind);run(process.execPath,[cli,'init',project,'--kind',kind,'--id','sample'],temp,env);npm(['install','--ignore-scripts','--no-audit','--no-fund',...(offline?['--offline']:[])],project,env);for(const command of ['check','build'])npm(['run',command],project,env);}
  const output=path.join(__dirname,'../build/logs');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'release-install.json'),JSON.stringify({version:require('../package.json').version,archive:path.basename(archive),freshDependencies:true,offline,platform:process.platform,arch:process.arch,checks:['CLI','создание мода','npm install мода','проверка и сборка мода','создание игры','npm install игры','проверка и сборка игры']},null,2)+'\n');console.log('Установка из архива, CLI и оба шаблона проверены.');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
if(require.main===module){try{checkRelease();}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={extract};
