/// <reference path="types.d.ts" />
declare namespace console {
  function execute(this:void,prompt:string):unknown;
  function get(this:void,name:string):unknown;
  function set(this:void,name:string,value:VC.Value):void;
  function get_commands_list(this:void):string[];
  function get_command_info(this:void,name:string):{name:string;description:string;args:{name:string;type:string;optional?:boolean}[];kwargs:Record<string,{type:string}>}|undefined;
}
declare namespace core {
  function blank(this:void):void;
  /** Use a closure for arguments: native variadic stack ordering is broken. Callback errors are swallowed and logged. */
  function capture_output(this:void,callback:(this:void)=>void):string;
  /** Returns a recording token only for code loaded as core. */
  function get_core_token(this:void):string|undefined;
}
declare namespace pack { function unload(this:void,prefix:string):void; }
declare namespace rules {
  function get_rule(this:void,name:string):{value?:unknown;default?:unknown;listeners:Record<string,(this:void,value:unknown)=>void>};
}

declare namespace console {
  function add_command(this:void,scheme:string,description:string,handler:(this:void,args:VC.Value[],kwargs:VC.ObjectValue)=>VC.Value,isCheat?:boolean):void;
  function is_cheat(this:void,name:string):boolean;
  function set_cheat(this:void,name:string,enabled:boolean):boolean;
}
declare namespace debug {
  function get_pack_by_frame(this:void,level:number):string;
  function pull_events(this:void):boolean|undefined;
  function set_breakpoint(this:void,source:string,line:number):void;
  function remove_breakpoint(this:void,source:string,line:number):void;
  function Logger(this:void,name?:string):VC.Logger;
}
declare namespace VC {
  interface Logger {
    readonly name:string;
    info(this:Logger,text:string):void;
    warning(this:Logger,text:string):void;
    error(this:Logger,text:string):void;
  }
}
