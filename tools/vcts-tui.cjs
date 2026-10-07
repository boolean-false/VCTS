const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const readline=require('node:readline');
const {spawn}=require('node:child_process');
const {createProject}=require('./vcts-template.cjs');
const {connectDependency,scaffoldTypes}=require('./vcts-dependencies.cjs');
const toolRoot=path.resolve(__dirname,'..');
class Cancelled extends Error {}
function projectAt(directory){
 let current=path.resolve(directory);
 for(;;){const config=path.join(current,'vcts.config.json');if(fs.existsSync(config))return config;const parent=path.dirname(current);if(parent===current)return null;current=parent;}
}
function userPath(value,base=process.cwd()){
 value=value.trim();if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
 if(process.platform!=='win32')value=value.replace(/\\ /g,' ');
 if(value==='~')value=os.homedir();else if(value.startsWith('~/'))value=path.join(os.homedir(),value.slice(2));
 if(/^Users\//.test(value))throw new Error('Абсолютный путь на macOS начинается с /Users/, а не Users/.');
 if(!value)throw new Error('Укажите путь.');return path.resolve(base,value);
}
function completePath(line,base){
 try{
  const quote=line.startsWith('"')?'"':line.startsWith("'")?"'":'';
  let value=quote?line.slice(1):line;if(quote&&value.endsWith(quote))value=value.slice(0,-1);
  const split=value.lastIndexOf(path.sep),head=value.slice(0,split+1),prefix=value.slice(split+1);
  const dir=userPath(head||'.',base);
  const matches=fs.readdirSync(dir,{withFileTypes:true}).filter(item=>item.name.startsWith(prefix)).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,100).map(item=>quote+head+item.name+(item.isDirectory()?path.sep:quote));
  return [matches,line];
 }catch{return [[],line];}
}
function readProject(file){
 const config=JSON.parse(fs.readFileSync(file,'utf8'));
 if(config.schemaVersion!==1||!['mod','game'].includes(config.kind)||!Array.isArray(config.units))throw new Error('Ожидается конфиг VCTS с schemaVersion: 1, kind: mod/game и units.');
 const packs=[...new Set(config.units.flatMap(unit=>unit.packs.map(pack=>pack.id)))];return {config,packs,root:path.dirname(file)};
}
function realLocation(file){let head=path.resolve(file),tail=[];while(!fs.existsSync(head)){const parent=path.dirname(head);if(parent===head)break;tail.unshift(path.basename(head));head=parent;}return path.join(fs.realpathSync(head),...tail);}
function contains(parent,child){const rel=path.relative(parent,child);return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));}
function setDestinations(file,updates){
 const {config,packs,root}=readProject(file),next={...(config.packOutDirs||{})};
 for(const [id,destination] of Object.entries(updates)){
  if(!packs.includes(id))throw new Error(`Неизвестный собственный пак: ${id}`);
  if(destination===null)delete next[id];else next[id]=userPath(destination,root);
 }
 const targets=Object.values(next).map(realLocation),build=realLocation(path.resolve(root,config.outDir));
 const inputs=[file,...config.units.map(unit=>path.resolve(root,unit.tsconfig))].map(realLocation);
 const sources=[...config.units.flatMap(unit=>unit.packs.map(pack=>path.resolve(root,pack.root))),...(config.assets||[]).map(asset=>path.resolve(root,asset.from)),...(config.dependencies||[]).map(dep=>path.resolve(root,dep.path))].map(realLocation);
 for(let i=0;i<targets.length;i++){
  const dest=targets[i];if(contains(dest,realLocation(root))||contains(dest,build)||contains(build,dest)||inputs.some(input=>contains(dest,input))||sources.some(source=>contains(dest,source)||contains(source,dest)))throw new Error('Папка назначения пересекается с проектом, сборкой, исходниками или зависимостью. Выберите другую папку.');
  if(targets.some((other,j)=>i!==j&&(contains(dest,other)||contains(other,dest))))throw new Error('Папки назначения разных паков пересекаются.');
 }
 config.packOutDirs=next;fs.writeFileSync(file,JSON.stringify(config,null,2)+'\n');return next;
}
const color=(code,text)=>`\x1b[${code}m${text}\x1b[0m`;
function plain(text){return String(text).replace(/\x1b\[[0-9;]*m/g,'').replace(/[\x00-\x1f\x7f]/g,' ');}
function fit(text,width){text=plain(text);const chars=[...text];return chars.length>width?chars.slice(0,Math.max(0,width-1)).join('')+'…':text;}
function dashboard(configFile){
 if(!configFile)return ['Проект не выбран','Откройте папку проекта или создайте новый мод.'];
 try{const {config,packs,root}=readProject(configFile);return [root,`${config.kind==='game'?'Игра':'Мод'} · ${packs.join(', ')} · зависимостей: ${(config.dependencies||[]).length}`,Object.entries(config.packOutDirs||{}).map(([id,dir])=>`${id} → ${path.resolve(root,dir)}`).join(' | ')||`Локальная сборка → ${path.resolve(root,config.outDir)}`];}
 catch(error){return [configFile,'Ошибка конфига: '+error.message];}
}
class Terminal {
 constructor(input=process.stdin,output=process.stdout){this.input=input;this.output=output;readline.emitKeypressEvents(input);}
 async menu(title,items,details=[]){
  if(!items.length)return null;let selected=0;
  const input=this.input,output=this.output,wasRaw=!!input.isRaw;
  const draw=()=>{
   const width=Math.max(24,(output.columns||90)-4);
   output.write('\x1b[2J\x1b[H\x1b[?25l'+color('1;36','  VCTS')+color('90','  TypeScript → VoxelCore')+'\n\n');
   for(const line of details)output.write('  '+color('90',fit(line,width))+'\n');
   output.write('\n  '+color('1',fit(title,width))+'\n\n');
   const visible=Math.max(3,Math.min(items.length,(output.rows||30)-8-details.length));
   const start=Math.max(0,Math.min(selected-visible+1,items.length-visible));
   items.slice(start,start+visible).forEach((item,offset)=>{const i=start+offset;output.write((i===selected?color('36','  › '):'    ')+(i===selected?color('1',fit(item.label,width-2)):fit(item.label,width-2))+'\n');});
   output.write('\n  '+color('90',fit(`↑ ↓ / j k · Enter · Esc — назад · Ctrl+C — выход  ${selected+1}/${items.length}`,width))+'\n');
  };
  return new Promise(resolve=>{
   const finish=value=>{input.removeListener('keypress',key);output.removeListener('resize',draw);input.setRawMode(wasRaw);input.pause();output.write('\x1b[?25h');resolve(value);};
   const key=(text,event={})=>{
    if(event.ctrl&&event.name==='c'||text==='q'||text==='Q')return finish('quit');
    if(event.name==='escape')return finish(null);
    if(event.name==='up'||text==='k')selected=(selected+items.length-1)%items.length;
    else if(event.name==='down'||text==='j')selected=(selected+1)%items.length;
    else if(event.name==='home')selected=0;
    else if(event.name==='end')selected=items.length-1;
    else if(event.name==='return')return finish(items[selected].id);
    else return;draw();
   };
   input.setRawMode(true);input.resume();input.on('keypress',key);output.on('resize',draw);draw();
  });
 }
 async ask(label,{initial='',required=true,pathBase}={}){
  const input=this.input,output=this.output;output.write('\x1b[?25h');input.setRawMode(false);
  const rl=readline.createInterface({input,output,terminal:true,...(pathBase?{completer:line=>completePath(line,pathBase)}:{})});
  return new Promise((resolve,reject)=>{
   let settled=false;const cancel=()=>{if(settled)return;settled=true;rl.close();input.pause();reject(new Cancelled());};
   const key=(text,event={})=>{if(event.name==='escape')cancel();};input.on('keypress',key);
   rl.on('SIGINT',cancel);rl.on('close',()=>{input.removeListener('keypress',key);if(!settled){settled=true;input.pause();reject(new Cancelled());}});
   rl.question('  '+label+': ',answer=>{settled=true;rl.close();input.pause();const value=answer.trim();if(required&&!value)reject(new Error('Значение не может быть пустым.'));else resolve(value);});
   if(initial)rl.write(initial);
  });
 }
 async pause(){await this.ask('Enter — вернуться в меню',{required:false});}
 clear(title){this.output.write('\x1b[2J\x1b[H\x1b[?25h'+color('1;36','  '+title)+'\n\n');}
 async run(args,{cwd,watch=false,npm=false}={}){
  this.clear(watch?'Наблюдение за проектом':'Выполнение');
  if(watch)this.output.write('  Q / Esc / Ctrl+C — остановить watch и вернуться\n\n');
  else this.output.write('  Ctrl+C — прервать действие\n\n');
  const command=npm?(process.platform==='win32'?'npm.cmd':'npm'):process.execPath;
  const child=spawn(command,npm?['install']:[path.join(__dirname,'vcts.cjs'),...args],{cwd:cwd||process.cwd(),stdio:['ignore','pipe','pipe'],shell:npm&&process.platform==='win32',detached:process.platform!=='win32'});
  child.stdout.on('data',data=>this.output.write(data));child.stderr.on('data',data=>this.output.write(data));
  let stopping=false;const stop=()=>{if(!stopping){stopping=true;try{if(process.platform!=='win32'&&child.pid)process.kill(-child.pid,'SIGTERM');else child.kill('SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}}};
  const onKey=(text,key={})=>{if(text==='q'||text==='Q'||key.name==='escape'||key.ctrl&&key.name==='c')stop();};
  const wasRaw=!!this.input.isRaw;
  if(watch){this.input.setRawMode(true);this.input.resume();this.input.on('keypress',onKey);}else process.on('SIGINT',stop);
  try{
   const result=await new Promise(resolve=>{child.once('error',error=>resolve({error}));child.once('close',(code,signal)=>resolve({code,signal}));});
   if(result.error){result.error.keepOutput=true;throw result.error;}
   if(!stopping&&result.code!==0){const error=new Error(`Действие завершилось с кодом ${result.code??result.signal}. Подробности выше.`);error.keepOutput=true;throw error;}
   this.output.write('\n  '+color('32',stopping?'Остановлено.':'Готово.')+'\n\n');
  }finally{this.input.removeListener('keypress',onKey);process.removeListener('SIGINT',stop);this.input.setRawMode(wasRaw);this.input.pause();}
 }
}
async function launchTui({cwd=process.cwd(),input=process.stdin,output=process.stdout}={}){
 if(!input.isTTY||!output.isTTY||typeof input.setRawMode!=='function')throw new Error('TUI требует интерактивного терминала. Используйте vcts help или команды build/check/test.');
 const ui=new Terminal(input,output);let configFile=projectAt(cwd),quit=false;
 const choose=async(title,items,details=[])=>{const answer=await ui.menu(title,items,details);if(answer==='quit'){quit=true;throw new Cancelled();}return answer;};
 try{while(!quit){
  const actions=configFile?[{id:'check',label:'Проверить TypeScript и зависимости'},{id:'build',label:'Собрать мод'},{id:'watch',label:'Наблюдать за изменениями'},{id:'test',label:'Запустить тесты в VoxelCore'},{id:'dependencies',label:'Подключить чужой пак / Lua API'},{id:'destination',label:'Настроить папку установки'},{id:'inspect',label:'Посмотреть модули и API'},{id:'explain',label:'Разобрать ошибку из лога'},{id:'install',label:'Установить npm-зависимости проекта'}]:[];
  actions.push({id:'open',label:'Открыть другой проект'},{id:'create',label:'Создать мод или игру'},{id:'guide',label:'Руководство'},{id:'exit',label:'Выход'});
  try{
   const action=await choose('Что сделать?',actions,dashboard(configFile));if(!action||action==='exit')break;
   const root=configFile?path.dirname(configFile):cwd;
   if(['check','build','test','watch'].includes(action)){await ui.run([action,configFile],{watch:action==='watch'});await ui.pause();}
   else if(action==='install'){await ui.run([],{npm:true,cwd:root});await ui.pause();}
   else if(action==='open'){
    ui.clear('Открыть проект');const selected=userPath(await ui.ask('Папка проекта или vcts.config.json (Tab — дополнить)',{pathBase:cwd}),cwd);const file=fs.existsSync(selected)&&fs.statSync(selected).isDirectory()?path.join(selected,'vcts.config.json'):selected;readProject(file);configFile=file;
   }else if(action==='create'){
    const kind=await choose('Что создаём?',[{id:'mod',label:'Контент-пак / мод'},{id:'game',label:'Отдельная игра'}]);if(!kind)continue;
    ui.clear('Новый '+(kind==='mod'?'мод':'проект игры'));const destination=userPath(await ui.ask('Новая папка проекта (Tab — дополнить)',{pathBase:cwd}),cwd);
    const suggested=path.basename(destination).replace(/[^A-Za-z0-9_]/g,'_');const id=await ui.ask('ID пака (латиница, 2–24 символа)',{initial:/^[A-Za-z_][A-Za-z0-9_]{1,23}$/.test(suggested)?suggested:'my_mod'});
    createProject(destination,{kind,id});configFile=path.join(destination,'vcts.config.json');output.write('\n  Проект создан. В меню доступна установка npm-зависимостей.\n\n');await ui.pause();
   }else if(action==='dependencies'){
    const info=readProject(configFile);const mode=await choose('Подключение зависимости',[{id:'auto',label:'Готовый пак с типами'},{id:'manual',label:'Lua API с моей декларацией .d.ts'},{id:'scaffold',label:'Lua API без типов — создать заготовку'},{id:'resources',label:'Пак только с ресурсами'}],info.config.dependencies?.map(dep=>`${dep.id} · ${dep.version||'версия не указана'} · ${dep.path}`)||[]);if(!mode)continue;
    ui.clear('Подключить пак');const folder=userPath(await ui.ask('Папка готового контент-пака (Tab — дополнить)',{pathBase:root}),root);
    if(mode==='scaffold'||mode==='manual'){
     const module=await ui.ask('Имя Lua-модуля после двоеточия',{initial:'api'});
     if(mode==='scaffold'){const file=scaffoldTypes(configFile,folder,module);output.write('\n  Создано: '+file+'\n  Заполните публичные сигнатуры по настоящему Lua API.\n');}
     else {const types=userPath(await ui.ask('Файл декларации .d.ts (Tab — дополнить)',{pathBase:root}),root);const pack=connectDependency(configFile,folder,{types,module});output.write('\n  Подключён '+pack.id+'\n');}
    }else{const pack=connectDependency(configFile,folder,{resources:mode==='resources'});output.write('\n  Подключён '+pack.id+'\n');}
    await ui.pause();
   }else if(action==='destination'){
    const info=readProject(configFile);const id=info.packs.length===1?info.packs[0]:await choose('Какой пак настроить?',info.packs.map(id=>({id,label:id})));if(!id)continue;
    const mode=await choose('Куда собирать '+id+'?',[{id:'content',label:'В папку content игры (ID пака добавится сам)'},{id:'exact',label:'В указанную папку пака'},{id:'local',label:'Только локальная сборка'}],[`${id} → ${info.config.packOutDirs?.[id]||'только локальная сборка'}`]);if(!mode)continue;
    ui.clear('Папка установки');let destination=null;
    if(mode!=='local'){destination=userPath(await ui.ask(mode==='content'?'Папка content игры (Tab — дополнить)':'Полный путь папки '+id,{pathBase:root,initial:info.config.packOutDirs?.[id]?(mode==='content'?path.dirname(path.resolve(root,info.config.packOutDirs[id])):path.resolve(root,info.config.packOutDirs[id])):''}),root);if(mode==='content')destination=path.join(destination,id);}
    setDestinations(configFile,{[id]:destination});output.write('\n  '+id+' → '+(destination||'только локальная сборка')+'\n  Настройка сохранена. Файлы обновятся при build/watch.\n\n');await ui.pause();
   }else if(action==='inspect'){
    const {index}=require('./vcts-project.cjs').buildProject(configFile,{write:false});const module=await choose('Модули проекта',index.modules.map(m=>({id:m.id,label:m.id+(m.external?' · внешний API':'')})));if(!module)continue;
    ui.clear(module);const selected=index.modules.find(m=>m.id===module);output.write('  '+selected.source+'\n\n');for(const item of selected.exports)output.write(`  ${item.name}: ${Array.isArray(item.type)?item.type.join('\n    '):item.type}\n`);if(!selected.exports.length)output.write('  Нет экспортов в текущей TS-программе.\n');output.write('\n');await ui.pause();
   }else if(action==='explain'){
    ui.clear('Ошибка из лога');const log=userPath(await ui.ask('Файл лога (Tab — дополнить)',{pathBase:root}),root);await ui.run(['explain',configFile,log]);await ui.pause();
   }else if(action==='guide'){
    ui.clear('Руководство VCTS');output.write(fs.readFileSync(path.join(toolRoot,'VCTS_GUIDE.md'),'utf8')+'\n');await ui.pause();
   }
  }catch(error){if(error instanceof Cancelled)continue;if(!error.keepOutput)ui.clear('Не удалось выполнить действие');else output.write('\n');output.write('  '+error.message+'\n\n');try{await ui.pause();}catch(cancel){if(!(cancel instanceof Cancelled))throw cancel;}}
 }}finally{input.setRawMode(false);input.pause();output.write('\x1b[?25h\x1b[0m\n');}
}
module.exports={launchTui,Terminal,projectAt,userPath,setDestinations,readProject,completePath};
