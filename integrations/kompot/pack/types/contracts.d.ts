// Generated from Kompot 1.2.2 LuaLS annotations, with explicit generic refinements.
// unknown represents dynamic Lua contracts; it is not an inferred API.
/// <reference types="@typescript-to-lua/language-extensions" />
export interface KompotCorners {
  top_left?: number;
  top_right?: number;
  bottom_right?: number;
  bottom_left?: number;
}
export type KompotRadius = number | KompotCorners;
export interface KompotCornerSize {
  unit: 'px' | 'percent';
  value: number;
}
export type KompotCornerValue = number | KompotCornerSize;
export interface KompotShapeCorners {
  top_left?: KompotCornerValue;
  top_right?: KompotCornerValue;
  bottom_right?: KompotCornerValue;
  bottom_left?: KompotCornerValue;
}
export interface KompotShape {
  kind: 'rectangle' | 'circle' | 'rounded' | 'cut';
}
export type KompotShapeInput = KompotShape | KompotRadius;
export interface KompotShapeApi {
  rectangle: ((this: void) => KompotShape);
  circle: ((this: void) => KompotShape);
  rounded: ((this: void, size?: KompotCornerValue | KompotShapeCorners) => KompotShape);
  cut: ((this: void, size?: KompotCornerValue | KompotShapeCorners) => KompotShape);
  px: ((this: void, value: number) => KompotCornerSize);
  percent: ((this: void, value: number) => KompotCornerSize);
}
export type KompotColor = string | (number)[];
export type KompotContent = ((this: void) => void);
export type KompotAlign = 'top_start' | 'top_center' | 'top_end' | 'center_start' | 'center' | 'center_end' | 'bottom_start' | 'bottom_center' | 'bottom_end';
export type KompotCrossAlign = 'start' | 'top' | 'center' | 'end' | 'bottom' | number;
export type KompotArrangement = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly' | number;
export type KompotTextAlign = 'start' | 'center' | 'end';
export type KompotImageFit = 'fill' | 'contain' | 'cover';
export type KompotPlacement = 'below' | 'above' | 'right' | 'center' | 'fill' | ((this: void, anchor: (KompotRect) | undefined, width: number, height: number, screen_width: number, screen_height: number, gap: number) => LuaMultiReturn<[number, number]>);
export interface KompotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface KompotPadding {
  l?: number;
  t?: number;
  r?: number;
  b?: number;
  h?: number;
  v?: number;
  start?: number;
  top?: number;
  end?: number;
  bottom?: number;
  horizontal?: number;
  vertical?: number;
}
export interface KompotState<T> {
  value: T;
  set: ((this: KompotState<T>, value: T) => void);
  peek: ((this: KompotState<T>) => T);
  update: ((this: KompotState<T>, fn: ((this: void, value: T) => T)) => void);
  patch: ((this:KompotState<T>,changes:T extends object ? Partial<T> : never)=>void);
  update_field: (<P extends keyof T>(this:KompotState<T>,key:P,value:T[P]|((this:void,old:T[P])=>T[P]))=>void);
}
export interface KompotLocal<T> {
  default: T;
  name: string;
  get: ((this: KompotLocal<T>) => T);
}
export interface KompotInteraction {
  hovered: KompotState<boolean>;
  pressed: KompotState<boolean>;
  dragged: KompotState<boolean>;
  focused: KompotState<boolean>;
}
export interface KompotClickOptions {
  enabled?: boolean;
  interaction?: KompotInteraction;
  cursor?: string;
  on_long_click?: ((this: void) => void);
  on_right_click?: ((this: void) => void);
  focusable?: boolean;
  focus_scope?: boolean;
  on_focus?: ((this: void) => void);
  on_defocus?: ((this: void) => void);
  focus_color?: KompotColor;
  focus_radius?: KompotShapeInput;
  focus_shape?: KompotShapeInput;
}
export type KompotPivot = [number, number] | {x:number; y:number};
export interface KompotDragEvent {
  type: 'start' | 'move' | 'end' | 'cancel';
  x: number;
  y: number;
  dx: number;
  dy: number;
  parent_x: number;
  parent_y: number;
  parent_dx: number;
  parent_dy: number;
  velocity_x: number;
  velocity_y: number;
  button: 'left' | 'right';
  accepted?: boolean;
  cancelled?: boolean;
  reason?: 'escape' | 'removed' | 'blocked' | 'reset' | 'cancelled';
}
export interface KompotDragOptions {
  button?: 'left' | 'right';
  on_event?: ((this: void, event: KompotDragEvent) => unknown);
  axis?: 1 | 2;
  interaction?: KompotInteraction;
  cursor?: string;
}
export interface KompotDropOptions {
  on_enter?: ((this: void, payload: unknown) => void);
  on_leave?: ((this: void, payload: unknown) => void);
  on_drop?: ((this: void, payload: unknown) => (boolean) | undefined);
}
export interface KompotPointerEvent {
  type: 'down' | 'up' | 'move' | 'cancel';
  x: number;
  y: number;
  dx: number;
  dy: number;
  parent_x: number;
  parent_y: number;
  parent_dx: number;
  parent_dy: number;
  button: 'left' | 'right';
  cancelled?: boolean;
  reason?: string;
}
export interface KompotModifier {
  is: ((this: void, value: unknown) => boolean);
  then_: ((this: KompotModifier, other: KompotModifier) => KompotModifier);
  padding: ((this: KompotModifier, a: number | KompotPadding, b?: number, c?: number, d?: number) => KompotModifier);
  size: ((this: KompotModifier, width: number, height?: number) => KompotModifier);
  width: ((this: KompotModifier, width: number) => KompotModifier);
  height: ((this: KompotModifier, height: number) => KompotModifier);
  size_in: ((this: KompotModifier, min_width?: number, max_width?: number, min_height?: number, max_height?: number) => KompotModifier);
  width_in: ((this: KompotModifier, min?: number, max?: number) => KompotModifier);
  height_in: ((this: KompotModifier, min?: number, max?: number) => KompotModifier);
  required_size: ((this: KompotModifier, width: number, height?: number) => KompotModifier);
  fill_max_width: ((this: KompotModifier, fraction?: number) => KompotModifier);
  fill_max_height: ((this: KompotModifier, fraction?: number) => KompotModifier);
  fill_max_size: ((this: KompotModifier, fraction?: number) => KompotModifier);
  wrap_content: ((this: KompotModifier) => KompotModifier);
  aspect_ratio: ((this: KompotModifier, ratio: number) => KompotModifier);
  offset: ((this: KompotModifier, x?: number, y?: number) => KompotModifier);
  weight: ((this: KompotModifier, weight?: number, fill?: boolean) => KompotModifier);
  match_parent_size: ((this: KompotModifier) => KompotModifier);
  align: ((this: KompotModifier, align: KompotAlign | KompotCrossAlign) => KompotModifier);
  z_index: ((this: KompotModifier, z: number) => KompotModifier);
  vertical_scroll: ((this: KompotModifier, state: KompotScrollState) => KompotModifier);
  horizontal_scroll: ((this: KompotModifier, state: KompotScrollState) => KompotModifier);
  background: ((this: KompotModifier, color: KompotColor, shape?: KompotShapeInput) => KompotModifier);
  background_image: ((this: KompotModifier, paint: KompotNinePatch, tint?: KompotColor) => KompotModifier);
  border: ((this: KompotModifier, width: number, color: KompotColor, shape?: KompotShapeInput) => KompotModifier);
  shadow: ((this: KompotModifier, elevation?: number, shape?: KompotShapeInput, color?: KompotColor, dy?: number) => KompotModifier);
  rotate: ((this: KompotModifier, angle: number, pivot?: KompotPivot) => KompotModifier);
  scale: ((this: KompotModifier, x: number, y?: number, pivot?: KompotPivot) => KompotModifier);
  clip: ((this: KompotModifier, shape?: KompotShapeInput) => KompotModifier);
  alpha: ((this: KompotModifier, alpha: number) => KompotModifier);
  clickable: ((this: KompotModifier, on_click?: ((this: void) => void), opts?: KompotClickOptions) => KompotModifier);
  focusable: ((this: KompotModifier, on_key?: ((this: void, key: string) => void), opts?: KompotClickOptions) => KompotModifier);
  block_pointer: ((this: KompotModifier) => KompotModifier);
  hoverable: ((this: KompotModifier, target: KompotInteraction | ((this: void, hovered: boolean) => void)) => KompotModifier);
  draggable: ((this: KompotModifier, opts: KompotDragOptions) => KompotModifier);
  drop_target: ((this: KompotModifier, opts?: KompotDropOptions) => KompotModifier);
  pointer_input: ((this: KompotModifier, fn: ((this: void, event: KompotPointerEvent) => void)) => KompotModifier);
  on_wheel: ((this: KompotModifier, fn: ((this: void, delta: number) => (boolean) | undefined)) => KompotModifier);
  cursor: ((this: KompotModifier, name: string) => KompotModifier);
  on_size: ((this: KompotModifier, fn: ((this: void, width: number, height: number) => void)) => KompotModifier);
  on_placed: ((this: KompotModifier, fn: ((this: void, x: number, y: number, width: number, height: number) => void)) => KompotModifier);
  tag: ((this: KompotModifier, name: string) => KompotModifier);
}
export interface KompotProps {
  modifier?: KompotModifier;
  mod?: KompotModifier;
  key?: unknown;
}
export interface KompotBoxProps extends KompotProps {
  align?: KompotAlign;
  propagate_min?: boolean;
}
export interface KompotLinearProps extends KompotProps {
  arrangement?: KompotArrangement;
  spacing?: number;
  align?: KompotCrossAlign;
  fill_cross?: boolean;
}
export interface KompotFlowProps extends KompotProps {
  spacing?: number;
  run_spacing?: number;
  align?: KompotCrossAlign;
}
export interface KompotTextStyle {
  font: string;
  bold?: string;
  size?: number;
  color?: KompotColor;
  family?: string;
  weight?: string;
}
export interface KompotTextSpan {
  text?: string;
  color?: KompotColor;
  style?: string | KompotTextStyle;
  font?: string;
  bold?: boolean;
}
export interface KompotTextProps extends KompotProps {
  style?: string | KompotTextStyle;
  color?: KompotColor;
  align?: KompotTextAlign;
  max_lines?: number;
  wrap?: boolean;
  ellipsis?: boolean;
  font?: string;
  bold_font?: string;
  markup?: 'md';
  spans?: (KompotTextSpan)[];
}
export interface KompotImageProps extends KompotProps {
  width?: number;
  height?: number;
  size?: number;
  source_size?: { 1: number; 2: number } | { width: number; height: number };
  fit?: KompotImageFit;
  color?: KompotColor;
  region?: (number)[];
}
export interface KompotIconProps extends KompotProps {
  size?: number;
  color?: KompotColor;
}
export interface KompotCanvasImageOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  angle?: number;
  scale?: number | { 1: number; 2: number } | { x: number; y: number };
  pivot?: KompotPivot;
  alpha?: number;
  color?: KompotColor;
  region?: (number)[];
}
export interface KompotCanvas {
  width: number;
  height: number;
  image: ((this: KompotCanvas, src: string | KompotRaster, opts?: KompotCanvasImageOptions) => void);
  set: ((this: KompotCanvas, x: number, y: number, r: number, g?: number, b?: number, a?: number) => void);
  line: ((this: KompotCanvas, x1: number, y1: number, x2: number, y2: number, r: number, g?: number, b?: number, a?: number) => void);
  rect: ((this: KompotCanvas, x: number, y: number, width: number, height: number, r: number, g?: number, b?: number, a?: number) => void);
  clear: ((this: KompotCanvas, r?: number, g?: number, b?: number, a?: number) => void);
}
export interface KompotRasterOptions {
  key?: string;
  version?: string | number;
  width: number;
  height: number;
  draw: ((this: void, canvas: KompotCanvas, width: number, height: number) => void);
}
export interface KompotRaster extends KompotRasterOptions {
  kind: 'raster';
}
export interface KompotNinePatchOptions {
  source_size?: (number)[];
  border?: number | (number)[];
  center?: 'stretch' | 'tile' | 'none';
  edges?: 'stretch' | 'tile';
  scale?: number;
}
export interface KompotNinePatch extends KompotNinePatchOptions {
  kind: 'nine_patch';
  src: string | KompotRaster;
}
export interface KompotCanvasProps extends KompotProps {
  draw: ((this: void, canvas: KompotCanvas, width: number, height: number) => void);
  version?: unknown;
  width?: number;
  height?: number;
}
export interface KompotMeasureApi {
  INF: number;
  measure: ((this: void, child: unknown, min_width: number, max_width: number, min_height: number, max_height: number) => LuaMultiReturn<[number, number]>);
  place: ((this: void, child: unknown, x: number, y: number) => void);
}
export interface KompotLayoutProps extends KompotProps {
  measure: ((this: void, children: (unknown)[], min_width: number, max_width: number, min_height: number, max_height: number, api: KompotMeasureApi) => LuaMultiReturn<[number, number]>);
}
export interface KompotTextInputProps extends KompotProps {
  value?: string;
  on_change?: ((this: void, text: string) => void);
  on_submit?: ((this: void, text: string) => void);
  hint?: string;
  font?: string | false;
  color?: KompotColor;
  lines?: number;
  pad?: number;
  width?: number;
  focus?: boolean;
  on_focus?: ((this: void) => void);
  on_defocus?: ((this: void) => void);
  syntax?: 'lua' | string;
  line_numbers?: boolean;
  editable?: boolean;
  wrap?: boolean;
  presentation?: unknown;
  editor_state?: KompotState<KompotEditorValue>;
  editor_value?: KompotEditorValue;
  on_selection_change?: ((this: void, anchor: number, caret: number) => void);
}
export interface KompotEditorValue {
  text: string;
  anchor: number;
  caret: number;
}
export interface KompotBasicTextFieldProps extends KompotTextInputProps {
  state?: KompotState<string>;
  editor_state?: KompotState<KompotEditorValue>;
}
export interface KompotScrollState {
  value: number;
  max: number;
  view: number;
  step: number;
  scroll_by: ((this: KompotScrollState, delta: number) => number);
  scroll_to: ((this: KompotScrollState, value: number) => number);
  fraction: ((this: KompotScrollState) => LuaMultiReturn<[number, number]>);
}
export interface KompotLazyState {
  first: number;
  offset: number;
  total: number;
  view: number;
  step: number;
  scroll_by: ((this: KompotLazyState, delta: number) => number);
  scroll_to_item: ((this: KompotLazyState, index: number) => void);
  first_visible: ((this: KompotLazyState) => number);
  fraction: ((this: KompotLazyState) => LuaMultiReturn<[number, number]>);
}
export interface KompotLazyProps extends KompotProps {
  count: number;
  item: ((this: void, index: number) => void);
  key_of?: ((this: void, index: number) => unknown);
  state?: KompotLazyState;
  spacing?: number;
  pad?: number;
  pad_start?: number;
  pad_end?: number;
  fill_cross?: boolean;
}
export interface KompotLazyGridProps extends KompotLazyProps {
  columns?: number;
}
export interface KompotPopupProps {
  placement?: KompotPlacement;
  gap?: number;
  key?: unknown;
  z?: number;
}
export interface KompotTheme {
  name?: string;
  dark?: boolean;
  colors: Record<string, (number)[]>;
  type: Record<string, KompotTextStyle>;
  default_style?: string;
  icons?: string;
  fonts?: (string)[];
  ui?: KompotUiContract;
}
export interface KompotTween {
  kind: 'tween';
  duration: number;
  easing: string;
}
export interface KompotSpring {
  kind: 'spring';
  stiffness: number;
  damping: number;
}
export interface KompotSnap {
  kind: 'snap';
}
export type KompotAnimationSpec = KompotTween | KompotSpring | KompotSnap;
export interface KompotPreviewOptions {
  width?: number;
  height?: number;
  theme?: KompotTheme | ((this: void) => KompotTheme);
  padding?: number;
  group?: string;
  hook_diagnostics?: boolean;
}
export interface KompotPreviewEntry {
  name: string;
  opts: KompotPreviewOptions;
  content: KompotContent;
  source?: string;
  line?: number;
}
export interface KompotMountOptions {
  content: KompotContent;
  theme?: KompotTheme;
  target?: unknown;
  fullscreen?: boolean;
  interactive?: boolean;
  z_index?: number;
  lock_inventory?: boolean;
  hook_diagnostics?: boolean;
}
export interface KompotMountHandle {
  disposed: boolean;
  app: KompotAppInstance;
  backend: Record<string | number, unknown>;
  host: unknown;
  fake_input?: Record<string | number, unknown>;
  close_pending?: boolean;
  dispose: ((this: KompotMountHandle) => void);
  set_content: ((this: KompotMountHandle, content: KompotContent) => void);
  set_theme: ((this: KompotMountHandle, theme: KompotTheme) => void);
}
export interface KompotColorApi {
  rgb: ((this: void, r: number, g: number, b: number, a?: number) => (number)[]);
  hex: ((this: void, value: string) => (number)[]);
  of: ((this: void, value: (KompotColor) | undefined) => ((number)[]) | undefined);
  to_hex: ((this: void, value: (number)[]) => string);
  with_alpha: ((this: void, value: (number)[], alpha: number) => (number)[]);
  mul_alpha: ((this: void, value: (number)[], alpha: number) => (number)[]);
  mix: ((this: void, a: (number)[], b: (number)[], t: number) => (number)[]);
  over: ((this: void, base: (number)[], over: (number)[]) => (number)[]);
  equals: ((this: void, a: (number)[], b: (number)[]) => boolean);
  to_hsl: ((this: void, value: (number)[]) => LuaMultiReturn<[number, number, number]>);
  hsl: ((this: void, h: number, s: number, l: number, a?: number) => (number)[]);
  lighten: ((this: void, value: (number)[], amount: number) => (number)[]);
  darken: ((this: void, value: (number)[], amount: number) => (number)[]);
  luminance: ((this: void, value: (number)[]) => number);
  contrast: ((this: void, a: (number)[], b: (number)[]) => number);
  on: ((this: void, background: (number)[], dark?: (number)[], light?: (number)[]) => (number)[]);
  tone: ((this: void, value: (number)[], tone: number, chroma?: number) => (number)[]);
  palette: ((this: void, value: (number)[], chroma?: number) => Record<string, (number)[]>);
  to255: ((this: void, value: (number)[], alpha_mul?: number) => (number)[]);
  WHITE: (number)[];
  BLACK: (number)[];
  TRANSPARENT: (number)[];
}
export interface KompotFontApi {
  register_family: ((this: void, id: string, entries: (Record<string | number, unknown>)[]) => undefined);
  info: ((this: void, name: string) => (Record<string | number, unknown>) | undefined);
  resolve: ((this: void, id: string, size: number, weight?: string) => string);
  typography: ((this: void, defaults: Record<string, KompotTextStyle>, opts?: Record<string | number, unknown>, overrides?: Record<string | number, unknown>) => Record<string, KompotTextStyle>);
  register_metrics: ((this: void, metrics: Record<string | number, unknown>) => void);
}
export interface KompotTextMeasurer {
  width: ((this: KompotTextMeasurer, font: string, text: string) => number);
  line_height: ((this: KompotTextMeasurer, font: string) => number);
  field_line_height?: ((this: KompotTextMeasurer, font: string) => number);
}
export interface KompotTextLayout {
  lines: (Record<string | number, unknown>)[];
  widths: (number)[];
  w: number;
  h: number;
  lh: number;
  rich?: boolean;
}
export interface KompotTextApi {
  version: number;
  chars: ((this: void, text: string) => (string)[]);
  layout: ((this: void, measurer: KompotTextMeasurer, font: string, text: string | number, max_width: number, max_lines?: number, wrap?: boolean, ellipsis?: boolean) => KompotTextLayout);
  parse_md: ((this: void, text: string) => (Record<string | number, unknown>)[]);
  layout_rich: ((this: void, measurer: KompotTextMeasurer, runs: (Record<string | number, unknown>)[], max_width: number, max_lines?: number, wrap?: boolean) => KompotTextLayout);
  clear_cache: ((this: void) => void);
  approx_measurer: ((this: void, scale?: number) => KompotTextMeasurer);
  register_metrics: ((this: void, metrics: Record<string, Record<string | number, unknown>>) => void);
  metrics_measurer: ((this: void) => KompotTextMeasurer);
  field_line_height: ((this: void, measurer: KompotTextMeasurer, font: string) => number);
}
export interface KompotApp {
  new: ((this: void, opts: Record<string | number, unknown>) => KompotAppInstance);
}
export interface KompotAppInstance {
  rt: Record<string, unknown>;
  input: Record<string, unknown>;
  dl: (Record<string | number, unknown>)[];
  stats: Record<string, number>;
  set_size: ((this: KompotAppInstance, width: number, height: number) => void);
  frame: ((this: KompotAppInstance, dt?: number, event?: Record<string | number, unknown>) => boolean);
  find_tag: ((this: KompotAppInstance, name: string) => (Record<string | number, unknown>) | undefined);
  dispose: ((this: KompotAppInstance) => void);
}
export interface KompotApi {
  VERSION: string;
  copy: (<T>(this: void, source: T, changes?: Record<string | number, unknown>) => T);
  Modifier: KompotModifier;
  M: KompotModifier;
  Shape: KompotShapeApi;
  rounded_corners: ((this: void, radius?: KompotRadius) => KompotRadius);
  nine_patch: ((this: void, source: string | KompotRaster, opts?: KompotNinePatchOptions) => KompotNinePatch);
  raster: ((this: void, opts: KompotRasterOptions) => KompotRaster);
  Box: ((this: void, a: KompotBoxProps | KompotModifier | KompotContent, content?: KompotContent) => void);
  Row: ((this: void, a: KompotLinearProps | KompotModifier | KompotContent, content?: KompotContent) => void);
  Column: ((this: void, a: KompotLinearProps | KompotModifier | KompotContent, content?: KompotContent) => void);
  FlowRow: ((this: void, a: KompotFlowProps | KompotModifier | KompotContent, content?: KompotContent) => void);
  Spacer: ((this: void, width: number | KompotModifier, height?: number) => void);
  Text: ((this: void, text: string | number | undefined, props?: KompotTextProps) => void);
  Image: ((this: void, source: string, props?: KompotImageProps) => void);
  Icon: ((this: void, name: string, props?: KompotIconProps) => void);
  Canvas: ((this: void, props: KompotCanvasProps) => void);
  Layout: ((this: void, props: KompotLayoutProps, content: KompotContent) => void);
  TextInput: ((this: void, props: KompotTextInputProps) => void);
  BasicTextField: ((this: void, props: KompotBasicTextFieldProps) => void);
  new_text_field_state: ((this: void, initial?: string) => KompotState<KompotEditorValue>);
  text_field_state: ((this: void, initial?: string) => KompotState<KompotEditorValue>);
  scroll_state: ((this: void, initial?: number) => KompotScrollState);
  lazy_state: ((this: void) => KompotLazyState);
  LazyColumn: ((this: void, props: KompotLazyProps) => void);
  LazyRow: ((this: void, props: KompotLazyProps) => void);
  LazyGrid: ((this: void, props: KompotLazyGridProps) => void);
  Popup: ((this: void, props: KompotPopupProps, content: KompotContent) => void);
  state: (<T>(this:void, initial:T, eq?:(this:void,a:T,b:T)=>boolean)=>KompotState<T>);
  form: (<T extends Record<string, unknown>>(this:void,initial:T)=>{[P in keyof T]:KompotState<T[P]>});
  new_state: (<T>(this: void, initial: T, eq?: ((this: void, a: T, b: T) => boolean)) => KompotState<T>);
  remember: (<T>(this: void, initial: ((this: void) => T), ...args: (unknown)[]) => T);
  effect: ((this:void,fn:(this:void)=>void|((this:void)=>void),...deps:unknown[])=>void);
  on_dispose: ((this: void, fn: ((this: void) => void)) => void);
  on_frame: ((this: void, fn: ((this: void, dt: number) => void)) => void);
  key: ((this: void, key: unknown, content: KompotContent) => void);
  component: (<A extends unknown[], R>(this:void,fn:(this:void,...args:A)=>R)=>((this:void,...args:A)=>R));
  provide: (<T>(this: void, local_value: KompotLocal<T>, value: T, content: KompotContent) => void);
  local_of: (<T>(this: void, defaultValue: T, name?: string) => KompotLocal<T>);
  untracked: (<T>(this: void, fn: ((this: void, ...args: (unknown)[]) => T), ...args: (unknown)[]) => T);
  is_state: ((this: void, value: unknown) => boolean);
  poll: ((this: void, getter: ((this:void, ...args: never[]) => unknown), eq?: ((this:void, ...args: never[]) => unknown)) => unknown);
  animate: (<T>(this: void, target: T, spec?: KompotAnimationSpec) => T);
  tween: ((this: void, duration?: number, easing?: string) => KompotTween);
  spring: ((this: void, stiffness?: number, damping?: number) => KompotSpring);
  snap: KompotSnap;
  clock: ((this: void) => number);
  after: ((this: void, seconds: number, key?: unknown) => boolean);
  runtime: ((this: void) => Record<string | number, unknown>);
  EASING: Record<string, ((this: void, t: number) => number)>;
  interaction: ((this: void) => KompotInteraction);
  new_interaction: ((this: void) => KompotInteraction);
  color: KompotColorApi;
  rgb: ((this: void, r: number, g: number, b: number, a?: number) => (number)[]);
  hex: ((this: void, value: string) => (number)[]);
  fonts: KompotFontApi;
  BASE_THEME: KompotTheme;
  theme: ((this: void) => KompotTheme);
  Theme: ((this: void, theme: KompotTheme, content: KompotContent) => void);
  ContentColor: ((this: void, color: KompotColor, content: KompotContent) => void);
  TextStyle: ((this: void, style: string | KompotTextStyle, content: KompotContent) => void);
  style: ((this: void, name: string | KompotTextStyle, theme?: KompotTheme) => KompotTextStyle);
  extend_theme: ((this: void, base: KompotTheme, overrides: Record<string | number, unknown>) => KompotTheme);
  LocalTheme: KompotLocal<KompotTheme>;
  LocalContentColor: KompotLocal<KompotColor>;
  LocalTextStyle: KompotLocal<KompotTextStyle>;
  ui: ((this: void) => KompotUiContract);
  args: ((this: void, a: KompotProps | KompotModifier | KompotContent, content?: KompotContent) => KompotProps);
  App: KompotApp;
  text: KompotTextApi;
  preview: ((this: void, name: string, opts: KompotPreviewOptions | KompotContent, content?: KompotContent) => KompotPreviewEntry);
  previews: ((this: void) => (KompotPreviewEntry)[]);
  mount: ((this: void, opts: KompotMountOptions) => KompotMountHandle);
}
export interface KompotUiProps {
  modifier?: KompotModifier;
  mod?: KompotModifier;
  key?: unknown;
  enabled?: boolean;
  tooltip?: string;
}
export interface KompotUiButtonProps extends KompotUiProps {
  text?: string;
  icon?: string;
  on_click?: ((this: void) => void);
  on_right_click?: ((this: void) => void);
  variant?: 'default' | 'primary' | 'secondary' | 'danger' | 'ghost' | 'toggle' | string;
  selected?: boolean;
  size?: 'sm' | 'md' | 'lg' | number;
  align?: 'start' | 'center';
  trailing?: string;
  compact?: boolean;
  min_width?: number;
  radius?: KompotShapeInput;
}
export interface KompotUiIconButtonProps extends KompotUiButtonProps {
  icon: string;
}
export interface KompotUiToggleProps extends KompotUiProps {
  checked?: boolean;
  on_change?: ((this: void, value: boolean) => void);
  label?: string;
}
export interface KompotUiOption {
  value: unknown;
  text: string;
  icon?: string;
  tooltip?: string;
}
export interface KompotUiChoiceProps extends KompotUiProps {
  options: ((KompotUiOption | { 1: unknown; 2: string } | string))[];
  selected?: unknown;
  on_select?: ((this: void, value: unknown) => void);
  columns?: number;
  size?: number;
}
export interface KompotUiSliderProps extends KompotUiProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  steps?: number;
  on_change?: ((this: void, value: number) => void);
  on_change_end?: ((this: void) => void);
  label?: string;
  format?: ((this: void, value: number) => string);
}
export interface KompotUiTabsProps extends KompotUiProps {
  tabs: ((string | { text: string; icon?: string }))[];
  selected?: number;
  on_select?: ((this: void, index: number) => void);
}
export interface KompotUiFieldProps extends KompotTextInputProps {
  state?: KompotState<string>;
  label?: string;
  label_width?: number;
  supporting?: string;
  error?: string | boolean;
  height?: number;
}
export interface KompotUiLabeledFieldProps extends KompotUiFieldProps {
  label_width?: number;
  field_width?: number;
}
export interface KompotUiPanelProps extends KompotUiProps {
  title?: string;
  markup?: 'md';
  icon?: string;
  accent?: string | KompotColor;
  header?: KompotContent;
  width?: number | false;
  variant?: 'plain' | 'flat' | 'accent';
  padding?: number;
  spacing?: number;
  background?: KompotColor;
  radius?: KompotShapeInput;
  fill_height?: boolean;
}
export interface KompotUiWindowProps extends KompotUiPanelProps {
  visible?: boolean;
  on_close?: ((this: void) => void);
  on_dismiss?: ((this: void) => void);
  placement?: KompotPlacement;
  bounds?: { x: number; y: number; width: number; height: number };
  on_bounds_change?: ((this: void, bounds: { x: number; y: number; width: number; height: number }) => void);
  draggable?: boolean;
  resizable?: boolean;
  modal?: boolean;
  min_width?: number;
  min_height?: number;
  max_width?: number;
  max_height?: number;
  height?: number;
  z?: number;
  title_modifier?: KompotModifier;
}
export interface KompotUiDialogAction {
  text?: string;
  on_click?: ((this: void) => void);
  variant?: string;
}
export interface KompotUiDialogProps extends KompotUiWindowProps {
  text?: string;
  confirm?: KompotUiDialogAction;
  cancel?: KompotUiDialogAction;
}
export interface KompotUiMenuProps extends KompotUiProps {
  expanded?: boolean;
  on_dismiss?: ((this: void) => void);
  width?: number;
  placement?: KompotPlacement;
}
export interface KompotUiMenuItemProps extends KompotUiButtonProps {
  shortcut?: string;
  danger?: boolean;
  divider?: boolean;
}
export interface KompotUiSplitPaneProps extends KompotUiProps {
  first: KompotContent;
  second: KompotContent;
  orientation?: 'horizontal' | 'vertical';
  default_size?: number;
  size?: number;
  on_change?: ((this: void, size: number) => void);
  divider_modifier?: KompotModifier;
  divider_size?: number;
  min_first?: number;
  min_second?: number;
  max_first?: number;
  step?: number;
}
export interface KompotUiMenuBarProps extends KompotUiProps {
  brand?: string;
  menus?: ({ text: string; width?: number; menu_width?: number; items?: (KompotUiMenuItemProps)[] })[];
  actions?: KompotContent;
  open?: number;
  on_open?: ((this: void, index: (number) | undefined) => void);
}
export interface KompotUiBarProps extends KompotUiProps {
  text?: string;
  right?: string;
  height?: number;
  color?: KompotColor;
}
export interface KompotUiToastProps extends KompotUiProps {
  text?: string;
  width?: number;
  top?: number;
  icon?: string | false;
  accent?: string | KompotColor;
  variant?: 'plain' | 'accent';
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'error';
}
export interface KompotUiLuaProps extends KompotUiProps {
  code?: string;
  title?: string;
  line_numbers?: boolean;
  lines?: number;
  height?: number;
  presentation?: unknown;
}
export interface KompotUiVectorFieldProps extends KompotUiProps {
  label?: string;
  values?: ((string | number))[];
  on_change?: ((this: void, axis: number, text: string) => void);
  on_submit?: ((this: void, axis: number, text: string) => void);
  on_focus?: ((this: void) => void);
  on_defocus?: ((this: void) => void);
  label_width?: number;
}
export interface KompotUiPreviewProps extends KompotImageProps {
  src?: string;
  placeholder?: string;
  tooltip?: string;
}
export interface KompotUiCardProps extends KompotUiProps {
  on_click?: ((this: void) => void);
  selected?: boolean;
  padding?: number;
  radius?: KompotShapeInput;
}
export interface KompotUiListItemProps extends KompotUiProps {
  headline?: string;
  supporting?: string;
  icon?: string;
  trailing?: string | KompotContent;
  on_click?: ((this: void) => void);
  selected?: boolean;
}
export interface KompotUiThemeOptions {
  accent?: string | KompotColor;
  dark?: boolean;
  density?: 'compact' | 'comfortable';
  colors?: Record<string, KompotColor>;
  skin?: Record<'panel' | 'button' | 'button_pressed' | 'inset', string | Record<string | number, unknown>>;
  metrics?: Record<string, number>;
  panel_alpha?: number;
  ui?: Record<string, ((this:void, ...args: never[]) => unknown)>;
}
export interface KompotUiContract {
  Button: ((this: void, props: KompotUiButtonProps, content?: KompotContent) => void);
  IconButton: ((this: void, props: KompotUiIconButtonProps) => void);
  Checkbox: ((this: void, props: KompotUiToggleProps) => void);
  Switch: ((this: void, props: KompotUiToggleProps) => void);
  Tabs: ((this: void, props: KompotUiTabsProps) => void);
  Divider: ((this: void, props?: { modifier?: KompotModifier; vertical?: boolean; thickness?: number; inset?: number; color?: KompotColor }) => void);
  Badge: ((this: void, props: { count?: string | number; color?: KompotColor; modifier?: KompotModifier }) => void);
  ProgressBar: ((this: void, props: { progress?: number; color?: KompotColor; height?: number; modifier?: KompotModifier }) => void);
  Tooltip: ((this: void, props: { text: string; delay?: number; placement?: KompotPlacement; modifier?: KompotModifier }, content: KompotContent) => void);
  Dialog: ((this: void, props: KompotUiDialogProps, content?: KompotContent) => void);
  Scrollbar: ((this: void, props: { state: KompotScrollState | KompotLazyState; modifier?: KompotModifier }) => void);
  MenuItem: ((this: void, props: KompotUiMenuItemProps) => void);
  Slider: ((this: void, props: KompotUiSliderProps) => void);
  TextField: ((this: void, props: KompotUiFieldProps) => void);
  Segmented: ((this: void, props: KompotUiChoiceProps) => void);
  Panel: ((this: void, props: KompotUiPanelProps, content: KompotContent) => void);
  ListItem: ((this: void, props: KompotUiListItemProps) => void);
  Menu: ((this: void, props: KompotUiMenuProps, content: KompotContent) => void);
}
export interface KompotUiItem {
  id?: string;
  name?: string;
  src?: string;
  count?: number;
  durability?: number;
  rarity?: KompotColor;
  description?: string;
}
export interface KompotUiItemSlotProps extends KompotUiProps {
  item?: KompotUiItem;
  size?: number;
  selected?: boolean;
  locked?: boolean;
  enabled?: boolean;
  keycap?: string | number;
  placeholder?: string;
  tooltip?: string;
  on_click?: ((this: void) => void);
  on_right_click?: ((this: void) => void);
  on_drag_event?: ((this: void, event: KompotDragEvent, item: KompotUiItem) => unknown);
  drag_button?: 'left' | 'right';
  accepts?: ((this: void, payload: unknown) => boolean);
  on_drop?: ((this: void, payload: unknown) => (boolean) | undefined);
  src?: string;
  icon?: string;
  badge?: string | number;
}
export interface KompotUiInventoryProps extends KompotUiProps {
  items?: Record<number, KompotUiItem>;
  count?: number;
  columns?: number;
  size?: number;
  gap?: number;
  selected?: number;
  on_select?: ((this: void, index: number) => void);
  on_right_click?: ((this: void, index: number) => void);
  on_move?: ((this: void, from: number, to: number, item: KompotUiItem) => (boolean) | undefined);
  accepts?: ((this: void, target: number, payload: unknown) => boolean);
  drag_group?: unknown;
  slot_props?: KompotUiItemSlotProps;
  tag_prefix?: string;
}
export interface KompotUiApi extends KompotUiContract {
  VERSION: string;
  theme: ((this: void, opts?: KompotUiThemeOptions) => KompotTheme);
  Theme: ((this: void, opts: KompotUiThemeOptions, content: KompotContent) => void);
  current: ((this: void) => KompotTheme);
  DEFAULT: KompotTheme;
  PALETTE: Record<string, Record<string, KompotColor>>;
  TYPE: Record<string, KompotTextStyle>;
  METRICS: Record<string, number>;
  MOTION: Record<string, KompotAnimationSpec>;
  tokens: Record<string | number, unknown>;
  components: Record<string, ((this:void, ...args: never[]) => unknown)>;
  ui: KompotUiContract;
  ToolButton: ((this: void, props: KompotUiIconButtonProps) => void);
  Choice: ((this: void, props: KompotUiChoiceProps) => void);
  Stepper: ((this: void, props: { label?: string; value?: number | string; on_minus?: ((this: void) => void); on_plus?: ((this: void) => void); minus?: string; plus?: string; tooltip?: string; modifier?: KompotModifier }) => void);
  Field: ((this: void, props: KompotUiFieldProps) => void);
  LabeledField: ((this: void, props: KompotUiLabeledFieldProps) => void);
  VectorField: ((this: void, props: KompotUiVectorFieldProps) => void);
  Window: ((this: void, props: KompotUiWindowProps, content: KompotContent) => void);
  MenuBar: ((this: void, props: KompotUiMenuBarProps) => void);
  MenuDivider: ((this: void, props?: KompotUiProps) => void);
  Bar: ((this: void, props: KompotUiBarProps) => void);
  Toast: ((this: void, props: KompotUiToastProps) => void);
  ListRow: ((this: void, props: KompotUiButtonProps) => void);
  Slot: ((this: void, props: KompotUiItemSlotProps) => void);
  ItemSlot: ((this: void, props: KompotUiItemSlotProps) => void);
  InventoryGrid: ((this: void, props: KompotUiInventoryProps) => void);
  Hotbar: ((this: void, props: { items?: Record<number, KompotUiItem>; count?: number; size?: number; selected?: number; show_name?: boolean; on_select?: ((this: void, index: number) => void); modifier?: KompotModifier }) => void);
  ResourceBar: ((this: void, props: { label?: string; value?: number; max?: number; kind?: string; color?: KompotColor; segments?: number; height?: number; text?: string; compact?: boolean; modifier?: KompotModifier }) => void);
  ActionHint: ((this: void, props: { binding?: string; text?: string; detail?: string; modifier?: KompotModifier }) => void);
  ItemDetails: ((this: void, props: { item?: KompotUiItem; width?: number; actions?: KompotContent; modifier?: KompotModifier }) => void);
  MachinePanel: ((this: void, props: Record<string | number, unknown>) => void);
  HUD: ((this: void, props: Record<string | number, unknown>) => void);
  Card: ((this: void, props: KompotUiCardProps, content: KompotContent) => void);
  Section: ((this: void, text: string, props?: KompotUiProps) => void);
  Hint: ((this: void, text: string, props?: KompotTextProps) => void);
  Key: ((this: void, text: string) => void);
  Preview: ((this: void, props: KompotUiPreviewProps) => void);
  SplitPane: ((this: void, props: KompotUiSplitPaneProps) => void);
  Lua: ((this: void, code: string | KompotUiLuaProps, props?: KompotUiLuaProps) => void);
  key_chips: ((this: void, items: ({ 1: string; 2: string })[]) => string);
  open_gallery: ((this: void) => void);
}
