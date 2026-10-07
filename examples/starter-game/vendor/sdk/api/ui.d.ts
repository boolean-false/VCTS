/// <reference path="canvas.d.ts" />
declare namespace VC {
  type UIData = Record<string, unknown>;
  interface UIAttributes {
    id: string; exists: boolean;
    color: Vec4; hoverColor: Vec4; pressedColor: Vec4;
    contentOffset: Vec2; tooltip: string; tooltipDelay: number;
    pos: Vec2; wpos: Vec2; size: Vec2;
    interactive: boolean; visible: boolean; enabled: boolean;
    placeholder: string | undefined; hint: string | undefined; valid: boolean | undefined;
    caret: number | undefined; text: string | undefined;
    editable: boolean | undefined; edited: boolean | undefined; lineNumbers: boolean | undefined;
    syntax: string | undefined; markup: string | undefined;
    src: string | undefined; fallback: string | undefined;
    value: number | string | undefined; min: number | undefined; max: number | undefined; step: number | undefined;
    scroll: number | undefined; trackWidth: number | undefined;
    trackColor: Vec4 | undefined; textColor: Vec4 | undefined; checked: boolean | undefined;
    page: string | undefined; inventory: number | undefined; slotIndex: number | undefined;
    focused: boolean; cursor: string; data: Canvas | undefined;
    parent: UIElement | undefined; region: Vec4 | undefined;
    options: {value:string;text:string}[] | undefined; zIndex: number;
  }
  interface UIWritableAttributes {
    color: Vec4; hoverColor: Vec4; pressedColor: Vec4; tooltip: string; tooltipDelay: number;
    pos: Vec2; wpos: Vec2; size: Vec2; interactive: boolean; visible: boolean; enabled: boolean;
    placeholder: string; hint: string; caret: number; text: string; editable: boolean; edited: boolean;
    lineNumbers: boolean; syntax: string; markup: string; src: string; fallback: string;
    value: number | string; min: number; max: number; step: number; scroll: number; trackWidth: number;
    trackColor: Vec4; textColor: Vec4; checked: boolean; page: string; inventory: number;
    focused: boolean; cursor: string; region: Vec4; options: {value:string;text:string}[]; zIndex: number;
  }
  /** Widget-specific attributes/methods can be absent. Use contracts for known XML element kinds. */
  interface UIElement extends UIAttributes {
    readonly docname: string; readonly name: string;
    readonly id: string; readonly exists: boolean; readonly contentOffset: Vec2;
    readonly parent: UIElement | undefined; readonly data: Canvas | undefined;
    readonly valid: boolean | undefined; readonly slotIndex: number | undefined;
    destruct(this: UIElement): void;
    reposition(this: UIElement): void;
    moveInto(this: UIElement, destination: UIElement): void;
    add?: (this: UIElement, xml: string, data?: UIData) => void;
    clear?: (this: UIElement) => void;
    refresh?: (this: UIElement) => void;
    setInterval?: (this: UIElement, milliseconds: number, callback: (this:void)=>void) => void;
    paste?: (this: UIElement, text: string) => void;
    reset?: (this: UIElement) => void;
    back?: (this: UIElement) => boolean;
    lineAt(this: UIElement, index: number): number | undefined;
    indexByPos(this: UIElement, position: Vec2): number | undefined;
    lineY(this: UIElement, line: number): number | undefined;
    linePos(this: UIElement, line: number): number | undefined;
  }
  type UIContainer = UIElement & Required<Pick<UIElement,"add" | "clear" | "refresh" | "setInterval">>;
  type UIDocument<Elements extends Record<string,UIElement> = Record<string,UIElement>> = {readonly name:string} & Elements;
  interface LayoutContext<Elements extends Record<string,UIElement> = Record<string,UIElement>> { readonly document: UIDocument<Elements>; readonly environment: UIData; }
  interface LayoutCallbacks<OpenArgs extends unknown[] = unknown[]> {
    on_open?(this: void, ...args: OpenArgs): void;
    on_close?(this: void, inventory: number): void;
    on_progress?(this: void, done: number, total: number): void;
    on_destroy?(this: void): void;
  }
  interface Canvas { create_texture(this: Canvas, name: string): void; }
}
declare namespace gui {
  function close_menu(this: void): void;
  const root: VC.UIDocument | undefined;
  function getattr<K extends keyof VC.UIAttributes>(this: void, document: string, element: string, attribute: K): VC.UIAttributes[K];
  /** Native children indices start at 1. */
  function getattr(this: void, document: string, element: string, child: number): VC.UIElement | undefined;
  function setattr<K extends keyof VC.UIWritableAttributes>(this: void, document: string, element: string, attribute: K, value: VC.UIWritableAttributes[K]): void;
  function get_env(this: void, document: string): VC.UIData;
  function str(this: void, text: string, context?: string): string;
  function get_locales_info(this: void): Record<string,{name:string}>;
  function get_viewport(this: void): VC.Vec2;
  function clear_markup(this: void, language: string, text: string): string;
  function escape_markup(this: void, language: string, text: string): string;
  function confirm(this: void, text: string, onConfirm?: (this:void)=>void, onDeny?: (this:void)=>void, yesText?:string, noText?:string): void;
  function alert(this: void, text: string, onClose?: (this:void)=>void): void;
  function show_message(this: void, text: string, onClose?: (this:void)=>void): void;
  function show_input_dialog(this: void, text: string, onConfirm?: (this:void,value:string)=>void, validator?: (this:void,value:string)=>boolean, confirmText?:string): void;
  function ask(this: void, text: string, onConfirm?: (this:void)=>void, onDeny?: (this:void)=>void, yesText?:string, noText?:string): void;
  function load_document(this: void, path: string, name: string, args: VC.Value, extension?: VC.UIData): VC.UIData;
  function template(this: void, name: string, parameters: VC.UIData): string;
  function process_template(this: void, source: string, parameters: VC.UIData): string;
  /** Native implementation returns zero values, despite documentation suggesting Element,Document. */
  function create_frame(this: void, id: string, outputTexture: string, size: VC.Vec2): void;
  function set_active_frame(this: void, id: string, cursorLocator?: (this:void)=>LuaMultiReturn<[number,number]>): void;
  function get_active_frame(this: void): string | undefined;
  function screenshot(this: void, frameId?: string): VC.Canvas | undefined;
  function set_syntax_styles(this: void, scheme: VC.ObjectValue): void;
}

declare const Document: {new:<Elements extends Record<string,VC.UIElement> = Record<string,VC.UIElement>>(this:void, name:string)=>VC.UIDocument<Elements>};
declare const Element: {new:(this:void, document:string, name:string)=>VC.UIElement};
