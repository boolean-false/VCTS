/// <reference path="types.d.ts" />
/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /**
   * Поток ввода и вывода с текстовым и бинарным режимами.
   * Смена режима сбрасывает буферы. Перед close вызывайте flush явно.
   */
  interface IOStream {
    /** Проверяет, включён ли бинарный режим потока. */
    is_binary_mode(this:IOStream):boolean;
    /**
     * Переключает бинарный режим; в текущем движке отключение требует undefined.
     * Движок проверяет наличие аргумента: false тоже включает бинарный режим, undefined выключает его.
     */
    set_binary_mode(this:IOStream,value?:boolean):void;
    /** Возвращает режим работы: default, buffered или yield. */
    get_mode(this:IOStream):"default"|"buffered"|"yield";
    /** Задаёт режим работы потока и сбрасывает его буферы. */
    set_mode(this:IOStream,value:"default"|"buffered"|"yield"):void;
    /** Возвращает режим сброса данных: all или buffer. */
    get_flush_mode(this:IOStream):"all"|"buffer";
    /** Задаёт режим сброса данных потока. */
    set_flush_mode(this:IOStream,value:"all"|"buffer"):void;
    /** Возвращает максимальный размер буфера в байтах. */
    get_max_buffer_size(this:IOStream):number;
    /** Задаёт максимальный размер буфера в байтах. */
    set_max_buffer_size(this:IOStream,size:number):void;
    /** Возвращает число доступных байтов либо проверяет наличие length байтов. */
    available(this:IOStream):number;
    /** Возвращает число доступных байтов либо проверяет наличие length байтов. */
    available(this:IOStream,length:number):boolean;
    /** Читает строку текста или возвращает undefined при отсутствии результата. */
    read_line(this:IOStream):string|undefined;
    /** Записывает строку текста с переводом строки. */
    write_line(this:IOStream,text:string):void;
    /**
     * Читает данные в текущем режиме либо распаковывает запись по бинарному формату.
     * Результат зависит от бинарного режима. В текстовом чтении по размеру есть ошибки движка на конце потока.
     */
    read(this:IOStream,length?:number,asTable?:boolean):Bytearray|number[]|string|(string|undefined)[]|undefined;
    /** Читает данные в текущем режиме либо распаковывает запись по бинарному формату. */
    read(this:IOStream,format:string):LuaMultiReturn<(number|boolean)[]>;
    /** Читает все оставшиеся данные потока в текущем режиме. */
    read_fully(this:IOStream,asTable?:boolean):Bytearray|number[]|string|string[];
    /** Записывает данные в поток либо упаковывает значения по бинарному формату. */
    write(this:IOStream,data:Bytearray|number[]|string[]):void;
    /** Записывает данные в поток либо упаковывает значения по бинарному формату. */
    write(this:IOStream,textOrFormat:string,...values:(number|boolean)[]):void;
    /** Меняет позицию: b от начала, c от текущей позиции, e от конца; offset задаётся в байтах. */
    seek(this:IOStream,mode:"b"|"c"|"e",offset:number):void;
    /** Возвращает текущую позицию потока. */
    tell(this:IOStream):number;
    /** Проверяет доступность потока для операций. */
    is_alive(this:IOStream):boolean;
    /** Проверяет, закрыт ли поток. */
    is_closed(this:IOStream):boolean;
    /** Закрывает поток без автоматического flush. */
    close(this:IOStream):void;
    /** Передаёт накопленные данные нижележащему источнику согласно режиму сброса. */
    flush(this:IOStream):void;
  }
}
/** Файлы и виртуальные пути VoxelCore вида точка_входа:путь. */
declare namespace file {
  /** Открывает файловый поток в указанном режиме. */
  function open(this:void,path:string,mode:string):VC.IOStream;
  /**
   * Открывает именованный канал в указанном режиме.
   * Действуют платформенные ограничения FIFO; Unix-реализация движка использует константы флагов Linux.
   */
  function open_named_pipe(this:void,path:string,mode:string):VC.IOStream;
}
