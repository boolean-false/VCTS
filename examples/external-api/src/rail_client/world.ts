import * as rails from "rail_core:api";
export function probe(this:void):number {return rails.path_length(0);}
export function create(this:void):VC.WorldCallbacks {
  return {on_world_open:()=>{if(rails.version!==1)throw new Error("RailCore API version");}};
}
