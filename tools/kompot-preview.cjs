const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {buildProject}=require('./vcts-project.cjs');
const {writeBuild}=require('./build-modules.cjs');
const {SourceMapConsumer}=require('source-map');
async function preparePreview(configFile,source,{sourceOverrides=[]}={}){
 const result=buildProject(configFile,{write:false,sourceOverrides});source=fs.realpathSync(source);
 const module=result.index.modules.find(item=>!item.external&&item.source===source);if(!module)throw new Error('TS file is not a module of this VCTS project. Save new files before previewing.');
 if(!result.externalDependencies.some(dep=>dep.id==='kompot')&&!result.config.units.some(unit=>unit.packs.some(pack=>pack.id==='kompot')))throw new Error('Connect Kompot first: vcts add <kompot-pack-folder>');
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'vcts-kompot-preview-'));
 try{
  writeBuild({...result,outDir:temporary});for(const dep of result.externalDependencies)fs.cpSync(dep.dir,path.join(temporary,'content',dep.id),{recursive:true});
  const overrides=[],lineMaps={};
  for(const [name,code] of result.outputs){
   const match=/^content\/([^/]+)\/modules\/(.+)\.lua$/.exec(name);if(!match)continue;
   const mapText=result.outputs.get(name+'.map');const file=mapText?JSON.parse(mapText).sources[0]:path.join(temporary,name);
   const chunk=mapText?'vcts-'+crypto.createHash('sha256').update(file).digest('hex').slice(0,16)+'.ts':file;
   overrides.push({module:match[1]+':'+match[2],text:code,file:chunk});
   if(mapText){const map=JSON.parse(mapText),consumer=await new SourceMapConsumer(map);const lines={};try{consumer.eachMapping(m=>{if(m.source&&!lines[m.generatedLine])lines[m.generatedLine]={file:m.source,line:m.originalLine,column:m.originalColumn};});}finally{consumer.destroy();}lineMaps[chunk]=lines;}
  }
  return {schemaVersion:1,temporary,content:path.join(temporary,'content'),module:module.id,source,overrides,lineMaps};
 }catch(error){fs.rmSync(temporary,{recursive:true,force:true});throw error;}
}
module.exports={preparePreview};
