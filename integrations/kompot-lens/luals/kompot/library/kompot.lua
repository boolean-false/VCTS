---@meta _

---@class KompotCorners
---@field top_left? number Upper left radius in pixels; defaults to zero.
---@field top_right? number Upper right radius in pixels; defaults to zero.
---@field bottom_right? number Lower right radius in pixels; defaults to zero.
---@field bottom_left? number Lower left radius in pixels; defaults to zero.
---@alias KompotRadius number|KompotCorners

---@class KompotCornerSize
---@field unit 'px'|'percent'
---@field value number
---@alias KompotCornerValue number|KompotCornerSize

---@class KompotShapeCorners
---@field top_left? KompotCornerValue
---@field top_right? KompotCornerValue
---@field bottom_right? KompotCornerValue
---@field bottom_left? KompotCornerValue

---@class KompotShape
---@field kind 'rectangle'|'circle'|'rounded'|'cut'

---@alias KompotShapeInput KompotShape|KompotRadius

---@class KompotShapeApi
---@field rectangle fun(): KompotShape
---@field circle fun(): KompotShape Circle for a square, capsule for a rectangle.
---@field rounded fun(size?: KompotCornerValue|KompotShapeCorners): KompotShape
---@field cut fun(size?: KompotCornerValue|KompotShapeCorners): KompotShape
---@field px fun(value: number): KompotCornerSize
---@field percent fun(value: number): KompotCornerSize Percentage of the smaller side, 0..100.

---@alias KompotColor string|number[]
---@alias KompotContent fun()
---@alias KompotAlign 'top_start'|'top_center'|'top_end'|'center_start'|'center'|'center_end'|'bottom_start'|'bottom_center'|'bottom_end'
---@alias KompotCrossAlign 'start'|'top'|'center'|'end'|'bottom'|number
---@alias KompotArrangement 'start'|'center'|'end'|'between'|'around'|'evenly'|number
---@alias KompotTextAlign 'start'|'center'|'end'
---@alias KompotImageFit 'fill'|'contain'|'cover'
---@alias KompotPlacement 'below'|'above'|'right'|'center'|'fill'|fun(anchor: KompotRect?, width: number, height: number, screen_width: number, screen_height: number, gap: number): number, number

---@class KompotRect
---@field x number
---@field y number
---@field w number
---@field h number

---@class KompotPadding
---@field l? number
---@field t? number
---@field r? number
---@field b? number
---@field h? number
---@field v? number
---@field start? number
---@field top? number
---@field end? number
---@field bottom? number
---@field horizontal? number
---@field vertical? number

---@class KompotState<T>
---@field value T
---@field set fun(self: KompotState<T>, value: T)
---@field peek fun(self: KompotState<T>): T
---@field update fun(self: KompotState<T>, fn: fun(value: T): T)
---@field patch fun(self: KompotState<T>, changes: table) Shallow copy and replace fields; requires a table value. Functions in changes are stored as values.
---@field update_field fun(self: KompotState<T>, key: any, value_or_fn: any|fun(old: any): any) Shallow copy and update one field; nil removes it. A function computes the new value once.

---@class KompotLocal<T>
---@field default T
---@field name string
---@field get fun(self: KompotLocal<T>): T

---@class KompotInteraction
---@field hovered KompotState<boolean>
---@field pressed KompotState<boolean>
---@field dragged KompotState<boolean>
---@field focused KompotState<boolean>

---@class KompotClickOptions
---@field enabled? boolean
---@field interaction? KompotInteraction
---@field cursor? string
---@field on_long_click? fun()
---@field on_right_click? fun()
---@field focusable? boolean
---@field focus_scope? boolean
---@field on_focus? fun()
---@field on_defocus? fun()
---@field focus_color? KompotColor
---@field focus_radius? KompotShapeInput Legacy alias of focus_shape.
---@field focus_shape? KompotShapeInput Takes precedence over focus_radius.

---@alias KompotPivot { [1]: number, [2]: number }|{x: number, y: number}

---@class KompotDragEvent
---@field type 'start'|'move'|'end'|'cancel'
---@field x number Local pointer x after inverse transforms.
---@field y number Local pointer y after inverse transforms.
---@field dx number Local pointer delta.
---@field dy number Local pointer delta.
---@field parent_x number Pointer x in the parent's content coordinates.
---@field parent_y number Pointer y in the parent's content coordinates.
---@field parent_dx number Pointer delta in parent coordinates.
---@field parent_dy number Pointer delta in parent coordinates.
---@field velocity_x number Parent pixels per second.
---@field velocity_y number Parent pixels per second.
---@field button 'left'|'right'
---@field accepted? boolean Drop target accepted the payload.
---@field cancelled? boolean
---@field reason? 'escape'|'removed'|'blocked'|'reset'|'cancelled'

---@class KompotDragOptions
---@field button? 'left'|'right'
---@field on_event? fun(event: KompotDragEvent): any Return the drop payload during 'start'; other return values are ignored.
---@field axis? 1|2
---@field interaction? KompotInteraction
---@field cursor? string

---@class KompotDropOptions
---@field on_enter? fun(payload: any)
---@field on_leave? fun(payload: any)
---@field on_drop? fun(payload: any): boolean?

---@class KompotPointerEvent
---@field type 'down'|'up'|'move'|'cancel'
---@field x number
---@field y number
---@field dx number
---@field dy number
---@field parent_x number
---@field parent_y number
---@field parent_dx number
---@field parent_dy number
---@field button 'left'|'right'
---@field cancelled? boolean
---@field reason? string

---@class KompotModifier
---@field is fun(value: any): boolean
---@field then_ fun(self: KompotModifier, other: KompotModifier): KompotModifier
---@field padding fun(self: KompotModifier, a: number|KompotPadding, b?: number, c?: number, d?: number): KompotModifier
---@field size fun(self: KompotModifier, width: number, height?: number): KompotModifier
---@field width fun(self: KompotModifier, width: number): KompotModifier
---@field height fun(self: KompotModifier, height: number): KompotModifier
---@field size_in fun(self: KompotModifier, min_width?: number, max_width?: number, min_height?: number, max_height?: number): KompotModifier
---@field width_in fun(self: KompotModifier, min?: number, max?: number): KompotModifier
---@field height_in fun(self: KompotModifier, min?: number, max?: number): KompotModifier
---@field required_size fun(self: KompotModifier, width: number, height?: number): KompotModifier
---@field fill_max_width fun(self: KompotModifier, fraction?: number): KompotModifier
---@field fill_max_height fun(self: KompotModifier, fraction?: number): KompotModifier
---@field fill_max_size fun(self: KompotModifier, fraction?: number): KompotModifier
---@field wrap_content fun(self: KompotModifier): KompotModifier
---@field aspect_ratio fun(self: KompotModifier, ratio: number): KompotModifier
---@field offset fun(self: KompotModifier, x?: number, y?: number): KompotModifier
---@field weight fun(self: KompotModifier, weight?: number, fill?: boolean): KompotModifier
---@field match_parent_size fun(self: KompotModifier): KompotModifier
---@field align fun(self: KompotModifier, align: KompotAlign|KompotCrossAlign): KompotModifier
---@field z_index fun(self: KompotModifier, z: number): KompotModifier
---@field vertical_scroll fun(self: KompotModifier, state: KompotScrollState): KompotModifier
---@field horizontal_scroll fun(self: KompotModifier, state: KompotScrollState): KompotModifier
---@field background fun(self: KompotModifier, color: KompotColor, shape?: KompotShapeInput): KompotModifier
---@field background_image fun(self: KompotModifier, paint: KompotNinePatch, tint?: KompotColor): KompotModifier
---@field border fun(self: KompotModifier, width: number, color: KompotColor, shape?: KompotShapeInput): KompotModifier
---@field shadow fun(self: KompotModifier, elevation?: number, shape?: KompotShapeInput, color?: KompotColor, dy?: number): KompotModifier
---@field rotate fun(self: KompotModifier, angle: number, pivot?: KompotPivot): KompotModifier
---@field scale fun(self: KompotModifier, x: number, y?: number, pivot?: KompotPivot): KompotModifier
---@field clip fun(self: KompotModifier, shape?: KompotShapeInput): KompotModifier
---@field alpha fun(self: KompotModifier, alpha: number): KompotModifier
---@field clickable fun(self: KompotModifier, on_click?: fun(), opts?: KompotClickOptions): KompotModifier
---@field focusable fun(self: KompotModifier, on_key?: fun(key: string), opts?: KompotClickOptions): KompotModifier
---@field block_pointer fun(self: KompotModifier): KompotModifier
---@field hoverable fun(self: KompotModifier, target: KompotInteraction|fun(hovered: boolean)): KompotModifier
---@field draggable fun(self: KompotModifier, opts: KompotDragOptions): KompotModifier
---@field drop_target fun(self: KompotModifier, opts?: KompotDropOptions): KompotModifier
---@field pointer_input fun(self: KompotModifier, fn: fun(event: KompotPointerEvent)): KompotModifier
---@field on_wheel fun(self: KompotModifier, fn: fun(delta: number): boolean?): KompotModifier
---@field cursor fun(self: KompotModifier, name: string): KompotModifier
---@field on_size fun(self: KompotModifier, fn: fun(width: number, height: number)): KompotModifier
---@field on_placed fun(self: KompotModifier, fn: fun(x: number, y: number, width: number, height: number)): KompotModifier
---@field tag fun(self: KompotModifier, name: string): KompotModifier

---@class KompotProps
---@field modifier? KompotModifier
---@field mod? KompotModifier
---@field key? any

---@class KompotBoxProps: KompotProps
---@field align? KompotAlign
---@field propagate_min? boolean

---@class KompotLinearProps: KompotProps
---@field arrangement? KompotArrangement
---@field spacing? number
---@field align? KompotCrossAlign
---@field fill_cross? boolean

---@class KompotFlowProps: KompotProps
---@field spacing? number
---@field run_spacing? number
---@field align? KompotCrossAlign

---@class KompotTextStyle
---@field font string
---@field bold? string
---@field size? number
---@field color? KompotColor
---@field family? string
---@field weight? string

---@class KompotTextSpan
---@field text? string
---@field [1]? string
---@field color? KompotColor
---@field style? string|KompotTextStyle
---@field font? string
---@field bold? boolean

---@class KompotTextProps: KompotProps
---@field style? string|KompotTextStyle
---@field color? KompotColor
---@field align? KompotTextAlign
---@field max_lines? integer
---@field wrap? boolean
---@field ellipsis? boolean
---@field font? string
---@field bold_font? string
---@field markup? 'md'
---@field spans? KompotTextSpan[]

---@class KompotImageProps: KompotProps
---@field width? number
---@field height? number
---@field size? number
---@field source_size? { [1]: number, [2]: number }|{ width: number, height: number }
---@field fit? KompotImageFit
---@field color? KompotColor
---@field region? number[]

---@class KompotIconProps: KompotProps
---@field size? number
---@field color? KompotColor

---@class KompotCanvasImageOptions
---@field x? number Top-left position before rotation; default 0.
---@field y? number
---@field width? number Unscaled display width; default source width.
---@field height? number Unscaled display height; default source height.
---@field angle? number Clockwise degrees; default 0.
---@field scale? number|{ [1]: number, [2]: number }|{x: number, y: number}
---@field pivot? KompotPivot Fractions of display size; default {0.5,0.5}.
---@field alpha? number Opacity 0..1.
---@field color? KompotColor Color multiplication.
---@field region? number[] UV {u0,v0,u1,v1}; default {0,0,1,1}.

---@class KompotCanvas
---@field width number
---@field height number
---@field image fun(self: KompotCanvas, src: string|KompotRaster, opts?: KompotCanvasImageOptions)
---@field set fun(self: KompotCanvas, x: number, y: number, r: number, g?: number, b?: number, a?: number)
---@field line fun(self: KompotCanvas, x1: number, y1: number, x2: number, y2: number, r: number, g?: number, b?: number, a?: number)
---@field rect fun(self: KompotCanvas, x: number, y: number, width: number, height: number, r: number, g?: number, b?: number, a?: number)
---@field clear fun(self: KompotCanvas, r?: number, g?: number, b?: number, a?: number)

---@class KompotRasterOptions
---@field key? string Shared resource identity; namespace with your pack name.
---@field version? string|number Change when source pixels change.
---@field width integer
---@field height integer
---@field draw fun(canvas: KompotCanvas, width: integer, height: integer)

---@class KompotRaster: KompotRasterOptions
---@field kind 'raster'

---@class KompotNinePatchOptions
---@field source_size? number[] Required for texture/atlas sources: {width, height}.
---@field border? number|number[] Source pixels: number or {left, top, right, bottom}.
---@field center? 'stretch'|'tile'|'none'
---@field edges? 'stretch'|'tile'
---@field scale? number

---@class KompotNinePatch: KompotNinePatchOptions
---@field kind 'nine_patch'
---@field src string|KompotRaster

---@class KompotCanvasProps: KompotProps
---@field draw fun(canvas: KompotCanvas, width: number, height: number)
---@field version? any
---@field width? number
---@field height? number

---@class KompotMeasureApi
---@field INF number
---@field measure fun(child: any, min_width: number, max_width: number, min_height: number, max_height: number): number, number
---@field place fun(child: any, x: number, y: number)

---@class KompotLayoutProps: KompotProps
---@field measure fun(children: any[], min_width: number, max_width: number, min_height: number, max_height: number, api: KompotMeasureApi): number, number

---@class KompotTextInputProps: KompotProps
---@field value? string
---@field on_change? fun(text: string)
---@field on_submit? fun(text: string)
---@field hint? string
---@field font? string|false
---@field color? KompotColor
---@field lines? integer
---@field pad? number
---@field width? number
---@field focus? boolean
---@field on_focus? fun()
---@field on_defocus? fun()
---@field syntax? 'lua'|string
---@field line_numbers? boolean
---@field editable? boolean
---@field wrap? boolean
---@field presentation? any
---@field editor_state? KompotState<KompotEditorValue>
---@field editor_value? KompotEditorValue
---@field on_selection_change? fun(anchor: number, caret: number)

---@class KompotEditorValue
---@field text string
---@field anchor integer
---@field caret integer

---@class KompotBasicTextFieldProps: KompotTextInputProps
---@field state? KompotState<string>
---@field editor_state? KompotState<KompotEditorValue>

---@class KompotScrollState
---@field value number
---@field max number
---@field view number
---@field step number
---@field scroll_by fun(self: KompotScrollState, delta: number): number
---@field scroll_to fun(self: KompotScrollState, value: number): number
---@field fraction fun(self: KompotScrollState): number, number

---@class KompotLazyState
---@field first integer
---@field offset number
---@field total number
---@field view number
---@field step number
---@field scroll_by fun(self: KompotLazyState, delta: number): number
---@field scroll_to_item fun(self: KompotLazyState, index: integer)
---@field first_visible fun(self: KompotLazyState): integer
---@field fraction fun(self: KompotLazyState): number, number

---@class KompotLazyProps: KompotProps
---@field count integer
---@field item fun(index: integer)
---@field key_of? fun(index: integer): any
---@field state? KompotLazyState
---@field spacing? number
---@field pad? number
---@field pad_start? number
---@field pad_end? number
---@field fill_cross? boolean

---@class KompotLazyGridProps: KompotLazyProps
---@field columns? integer

---@class KompotPopupProps
---@field placement? KompotPlacement
---@field gap? number
---@field key? any
---@field z? number

---@class KompotTheme
---@field name? string
---@field dark? boolean
---@field colors table<string, number[]>
---@field type table<string, KompotTextStyle>
---@field default_style? string
---@field icons? string
---@field fonts? string[]
---@field ui? KompotUiContract
---@field [string] any

---@class KompotTween
---@field kind 'tween'
---@field duration number
---@field easing string

---@class KompotSpring
---@field kind 'spring'
---@field stiffness number
---@field damping number

---@class KompotSnap
---@field kind 'snap'

---@alias KompotAnimationSpec KompotTween|KompotSpring|KompotSnap

---@class KompotPreviewOptions
---@field width? number
---@field height? number
---@field theme? KompotTheme|fun(): KompotTheme
---@field padding? number
---@field group? string
---@field hook_diagnostics? boolean Detailed hook locations and previous/current order; enabled by default in previews.

---@class KompotPreviewEntry
---@field name string
---@field opts KompotPreviewOptions
---@field content KompotContent
---@field source? string
---@field line? integer

---@class KompotMountOptions
---@field content KompotContent
---@field theme? KompotTheme
---@field target? any
---@field fullscreen? boolean
---@field interactive? boolean
---@field z_index? number
---@field lock_inventory? boolean False leaves Tab/hud.inventory untouched, including hover and focus (default true).
---@field hook_diagnostics? boolean Collect detailed hook locations; order/type checks are always enabled.

---@class KompotMountHandle
---@field disposed boolean
---@field app KompotAppInstance
---@field backend table
---@field host any
---@field fake_input? table
---@field close_pending? boolean
---@field dispose fun(self: KompotMountHandle)
---@field set_content fun(self: KompotMountHandle, content: KompotContent)
---@field set_theme fun(self: KompotMountHandle, theme: KompotTheme)

---@class KompotColorApi
---@field rgb fun(r: number, g: number, b: number, a?: number): number[]
---@field hex fun(value: string): number[]
---@field of fun(value: KompotColor?): number[]?
---@field to_hex fun(value: number[]): string
---@field with_alpha fun(value: number[], alpha: number): number[]
---@field mul_alpha fun(value: number[], alpha: number): number[]
---@field mix fun(a: number[], b: number[], t: number): number[]
---@field over fun(base: number[], over: number[]): number[]
---@field equals fun(a: number[], b: number[]): boolean
---@field to_hsl fun(value: number[]): number, number, number
---@field hsl fun(h: number, s: number, l: number, a?: number): number[]
---@field lighten fun(value: number[], amount: number): number[]
---@field darken fun(value: number[], amount: number): number[]
---@field luminance fun(value: number[]): number
---@field contrast fun(a: number[], b: number[]): number
---@field on fun(background: number[], dark?: number[], light?: number[]): number[]
---@field tone fun(value: number[], tone: number, chroma?: number): number[]
---@field palette fun(value: number[], chroma?: number): table<string, number[]>
---@field to255 fun(value: number[], alpha_mul?: number): number[]
---@field WHITE number[]
---@field BLACK number[]
---@field TRANSPARENT number[]

---@class KompotFontApi
---@field register_family fun(id: string, entries: table[]): nil
---@field info fun(name: string): table?
---@field resolve fun(id: string, size: number, weight?: string): string
---@field typography fun(defaults: table<string, KompotTextStyle>, opts?: table, overrides?: table): table<string, KompotTextStyle>
---@field register_metrics fun(metrics: table)

---@class KompotTextMeasurer
---@field width fun(self: KompotTextMeasurer, font: string, text: string): number
---@field line_height fun(self: KompotTextMeasurer, font: string): number
---@field field_line_height? fun(self: KompotTextMeasurer, font: string): number

---@class KompotTextLayout
---@field lines table[]
---@field widths number[]
---@field w number
---@field h number
---@field lh number
---@field rich? boolean

---@class KompotTextApi
---@field version integer
---@field chars fun(text: string): string[]
---@field layout fun(measurer: KompotTextMeasurer, font: string, text: string|number, max_width: number, max_lines?: integer, wrap?: boolean, ellipsis?: boolean): KompotTextLayout
---@field parse_md fun(text: string): table[]
---@field layout_rich fun(measurer: KompotTextMeasurer, runs: table[], max_width: number, max_lines?: integer, wrap?: boolean): KompotTextLayout
---@field clear_cache fun()
---@field approx_measurer fun(scale?: number): KompotTextMeasurer
---@field register_metrics fun(metrics: table<string, table>)
---@field metrics_measurer fun(): KompotTextMeasurer
---@field field_line_height fun(measurer: KompotTextMeasurer, font: string): number

---@class KompotApp
---@field new fun(opts: table): KompotAppInstance

---@class KompotAppInstance
---@field rt table<string, any>
---@field input table<string, any>
---@field dl table[]
---@field stats table<string, number>
---@field set_size fun(self: KompotAppInstance, width: number, height: number)
---@field frame fun(self: KompotAppInstance, dt?: number, event?: table): boolean
---@field find_tag fun(self: KompotAppInstance, name: string): table?
---@field dispose fun(self: KompotAppInstance)

---@class KompotApi
---@field VERSION string
---@field copy fun<T>(source: T, changes?: table): T Shallow copy of a table with optional field replacements; nested values share references, metatable is not copied.
---@field Modifier KompotModifier
---@field M KompotModifier
---@field Shape KompotShapeApi
---@field rounded_corners fun(radius?: KompotRadius): KompotRadius Copy and validate corner radii.
---@field nine_patch fun(source: string|KompotRaster, opts?: KompotNinePatchOptions): KompotNinePatch
---@field raster fun(opts: KompotRasterOptions): KompotRaster
---@field Box fun(a: KompotBoxProps|KompotModifier|KompotContent, content?: KompotContent)
---@field Row fun(a: KompotLinearProps|KompotModifier|KompotContent, content?: KompotContent)
---@field Column fun(a: KompotLinearProps|KompotModifier|KompotContent, content?: KompotContent)
---@field FlowRow fun(a: KompotFlowProps|KompotModifier|KompotContent, content?: KompotContent)
---@field Spacer fun(width: number|KompotModifier, height?: number)
---@field Text fun(text: string|number|nil, props?: KompotTextProps)
---@field Image fun(source: string, props?: KompotImageProps)
---@field Icon fun(name: string, props?: KompotIconProps)
---@field Canvas fun(props: KompotCanvasProps)
---@field Layout fun(props: KompotLayoutProps, content: KompotContent)
---@field TextInput fun(props: KompotTextInputProps)
---@field BasicTextField fun(props: KompotBasicTextFieldProps)
---@field new_text_field_state fun(initial?: string): KompotState<KompotEditorValue>
---@field text_field_state fun(initial?: string): KompotState<KompotEditorValue>
---@field scroll_state fun(initial?: number): KompotScrollState
---@field lazy_state fun(): KompotLazyState
---@field LazyColumn fun(props: KompotLazyProps)
---@field LazyRow fun(props: KompotLazyProps)
---@field LazyGrid fun(props: KompotLazyGridProps)
---@field Popup fun(props: KompotPopupProps, content: KompotContent)
---@field state fun(initial: any, eq?: fun(a: any, b: any): boolean): KompotState<any>
---@field form fun(initial: table): table<any, KompotState<any>> Remember a fixed set of independent field states. Initial values apply once; recreate with K.key to change schema.
---@field new_state fun<T>(initial: T, eq?: fun(a: T, b: T): boolean): KompotState<T>
---@field remember fun<T>(initial: fun(): T, ...: any): T
---@field effect fun(fn: function, ...: any)
---@field on_dispose fun(fn: fun())
---@field on_frame fun(fn: fun(dt: number)) Once per frame; removed with the component.
---@field key fun(key: any, content: KompotContent)
---@field component fun<T>(fn: T): T
---@field provide fun<T>(local_value: KompotLocal<T>, value: T, content: KompotContent)
---@field local_of fun<T>(default: T, name?: string): KompotLocal<T>
---@field untracked fun<T>(fn: fun(...: any): T, ...: any): T
---@field is_state fun(value: any): boolean
---@field poll fun(getter: function, eq?: function): any
---@field animate fun<T>(target: T, spec?: KompotAnimationSpec): T
---@field tween fun(duration?: number, easing?: string): KompotTween
---@field spring fun(stiffness?: number, damping?: number): KompotSpring
---@field snap KompotSnap
---@field clock fun(): number
---@field after fun(seconds: number, key?: any): boolean
---@field runtime fun(): table
---@field EASING table<string, fun(t: number): number>
---@field interaction fun(): KompotInteraction
---@field new_interaction fun(): KompotInteraction
---@field color KompotColorApi
---@field rgb fun(r: number, g: number, b: number, a?: number): number[]
---@field hex fun(value: string): number[]
---@field fonts KompotFontApi
---@field BASE_THEME KompotTheme
---@field theme fun(): KompotTheme
---@field Theme fun(theme: KompotTheme, content: KompotContent)
---@field ContentColor fun(color: KompotColor, content: KompotContent)
---@field TextStyle fun(style: string|KompotTextStyle, content: KompotContent)
---@field style fun(name: string|KompotTextStyle, theme?: KompotTheme): KompotTextStyle
---@field extend_theme fun(base: KompotTheme, overrides: table): KompotTheme
---@field LocalTheme KompotLocal<KompotTheme>
---@field LocalContentColor KompotLocal<KompotColor>
---@field LocalTextStyle KompotLocal<KompotTextStyle>
---@field ui fun(): KompotUiContract
---@field args fun(a: KompotProps|KompotModifier|KompotContent, content?: KompotContent): KompotProps, KompotContent?
---@field App KompotApp
---@field text KompotTextApi
---@field preview fun(name: string, opts: KompotPreviewOptions|KompotContent, content?: KompotContent): KompotPreviewEntry
---@field previews fun(): KompotPreviewEntry[]
---@field mount fun(opts: KompotMountOptions): KompotMountHandle
