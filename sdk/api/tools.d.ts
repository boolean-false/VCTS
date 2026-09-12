/// <reference path="types.d.ts" />
/** Команды консоли, переменные и вывод сообщений. */
declare namespace console {
  /** Исполняет строку команды консоли и возвращает её результат. */
  function execute(this:void,prompt:string):unknown;
  /** Возвращает значение переменной консоли. */
  function get(this:void,name:string):unknown;
  /** Задаёт значение переменной консоли. */
  function set(this:void,name:string,value:VC.Value):void;
  /** Возвращает список имён зарегистрированных команд. */
  function get_commands_list(this:void):string[];
  /** Возвращает описание и аргументы команды или undefined. */
  function get_command_info(this:void,name:string):{
    /** Имя команды консоли. */
    name:string;
    /** Описание команды консоли. */
    description:string;
    /** Позиционные аргументы команды. */
    args:{
      /** Имя позиционного аргумента. */
      name:string;
      /** Имя типа позиционного аргумента. */
      type:string;
      /** Признак необязательного аргумента. */
      optional?:boolean
    }[];
    /** Описание именованных аргументов команды. */
    kwargs:Record<string,{
      /** Имя типа именованного аргумента. */
      type:string
    }>
  }|undefined;
}
/** Служебные функции ядра Lua. */
declare namespace core {
  /** Пустая функция для использования в качестве обработчика. */
  function blank(this:void):void;
  /**
   * Перехватывает вывод при выполнении callback и возвращает его строкой.
   * Захватывайте аргументы замыканием: порядок вариативных аргументов в движке нарушен. Ошибки callback перехватываются и записываются в журнал.
   */
  function capture_output(this:void,callback:(this:void)=>void):string;
  /**
   * Возвращает токен записи для кода, загруженного как core, или undefined.
   * Токен записи доступен только коду, загруженному как core.
   */
  function get_core_token(this:void):string|undefined;
}
/** Поиск паков, их ресурсов и каталогов данных. */
declare namespace pack {
  /** Выгружает Lua-модули с указанным префиксом из кеша. */
  function unload(this:void,prefix:string):void;
}
/** Игровые правила и подписки на изменение их значений. */
declare namespace rules {
  /** Возвращает внутреннее описание правила со значением по умолчанию и подписчиками. */
  function get_rule(this:void,name:string):{
    /** Текущее динамическое значение правила. */
    value?:unknown;
    /** Значение правила по умолчанию. */
    default?:unknown;
    /** Обработчики изменения значения по ключам подписок. */
    listeners:Record<string,(this:void,value:unknown)=>void>
  };
}

/** Команды консоли, переменные и вывод сообщений. */
declare namespace console {
  /** Регистрирует команду по схеме с описанием и обработчиком; isCheat помечает чит-команду. */
  function add_command(this:void,scheme:string,description:string,handler:(this:void,args:VC.Value[],kwargs:VC.ObjectValue)=>VC.Value,isCheat?:boolean):void;
  /** Проверяет, помечена ли команда как чит. */
  function is_cheat(this:void,name:string):boolean;
  /** Изменяет признак чит-команды и сообщает результат. */
  function set_cheat(this:void,name:string,enabled:boolean):boolean;
}
/** Журнал, стек вызовов и средства отладки. */
declare namespace debug {
  /** Возвращает ID пака для кадра стека. */
  function get_pack_by_frame(this:void,level:number):string;
  /** Обрабатывает события отладчика и возвращает результат обработки. */
  function pull_events(this:void):boolean|undefined;
  /** Ставит точку останова в файле source на строке line. */
  function set_breakpoint(this:void,source:string,line:number):void;
  /** Удаляет точку останова из файла source на строке line. */
  function remove_breakpoint(this:void,source:string,line:number):void;
  /** Создаёт именованный журнал сообщений. */
  function Logger(this:void,name?:string):VC.Logger;
}
/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /** Именованный журнал с уровнями сообщений. */
  interface Logger {
    /** Имя журнала сообщений. */
    readonly name:string;
    /** Записывает информационное сообщение. */
    info(this:Logger,text:string):void;
    /** Записывает предупреждение. */
    warning(this:Logger,text:string):void;
    /** Записывает сообщение об ошибке. */
    error(this:Logger,text:string):void;
  }
}
