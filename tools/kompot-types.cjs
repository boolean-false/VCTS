// Translate the shipped LuaLS contracts; do not infer signatures from runtime code.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../integrations/kompot/pack');
class Parser {
 constructor(text){this.tokens=text.match(/\.\.\.|[A-Za-z_]\w*|-?\d+(?:\.\d+)?|'[^']*'|"[^"]*"|[^\s]/g)||[];this.i=0;}
 peek(){return this.tokens[this.i];}take(token){if(this.peek()!==token)throw new Error(`Expected ${token}, found ${this.peek()}`);this.i++;}
 type(){let result=this.atom();while(this.peek()==='|'){this.i++;result+=' | '+this.atom();}return result;}
 atom(){
 let token=this.tokens[this.i++],result;
 if(token==='fun'){
  let generic='';if(this.peek()==='<'){this.i++;const names=[];while(this.peek()!=='>'){names.push(this.tokens[this.i++]);if(this.peek()===',')this.i++;}this.take('>');generic='<'+names.join(', ')+'>';}
  this.take('(');const args=[];let self='void';
  while(this.peek()!==')'){
   const name=this.tokens[this.i++];let optional=false;if(this.peek()==='?'){this.i++;optional=true;}this.take(':');const value=this.type();
   if(name==='self')self=value;else args.push(name==='...'?`...args: (${value})[]`:`${name==='default'?'defaultValue':name}${optional?'?':''}: ${value}`);
   if(this.peek()!==',')break;this.i++;
  }
  this.take(')');let returns='void';if(this.peek()===':'){this.i++;const values=[this.type()];while(this.peek()===','&&![':', '?'].includes(this.tokens[this.i+2])){this.i++;values.push(this.type());}returns=values.length>1?`LuaMultiReturn<[${values.join(', ')}]>`:values[0];}
  result=`(${generic}(this: ${self}${args.length?', '+args.join(', '):''}) => ${returns})`;
 }else if(token==='('){result='('+this.type()+')';this.take(')');
 }else if(token==='{'){
  const fields=[];while(this.peek()!=='}'){
   let name=this.tokens[this.i++];if(name==='['){name=this.tokens[this.i++];this.take(']');}
   let optional='';if(this.peek()==='?'){this.i++;optional='?';}this.take(':');fields.push(`${name}${optional}: ${this.type()}`);if(this.peek()!==',')break;this.i++;
  }this.take('}');result='{ '+fields.join('; ')+' }';
 }else{
  const replacements={any:'unknown',integer:'number',nil:'undefined',table:'Record<string | number, unknown>',['function']:'((this:void, ...args: never[]) => unknown)'};
  result=replacements[token]||token;
  if(this.peek()==='<'){this.i++;const args=[];while(this.peek()!=='>'){args.push(this.type());if(this.peek()===',')this.i++;else break;}this.take('>');result=token==='table'?`Record<${args[0]==='unknown'?'string | number':args[0]}, ${args[1]||'unknown'}>`:`${token}<${args.join(', ')}>`;}
 }
 while(this.peek()==='['||this.peek()==='?'){if(this.peek()==='?'){this.i++;result=`(${result}) | undefined`;}else{this.i++;this.take(']');result=`(${result})[]`;}}
 if(!result)throw new Error('Missing type');return result;
 }
}
function generate(){
 const definitions=new Map();let current;
 for(const name of ['kompot','ui'])for(const line of fs.readFileSync(path.join(root,'annotations',name+'.lua'),'utf8').split('\n')){
  let match=/^---@class (\w+(?:<[^>]+>)?)(?::\s*(\w+))?/.exec(line);
  if(match){current={name:match[1],base:match[2],fields:[]};definitions.set(match[1].split('<')[0],current);continue;}
  match=/^---@alias (\w+) (.+)/.exec(line);if(match){current=null;definitions.set(match[1],{name:match[1],alias:new Parser(match[2]).type()});continue;}
  match=/^---@field (\w+)(\?)? (.+)/.exec(line);if(match&&current){try{current.fields.push([match[1],match[2]||'',new Parser(match[3]).type()]);}catch(error){throw new Error(line+'\n'+error.message);}}
 }
 const overrides={
  KompotPivot:'[number, number] | {x:number; y:number}',
 };
 const fieldOverrides={
  'KompotApi.state':'(<T>(this:void, initial:T, eq?:(this:void,a:T,b:T)=>boolean)=>KompotState<T>)',
  'KompotApi.form':'(<T extends Record<string, unknown>>(this:void,initial:T)=>{[P in keyof T]:KompotState<T[P]>})',
  'KompotApi.effect':'((this:void,fn:(this:void)=>void|((this:void)=>void),...deps:unknown[])=>void)',
  'KompotApi.component':'(<A extends unknown[], R>(this:void,fn:(this:void,...args:A)=>R)=>((this:void,...args:A)=>R))',
  'KompotState.patch':'((this:KompotState<T>,changes:T extends object ? Partial<T> : never)=>void)',
  'KompotState.update_field':'(<P extends keyof T>(this:KompotState<T>,key:P,value:T[P]|((this:void,old:T[P])=>T[P]))=>void)',
 };
 const body=[ '// Generated from Kompot 1.2.2 LuaLS annotations, with explicit generic refinements.', '// unknown represents dynamic Lua contracts; it is not an inferred API.', '/// <reference types="@typescript-to-lua/language-extensions" />' ];
 for(const def of definitions.values()){
  if(def.alias){body.push(`export type ${def.name} = ${overrides[def.name]||def.alias};`);continue;}
  body.push(`export interface ${def.name}${def.base?' extends '+def.base:''} {`);
  for(const [name,optional,value] of def.fields)body.push(`  ${name}${optional}: ${fieldOverrides[def.name.split('<')[0]+'.'+name]||value};`);
  body.push('}');
 }
 return body.join('\n')+'\n';
}
function emitTypes({check=false}={}){
 const dir=path.join(root,'types');fs.mkdirSync(dir,{recursive:true});
 const outputs={'contracts.d.ts':generate(),'kompot.d.ts':'import type {KompotApi} from "./contracts";\ndeclare const K:KompotApi;\nexport = K;\n','ui.d.ts':'import type {KompotUiApi} from "./contracts";\ndeclare const UI:KompotUiApi;\nexport = UI;\n','vcts.json':JSON.stringify({schemaVersion:1,modules:{kompot:{declaration:'kompot.d.ts',apiVersion:'1.2'},ui:{declaration:'ui.d.ts',apiVersion:'1.2'}}},null,2)+'\n'};
 for(const [name,value] of Object.entries(outputs)){const file=path.join(dir,name);if(check){if(fs.readFileSync(file,'utf8')!==value)throw new Error('Stale Kompot declaration: '+name);}else fs.writeFileSync(file,value);}
}
if(require.main===module)emitTypes({check:process.argv.includes('--check')});
module.exports={emitTypes};
