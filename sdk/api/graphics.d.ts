/// <reference path="math.d.ts" />
/// <reference path="canvas.d.ts" />
declare namespace VC {
  interface NotePreset {display?:string;color?:Vec4;scale?:number;render_distance?:number;xray_opacity?:number;perspective?:boolean;font?:string;}
  interface ParticlesPreset {
    texture?:string;frames?:string[];collision?:boolean;lighting?:boolean;global_up_vector?:boolean;
    max_distance?:number;spawn_interval?:number;lifetime?:number;lifetime_spread?:number;
    velocity?:Vec3;acceleration?:Vec3;explosion?:Vec3;size?:Vec3;size_spread?:number;
    angle_spread?:number;min_angular_vel?:number;max_angular_vel?:number;
    spawn_spread?:Vec3;spawn_offset?:Vec3;spawn_shape?:string;random_sub_uv?:number;
  }
  interface WeatherPreset {
    fall?:{texture?:string;vspeed?:number;hspeed?:number;scale?:number;noise?:number;min_opacity?:number;max_opacity?:number;max_intensity?:number;opaque?:boolean;splash?:ParticlesPreset};
    fog_opacity?:number;fog_dencity?:number;fog_curve?:number;sky_tint?:Vec3;clouds_tint?:Vec3;min_sky_light?:Vec3;clouds?:number;thunder_rate?:number;
  }
  interface Text3D {
    readonly id:number;
    hide(this:Text3D):void;
    get_pos(this:Text3D):Vec3|undefined;set_pos(this:Text3D,value:Vec3):void;
    get_axis_x(this:Text3D):Vec3|undefined;set_axis_x(this:Text3D,value:Vec3):void;
    get_axis_y(this:Text3D):Vec3|undefined;set_axis_y(this:Text3D,value:Vec3):void;
    set_rotation(this:Text3D,value:Mat4):void;
    get_text(this:Text3D):string|undefined;set_text(this:Text3D,value:string):void;
    update_settings(this:Text3D,preset:NotePreset):void;
  }
}
/** Graphical assets required. */
declare namespace assets {
  function request_texture(this:void,path:string,alias:string):void;
  function load_texture(this:void,bytes:VC.Bytearray|number[],alias:string,format?:"png"):void;
  function parse_animation(this:void,format:"vca",source:string,name:string):void;
  function parse_model(this:void,format:"obj"|"xml"|"vcm",source:string,name:string,skeleton?:string):void;
  function to_canvas(this:void,alias:string):VC.Canvas|undefined;
}
/** Call after on_hud_open. */
declare namespace gfx.particles {
  function emit(this:void,origin:VC.Vec3|number,count:number,preset:VC.ParticlesPreset,extension?:VC.ParticlesPreset):number;
  function stop(this:void,id:number):void;
  function is_alive(this:void,id:number):boolean;
  function get_origin(this:void,id:number):VC.Vec3|number|undefined;
  function set_origin(this:void,id:number,origin:VC.Vec3|number):void;
}
declare namespace gfx.blockwraps {
  function wrap(this:void,position:VC.Vec3,texture:string,emission?:number,tint?:VC.Vec3|VC.Vec4):number;
  function unwrap(this:void,id:number):void;
  function set_pos(this:void,id:number,position:VC.Vec3):void;
  function set_texture(this:void,id:number,texture:string):void;
  function set_faces(this:void,id:number,...faces:[string?,string?,string?,string?,string?,string?]):void;
  function set_tints(this:void,id:number,...faces:[(VC.Vec3|VC.Vec4)?,(VC.Vec3|VC.Vec4)?,(VC.Vec3|VC.Vec4)?,(VC.Vec3|VC.Vec4)?,(VC.Vec3|VC.Vec4)?,(VC.Vec3|VC.Vec4)?]):void;
}
declare namespace gfx.posteffects {
  function index(this:void,name:string):number;
  function set_effect(this:void,index:number,name:string):void;
  function get_intensity(this:void,index:number):number;
  function set_intensity(this:void,index:number,value:number):void;
  function is_active(this:void,index:number):boolean;
  function set_params(this:void,index:number,parameters:VC.ObjectValue):void;
  function set_array(this:void,index:number,name:string,data:VC.Bytearray):void;
}
declare namespace gfx.weather {
  function change(this:void,preset:VC.WeatherPreset,seconds:number,name?:string):void;
  function get_current(this:void):string;
  function get_current_data(this:void):VC.WeatherPreset;
  function get_fall_intensity(this:void):number;
  function is_transition(this:void):boolean;
}
declare namespace gfx {
 const text3d: {
  show(this:void,position:VC.Vec3,text:string,preset:VC.NotePreset,extension?:VC.NotePreset):number;
  hide(this:void,id:number):void;
  get_text(this:void,id:number):string|undefined;
  set_text(this:void,id:number,text:string):void;
  get_pos(this:void,id:number):VC.Vec3|undefined;
  set_pos(this:void,id:number,position:VC.Vec3):void;
  get_axis_x(this:void,id:number):VC.Vec3|undefined;
  set_axis_x(this:void,id:number,axis:VC.Vec3):void;
  get_axis_y(this:void,id:number):VC.Vec3|undefined;
  set_axis_y(this:void,id:number,axis:VC.Vec3):void;
  set_rotation(this:void,id:number,matrix:VC.Mat4):void;
  update_settings(this:void,id:number,preset:VC.NotePreset):void;
  get_entity(this:void,id:number):number|undefined;
  set_entity(this:void,id:number,entity:number):void;
  "new"(this:void,position:VC.Vec3,text:string,preset:VC.NotePreset,extension?:VC.NotePreset):VC.Text3D;

};
}

declare namespace VC {
  interface NamedSkeleton {
    readonly name:string;
    index(this:NamedSkeleton,bone:string):number|undefined;
    get_model(this:NamedSkeleton,bone:number):string|undefined;
    set_model(this:NamedSkeleton,bone:number,model:string|undefined):void;
    get_matrix(this:NamedSkeleton,bone:number):Mat4|undefined;
    set_matrix(this:NamedSkeleton,bone:number,matrix:Mat4):void;
    get_texture(this:NamedSkeleton,bone:string):string|undefined;
    set_texture(this:NamedSkeleton,bone:string,texture:string):void;
    is_visible(this:NamedSkeleton,bone:number):boolean|undefined;
    set_visible(this:NamedSkeleton,bone:number,visible:boolean):void;
    get_color(this:NamedSkeleton,bone:number):Vec4|undefined;
    /** @deprecated VC HUD wrapper passes arguments in wrong order; use entity Skeleton or native binding. */
    set_color(this:NamedSkeleton,bone:number,color:Vec4):void;
  }
}
declare namespace gfx.skeletons { function get(this:void,name:string):VC.NamedSkeleton|undefined; }
