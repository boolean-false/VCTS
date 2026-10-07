/// <reference path="types.d.ts" />
declare namespace VC { type Route = Vec3[] & {total_visited?:number}; }
/** Requires an open world. An async empty route means failure; nil means pending or absent agent. */
declare namespace pathfinding {
  function create_agent(this:void):number;
  function remove_agent(this:void,id:number):boolean;
  function set_enabled(this:void,id:number,enabled:boolean):void;
  function is_enabled(this:void,id:number):boolean;
  function make_route(this:void,id:number,start:VC.Vec3,target:VC.Vec3):VC.Route|undefined;
  function make_route_async(this:void,id:number,start:VC.Vec3,target:VC.Vec3):void;
  function pull_route(this:void,id:number):VC.Route|undefined;
  function set_max_visited(this:void,id:number,blocks:number):void;
  function set_jump_height(this:void,id:number,height:number):void;
  function avoid_tag(this:void,id:number,tag:string,cost?:number):void;
}
