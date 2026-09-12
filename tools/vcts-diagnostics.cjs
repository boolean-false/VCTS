const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {SourceMapConsumer}=require('source-map');
const pattern=/(?:\[string ")?([A-Za-z_][A-Za-z0-9_]*):modules\/([A-Za-z0-9_./-]+\.lua)(?:"\])?:(\d+)/g;
async function explain(log,outDir) {
  const replacements=await Promise.all([...log.matchAll(pattern)].map(async ([original,pack,module,line])=>{
    if(module.split('/').some(part=>part==='..'||part==='.'||!part))return original;
    const projectModule=path.join(outDir,'modules',module);
    const lua=pack==='project'&&fs.existsSync(projectModule)?projectModule:path.join(outDir,'content',pack,'modules',module),file=`${lua}.map`;
    if(!fs.existsSync(file)||!fs.existsSync(lua))return original;
    const map=JSON.parse(fs.readFileSync(file));
    const hash=crypto.createHash('sha256').update(fs.readFileSync(lua)).digest('hex');
    if(hash!==map.x_vcts_luaHash)return `${original} [source map does not match Lua]`;
    const consumer=await new SourceMapConsumer(map);
    try {
      let position;
      // Use an actual mapping on this line; synthetic wrapper lines stay in Lua.
      consumer.eachMapping(m=>{if(!position && m.generatedLine===Number(line) && m.source)position={source:m.source,line:m.originalLine,column:m.originalColumn};});
      if(!position)return original;
      const index=map.sources.indexOf(position.source);
      const stale=fs.existsSync(position.source)&&index>=0&&fs.readFileSync(position.source,'utf8')!==map.sourcesContent[index];
      return `${position.source}:${position.line}:${position.column+1}${stale?' [built source snapshot]':''} (${original})`;
    } finally {consumer.destroy();}
  }));
  let index=0;return log.replace(pattern,()=>replacements[index++]);
}
module.exports={explain};
