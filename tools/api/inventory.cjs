const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const project = path.resolve(__dirname, '../..');
const engine = process.env.VC_SOURCES || '/Users/dartyukhov/Desktop/Projects/voxelcore-sources';
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const lineAt = (text, index) => text.slice(0, index).split('\n').length;

function inventory(root = engine) {
  const sources = new Map();
  const read = file => {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    sources.set(file, hash(text));
    return text;
  };
  const registrations = new Map();
  for (const file of ['src/logic/scripting/lua/lua_engine.cpp', 'src/logic/scripting/scripting_hud.cpp']) {
    const source = read(file);
    for (const m of source.matchAll(/openlib\(L,\s*"([^"]+)"\s*,\s*(?:"([^"]+)"\s*,\s*)?(\w+)\)/g)) {
      let name = [m[1], m[2]].filter(Boolean).join('.');
      const context = file.endsWith('scripting_hud.cpp') ? 'client-hud'
        : m[3] === 'applib' ? 'app-script'
        : m[3] === 'testlib' ? 'engine-test'
        : m.index > source.indexOf('if (stateType == StateType::BASE ||') ? 'base/script' : 'all-states';
      if (name === '__vc_app') name = 'app';
      if (registrations.has(m[3])) throw new Error(`Duplicate registration: ${m[3]}`);
      registrations.set(m[3], {namespace:name, context, registration:{file, line:lineAt(source,m.index)}});
    }
  }
  const symbols = new Map();
  const dir = 'src/logic/scripting/lua/libs';
  const seen = new Set();
  for (const name of fs.readdirSync(path.join(root, dir)).filter(x => x.endsWith('.cpp')).sort()) {
    const file = `${dir}/${name}`, source = read(file);
    for (const array of source.matchAll(/const luaL_Reg (\w+)\[\]\s*=\s*\{([\s\S]*?)\n\};/g)) {
      const reg = registrations.get(array[1]);
      if (!reg) throw new Error(`Unmapped library registration: ${array[1]}`);
      seen.add(array[1]);
      for (const entry of array[2].matchAll(/\{\s*"([^"]+)"\s*,\s*([^\n]+?)\s*\},?/g)) {
        const id = `${reg.namespace}.${entry[1]}`;
        const index = source.indexOf(entry[0], array.index);
        symbols.set(id, {id, namespace:reg.namespace, context:reg.context,
          internal: reg.namespace.startsWith('_') || entry[1].startsWith('_') || reg.context === 'engine-test',
          native:{file, line:lineAt(source,index), binding:entry[2].trim()}, registration:reg.registration});
      }
    }
  }
  for (const [name] of registrations) if (!seen.has(name)) throw new Error(`Library array not found: ${name}`);
  {
    const file='src/logic/scripting/lua/lua_extensions.cpp', source=read(file);
    for(const section of source.matchAll(/if \(lua::getglobal\(L, "(\w+)"\)\) \{([\s\S]*?)lua::pop\(L\);/g)) {
      for(const m of section[2].matchAll(/lua::pushcfunction\(L, ([^\n]+)\);\s*lua::setfield\(L, "(\w+)"\);/g)) {
        const id=`${section[1]}.${m[2]}`;
        symbols.set(id,{id,namespace:section[1],context:'all-states',internal:m[2].startsWith('_'),
          native:{file,line:lineAt(source,source.indexOf(m[0],section.index)),binding:m[1]}});
      }
    }
  }
  // Explicit public declarations in engine Lua. This is discovery, not a Lua parser.
  // Table-literal aliases, metatables, returned module objects and dynamic exports
  // are separate audit work; they are never counted as fully inventoried here.
  const luaFiles = ['res/scripts/stdmin.lua', 'res/scripts/stdlib.lua', 'res/scripts/classes.lua', 'res/scripts/hud_classes.lua',
    'res/modules/internal/events.lua', 'res/modules/internal/session.lua',
    'res/modules/internal/rules.lua','res/modules/internal/console.lua','res/modules/internal/debugging.lua', 'res/modules/internal/lifetime_events.lua',
    'res/modules/internal/gui_util.lua', 'res/modules/internal/stdcomp.lua', 'res/modules/internal/maths_inline.lua', 'res/modules/internal/audio_input.lua',
    ...['file','inventory','pack','math','string','table'].map(x => `res/modules/internal/extensions/${x}.lua`)];
  const roots = new Set([...registrations.values()].map(x => x.namespace.split('.')[0]));
  for (const n of ['vc','events','session','rules','math','string','table','debug','app']) roots.add(n);
  for (const file of luaFiles) {
    const source = read(file);
    const pattern = /(?:\bfunction\s+([\w.]+)\s*\(|\b([\w.]+)\s*=\s*function\s*\()/g;
    for (const m of source.matchAll(pattern)) {
      const id = m[1] || m[2], parts = id.split('.');
      if (parts.length < 2 || !roots.has(parts[0]) || parts.some(p => p.startsWith('_'))) continue;
      const existing = symbols.get(id);
      const context = existing?.context || (file.endsWith('hud_classes.lua') ? 'client-hud' : file.includes('stdmin') || file.includes('/extensions/') && !file.endsWith('inventory.lua')
        ? 'all-states' : parts[0] === 'app' ? 'app-script' : 'base/script');
      symbols.set(id, {...existing, id, namespace:parts.slice(0,-1).join('.'), internal:false, context,
        lua:{file, line:lineAt(source,m.index)}});
    }
  }
  const surfaces = {callbacks:[], userdata:[], modules:[], objects:[], componentCallbacks:[], networkObjects:[], generatorCallbacks:[],layoutCallbacks:[]};
  {
    const file = 'src/logic/scripting/scripting_world_generation.cpp', source = read(file);
    for (const m of source.matchAll(/getfield\(L, "(generate_heightmap|generate_biome_parameters|place_structures|place_structures_wide)"\)/g)) {
      surfaces.generatorCallbacks.push({id:`VC.GeneratorCallbacks.${m[1]}`,file,line:lineAt(source,m.index)});
    }
  }
  {
    const file = 'res/scripts/classes.lua', source = read(file);
    for (const table of source.matchAll(/local (Socket|WriteableSocket|ServerSocket|DatagramServerSocket) = \{__index=\{([\s\S]*?)\r?\n\}\}/g)) {
      for (const m of table[2].matchAll(/(\w+)\s*=\s*(?:function\s*\(self|network\.__\w+)/g)) {
        surfaces.networkObjects.push({id:`VC.${table[1]}.${m[1]}`,file,line:lineAt(source,source.indexOf(m[0],table.index))});
      }
    }
    const camera=/local Camera = \{__index=\{([\s\S]*?)\r?\n\}\}/.exec(source);
    for(const m of camera[1].matchAll(/(\w+)=function\(self/g))surfaces.objects.push({id:`VC.Camera.${m[1]}`,file,line:lineAt(source,source.indexOf(m[0]))});
    for (const file of ['src/network/Network.cpp','src/network/Curl.cpp','src/network/Sockets.cpp','src/network/commons.hpp']) read(file);
  }
  {
    const file = 'res/modules/internal/stdcomp.lua', source = read(file);
    for (const table of source.matchAll(/local (\w+) = \{__index=\{([\s\S]*?)\n\}\}/g)) {
      for (const m of table[2].matchAll(/(\w+)\s*=\s*function\s*\(self/g)) {
        surfaces.objects.push({id:`VC.${table[1]}.${m[1]}`,file,line:lineAt(source,source.indexOf(m[0],table.index))});
      }
    }
    const nativeFile = 'src/logic/scripting/scripting_entities.cpp', native = read(nativeFile);
    for (const m of native.matchAll(/funcsset\.(\w+) = lua::hasfield\(L, "(\w+)"\)/g)) {
      if (m[1] !== m[2]) throw new Error('Component callback registration changed');
      surfaces.componentCallbacks.push({id:`VC.ComponentCallbacks.${m[1]}`,file:nativeFile,line:lineAt(native,m.index)});
    }
    for (const name of ['on_update','on_physics_update','on_render','on_enable','on_disable']) {
      const anchor = source.indexOf(name);
      if (anchor < 0) throw new Error(`Component callback missing: ${name}`);
      surfaces.componentCallbacks.push({id:`VC.ComponentCallbacks.${name}`,file,line:lineAt(source,anchor)});
    }
  }
  for (const file of ['src/logic/scripting/scripting.cpp','src/logic/scripting/scripting_hud.cpp']) {
    const source=read(file);
    for (const m of source.matchAll(/register_event\(env,\s*"([^"]+)",\s*([^;]+)\);/g)) {
      const before=source.slice(0,m.index);
      const loader=[...before.matchAll(/void scripting::(\w+)\(/g)].at(-1);
      const body=before.slice(loader?.index||0);
      const context=body.includes('BlockFuncsSet&') ? 'block' : body.includes('ItemFuncsSet&') ? 'item' : loader?.[1] || 'unknown';
      const types={block:'BlockCallbacks',item:'ItemCallbacks',load_world_script:'WorldCallbacks',load_content_script:'ContentCallbacks',load_hud_script:'HudCallbacks'};
      surfaces.callbacks.push({id:`VC.${types[context]}.${m[1]}`,name:m[1],context,eventExpression:m[2].trim(),file,line:lineAt(source,m.index),status:'registered; signature audit separate from behavioral checks'});
    }
  }
  {
    const file='src/logic/scripting/scripting.cpp',source=read(file);
    for(const m of source.matchAll(/script\.on\w+ = lua::hasfield\(L, "(on_\w+)"\)/g))surfaces.layoutCallbacks.push({id:`VC.LayoutCallbacks.${m[1]}`,file,line:lineAt(source,m.index)});
  }
  const userdataDir='src/logic/scripting/lua/usertypes';
  for (const name of fs.readdirSync(path.join(root,userdataDir)).filter(x=>x.endsWith('.cpp')).sort()) {
    const file=`${userdataDir}/${name}`, source=read(file);
    const methods=[];
    for(const table of source.matchAll(/lua_CFunction> methods\s*\{([\s\S]*?)\n\};/g)) {
      for(const m of table[1].matchAll(/\{"([^"_][^"]*)",/g)) methods.push(m[1]);
    }
    const types = {heightmap:'Heightmap',voxelfragment:'VoxelFragment',canvas:'Canvas',pcmstream:'PCMStream',random:'Random'};
    const type = types[name.replace('lua_type_','').replace('.cpp','')];
    surfaces.userdata.push({file,type,methods,status:'constructors, properties and dynamic methods need separate audit',
      declarations:methods.map(method=>({id:`VC.${type}.${method}`,file,line:lineAt(source,source.indexOf(`{"${method}"`))}))});
  }
  {
    const file='res/scripts/stdmin.lua',source=read(file),anchor='function __vc_Canvas_set_data(self, data)';
    if(!source.includes(anchor))throw new Error('Canvas.set_data alias changed');
    surfaces.userdata.find(s=>s.type==='Canvas').declarations.push({id:'VC.Canvas.set_data',file,line:lineAt(source,source.indexOf(anchor))});
  }
  {
    const file='res/scripts/hud_classes.lua',source=read(file);
    const table=/local Text3D = \{__index=\{([\s\S]*?)\n\}\}/.exec(source);
    for(const m of table[1].matchAll(/(\w+)=function\(self/g))surfaces.objects.push({id:`VC.Text3D.${m[1]}`,file,line:lineAt(source,source.indexOf(m[0]))});
  }
  {
    const file='res/scripts/hud_classes.lua',source=read(file),table=/local Skeleton = \{__index=\{([\s\S]*?)\n\}\}/.exec(source);
    for(const m of table[1].matchAll(/(\w+)=function\(self/g))surfaces.objects.push({id:`VC.NamedSkeleton.${m[1]}`,file,line:lineAt(source,source.indexOf(m[0]))});
    const streamFile='res/modules/io_stream.lua',stream=read(streamFile);
    for(const m of stream.matchAll(/function io_stream:(?!__)(\w+)\(/g))surfaces.objects.push({id:`VC.IOStream.${m[1]}`,file:streamFile,line:lineAt(stream,m.index)});
    const randomFile='res/scripts/stdmin.lua',random=read(randomFile);
    for(const m of random.matchAll(/function random_methods:(\w+)\(/g))surfaces.objects.push({id:`VC.Random.${m[1]}`,file:randomFile,line:lineAt(random,m.index)});
    const cryptoFile='src/logic/scripting/lua/libs/libcrypto.cpp',crypto=read(cryptoFile);
    for(const method of ['update','final','reset']) {
      const anchor=`lua::setfield(L, "${method}");`;
      if(!crypto.includes(anchor))throw new Error(`HashContext method missing: ${method}`);
      surfaces.objects.push({id:`VC.HashContext.${method}`,file:cryptoFile,line:lineAt(crypto,crypto.indexOf(anchor))});
    }
    for(const file of ['src/presets/ParticlesPreset.cpp','src/presets/ParticlesPreset.hpp','src/presets/WeatherPreset.cpp','src/presets/NotePreset.cpp'])read(file);
  }
  {
    const file='res/modules/internal/debugging.lua',source=read(file);
    for(const m of source.matchAll(/(info|warning|error) = function \(self, text\)/g))surfaces.objects.push({id:`VC.Logger.${m[1]}`,file,line:lineAt(source,m.index)});
  }
  function walk(directory) {
    for(const entry of fs.readdirSync(path.join(root,directory),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      if(entry.name==='internal') continue;
      const file=`${directory}/${entry.name}`;
      if(entry.isDirectory()) walk(file);
      else if(entry.name.endsWith('.lua')) {
        read(file);
        surfaces.modules.push({id:`core:${file.slice('res/modules/'.length,-4)}`,file,status:'module found, exports untyped'});
      }
    }
  }
  walk('res/modules');
  return {schema:1, scope:'All named C++ library registrations, plus explicitly named functions in selected engine Lua files.',
    limitations:['Lua table aliases/dynamic exports and userdata methods are not exhaustively discovered.',
      'Engine callbacks, constants, core modules and standard LuaJIT APIs require separate inventories.',
      'Registration context is not a guarantee a call is valid: content/world/client preconditions still apply.'],
    sourceHashes:Object.fromEntries([...sources].sort()), surfaces, symbols:[...symbols.values()].sort((a,b)=>a.id.localeCompare(b.id))};
}

function declarations() {
  const found = new Map();
  for (const file of fs.readdirSync(path.join(project,'sdk/api')).filter(f=>f.endsWith('.d.ts'))) {
    const relative = `sdk/api/${file}`, text = fs.readFileSync(path.join(project,relative),'utf8');
    const source = ts.createSourceFile(relative,text,ts.ScriptTarget.Latest,true);
    if (source.parseDiagnostics.length) throw new Error(`Invalid declaration syntax in ${relative}`);
    function add(node, id) {
      if (!node.parameters.some(p=>p.name.getText(source)==='this' && p.type?.kind===ts.SyntaxKind.VoidKeyword)) {
        throw new Error(`Missing explicit dot-call ABI: ${id}`);
      }
      const entry = found.get(id) || {file:relative,line:lineAt(text,node.getStart(source)),signatures:[]};
      const deprecated = ts.getJSDocDeprecatedTag(node);
      if (deprecated) entry.deprecated = typeof deprecated.comment === 'string' ? deprecated.comment : 'See declaration documentation';
      entry.signatures.push(node.getText(source));
      found.set(id,entry);
    }
    function visit(node, prefix=[]) {
      if (ts.isModuleDeclaration(node)) {
        if (node.body) visit(node.body,[...prefix,node.name.text]);
      } else if (ts.isFunctionDeclaration(node) && node.name && prefix.length && prefix[0] !== 'VC') {
        const id = [...prefix,node.name.text].join('.');
        add(node,id);
      } else if (ts.isVariableDeclaration(node) && !["Document","Element"].includes(node.name.getText(source)) && node.type && ts.isTypeLiteralNode(node.type)) {
        for (const member of node.type.members) if (ts.isMethodSignature(member)) {
          add(member,[...prefix,node.name.getText(source),member.name.getText(source).replace(/^"|"$/g, "")].join('.'));
        }
      } else ts.forEachChild(node,child=>visit(child,prefix));
    }
    visit(source);
  }
  return found;
}

function report(data) {
  const typed = declarations();
  const members = new Map();
  for (const memberFile of ['sdk/api/entities.d.ts','sdk/api/network.d.ts','sdk/api/generation.d.ts','sdk/api/generation-world.d.ts','sdk/api/canvas.d.ts','sdk/api/ui.d.ts','sdk/api/audio.d.ts','sdk/api/graphics.d.ts','sdk/api/cameras.d.ts','sdk/api/streams.d.ts','sdk/api/lua-extensions.d.ts','sdk/api/crypto.d.ts','sdk/api/lifecycle.d.ts','sdk/api/client.d.ts','sdk/api/tools.d.ts']) {
    const memberText = fs.readFileSync(path.join(project,memberFile),'utf8');
    const memberSource = ts.createSourceFile(memberFile,memberText,ts.ScriptTarget.Latest,true);
    function visitMembers(node) {
      if (ts.isInterfaceDeclaration(node) && ['Entity','Transform','Rigidbody','Skeleton','ComponentCallbacks','Socket','WriteableSocket','ServerSocket','DatagramServerSocket','Heightmap','VoxelFragment','GeneratorCallbacks','Canvas','PCMStream','Text3D','Camera','NamedSkeleton','IOStream','Random','HashContext','WorldCallbacks','ContentCallbacks','BlockCallbacks','ItemCallbacks','HudCallbacks','LayoutCallbacks','Logger'].includes(node.name.text)) {
        for (const member of node.members.filter(ts.isMethodSignature)) {
          const id = `VC.${node.name.text}.${member.name.getText(memberSource)}`;
          const self = member.parameters.find(p=>p.name.getText(memberSource)==='this');
          const expected = node.name.text.endsWith('Callbacks') ? 'void' : node.name.text;
          if (self?.type?.getText(memberSource) !== expected) throw new Error(`Wrong member call ABI: ${id}`);
          const entry = members.get(id) || {file:memberFile,line:lineAt(memberText,member.getStart(memberSource)),signatures:[]};
          entry.signatures.push(member.getText(memberSource)); members.set(id,entry);
        }
      }
      ts.forEachChild(node,visitMembers);
    }
    visitMembers(memberSource);
  }
  const auditedSurfaces = [...data.surfaces.objects,...data.surfaces.callbacks,...data.surfaces.layoutCallbacks,...data.surfaces.componentCallbacks,...data.surfaces.networkObjects,...data.surfaces.generatorCallbacks,...data.surfaces.userdata.flatMap(s=>s.declarations)];
  const surfaceIds = new Set(auditedSurfaces.map(s=>s.id));
  for (const id of members.keys()) if (!surfaceIds.has(id)) throw new Error(`Member absent from inventory: ${id}`);
  for (const surface of auditedSurfaces) surface.declaration = members.get(surface.id) || null;
  const ids = new Set(data.symbols.map(s=>s.id));
  // Explicit aliases discovered by source audit; these are not C++ exports.
  const aliases = JSON.parse(fs.readFileSync(path.join(project,'sdk/api/aliases.json'),'utf8'));
  for (const alias of aliases) {
    if (ids.has(alias.id)) throw new Error(`Redundant alias: ${alias.id}`);
    const text = fs.readFileSync(path.join(engine,alias.file),'utf8');
    if (!text.includes(alias.anchor)) throw new Error(`Alias anchor changed: ${alias.id}`);
    data.symbols.push({...alias, namespace:alias.id.slice(0,alias.id.lastIndexOf('.')),
      internal:false, lua:{file:alias.file,line:lineAt(text,text.indexOf(alias.anchor))}});
    data.sourceHashes[alias.file] = hash(text);
    ids.add(alias.id);
  }
  for (const [id] of typed) if (!ids.has(id)) throw new Error(`Declaration absent from inventory: ${id}`);
  data.symbols.sort((a,b)=>a.id.localeCompare(b.id));
  const groups = new Map();
  for (const symbol of data.symbols) {
    symbol.declaration = typed.get(symbol.id) || null;
    if (symbol.internal) continue;
    const group = groups.get(symbol.namespace) || {total:0,typed:0};
    group.total++; group.typed += Number(typed.has(symbol.id));
    groups.set(symbol.namespace,group);
  }
  const total = [...groups.values()].reduce((a,b)=>({total:a.total+b.total,typed:a.typed+b.typed}),{total:0,typed:0});
  data.coverage = {...total, measure:'functions with at least one declared signature', nativePublic:data.symbols.filter(s=>s.native&&!s.internal).length};
  const lines = ['# Покрытие прямого API VC','',
    'Сгенерировано `npm run api:inventory` по локальным исходникам VC. Хеши исходников и позиции символов находятся в `inventory.json`.', '',
    `Обнаружено публичных функций: **${total.total}**; объявлено: **${total.typed}**. Это покрытие перечисленных функций, а не процент всего API движка.`, '',
    'Считаются функции хотя бы с одной декларацией. Это не гарантия покрытия всех перегрузок, предусловий и состояний. Контракты сверены с исходниками вручную; выбранные сценарии проверяются отдельным headless-тестом.', '',
    '| Раздел | Декларации | Обнаружено |','| --- | ---: | ---: |',
    ...[...groups].sort().map(([name,g])=>`| ${name} | ${g.typed} | ${g.total} |`), '',
    '## Объявленные функции с известными ограничениями','',
    ...data.symbols.filter(s=>s.declaration?.deprecated).map(s=>`- \`${s.id}\`: ${s.declaration.deprecated}`), '',
    '## Границы инвентаризации','',...data.limitations.map(x=>`- ${x}`), '',
    '## Другие поверхности API','',
    `Отдельно найдены ${data.surfaces.callbacks.length} регистрации callbacks, ${data.surfaces.userdata.length} реализаций userdata и ${data.surfaces.modules.length} Lua-модулей вне internal. Конструкторы и динамические экспорты модулей не покрываются этим счётчиком.`, '',
    `Методы Lua-объектов и потоков: **${data.surfaces.objects.filter(s=>s.declaration).length}/${data.surfaces.objects.length}**; callbacks компонентов: **${data.surfaces.componentCallbacks.filter(s=>s.declaration).length}/${data.surfaces.componentCallbacks.length}**. Они учитываются отдельно от глобальных функций. Сигнатура не означает проверку всех режимов исполнения.`, '',
    `Методы сетевых объектов: **${data.surfaces.networkObjects.filter(s=>s.declaration).length}/${data.surfaces.networkObjects.length}**. Socket.as_stream использует контракт IOStream; EOF/буферизация имеют ограничения движка. HTTP shortcuts с известными ошибками отмечены @deprecated; наличие декларации не исправляет их.`, '',
    `Callbacks скриптов: **${data.surfaces.callbacks.filter(s=>s.declaration).length}/${data.surfaces.callbacks.length}**; layout: **${data.surfaces.layoutCallbacks.filter(s=>s.declaration).length}/${data.surfaces.layoutCallbacks.length}**. init зарегистрирован, но места его вызова не найдены; его payload оставлен unknown.`, '',
    `Callbacks генератора: **${data.surfaces.generatorCallbacks.filter(s=>s.declaration).length}/${data.surfaces.generatorCallbacks.length}**; методы userdata: **${data.surfaces.userdata.flatMap(s=>s.declarations).filter(s=>s.declaration).length}/${data.surfaces.userdata.flatMap(s=>s.declarations).length}**. Свойства и конструкторы проверяются отдельно.`, '',
    '| Объект/контракт | Методы с декларациями |','| --- | ---: |',
    ...['Entity','Transform','Rigidbody','Skeleton','ComponentCallbacks','Socket','WriteableSocket','ServerSocket','DatagramServerSocket','Camera','Text3D','NamedSkeleton','IOStream','Random','HashContext','Logger','Canvas','PCMStream','Heightmap','VoxelFragment','WorldCallbacks','BlockCallbacks','ItemCallbacks','ContentCallbacks','HudCallbacks','LayoutCallbacks','GeneratorCallbacks'].map(name=>`| VC.${name} | ${auditedSurfaces.filter(s=>s.id.startsWith(`VC.${name}.`) && s.declaration).length} |`), '',
    '| Поверхность | Найдено |','| --- | --- |',
    ...data.surfaces.userdata.map(s=>`| ${s.file.split('/').at(-1)} | ${s.methods.join(', ') || 'Динамическая регистрация — нужна проверка'} |`), '',
    ...data.surfaces.modules.map(s=>`- \`${s.id}\` — ${s.status}`), '',
    '## Ещё без деклараций','',...data.symbols.filter(s=>!s.internal&&!s.declaration).map(s=>`- \`${s.id}\` — ${s.context}; \`${s.native?.file||s.lua.file}\``),''];
  return {data,markdown:lines.join('\n')};
}
if(require.main===module) {
  const result=report(inventory());
  const outputs={'sdk/api/inventory.json':JSON.stringify(result.data,null,2)+'\n','sdk/api/COVERAGE.md':result.markdown};
  for(const [file,text] of Object.entries(outputs)) {
    if(process.argv.includes('--check')) {
      if(!fs.existsSync(path.join(project,file)) || fs.readFileSync(path.join(project,file),'utf8')!==text) throw new Error(`API inventory changed: ${file}; run npm run api:inventory and review`);
    } else fs.writeFileSync(path.join(project,file),text);
  }
  console.log(result.data.coverage);
}
module.exports={inventory,declarations,report};
