type Elements={summary:VC.UIElement};
interface Handlers extends VC.LayoutCallbacks {increment(this:void):void;read(this:void):number;}
/** A closure per document; the cached module contains no mutable instance state. */
export function create(this:void,context:VC.LayoutContext<Elements>):Handlers {
  let count=0;
  const render=():void=>{context.document.summary.text=`Clicks: ${count}`;};
  return {on_open:render,increment:()=>{count++;render();},read:()=>count};
}
