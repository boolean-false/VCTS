export function create(this:void,_context:VC.ScriptContext):VC.HudCallbacks {
  return {on_hud_open:()=>hud.show_overlay("uiprobe:counter",false)};
}
