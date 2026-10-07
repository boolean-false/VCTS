/// <reference path="math.d.ts" />
declare namespace cameras {
  function index(this:void,name:string):number;
  function name(this:void,id:number):string;
  function get_pos(this:void,id:number):VC.Vec3;
  function set_pos(this:void,id:number,value:VC.Vec3):void;
  function get_rot(this:void,id:number):VC.Mat4;
  function set_rot(this:void,id:number,value:VC.Mat4):void;
  function get_zoom(this:void,id:number):number;
  function set_zoom(this:void,id:number,value:number):void;
  function get_fov(this:void,id:number):number;
  function set_fov(this:void,id:number,value:number):void;
  function is_perspective(this:void,id:number):boolean;
  function set_perspective(this:void,id:number,value:boolean):void;
  function is_flipped(this:void,id:number):boolean;
  function set_flipped(this:void,id:number,value:boolean):void;
  function get_front(this:void,id:number):VC.Vec3;
  function get_right(this:void,id:number):VC.Vec3;
  function get_up(this:void,id:number):VC.Vec3;
  function look_at(this:void,id:number,target:VC.Vec3,factor?:number):void;
  function get(this:void,name:string|number):VC.Camera;
}
declare namespace VC {
  interface Camera {
    readonly cid:number;
    get_name(this:Camera):string;
    get_index(this:Camera):number;
    get_pos(this:Camera):VC.Vec3;
    set_pos(this:Camera,value:VC.Vec3):void;
    get_rot(this:Camera):VC.Mat4;
    set_rot(this:Camera,value:VC.Mat4):void;
    get_zoom(this:Camera):number;
    set_zoom(this:Camera,value:number):void;
    get_fov(this:Camera):number;
    set_fov(this:Camera,value:number):void;
    is_perspective(this:Camera):boolean;
    set_perspective(this:Camera,value:boolean):void;
    is_flipped(this:Camera):boolean;
    set_flipped(this:Camera,value:boolean):void;
    get_front(this:Camera):VC.Vec3;
    get_right(this:Camera):VC.Vec3;
    get_up(this:Camera):VC.Vec3;
    look_at(this:Camera,target:Vec3,factor?:number):void;
  }
}
