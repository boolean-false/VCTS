/// <reference path="canvas.d.ts" />
/**
 * Корневой элемент меню core:root/menu.
 * Источник: res/scripts/stdlib.lua, элемент core:root/menu.
 */
declare const menu: VC.UIElement;
/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /** Динамические данные окружения или шаблона интерфейса. */
  type UIData = Record<string, unknown>;
  /** Читаемые свойства элементов интерфейса; доступность зависит от вида виджета. */
  interface UIAttributes {
    /** ID элемента в XML-документе. */
    id: string;
    /** Признак существования элемента в документе. */
    exists: boolean;
    /** Основной цвет RGBA с компонентами от 0 до 255. */
    color: Vec4;
    /** Цвет RGBA при наведении курсора, компоненты от 0 до 255. */
    hoverColor: Vec4;
    /** Цвет RGBA при нажатии, компоненты от 0 до 255. */
    pressedColor: Vec4;
    /** Смещение содержимого относительно элемента. */
    contentOffset: Vec2;
    /** Текст всплывающей подсказки. */
    tooltip: string;
    /** Задержка появления всплывающей подсказки. */
    tooltipDelay: number;
    /** Положение элемента относительно родителя. */
    pos: Vec2;
    /** Положение элемента в координатах документа. */
    wpos: Vec2;
    /** Размеры элемента по двум осям. */
    size: Vec2;
    /** Признак обработки действий пользователя. */
    interactive: boolean;
    /** Признак видимости элемента. */
    visible: boolean;
    /** Признак включённого состояния элемента. */
    enabled: boolean;
    /** Текст-заполнитель пустого поля ввода. */
    placeholder: string | undefined;
    /** Подсказка поля ввода. */
    hint: string | undefined;
    /** Результат проверки содержимого поля ввода. */
    valid: boolean | undefined;
    /** Позиция текстового курсора. */
    caret: number | undefined;
    /** Текст элемента. */
    text: string | undefined;
    /** Разрешение редактирования текста. */
    editable: boolean | undefined;
    /** Признак изменения текста пользователем. */
    edited: boolean | undefined;
    /** Видимость номеров строк в текстовом редакторе. */
    lineNumbers: boolean | undefined;
    /** Имя языка подсветки синтаксиса. */
    syntax: string | undefined;
    /** Имя языка разметки текста. */
    markup: string | undefined;
    /** Имя основного графического ресурса элемента. */
    src: string | undefined;
    /** Имя запасного графического ресурса. */
    fallback: string | undefined;
    /** Текущее значение элемента управления. */
    value: number | string | undefined;
    /** Минимальное значение элемента управления. */
    min: number | undefined;
    /** Максимальное значение элемента управления. */
    max: number | undefined;
    /** Шаг изменения числового значения. */
    step: number | undefined;
    /** Положение прокрутки. */
    scroll: number | undefined;
    /** Ширина дорожки элемента управления. */
    trackWidth: number | undefined;
    /** Цвет дорожки RGBA с компонентами от 0 до 255. */
    trackColor: Vec4 | undefined;
    /** Цвет текста RGBA с компонентами от 0 до 255. */
    textColor: Vec4 | undefined;
    /** Состояние флажка. */
    checked: boolean | undefined;
    /** Имя текущей страницы контейнера. */
    page: string | undefined;
    /** ID связанного инвентаря. */
    inventory: number | undefined;
    /** Индекс отображаемого слота инвентаря, начиная с 0. */
    slotIndex: number | undefined;
    /** Признак фокуса ввода на элементе. */
    focused: boolean;
    /** Имя вида курсора при наведении. */
    cursor: string;
    /** Буфер пикселей Canvas, связанный с элементом. */
    data: Canvas | undefined;
    /** Родительский элемент или undefined. */
    parent: UIElement | undefined;
    /** Прямоугольная область элемента из четырёх компонентов. */
    region: Vec4 | undefined;
    /** Варианты выбора с внутренним значением и отображаемым текстом. */
    options: {
      /** Внутреннее значение варианта выбора. */
      value:string;
      /** Отображаемый текст варианта выбора. */
      text:string
    }[] | undefined;
    /** Порядок наложения элемента при отрисовке. */
    zIndex: number;
  }
  /** Свойства элементов интерфейса, доступные для записи через gui.setattr. */
  interface UIWritableAttributes {
    /** Основной цвет RGBA с компонентами от 0 до 255. */
    color: Vec4;
    /** Цвет RGBA при наведении курсора, компоненты от 0 до 255. */
    hoverColor: Vec4;
    /** Цвет RGBA при нажатии, компоненты от 0 до 255. */
    pressedColor: Vec4;
    /** Текст всплывающей подсказки. */
    tooltip: string;
    /** Задержка появления всплывающей подсказки. */
    tooltipDelay: number;
    /** Положение элемента относительно родителя. */
    pos: Vec2;
    /** Положение элемента в координатах документа. */
    wpos: Vec2;
    /** Размеры элемента по двум осям. */
    size: Vec2;
    /** Признак обработки действий пользователя. */
    interactive: boolean;
    /** Признак видимости элемента. */
    visible: boolean;
    /** Признак включённого состояния элемента. */
    enabled: boolean;
    /** Текст-заполнитель пустого поля ввода. */
    placeholder: string;
    /** Подсказка поля ввода. */
    hint: string;
    /** Позиция текстового курсора. */
    caret: number;
    /** Текст элемента. */
    text: string;
    /** Разрешение редактирования текста. */
    editable: boolean;
    /** Признак изменения текста пользователем. */
    edited: boolean;
    /** Видимость номеров строк в текстовом редакторе. */
    lineNumbers: boolean;
    /** Имя языка подсветки синтаксиса. */
    syntax: string;
    /** Имя языка разметки текста. */
    markup: string;
    /** Имя основного графического ресурса элемента. */
    src: string;
    /** Имя запасного графического ресурса. */
    fallback: string;
    /** Текущее значение элемента управления. */
    value: number | string;
    /** Минимальное значение элемента управления. */
    min: number;
    /** Максимальное значение элемента управления. */
    max: number;
    /** Шаг изменения числового значения. */
    step: number;
    /** Положение прокрутки. */
    scroll: number;
    /** Ширина дорожки элемента управления. */
    trackWidth: number;
    /** Цвет дорожки RGBA с компонентами от 0 до 255. */
    trackColor: Vec4;
    /** Цвет текста RGBA с компонентами от 0 до 255. */
    textColor: Vec4;
    /** Состояние флажка. */
    checked: boolean;
    /** Имя текущей страницы контейнера. */
    page: string;
    /** ID связанного инвентаря. */
    inventory: number;
    /** Признак фокуса ввода на элементе. */
    focused: boolean;
    /** Имя вида курсора при наведении. */
    cursor: string;
    /** Прямоугольная область элемента из четырёх компонентов. */
    region: Vec4;
    /** Варианты выбора с внутренним значением и отображаемым текстом. */
    options: {
      /** Внутреннее значение варианта выбора. */
      value:string;
      /** Отображаемый текст варианта выбора. */
      text:string
    }[];
    /** Порядок наложения элемента при отрисовке. */
    zIndex: number;
  }
  /**
   * Обёртка XML-элемента с доступом к свойствам и операциям виджета.
   * Свойства и методы зависят от вида виджета и могут отсутствовать. Задавайте контракты для известных XML-элементов.
   */
  interface UIElement extends UIAttributes {
    /** Имя документа, которому принадлежит элемент. */
    readonly docname: string;
    /** Имя элемента в обёртке документа. */
    readonly name: string;
    /** ID элемента в XML-документе. */
    readonly id: string;
    /** Признак существования элемента в документе. */
    readonly exists: boolean;
    /** Смещение содержимого относительно элемента. */
    readonly contentOffset: Vec2;
    /** Родительский элемент или undefined. */
    readonly parent: UIElement | undefined;
    /** Буфер пикселей Canvas, связанный с элементом. */
    readonly data: Canvas | undefined;
    /** Результат проверки содержимого поля ввода. */
    readonly valid: boolean | undefined;
    /** Индекс отображаемого слота инвентаря, начиная с 0. */
    readonly slotIndex: number | undefined;
    /** Удаляет элемент из документа. */
    destruct(this: UIElement): void;
    /** Пересчитывает положение элемента по правилам компоновки. */
    reposition(this: UIElement): void;
    /** Перемещает элемент в контейнер destination. */
    moveInto(this: UIElement, destination: UIElement): void;
    /** Добавляет XML-разметку в контейнер с необязательными данными шаблона. */
    add?: (this: UIElement, xml: string, data?: UIData) => void;
    /** Удаляет содержимое контейнера. */
    clear?: (this: UIElement) => void;
    /** Обновляет содержимое контейнера. */
    refresh?: (this: UIElement) => void;
    /** Периодически вызывает callback с интервалом в миллисекундах, пока существует контейнер. */
    setInterval?: (this: UIElement, milliseconds: number, callback: (this:void)=>void) => void;
    /** Вставляет текст в редактируемый элемент. */
    paste?: (this: UIElement, text: string) => void;
    /** Сбрасывает состояние виджета. */
    reset?: (this: UIElement) => void;
    /** Возвращается на предыдущую страницу и сообщает результат. */
    back?: (this: UIElement) => boolean;
    /** Возвращает номер строки по позиции символа в тексте. */
    lineAt(this: UIElement, index: number): number | undefined;
    /** Возвращает позицию символа по координатам в текстовом элементе. */
    indexByPos(this: UIElement, position: Vec2): number | undefined;
    /** Возвращает вертикальную координату строки текста. */
    lineY(this: UIElement, line: number): number | undefined;
    /** Возвращает позицию начала строки в тексте. */
    linePos(this: UIElement, line: number): number | undefined;
  }
  /** Элемент-контейнер с добавлением, очисткой, обновлением и интервальными вызовами. */
  type UIContainer = UIElement & Required<Pick<UIElement,"add" | "clear" | "refresh" | "setInterval">>;
  /** Обёртка XML-документа с доступом к элементам по ID; тип не проверяет существование ID в XML. */
  type UIDocument<Elements extends Record<string,UIElement> = Record<string,UIElement>> = {
    /** Имя XML-документа; этот ключ зарезервирован обёрткой. */
    readonly name:string
  } & Elements;
  /** Документ и окружение, переданные фабрике интерфейса. */
  interface LayoutContext<Elements extends Record<string,UIElement> = Record<string,UIElement>> {
    /** Документ интерфейса с типизированными ID элементов. */
    readonly document: UIDocument<Elements>;
    /** Окружение Lua-документа DOC_ENV. */
    readonly environment: UIData;
  }
  /** Обработчики жизненного цикла документа интерфейса. */
  interface LayoutCallbacks<OpenArgs extends unknown[] = unknown[]> {
    /** Вызывается при открытии документа с аргументами его вызывающего кода. */
    on_open?(this: void, ...args: OpenArgs): void;
    /** Вызывается при закрытии документа; inventory передаёт связанный инвентарь. */
    on_close?(this: void, inventory: number): void;
    /** Сообщает о прогрессе операции: done выполнено из total. */
    on_progress?(this: void, done: number, total: number): void;
    /** Вызывается при уничтожении документа интерфейса. */
    on_destroy?(this: void): void;
  }
  /** CPU-буфер пикселей RGBA с операциями рисования. */
  interface Canvas {
    /** Создаёт и привязывает именованную GPU-текстуру; нужен графический клиент. */
    create_texture(this: Canvas, name: string): void;
  }
}
/** Документы, элементы и диалоги графического интерфейса. */
declare namespace gui {
  /** Закрывает текущее меню. */
  function close_menu(this: void): void;
  /** Корневой документ интерфейса или undefined, если он недоступен. */
  const root: VC.UIDocument | undefined;
  /** Читает свойство элемента либо возвращает дочерний элемент по индексу Lua от 1. */
  function getattr<K extends keyof VC.UIAttributes>(this: void, document: string, element: string, attribute: K): VC.UIAttributes[K];
  /**
   * Читает свойство элемента либо возвращает дочерний элемент по индексу Lua от 1.
   * Индексы дочерних элементов движка начинаются с 1.
   */
  function getattr(this: void, document: string, element: string, child: number): VC.UIElement | undefined;
  /** Записывает доступное свойство XML-элемента. */
  function setattr<K extends keyof VC.UIWritableAttributes>(this: void, document: string, element: string, attribute: K, value: VC.UIWritableAttributes[K]): void;
  /** Возвращает окружение документа интерфейса. */
  function get_env(this: void, document: string): VC.UIData;
  /** Переводит текстовый ключ с необязательным контекстом локализации. */
  function str(this: void, text: string, context?: string): string;
  /** Возвращает доступные локали и их отображаемые названия. */
  function get_locales_info(this: void): Record<string,{
    /** Отображаемое название локали. */
    name:string
  }>;
  /** Возвращает размеры области отображения интерфейса. */
  function get_viewport(this: void): VC.Vec2;
  /** Удаляет разметку выбранного языка из текста. */
  function clear_markup(this: void, language: string, text: string): string;
  /** Экранирует текст для выбранного языка разметки. */
  function escape_markup(this: void, language: string, text: string): string;
  /** Показывает диалог подтверждения с обработчиками согласия и отказа. */
  function confirm(this: void, text: string, onConfirm?: (this:void)=>void, onDeny?: (this:void)=>void, yesText?:string, noText?:string): void;
  /** Показывает предупреждение с обработчиком закрытия. */
  function alert(this: void, text: string, onClose?: (this:void)=>void): void;
  /** Показывает сообщение с обработчиком закрытия. */
  function show_message(this: void, text: string, onClose?: (this:void)=>void): void;
  /** Показывает диалог ввода строки с проверкой validator и обработчиком подтверждения. */
  function show_input_dialog(this: void, text: string, onConfirm?: (this:void,value:string)=>void, validator?: (this:void,value:string)=>boolean, confirmText?:string): void;
  /** Показывает вопрос с обработчиками согласия и отказа. */
  function ask(this: void, text: string, onConfirm?: (this:void)=>void, onDeny?: (this:void)=>void, yesText?:string, noText?:string): void;
  /** Загружает документ из path под именем name с аргументами и расширением окружения. */
  function load_document(this: void, path: string, name: string, args: VC.Value, extension?: VC.UIData): VC.UIData;
  /** Подставляет параметры в именованный шаблон интерфейса. */
  function template(this: void, name: string, parameters: VC.UIData): string;
  /** Подставляет параметры в переданный текст шаблона. */
  function process_template(this: void, source: string, parameters: VC.UIData): string;
  /**
   * Создаёт кадр интерфейса с выводом в текстуру указанного размера.
   * Текущий движок ничего не возвращает.
   */
  function create_frame(this: void, id: string, outputTexture: string, size: VC.Vec2): void;
  /** Выбирает активный кадр; cursorLocator возвращает координаты курсора отдельными значениями Lua. */
  function set_active_frame(this: void, id: string, cursorLocator?: (this:void)=>LuaMultiReturn<[number,number]>): void;
  /** Возвращает ID активного кадра или undefined. */
  function get_active_frame(this: void): string | undefined;
  /** Возвращает снимок указанного или текущего кадра как Canvas либо undefined. */
  function screenshot(this: void, frameId?: string): VC.Canvas | undefined;
  /** Задаёт схему оформления подсветки синтаксиса. */
  function set_syntax_styles(this: void, scheme: VC.ObjectValue): void;
}

/** Создание обёртки XML-документа с доступом к элементам по ID. */
declare const Document: {
  /** Создаёт обёртку документа по имени; существование элементов и соответствие типов обеспечивает XML. */
  new:<Elements extends Record<string,VC.UIElement> = Record<string,VC.UIElement>>(this:void, name:string)=>VC.UIDocument<Elements>
};
/** Создание обёртки элемента XML-документа. */
declare const Element: {
  /** Создаёт обёртку элемента по имени документа и ID элемента. */
  new:(this:void, document:string, name:string)=>VC.UIElement
};
