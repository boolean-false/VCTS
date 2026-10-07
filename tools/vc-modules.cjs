// TSTL 1.37.1 integration. All path changes happen while printing Lua AST calls.
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const tstl = require("typescript-to-lua");
const { buildMinimalLualibBundle } = require("typescript-to-lua/dist/LuaLib");

const slash = value => value.split(path.sep).join("/");
const within = (root, file) => {
  const relative = path.relative(root, file);
  return relative !== "" && !relative.startsWith(`..${path.sep}`)
    && relative !== ".." && !path.isAbsolute(relative);
};

function buildModules(configPath, override) {
  const root = path.dirname(path.resolve(configPath));
  const config = override || JSON.parse(fs.readFileSync(configPath, "utf8"));
  const fail = message => { throw new Error(message); };
  const packs = config.packs.map(pack => ({
    ...pack,
    root: fs.realpathSync(path.resolve(root, pack.root)),
    public: new Set(pack.public || []),
    dependencies: new Set(pack.dependencies || []),
  }));
  const ids = new Set();
  for (const pack of packs) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]{1,23}$/.test(pack.id) || ids.has(pack.id.toLowerCase())) {
      fail(`Invalid or duplicate pack ID: ${pack.id}`);
    }
    ids.add(pack.id.toLowerCase());
    for (const other of packs) {
      if (other !== pack && (other.root === pack.root || within(other.root, pack.root))) {
        fail(`Overlapping pack roots: ${pack.id}, ${other.id}`);
      }
    }
  }

  function owner(filename) {
    const real = fs.realpathSync(filename);
    const pack = packs.find(item => within(item.root, real));
    if (!pack) fail(`Module has no pack owner: ${filename}`);
    const relative = slash(path.relative(pack.root, real));
    if (!relative.endsWith(".ts") || relative.endsWith(".d.ts")) {
      fail(`Runtime module must be a .ts source: ${filename}`);
    }
    const name = relative.slice(0, -3);
    if (name.toLowerCase() === "__vcts_lualib" || !/^[a-zA-Z0-9_./-]+$/.test(name)) {
      fail(`Unsupported or reserved module name: ${relative}`);
    }
    return { pack, relative, key: `${pack.id}:${name}`, output: `${pack.id}/modules/${name}.lua` };
  }

  const tsconfig = path.resolve(root, config.tsconfig);
  const read = ts.readConfigFile(tsconfig, ts.sys.readFile);
  if (read.error) fail(ts.flattenDiagnosticMessageText(read.error.messageText, "\n"));
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(tsconfig));
  // This adapter owns printing and module layout. No arbitrary TSTL plugins,
  // JS emission, bundler, or source-map global override is enabled here.
  const options = {
    ...parsed.options, lib:parsed.options.lib || ["lib.es2022.d.ts"], types:parsed.options.types || [], noEmit: false, declaration: false, emitDeclarationOnly: false,
    target: ts.ScriptTarget.ESNext, sourceMap: false, inlineSourceMap: false,
    luaTarget: tstl.LuaTarget.LuaJIT,
    luaLibImport: tstl.LuaLibImportKind.RequireMinimal, noImplicitSelf: true,
  };
  options.paths={...options.paths,...Object.fromEntries((config.externalModules||[]).map(binding=>[binding.id,[binding.declaration]]))};
  const overlays=new Map((config.sourceOverrides||[]).map(item=>[path.resolve(item.file),item.text]));
  const compilerHost=ts.createCompilerHost(options),readSource=compilerHost.readFile;
  compilerHost.readFile=file=>overlays.has(path.resolve(file))?overlays.get(path.resolve(file)):readSource(file);
  const program = ts.createProgram(parsed.fileNames, options,compilerHost);
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
  const format = errors => ts.formatDiagnosticsWithColorAndContext(errors, {
    getCanonicalFileName: file => file,
    getCurrentDirectory: () => root,
    getNewLine: () => "\n",
  });
  if (diagnostics.length) {
    const hints=diagnostics.filter(d=>d.code===2307).map(d=>ts.flattenDiagnosticMessageText(d.messageText," ").match(/['"]([A-Za-z_]\w*:[^'"]+)['"]/)).filter(Boolean).map(m=>`External API ${m[1]} is unresolved. Use vcts add <pack-folder>; for an untyped Lua API use vcts types or --types <api.d.ts>.`);
    fail(format(diagnostics)+(hints.length?'\n'+[...new Set(hints)].join('\n'):''));
  }

  const checker = program.getTypeChecker();
  // Reject unsupported dynamic loading explicitly instead of silently emitting
  // require closures with unresolvable paths. Type-only import expressions are OK.
  for (const source of program.getSourceFiles().filter(file => !file.isDeclarationFile)) {
    owner(source.fileName);
    const visit = node => {
      if(ts.isForStatement(node)&&node.initializer&&ts.isVariableDeclarationList(node.initializer)&&(node.initializer.flags&ts.NodeFlags.Let)) {
        const variables=new Set();
        const collect=name=>{
          if(ts.isIdentifier(name))variables.add(checker.getSymbolAtLocation(name));
          else for(const element of name.elements)if(ts.isBindingElement(element))collect(element.name);
        };
        for(const declaration of node.initializer.declarations)collect(declaration.name);
        // TSTL выносит счётчик перед while, поэтому замыкание видит последнее значение.
        const capture=(child,inFunction=false)=>{
          const nested=inFunction||ts.isFunctionLike(child);
          if(nested&&ts.isIdentifier(child)&&variables.has(checker.getSymbolAtLocation(child))) {
            const position=source.getLineAndCharacterOfPosition(child.getStart(source));
            fail(`${source.fileName}:${position.line+1}:${position.character+1}: переменная цикла ${child.text} захвачена обработчиком. Создайте const в теле цикла и используйте её в обработчике.`);
          }
          ts.forEachChild(child,next=>capture(next,nested));
        };
        capture(node.statement);
      }
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
        && node.moduleSpecifier.text === "lualib_bundle") {
        fail(`${source.fileName}: lualib_bundle is reserved for TSTL helpers`);
      }
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
        fail(`${source.fileName}: use static imports; dynamic import/require is not supported`);
      }
      if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='vcts_load') {
        const symbol=checker.getSymbolAtLocation(node.expression);
        if(!symbol?.declarations?.some(d=>d.getSourceFile().isDeclarationFile&&ts.getJSDocTags(d).some(tag=>tag.tagName.text==='vctsDeferred')))fail(`${source.fileName}: vcts_load is reserved for the SDK declaration`);
        if(node.arguments.length!==1||!ts.isStringLiteral(node.arguments[0])||!/^([A-Za-z_]\w*):([A-Za-z0-9_/-]+)$/.test(node.arguments[0].text))fail(`${source.fileName}: vcts_load requires one literal pack:module ID`);
        let parent=node.parent;
        while(parent&&!ts.isFunctionLike(parent))parent=parent.parent;
        if(!parent)fail(`${source.fileName}: vcts_load must be called inside a function after module initialization`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  const graph = new Map();
  const deferredGraph = new Map();
  const features = new Map(packs.map(pack => [pack.id, new Set()]));
  const outputs = new Map();
  const nativeModules = new Map();
  for (const native of config.nativeModules || []) {
    const match = /^([^:]+):([a-zA-Z0-9_/-]+)$/.exec(native.id);
    const pack = match && packs.find(item => item.id === match[1]);
    if (!pack || match[2].split("/").some(part => !part || part === "..")) fail(`Invalid native module: ${native.id}`);
    const declaration = fs.realpathSync(path.resolve(root, native.declaration));
    if (!declaration.endsWith(".d.ts") || nativeModules.has(declaration)) fail(`Invalid native declaration: ${declaration}`);
    const output = `${pack.id}/modules/${match[2]}.lua`;
    if ([...outputs.keys()].some(key => key.toLowerCase() === output.toLowerCase())
      || match[2].toLowerCase() === "__vcts_lualib") fail(`Native module collision: ${native.id}`);
    nativeModules.set(declaration, { pack, relative: `${match[2]}.lua`, key: native.id, output });
    outputs.set(output, fs.readFileSync(path.resolve(root, native.source), "utf8"));
    graph.set(native.id, new Set()); // Native Lua is opaque; its own imports require integration tests.
  }
  for(const binding of config.externalModules||[]) {
    const [id,name]=binding.id.split(':');
    const declaration=fs.realpathSync(binding.declaration);
    if(nativeModules.has(declaration))fail(`Declaration bound to multiple Lua modules: ${declaration}`);
    nativeModules.set(declaration,{pack:{id,public:new Set([`${name}.lua`])},relative:`${name}.lua`,key:binding.id});
    graph.set(binding.id,new Set());
  }
  const cache = ts.createModuleResolutionCache(root, file => file, options);
  const plugin = {
    visitors: {
      [ts.SyntaxKind.VariableStatement]: (node,context) => {
        if(node.declarationList.declarations.length<2)return context.superTransformNode(node);
        // Временные вычисления следующей переменной должны идти после предыдущего объявления.
        return node.declarationList.declarations.flatMap(declaration=>context.transformStatements(
          ts.factory.updateVariableStatement(node,node.modifiers,
            ts.factory.updateVariableDeclarationList(node.declarationList,[declaration]))));
      },
    },
    printer(currentProgram, host, filename, luaFile) {
      const current = owner(filename);
      graph.set(current.key, new Set());
      deferredGraph.set(current.key, new Set());
      for (const feature of luaFile.luaLibFeatures) features.get(current.pack.id).add(feature);
      class VcPrinter extends tstl.LuaPrinter {
        printCallExpression(expression) {
          const deferred=tstl.isIdentifier(expression.expression)&&expression.expression.text==='vcts_load';
          if (!deferred&&(!tstl.isIdentifier(expression.expression) || expression.expression.text !== "require")) {
            return super.printCallExpression(expression);
          }
          const argument = expression.params[0];
          if (expression.params.length !== 1 || !tstl.isStringLiteral(argument)) {
            fail(`${filename}: non-literal Lua require is unsupported`);
          }
          let resolved;
          if (argument.value === "lualib_bundle") {
            resolved = `${current.pack.id}:__vcts_lualib`;
          } else {
            const specifier = argument.value.replace(/^@NoResolution:/, "");
            const result = ts.resolveModuleName(specifier, filename, options, ts.sys, cache).resolvedModule;
            if (!result) fail(`${filename}: cannot resolve runtime import ${specifier}`);
            const native = nativeModules.get(fs.realpathSync(result.resolvedFileName));
            if (result.resolvedFileName.endsWith(".d.ts") && !native) {
              fail(`${filename}: ${specifier} has declarations but no runtime implementation`);
            }
            const target = native || owner(result.resolvedFileName);
            if (target.pack.id !== current.pack.id) {
              if (!current.pack.dependencies.has(target.pack.id)) {
                fail(`${current.pack.id} imports ${target.key} without a declared dependency`);
              }
              if (!target.pack.public.has(target.relative)) {
                fail(`${current.pack.id} imports private module ${target.key}`);
              }
            }
            (deferred?deferredGraph:graph).get(current.key).add(target.key);
            resolved = target.key;
          }
          return super.printCallExpression({
            ...expression,
            expression:deferred?{...expression.expression,text:'require'}:expression.expression,
            params: [{ ...argument, value: resolved }],
          });
        }
      }
      return new VcPrinter(host, currentProgram, filename).print(luaFile);
    },
  };
  const result = tstl.getProgramTranspileResult(ts.sys, () => {}, { program, plugins: [plugin] });
  if (result.diagnostics.length) fail(format(result.diagnostics));
  for (const file of result.transpiledFiles) {
    const item = owner(file.fileName);
    // Case-insensitive collisions are rejected for portable Windows/macOS packs.
    if ([...outputs.keys()].some(key => key.toLowerCase() === item.output.toLowerCase())) {
      fail(`Output collision: ${item.output}`);
    }
    outputs.set(item.output, file.code);
    if(config.sourceMaps) {
      const map=JSON.parse(file.sourceMap);
      map.file=path.basename(item.output);map.sourceRoot='';
      map.sources=[slash(fs.realpathSync(file.fileName))];map.sourcesContent=[program.getSourceFile(file.fileName).text];
      map.x_vcts_luaHash=require('node:crypto').createHash('sha256').update(file.code).digest('hex');
      outputs.set(`${item.output}.map`,JSON.stringify(map)+'\n');
    }
  }

  const visited = new Set();
  const active = [];
  function checkCycle(key) {
    if (active.includes(key)) fail(`Runtime import cycle: ${[...active.slice(active.indexOf(key)), key].join(" -> ")}`);
    if (visited.has(key)) return;
    if (!graph.has(key)) fail(`Required module was not emitted: ${key}`);
    active.push(key);
    for (const target of graph.get(key)) checkCycle(target);
    active.pop();
    visited.add(key);
  }
  for (const key of [...graph.keys()].sort()) checkCycle(key);
  for(const [key,targets] of deferredGraph)for(const target of targets)if(!graph.has(target))fail(`Deferred module was not emitted: ${key} -> ${target}`);
  // VC executes this entry in a fresh component environment for every entity.
  // The required TS module is cached, so instance state belongs inside its factory.
  function resolveFactory(entry, kind) {
    const match = /^([^:]+):([a-zA-Z0-9_/-]+)$/.exec(entry.id);
    const pack = match && packs.find(item => item.id === match[1]);
    if (!pack || match[2].split('/').some(part => !part || part === '..')) fail(`Invalid ${kind.toLowerCase()} ID: ${entry.id}`);
    const filename = fs.realpathSync(path.resolve(root, entry.source));
    const target = owner(filename);
    if (target.pack !== pack) fail(`${kind} factory must belong to its pack: ${entry.id}`);
    const source = program.getSourceFiles().find(file => fs.realpathSync(file.fileName) === filename);
    const symbol = source && checker.getSymbolAtLocation(source);
    const exported = symbol && checker.getExportsOfModule(symbol).find(s => s.name === entry.factory);
    const signatures = exported && checker.getTypeOfSymbolAtLocation(exported, source).getCallSignatures();
    if (!signatures?.length || !graph.has(target.key)) fail(`Missing callable ${kind.toLowerCase()} factory: ${entry.factory}`);
    if (signatures.some(s => !s.thisParameter || !(checker.getTypeOfSymbolAtLocation(s.thisParameter, source).flags & ts.TypeFlags.Void))) {
      fail(`${kind} factory requires explicit this: void: ${entry.factory}`);
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(entry.factory)) fail(`Invalid factory name: ${entry.factory}`);
    return {pack, name:match[2], target};
  }
  for (const entry of config.components || []) {
    const {pack, name, target} = resolveFactory(entry, 'Component');
    const output = `${pack.id}/scripts/components/${name}.lua`;
    if ([...outputs.keys()].some(key => key.toLowerCase() === output.toLowerCase())) fail(`Output collision: ${output}`);
    // JSON strings here contain only validated ASCII identifiers/paths.
    outputs.set(output, `-- Generated component entry. Factory runs once per instance.\n` +
      `local factory = require(${JSON.stringify(target.key)})[${JSON.stringify(entry.factory)}]\n` +
      `local fields = factory({entity=entity, args=ARGS, saved=SAVED_DATA})\n` +
      `assert(type(fields) == "table", "component factory must return a table")\n` +
      `for key, value in pairs(fields) do\n` +
      `  assert(type(key) == "string" and key ~= "entity" and key ~= "this" and key ~= "ARGS" and key ~= "SAVED_DATA" and key:sub(1,2) ~= "__", "reserved component field")\n` +
      `  this[key] = value\n` +
      `end\n`);
  }
  for (const entry of config.generators || []) {
    const {pack, name, target} = resolveFactory(entry, 'Generator');
    const output = `${pack.id}/generators/${name}.files/script.lua`;
    if ([...outputs.keys()].some(key => key.toLowerCase() === output.toLowerCase())) fail(`Output collision: ${output}`);
    outputs.set(output, `-- Generated generator entry. Modules execute in a separate Lua state.\n` +
      `local factory = require(${JSON.stringify(target.key)})[${JSON.stringify(entry.factory)}]\n` +
      `local callbacks = factory({seed=SEED, dir=__DIR__, file=__FILE__})\n` +
      `local allowed = {generate_heightmap=true, generate_biome_parameters=true, place_structures=true, place_structures_wide=true}\n` +
      `local env = getfenv(1)\n` +
      `assert(type(callbacks) == "table", "generator factory must return a table")\n` +
      `for key, value in pairs(callbacks) do\n` +
      `  assert(allowed[key] and type(value) == "function", "invalid generator callback")\n` +
      `  env[key] = value\n` +
      `end\n`);
  }
  for(const entry of config.scripts || []) {
    const {pack,name,target}=resolveFactory(entry,'Script');
    if(!['world','content','hud','block','item'].includes(entry.kind))fail(`Invalid script kind: ${entry.kind}`);
    const script=['block','item'].includes(entry.kind)?name:entry.kind;
    const output=`${pack.id}/scripts/${script}.lua`;
    if([...outputs.keys()].some(k=>k.toLowerCase()===output.toLowerCase()))fail(`Output collision: ${output}`);
    outputs.set(output,`-- Generated ${entry.kind} entry.\n`+
      `local callbacks=require(${JSON.stringify(target.key)})[${JSON.stringify(entry.factory)}]({packId=${JSON.stringify(pack.id)},environment=CUR_ENV})\n`+
      `assert(type(callbacks)=="table", "script factory must return a table")\nlocal env=getfenv(1)\n`+
      `for key,value in pairs(callbacks) do\n  assert(type(key)=="string" and key:sub(1,2)~="__" and key~="CUR_ENV" and key~="PACK_ID" and type(value)=="function", "invalid script handler")\n  env[key]=value\nend\n`);
  }
  for (const entry of config.layouts || []) {
    const {pack,name,target}=resolveFactory(entry,'Layout');
    const output=`${pack.id}/layouts/${name}.xml.lua`;
    if([...outputs.keys()].some(k=>k.toLowerCase()===output.toLowerCase()))fail(`Output collision: ${output}`);
    outputs.set(output,`-- Generated layout entry. One factory per document.\n` +
      `local callbacks = require(${JSON.stringify(target.key)})[${JSON.stringify(entry.factory)}]({document=document, environment=DOC_ENV})\n` +
      `assert(type(callbacks)=="table", "layout factory must return a table")\n` +
      `local env=getfenv(1)\n` +
      `for key,value in pairs(callbacks) do\n` +
      `  assert(type(key)=="string" and key:sub(1,2)~="__" and key~="document" and key~="DOC_ENV" and type(value)=="function", "invalid layout handler")\n` +
      `  env[key]=value\nend\n`);
  }
  for (const pack of packs) {
    if (features.get(pack.id).size > 0) {
      outputs.set(`${pack.id}/modules/__vcts_lualib.lua`,
        buildMinimalLualibBundle(features.get(pack.id), tstl.LuaTarget.LuaJIT, ts.sys));
    }
  }
  function describeExport(exported,file) {
    const symbol=exported.flags&ts.SymbolFlags.Alias?checker.getAliasedSymbol(exported):exported;
    const type=symbol.flags&ts.SymbolFlags.Type?checker.getDeclaredTypeOfSymbol(symbol):checker.getTypeOfSymbolAtLocation(symbol,file),calls=type.getCallSignatures();
    return {name:exported.name,type:calls.length?calls.map(call=>checker.signatureToString(call)):checker.typeToString(type)};
  }
  const moduleIndex=program.getSourceFiles().filter(file=>!file.isDeclarationFile).map(file=>{
    const item=owner(file.fileName),symbol=checker.getSymbolAtLocation(file);
    return {id:item.key,source:fs.realpathSync(file.fileName),public:item.pack.public.has(item.relative),imports:[...(graph.get(item.key)||[])],lazyImports:[...(deferredGraph.get(item.key)||[])],
      exports:symbol?checker.getExportsOfModule(symbol).map(exported=>describeExport(exported,file)):[]};
  });
  for(const binding of config.externalModules||[]) {
    const file=program.getSourceFile(binding.declaration),symbol=file&&checker.getSymbolAtLocation(file);
    moduleIndex.push({id:binding.id,source:binding.declaration,public:true,external:true,imports:[],exports:symbol?checker.getExportsOfModule(symbol).map(exported=>describeExport(exported,file)):[]});
  }
  return { outputs, graph, features, moduleIndex, sourceFiles:program.getSourceFiles().map(s=>s.fileName), tsconfig, outDir: path.resolve(root, config.outDir) };
}

module.exports = { buildModules };
