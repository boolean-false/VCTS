---@meta _

-- API встроенной дизайн-системы и общий контракт K.ui().

---@class KompotUiProps
---@field modifier? KompotModifier
---@field mod? KompotModifier
---@field key? any
---@field enabled? boolean
---@field tooltip? string

---@class KompotUiButtonProps: KompotUiProps
---@field text? string
---@field icon? string
---@field on_click? fun()
---@field on_right_click? fun()
---@field variant? 'default'|'primary'|'secondary'|'danger'|'ghost'|'toggle'|string
---@field selected? boolean
---@field size? 'sm'|'md'|'lg'|number
---@field align? 'start'|'center'
---@field trailing? string
---@field compact? boolean
---@field min_width? number
---@field radius? KompotShapeInput

---@class KompotUiIconButtonProps: KompotUiButtonProps
---@field icon string

---@class KompotUiToggleProps: KompotUiProps
---@field checked? boolean
---@field on_change? fun(value: boolean)
---@field label? string

---@class KompotUiOption
---@field value any
---@field text string
---@field icon? string
---@field tooltip? string

---@class KompotUiChoiceProps: KompotUiProps
---@field options (KompotUiOption|{[1]: any, [2]: string}|string)[]
---@field selected? any
---@field on_select? fun(value: any)
---@field columns? integer
---@field size? number

---@class KompotUiSliderProps: KompotUiProps
---@field value? number
---@field min? number
---@field max? number
---@field step? number
---@field steps? integer
---@field on_change? fun(value: number)
---@field on_change_end? fun()
---@field label? string
---@field format? fun(value: number): string

---@class KompotUiTabsProps: KompotUiProps
---@field tabs (string|{text: string, icon?: string})[]
---@field selected? integer
---@field on_select? fun(index: integer)

---@class KompotUiFieldProps: KompotTextInputProps
---@field state? KompotState<string>
---@field label? string
---@field label_width? number
---@field supporting? string
---@field error? string|boolean
---@field height? number

---@class KompotUiLabeledFieldProps: KompotUiFieldProps
---@field label_width? number
---@field field_width? number

---@class KompotUiPanelProps: KompotUiProps
---@field title? string
---@field markup? 'md'
---@field icon? string
---@field accent? string|KompotColor
---@field header? KompotContent
---@field width? number|false
---@field variant? 'plain'|'flat'|'accent'
---@field padding? number
---@field spacing? number
---@field background? KompotColor
---@field radius? KompotShapeInput
---@field fill_height? boolean

---@class KompotUiWindowProps: KompotUiPanelProps
---@field visible? boolean
---@field on_close? fun()
---@field on_dismiss? fun()
---@field placement? KompotPlacement
---@field bounds? {x: number, y: number, width: number, height: number}
---@field on_bounds_change? fun(bounds: {x: number, y: number, width: number, height: number})
---@field draggable? boolean
---@field resizable? boolean
---@field modal? boolean
---@field min_width? number
---@field min_height? number
---@field max_width? number
---@field max_height? number
---@field height? number
---@field z? number
---@field title_modifier? KompotModifier

---@class KompotUiDialogAction
---@field text? string
---@field on_click? fun()
---@field variant? string

---@class KompotUiDialogProps: KompotUiWindowProps
---@field text? string
---@field confirm? KompotUiDialogAction
---@field cancel? KompotUiDialogAction

---@class KompotUiMenuProps: KompotUiProps
---@field expanded? boolean
---@field on_dismiss? fun()
---@field width? number
---@field placement? KompotPlacement

---@class KompotUiMenuItemProps: KompotUiButtonProps
---@field shortcut? string
---@field danger? boolean
---@field divider? boolean

---@class KompotUiSplitPaneProps: KompotUiProps
---@field first KompotContent
---@field second KompotContent
---@field orientation? 'horizontal'|'vertical'
---@field default_size? number
---@field size? number
---@field on_change? fun(size: number)
---@field divider_modifier? KompotModifier
---@field divider_size? number
---@field min_first? number
---@field min_second? number
---@field max_first? number
---@field step? number

---@class KompotUiMenuBarProps: KompotUiProps
---@field brand? string
---@field menus? {text: string, width?: number, menu_width?: number, items?: KompotUiMenuItemProps[]}[]
---@field actions? KompotContent
---@field open? integer
---@field on_open? fun(index: integer?)

---@class KompotUiBarProps: KompotUiProps
---@field text? string
---@field right? string
---@field height? number
---@field color? KompotColor

---@class KompotUiToastProps: KompotUiProps
---@field text? string
---@field width? number
---@field top? number
---@field icon? string|false
---@field accent? string|KompotColor
---@field variant? 'plain'|'accent'
---@field tone? 'neutral'|'info'|'success'|'warning'|'error'

---@class KompotUiLuaProps: KompotUiProps
---@field code? string
---@field title? string
---@field line_numbers? boolean
---@field lines? integer
---@field height? number
---@field presentation? any

---@class KompotUiVectorFieldProps: KompotUiProps
---@field label? string
---@field values? (string|number)[]
---@field on_change? fun(axis: integer, text: string)
---@field on_submit? fun(axis: integer, text: string)
---@field on_focus? fun()
---@field on_defocus? fun()
---@field label_width? number

---@class KompotUiPreviewProps: KompotImageProps
---@field src? string
---@field placeholder? string
---@field tooltip? string

---@class KompotUiCardProps: KompotUiProps
---@field on_click? fun()
---@field selected? boolean
---@field padding? number
---@field radius? KompotShapeInput

---@class KompotUiListItemProps: KompotUiProps
---@field headline? string
---@field supporting? string
---@field icon? string
---@field trailing? string|KompotContent
---@field on_click? fun()
---@field selected? boolean

---@class KompotUiThemeOptions
---@field accent? string|KompotColor
---@field dark? boolean
---@field density? 'compact'|'comfortable'
---@field colors? table<string, KompotColor>
---@field skin? table<'panel'|'button'|'button_pressed'|'inset', string|table>
---@field metrics? table<string, number>
---@field panel_alpha? number
---@field ui? table<string, function>
---@field [string] any

---@class KompotUiContract
---@field Button fun(props: KompotUiButtonProps, content?: KompotContent)
---@field IconButton fun(props: KompotUiIconButtonProps)
---@field Checkbox fun(props: KompotUiToggleProps)
---@field Switch fun(props: KompotUiToggleProps)
---@field Tabs fun(props: KompotUiTabsProps)
---@field Divider fun(props?: {modifier?: KompotModifier, vertical?: boolean, thickness?: number, inset?: number, color?: KompotColor})
---@field Badge fun(props: {count?: string|number, color?: KompotColor, modifier?: KompotModifier})
---@field ProgressBar fun(props: {progress?: number, color?: KompotColor, height?: number, modifier?: KompotModifier})
---@field Tooltip fun(props: {text: string, delay?: number, placement?: KompotPlacement, modifier?: KompotModifier}, content: KompotContent)
---@field Dialog fun(props: KompotUiDialogProps, content?: KompotContent)
---@field Scrollbar fun(props: {state: KompotScrollState|KompotLazyState, modifier?: KompotModifier})
---@field MenuItem fun(props: KompotUiMenuItemProps)
---@field Slider fun(props: KompotUiSliderProps)
---@field TextField fun(props: KompotUiFieldProps)
---@field Segmented fun(props: KompotUiChoiceProps)
---@field Panel fun(props: KompotUiPanelProps, content: KompotContent)
---@field ListItem fun(props: KompotUiListItemProps)
---@field Menu fun(props: KompotUiMenuProps, content: KompotContent)
---@field [string] function

---@class KompotUiItem
---@field id? string
---@field name? string
---@field src? string
---@field count? number
---@field durability? number
---@field rarity? KompotColor
---@field description? string

---@class KompotUiItemSlotProps: KompotUiProps
---@field item? KompotUiItem
---@field size? number
---@field selected? boolean
---@field locked? boolean
---@field enabled? boolean
---@field keycap? string|number
---@field placeholder? string
---@field tooltip? string
---@field on_click? fun()
---@field on_right_click? fun()
---@field on_drag_event? fun(event: KompotDragEvent, item: KompotUiItem): any Return the payload during 'start'.
---@field drag_button? 'left'|'right'
---@field accepts? fun(payload: any): boolean
---@field on_drop? fun(payload: any): boolean?
---@field src? string
---@field icon? string
---@field badge? string|number

---@class KompotUiInventoryProps: KompotUiProps
---@field items? table<integer, KompotUiItem>
---@field count? number
---@field columns? number
---@field size? number
---@field gap? number
---@field selected? number
---@field on_select? fun(index: number)
---@field on_right_click? fun(index: number)
---@field on_move? fun(from: number, to: number, item: KompotUiItem): boolean?
---@field accepts? fun(target: number, payload: any): boolean
---@field drag_group? any
---@field slot_props? KompotUiItemSlotProps
---@field tag_prefix? string

-- Остальные компоненты приходят из KompotUiContract.
---@class KompotUiApi: KompotUiContract
---@field VERSION string
---@field theme fun(opts?: KompotUiThemeOptions): KompotTheme
---@field Theme fun(opts: KompotUiThemeOptions, content: KompotContent)
---@field current fun(): KompotTheme
---@field DEFAULT KompotTheme
---@field PALETTE table<string, table<string, KompotColor>>
---@field TYPE table<string, KompotTextStyle>
---@field METRICS table<string, number>
---@field MOTION table<string, KompotAnimationSpec>
---@field tokens table
---@field components table<string, function>
---@field ui KompotUiContract
---@field ToolButton fun(props: KompotUiIconButtonProps)
---@field Choice fun(props: KompotUiChoiceProps)
---@field Stepper fun(props: {label?: string, value?: number|string, on_minus?: fun(), on_plus?: fun(), minus?: string, plus?: string, tooltip?: string, modifier?: KompotModifier})
---@field Field fun(props: KompotUiFieldProps)
---@field LabeledField fun(props: KompotUiLabeledFieldProps)
---@field VectorField fun(props: KompotUiVectorFieldProps)
---@field Window fun(props: KompotUiWindowProps, content: KompotContent)
---@field MenuBar fun(props: KompotUiMenuBarProps)
---@field MenuDivider fun(props?: KompotUiProps)
---@field Bar fun(props: KompotUiBarProps)
---@field Toast fun(props: KompotUiToastProps)
---@field ListRow fun(props: KompotUiButtonProps)
---@field Slot fun(props: KompotUiItemSlotProps)
---@field ItemSlot fun(props: KompotUiItemSlotProps)
---@field InventoryGrid fun(props: KompotUiInventoryProps)
---@field Hotbar fun(props: {items?: table<integer, KompotUiItem>, count?: number, size?: number, selected?: number, show_name?: boolean, on_select?: fun(index: number), modifier?: KompotModifier})
---@field ResourceBar fun(props: {label?: string, value?: number, max?: number, kind?: string, color?: KompotColor, segments?: number, height?: number, text?: string, compact?: boolean, modifier?: KompotModifier})
---@field ActionHint fun(props: {binding?: string, text?: string, detail?: string, modifier?: KompotModifier})
---@field ItemDetails fun(props: {item?: KompotUiItem, width?: number, actions?: KompotContent, modifier?: KompotModifier})
---@field MachinePanel fun(props: table)
---@field HUD fun(props: table)
---@field Card fun(props: KompotUiCardProps, content: KompotContent)
---@field Section fun(text: string, props?: KompotUiProps)
---@field Hint fun(text: string, props?: KompotTextProps)
---@field Key fun(text: string)
---@field Preview fun(props: KompotUiPreviewProps)
---@field SplitPane fun(props: KompotUiSplitPaneProps)
---@field Lua fun(code: string|KompotUiLuaProps, props?: KompotUiLuaProps)
---@field key_chips fun(items: {[1]: string, [2]: string}[]): string
---@field open_gallery fun()
