export function create(this:void):VC.HudCallbacks {
    return {on_hud_open:()=>{input.add_callback("kompot_ts.open",()=>{time.post_runnable(()=>{if(hud.is_open("kompot_ts:panel"))hud.close("kompot_ts:panel");else if(!hud.is_inventory_open())hud.show_overlay("kompot_ts:panel",false);});return true;},undefined,true);}};
}
