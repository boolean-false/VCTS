/// <reference path="ui.d.ts" />
/** Graphical client only; bind callbacks need a HUD or container owner. */
declare namespace input {
  function keycode(this:void,name:string):number;
  function mousecode(this:void,name:string):number;
  function add_callback(this:void,binding:string,callback:(this:void)=>boolean|void,owner?:VC.UIContainer,topLevel?:boolean):void;
  function get_mouse_pos(this:void):VC.Vec2|undefined;
  function get_mouse_delta(this:void):VC.Vec2|undefined;
  function get_mouse_scroll(this:void):number|undefined;
  function get_bindings(this:void):string[]|undefined;
  function get_binding_text(this:void,binding:string):string|undefined;
  function is_active(this:void,binding:string):boolean|undefined;
  function is_pressed(this:void,code:`key:${string}`|`mouse:${string}`):boolean|undefined;
  function reset_bindings(this:void):void;
  function set_enabled(this:void,binding:string,enabled:boolean):void;
}
