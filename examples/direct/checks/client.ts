/// <reference path="../../../sdk/client.d.ts" />
export {};
const [id,layout] = hud.open_block(0,100,0);
const inv: number = id;
const name: string = layout;
hud.show_overlay(name,false,{value:inv});
// @ts-expect-error client pack code still has no application-script access
app.focus();
const ui = Document.new<{title:VC.UIElement;body:VC.UIContainer}>("direct:panel");
ui.title.text="Title";
ui.body.add("<label>Ready</label>",{click:()=>{}});
const pixels=Canvas([16,16]);pixels.create_texture("direct:picture");
const layoutCallbacks:VC.LayoutCallbacks={on_progress:(done,total)=>{ui.title.text=`${done}/${total}`;},on_close:inventory=>{}};
// @ts-expect-error layout has no per-frame on_update callback
const badLayout:VC.LayoutCallbacks={on_update:()=>{}};
// @ts-expect-error identity is read-only
ui.title.id="new";
