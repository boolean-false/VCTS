// TS preview bridge. The trusted workspace's toolchain owns transpilation.
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
export type VctsPreview={schemaVersion:number;temporary:string;content:string;module:string;source:string;overrides:{module:string;text:string;file:string}[];lineMaps:Record<string,Record<number,{file:string;line:number;column:number}>>};
export function vctsConfig(file:string):string|null {
 let dir=path.dirname(file);while(true){const config=path.join(dir,'vcts.config.json');if(fs.existsSync(config))return config;const parent=path.dirname(dir);if(parent===dir)return null;dir=parent;}
}
export function toolchain(config:string,configured=''):string {
 const root=path.dirname(config);const candidates:string[]=[];
 if(configured)candidates.push(path.resolve(configured));
 const local=path.join(root,'node_modules/@vcts/toolchain');if(fs.existsSync(local))candidates.push(fs.realpathSync(local));
 try{const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));const dep=pkg.devDependencies?.['@vcts/toolchain']||pkg.dependencies?.['@vcts/toolchain'];if(typeof dep==='string'&&dep.startsWith('file:'))candidates.push(path.resolve(root,dep.slice(5)));}catch{}
 for(const candidate of candidates){const cli=candidate.endsWith('.cjs')?candidate:path.join(candidate,'tools/vcts.cjs');if(fs.existsSync(cli))return cli;}
 throw new Error('VCTS не найден. Установите зависимости проекта или задайте kompot.vctsPath (папка VCTS).');
}
export async function prepareVcts(file:string,configured='',overlays:{file:string;text:string}[]=[]):Promise<VctsPreview> {
 const config=vctsConfig(file);if(!config)throw new Error('Для TS-превью нужен vcts.config.json рядом с проектом.');
 const cli=toolchain(config,configured);const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kompot-vcts-input-'));const overlay=path.join(temp,'overlays.json');fs.writeFileSync(overlay,JSON.stringify(overlays));
 try{const {stdout}=await exec(process.execPath,[cli,'preview',file,'--config',config,'--overlays',overlay],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},timeout:30000,maxBuffer:8*1024*1024});const value=JSON.parse(stdout);if(value.schemaVersion!==1||!value.content||!value.overrides||!value.lineMaps)throw new Error('VCTS returned an unsupported preview response');return value;}
 catch(error){throw new Error((error as any).stderr||(error as Error).message);}
 finally{fs.rmSync(temp,{recursive:true,force:true});}
}
export function cleanupVcts(value:VctsPreview|null):void {
 if(value?.temporary&&path.dirname(value.temporary)===os.tmpdir()&&path.basename(value.temporary).startsWith('vcts-kompot-preview-'))fs.rmSync(value.temporary,{recursive:true,force:true});
}
/** Keep webview resource roots stable: changing options reloads its document. */
export function reuseVcts(previous:VctsPreview|null,next:VctsPreview):VctsPreview {
 if(!previous)return next;
 fs.rmSync(previous.content,{recursive:true,force:true});
 fs.renameSync(next.content,previous.content);
 cleanupVcts(next);
 return {...next,temporary:previous.temporary,content:previous.content};
}
export function mapVctsDocument(value:any,preview:VctsPreview):any {
 const result={...value};const source=result.source?.replace(/^@/,'');const position=preview.lineMaps[source]?.[result.line];if(position){result.source=position.file;result.line=position.line;}
 if(result.error)result.error=mapVctsError(result.error,preview);return result;
}
export function mapVctsError(error:string,preview:VctsPreview):string {
 for(const [file,lines] of Object.entries(preview.lineMaps)){
  const escaped=file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  error=error.replace(new RegExp(escaped+'("?\\]?):(\\d+):','g'),(whole,suffix,line)=>{const mapped=lines[Number(line)];return mapped?mapped.file+suffix+':'+mapped.line+':':whole;});
 }
 return error;
}
