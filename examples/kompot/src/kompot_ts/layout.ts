import * as K from "kompot:kompot";
import * as UI from "kompot:ui";
import {Screen} from "./screen";
type KompotMountHandle=ReturnType<typeof K.mount>;

export function create(this:void, context:VC.LayoutContext):VC.LayoutCallbacks {
    let handle:KompotMountHandle|undefined;
    return {on_open:()=>{handle?.dispose();handle=K.mount({target:context.document.root,theme:UI.theme(),content:Screen});},on_close:()=>{handle?.dispose();handle=undefined;}};
}
