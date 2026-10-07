/// <reference path="types.d.ts" />
/** VC additions to Lua tables. Native array positions and callback keys start at 1. Prefer TS Array methods for TS code. */
declare namespace table {
  function copy<T extends object>(this:void,value:T):T;
  function deep_copy<T extends object>(this:void,value:T):T;
  function count_pairs(this:void,value:object):number;
  function random<T>(this:void,value:T[]):T|undefined;
  function shuffle<T>(this:void,value:T[]):T[];
  function merge<T extends object>(this:void,target:T,source:object):T;
  function extend<T extends object>(this:void,target:T,source:Partial<T>):T;
  function map<K extends string|number,V>(this:void,value:Record<K,V>,transform:(this:void,key:K,value:V)=>V):Record<K,V>;
  function filter<K extends string|number,V>(this:void,value:Record<K,V>,predicate:(this:void,key:K,value:V)=>boolean):Record<K,V>;
  function set_default<K extends string,V>(this:void,value:Partial<Record<K,V>>,key:K,fallback:V):V;
  function flat<T>(this:void,value:(T|T[])[]):T[];
  function deep_flat(this:void,value:unknown[]):unknown[];
  function sub<T>(this:void,value:T[],start?:number,stop?:number):T[];
  function has<T>(this:void,value:T[],item:T):boolean;
  function index<T>(this:void,value:T[],item:T):number;
  function remove_value<T>(this:void,value:T[],item:T):void;
  function insert_unique<T>(this:void,value:T[],item:T):void;
  function insert_unique<T>(this:void,value:T[],position:number,item:T):void;
  function tostring(this:void,value:unknown[]):string;
  function keys<T extends object>(this:void,value:T):(keyof T)[];
}
declare namespace string {
  function pattern_safe(this:void,text:string):LuaMultiReturn<[string,number]>;
  function explode(this:void,separator:string,text:string,withPattern?:boolean):string[];
  function split(this:void,text:string,delimiter:string):string[];
  function formatted_time(this:void,seconds?:number):{h:number;m:number;s:number;ms:number};
  function formatted_time(this:void,seconds:number,format:string):string;
  function replace(this:void,text:string,find:string,replacement:string):string;
  function trim(this:void,text:string,char?:string):string;
  function trim_right(this:void,text:string,char?:string):string;
  function trim_left(this:void,text:string,char?:string):string;
  function pad(this:void,text:string,size:number,char?:string):string;
  function left_pad(this:void,text:string,size:number,char?:string):string;
  function right_pad(this:void,text:string,size:number,char?:string):string;
  function starts_with(this:void,text:string,prefix:string):boolean;
  function ends_with(this:void,text:string,suffix:string):boolean;
  function url_encode(this:void,text:string):string;
  function url_decode(this:void,text:string):string;
}
declare namespace math {
  function clamp(this:void,value:number,min:number,max:number):number;
  function rand(this:void,min:number,max:number):number;
  function normalize(this:void,value:number,period?:number):number;
  function round(this:void,value:number,places?:number):number;
  function sum(this:void,...values:number[]):number;
  function sum(this:void,values:number[]):number;
  function sign(this:void,value:number):number;
  function noise(this:void,x:number,octaves?:number):number;
  function noise2d(this:void,x:number,y:number,octaves?:number):number;
  function normal_random(this:void):number;
}
declare namespace VC {
  /** VC 0.32.1 shares a Lua prefetch buffer between instances. Use one per state; call seed explicitly. */
  interface Random {
    random(this:Random):number;
    random(this:Random,max:number):number;
    random(this:Random,min:number,max:number):number;
    seed(this:Random,seed:number):void;
    bytes(this:Random,length:number):Bytearray;
  }
}
declare namespace random {
  function random(this:void):number;
  function random(this:void,max:number):number;
  function random(this:void,min:number,max:number):number;
  function bytes(this:void,length:number):VC.Bytearray;
  function uuid(this:void):string;
  /** @deprecated Constructor ignores the provided seed in VC 0.32.1; call .seed explicitly. Multiple instances share a prefetch buffer. */
  function Random(this:void,seed?:number):VC.Random;
}
