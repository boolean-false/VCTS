/// <reference path="types.d.ts" />
/** Преобразование значений в бинарный JSON и обратно. */
declare namespace bjson {
  /** Сериализует значение в бинарный JSON; compress включает сжатие. */
  function tobytes(this:void,value:VC.Value,compress?:boolean):VC.Bytearray;
  /** Разбирает бинарный JSON; результат unknown требует проверки. */
  function frombytes(this:void,bytes:VC.Bytearray|number[]):unknown;
}
/** Сжатие и распаковка байтов алгоритмом gzip. */
declare namespace compression {
  /**
   * Сжимает байты алгоритмом gzip; asTable=true возвращает массив.
   * @param asTable true возвращает массив байтов вместо Bytearray.
   */
  function encode(this:void,bytes:VC.Bytearray,algorithm?:"gzip",asTable?:false):VC.Bytearray;
  /**
   * Сжимает байты алгоритмом gzip; asTable=true возвращает массив.
   * @param asTable true возвращает массив байтов вместо Bytearray.
   */
  function encode(this:void,bytes:VC.Bytearray,algorithm:"gzip",asTable:true):number[];
  /**
   * Распаковывает gzip; asTable=true возвращает массив байтов.
   * @param asTable true возвращает массив байтов вместо Bytearray.
   */
  function decode(this:void,bytes:VC.Bytearray,algorithm?:"gzip",asTable?:false):VC.Bytearray;
  /**
   * Распаковывает gzip; asTable=true возвращает массив байтов.
   * @param asTable true возвращает массив байтов вместо Bytearray.
   */
  function decode(this:void,bytes:VC.Bytearray,algorithm:"gzip",asTable:true):number[];
}
/** Упаковка чисел и логических значений по бинарному формату. */
declare namespace byteutil {
  /** Возвращает размер записи в байтах для строки бинарного формата. */
  function get_size(this:void,format:string):number;
  /** Упаковывает значения по формату в Bytearray. */
  function pack(this:void,format:string,...values:(number|boolean)[]):VC.Bytearray;
  /** Упаковывает значения по формату в массив байтов. */
  function tpack(this:void,format:string,...values:(number|boolean)[]):number[];
  /** Распаковывает байты по формату в отдельные значения Lua. */
  function unpack(this:void,format:string,bytes:VC.Bytearray):LuaMultiReturn<(number|boolean)[]>;
}
/** Работа со строками и символами Unicode в UTF-8. */
declare namespace utf8 {
  /**
   * Кодирует строку в байты UTF-8; asTable=true возвращает массив.
   * @param asTable true возвращает массив байтов вместо Bytearray.
   */
  function tobytes(this:void,text:string,asTable?:false):VC.Bytearray;
  /**
   * Кодирует строку в байты UTF-8; asTable=true возвращает массив.
   * @param asTable true возвращает массив байтов вместо Bytearray.
   */
  function tobytes(this:void,text:string,asTable:true):number[];
  /** Декодирует байты UTF-8 в строку. */
  function tostring(this:void,bytes:VC.Bytearray|number[]):string;
  /** Возвращает число символов Unicode в строке. */
  function length(this:void,text:string):number;
  /** Возвращает код первого символа Unicode. */
  function codepoint(this:void,text:string):number;
  /**
   * Возвращает подстроку по позициям символов Unicode.
   * Позиции символов Unicode начинаются с 1; конечная позиция включена. Это индексы Lua.
   */
  function sub(this:void,text:string,start:number,end?:number):string;
  /** Переводит символы строки в верхний регистр. */
  function upper(this:void,text:string):string;
  /** Переводит символы строки в нижний регистр. */
  function lower(this:void,text:string):string;
  /** Создаёт строку UTF-8 из кода символа Unicode. */
  function encode(this:void,codepoint:number):string;
  /** Экранирует специальные символы строки. */
  function escape(this:void,text:string):string;
  /** Экранирует специальные символы XML. */
  function escape_xml(this:void,text:string):string;
}
/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /** XML-узел с именем тега, атрибутами и индексируемыми дочерними узлами. */
  interface XMLNode {
    /** Имя XML-тега узла. */
    "#":string;
    /** Атрибут по строковому ключу или дочернее содержимое по числовому индексу. */
    [key:string]:string|XMLNode;
    /** Атрибут по строковому ключу или дочернее содержимое по числовому индексу. */
    [index:number]:string|XMLNode;
  }
}
/** Разбор и сериализация XML и разметки VCD. */
declare namespace xml {
  /** Разбирает XML в дерево узлов. */
  function parse(this:void,source:string):VC.XMLNode;
  /** Разбирает разметку VCD в дерево; rootTag задаёт корневой тег. */
  function parse_vcd(this:void,source:string,rootTag?:string):VC.XMLNode;
  /** Сериализует дерево XML; nice включает удобное форматирование. */
  function tostring(this:void,node:VC.XMLNode,nice?:boolean):string;
}
