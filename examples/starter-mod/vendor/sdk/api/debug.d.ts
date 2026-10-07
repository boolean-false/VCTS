/// <reference path="types.d.ts" />
declare namespace VC {
  interface DebugInfo {source?:string;short_src?:string;linedefined?:number;lastlinedefined?:number;what?:string;currentline?:number;name?:string;namewhat?:string;nups?:number;[key:string]:unknown;}
}
declare namespace debug {
  function log(this:void,text:string):void;
  function warning(this:void,text:string):void;
  function error(this:void,text:string):void;
  function print(this:void,...values:unknown[]):void;
  function pause(this:void,reason?:string,message?:string):void;
  function is_debugging(this:void):boolean;
  function count_frames(this:void):number;
  function get_traceback(this:void,start?:number):VC.DebugInfo[];
  /** base-state wrapper strips .func and errors for missing frames. */
  function getinfo(this:void,level:number,fields?:string):VC.DebugInfo;
}
