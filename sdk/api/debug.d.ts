/// <reference path="types.d.ts" />
/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /** Сведения о кадре стека Lua. */
  interface DebugInfo {
    /** Источник исполняемого кода Lua. */
    source?:string;
    /** Краткое имя источника кода. */
    short_src?:string;
    /** Строка начала определения функции. */
    linedefined?:number;
    /** Строка конца определения функции. */
    lastlinedefined?:number;
    /** Вид функции: Lua, C или главный блок. */
    what?:string;
    /** Текущая строка исполнения. */
    currentline?:number;
    /** Имя функции, если удалось определить. */
    name?:string;
    /** Способ определения имени функции. */
    namewhat?:string;
    /** Количество захваченных переменных функции. */
    nups?:number;
    /** Дополнительное поле отладочной информации с непроверенным типом. */
    [key:string]:unknown;
  }
}
/** Журнал, стек вызовов и средства отладки. */
declare namespace debug {
  /** Записывает информационное сообщение в журнал отладки. */
  function log(this:void,text:string):void;
  /** Записывает предупреждение в журнал отладки. */
  function warning(this:void,text:string):void;
  /** Записывает сообщение об ошибке в журнал отладки. */
  function error(this:void,text:string):void;
  /** Выводит произвольные значения в журнал отладки. */
  function print(this:void,...values:unknown[]):void;
  /** Приостанавливает исполнение в отладчике с причиной и сообщением. */
  function pause(this:void,reason?:string,message?:string):void;
  /** Проверяет наличие активной отладки. */
  function is_debugging(this:void):boolean;
  /** Возвращает число кадров стека вызовов. */
  function count_frames(this:void):number;
  /** Возвращает сведения о кадрах стека, начиная со start. */
  function get_traceback(this:void,start?:number):VC.DebugInfo[];
  /**
   * Возвращает сведения о кадре стека Lua; fields выбирает поля.
   * Обёртка основного Lua-состояния удаляет .func и вызывает ошибку для отсутствующего кадра.
   */
  function getinfo(this:void,level:number,fields?:string):VC.DebugInfo;
}
