const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {PassThrough}=require('node:stream');
const {spawnSync}=require('node:child_process');
const {Terminal,launchTui,projectAt,userPath,setDestinations,completePath}=require('../vcts-tui.cjs');
const {createProject}=require('../vcts-template.cjs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'vcts-tui-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const dir=path.join(root,'sample');createProject(dir,{id:'sample'});return {root,dir,file:path.join(dir,'vcts.config.json')};}
function terminal(t){const input=new PassThrough(),output=new PassThrough();input.isTTY=true;input.isRaw=false;input.setRawMode=value=>{input.isRaw=value;};output.isTTY=true;output.columns=65;output.rows=18;let text='';output.on('data',data=>text+=data);t.after(()=>{input.destroy();output.destroy();});return {input,output,ui:new Terminal(input,output),text:()=>text};}
test('no-argument noninteractive CLI prints help and explicit TUI rejects pipes',()=>{
 const cli=path.resolve(__dirname,'../vcts.cjs');const help=spawnSync(process.execPath,[cli],{encoding:'utf8',timeout:5000});assert.equal(help.status,0);assert(help.stdout.includes('vcts ui'));assert(!help.stdout.includes('\x1b[2J'));
 const ui=spawnSync(process.execPath,[cli,'ui'],{encoding:'utf8',timeout:5000});assert.equal(ui.status,1);assert(ui.stderr.includes('интерактивного терминала'));
});
test('project discovery and destination settings work without building or touching the game',t=>{
 const f=fixture(t);assert.equal(projectAt(path.join(f.dir,'src/sample')),f.file);assert.equal(projectAt(f.root),null);
 const target=path.join(f.root,'game with spaces/content/sample');const result=setDestinations(f.file,{sample:target});assert.equal(result.sample,target);assert(!fs.existsSync(target));assert(!fs.existsSync(path.join(f.dir,'build')));
 assert.throws(()=>setDestinations(f.file,{sample:f.dir}),/пересекается/);assert.throws(()=>setDestinations(f.file,{sample:path.join(f.dir,'src/sample')}),/пересекается/);
 const alias=path.join(f.root,'alias');fs.symlinkSync(path.join(f.dir,'src/sample'),alias);assert.throws(()=>setDestinations(f.file,{sample:alias}),/пересекается/);
 assert.equal(JSON.parse(fs.readFileSync(f.file)).packOutDirs.sample,target);setDestinations(f.file,{sample:null});assert.deepEqual(JSON.parse(fs.readFileSync(f.file)).packOutDirs,{});
 fs.mkdirSync(path.join(f.root,'a folder'));fs.writeFileSync(path.join(f.root,'api.d.ts'),'');assert(completePath('a',f.root)[0].includes('a folder/'));assert(completePath('"a',f.root)[0].includes('"api.d.ts"'));
 assert.equal(userPath('"./folder with spaces"',f.root),path.join(f.root,'folder with spaces'));assert.equal(userPath('~/mods'),path.join(os.homedir(),'mods'));assert.throws(()=>userPath('Users/person/content'),/\/Users\//);
});
test('menu handles arrows, scrolling, resize and cancellation; restores terminal state',async t=>{
 const f=terminal(t);const items=Array.from({length:20},(_,i)=>({id:String(i),label:'Action '+i}));const pending=f.ui.menu('Actions',items,['A project']);
 assert(f.input.isRaw);f.input.emit('keypress','',{name:'end'});f.output.emit('resize');assert(f.text().includes('Action 19'));f.input.emit('keypress','',{name:'up'});f.input.emit('keypress','',{name:'return'});assert.equal(await pending,'18');assert.equal(f.input.isRaw,false);assert(f.text().endsWith('\x1b[?25h'));assert.equal(f.input.listenerCount('keypress'),0);
 const cancel=f.ui.menu('Actions',items);f.input.emit('keypress','',{name:'escape'});assert.equal(await cancel,null);assert.equal(f.input.isRaw,false);
 const quit=f.ui.menu('Actions',items);f.input.emit('keypress','\x03',{name:'c',ctrl:true});assert.equal(await quit,'quit');
});
test('text input is editable and Ctrl+C cancels without leaving listeners behind',async t=>{
 const f=terminal(t);const answer=f.ui.ask('Path');f.input.write('/tmp/my project\n');assert.equal(await answer,'/tmp/my project');
 const cancelled=f.ui.ask('Path');f.input.emit('keypress','\x03',{name:'c',ctrl:true});await assert.rejects(cancelled);assert.equal(f.input.isRaw,false);
 const escaped=f.ui.ask('Path');f.input.emit('keypress','',{name:'escape'});await assert.rejects(escaped);assert.equal(f.input.listenerCount('keypress'),0);
});
test('interactive no-project dashboard can exit cleanly',async t=>{
 const f=fixture(t),screen=terminal(t);const pending=launchTui({cwd:f.root,input:screen.input,output:screen.output});assert(screen.text().includes('Проект не выбран'));screen.input.emit('keypress','',{name:'end'});screen.input.emit('keypress','',{name:'return'});await pending;assert.equal(screen.input.isRaw,false);assert(screen.text().includes('Создать мод или игру'));
});
