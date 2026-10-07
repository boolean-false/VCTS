/// <reference path="types.d.ts" />
declare namespace bjson {
  function tobytes(this:void,value:VC.Value,compress?:boolean):VC.Bytearray;
  function frombytes(this:void,bytes:VC.Bytearray|number[]):unknown;
}
declare namespace compression {
  function encode(this:void,bytes:VC.Bytearray,algorithm?:"gzip",asTable?:false):VC.Bytearray;
  function encode(this:void,bytes:VC.Bytearray,algorithm:"gzip",asTable:true):number[];
  function decode(this:void,bytes:VC.Bytearray,algorithm?:"gzip",asTable?:false):VC.Bytearray;
  function decode(this:void,bytes:VC.Bytearray,algorithm:"gzip",asTable:true):number[];
}
declare namespace byteutil {
  function get_size(this:void,format:string):number;
  function pack(this:void,format:string,...values:(number|boolean)[]):VC.Bytearray;
  function tpack(this:void,format:string,...values:(number|boolean)[]):number[];
  function unpack(this:void,format:string,bytes:VC.Bytearray):LuaMultiReturn<(number|boolean)[]>;
}
declare namespace utf8 {
  function tobytes(this:void,text:string,asTable?:false):VC.Bytearray;
  function tobytes(this:void,text:string,asTable:true):number[];
  function tostring(this:void,bytes:VC.Bytearray|number[]):string;
  function length(this:void,text:string):number;
  function codepoint(this:void,text:string):number;
  /** 1-based inclusive Unicode character positions, not TS array indices. */
  function sub(this:void,text:string,start:number,end?:number):string;
  function upper(this:void,text:string):string;
  function lower(this:void,text:string):string;
  function encode(this:void,codepoint:number):string;
  function escape(this:void,text:string):string;
  function escape_xml(this:void,text:string):string;
}
declare namespace VC { interface XMLNode {"#":string;[key:string]:string|XMLNode;[index:number]:string|XMLNode;} }
declare namespace xml {
  function parse(this:void,source:string):VC.XMLNode;
  function parse_vcd(this:void,source:string,rootTag?:string):VC.XMLNode;
  function tostring(this:void,node:VC.XMLNode,nice?:boolean):string;
}
