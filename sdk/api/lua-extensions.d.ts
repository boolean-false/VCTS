/// <reference path="types.d.ts" />
/**
 * Дополнительные операции с Lua-таблицами.
 * Позиции массивов и числовые ключи обработчиков начинаются с 1. В TypeScript предпочитайте методы Array.
 */
declare namespace table {
  /** Создаёт поверхностную копию Lua-таблицы. */
  function copy<T extends object>(this:void,value:T):T;
  /** Создаёт копию таблицы вместе с вложенными таблицами. */
  function deep_copy<T extends object>(this:void,value:T):T;
  /** Возвращает количество пар ключ-значение в таблице. */
  function count_pairs(this:void,value:object):number;
  /** Возвращает случайный элемент массива или undefined. */
  function random<T>(this:void,value:T[]):T|undefined;
  /** Перемешивает массив на месте и возвращает его. */
  function shuffle<T>(this:void,value:T[]):T[];
  /** Дописывает числовые элементы source в target и добавляет отсутствующие именованные поля; возвращает target. */
  function merge<T extends object>(this:void,target:T,source:object):T;
  /** Копирует поля source в target и возвращает target. */
  function extend<T extends object>(this:void,target:T,source:Partial<T>):T;
  /** Меняет значения таблицы на месте через обработчик ключа и значения; возвращает ту же таблицу. */
  function map<K extends string|number,V>(this:void,value:Record<K,V>,transform:(this:void,key:K,value:V)=>V):Record<K,V>;
  /** Удаляет пары, для которых predicate возвращает false, и возвращает ту же таблицу. */
  function filter<K extends string|number,V>(this:void,value:Record<K,V>,predicate:(this:void,key:K,value:V)=>boolean):Record<K,V>;
  /** Задаёт fallback при отсутствии ключа и возвращает значение ключа. */
  function set_default<K extends string,V>(this:void,value:Partial<Record<K,V>>,key:K,fallback:V):V;
  /** Убирает один уровень вложенности массива. */
  function flat<T>(this:void,value:(T|T[])[]):T[];
  /** Убирает все уровни вложенности массива. */
  function deep_flat(this:void,value:unknown[]):unknown[];
  /** Возвращает срез массива по позициям Lua, начиная с 1. */
  function sub<T>(this:void,value:T[],start?:number,stop?:number):T[];
  /** Проверяет наличие элемента в массиве. */
  function has<T>(this:void,value:T[],item:T):boolean;
  /** Возвращает позицию элемента Lua от 1 или -1, если элемент не найден. */
  function index<T>(this:void,value:T[],item:T):number;
  /** Удаляет элемент массива по значению. */
  function remove_value<T>(this:void,value:T[],item:T):void;
  /** Добавляет элемент, если его ещё нет; position задаёт позицию Lua от 1. */
  function insert_unique<T>(this:void,value:T[],item:T):void;
  /** Добавляет элемент, если его ещё нет; position задаёт позицию Lua от 1. */
  function insert_unique<T>(this:void,value:T[],position:number,item:T):void;
  /** Возвращает строковое представление массива. */
  function tostring(this:void,value:unknown[]):string;
  /** Возвращает массив ключей таблицы. */
  function keys<T extends object>(this:void,value:T):(keyof T)[];
}
/** Дополнительные операции со строками Lua. */
declare namespace string {
  /** Экранирует строку для шаблона Lua и возвращает строку и число замен. */
  function pattern_safe(this:void,text:string):LuaMultiReturn<[string,number]>;
  /** Разбивает текст по separator; withPattern разрешает шаблон Lua. */
  function explode(this:void,separator:string,text:string,withPattern?:boolean):string[];
  /** Разбивает текст по указанному разделителю. */
  function split(this:void,text:string,delimiter:string):string[];
  /** Разбивает секунды на часы, минуты, секунды и миллисекунды либо форматирует их в строку. */
  function formatted_time(this:void,seconds?:number):{
    /** Часы в разобранной длительности. */
    h:number;
    /** Минуты в разобранной длительности. */
    m:number;
    /** Секунды в разобранной длительности. */
    s:number;
    /** Миллисекунды в разобранной длительности. */
    ms:number
  };
  /** Разбивает секунды на часы, минуты, секунды и миллисекунды либо форматирует их в строку. */
  function formatted_time(this:void,seconds:number,format:string):string;
  /** Заменяет вхождения find строкой replacement. */
  function replace(this:void,text:string,find:string,replacement:string):string;
  /** Удаляет крайние пробелы или указанный символ с обеих сторон. */
  function trim(this:void,text:string,char?:string):string;
  /** Удаляет пробелы или указанный символ с конца строки. */
  function trim_right(this:void,text:string,char?:string):string;
  /** Удаляет пробелы или указанный символ с начала строки. */
  function trim_left(this:void,text:string,char?:string):string;
  /** Дополняет строку символом char до заданной длины. */
  function pad(this:void,text:string,size:number,char?:string):string;
  /** Дополняет строку слева до заданной длины. */
  function left_pad(this:void,text:string,size:number,char?:string):string;
  /** Дополняет строку справа до заданной длины. */
  function right_pad(this:void,text:string,size:number,char?:string):string;
  /** Проверяет, начинается ли строка с prefix. */
  function starts_with(this:void,text:string,prefix:string):boolean;
  /** Проверяет, заканчивается ли строка на suffix. */
  function ends_with(this:void,text:string,suffix:string):boolean;
  /** Экранирует строку для передачи в URL. */
  function url_encode(this:void,text:string):string;
  /** Декодирует экранированную строку URL. */
  function url_decode(this:void,text:string):string;
}
/** Числовые функции, шум и случайные значения. */
declare namespace math {
  /** Ограничивает число диапазоном от min до max. */
  function clamp(this:void,value:number,min:number,max:number):number;
  /** Возвращает случайное число между min и max. */
  function rand(this:void,min:number,max:number):number;
  /** Возвращает дробную часть value/period в диапазоне [0, 1); period по умолчанию равен 1. */
  function normalize(this:void,value:number,period?:number):number;
  /** Округляет число до указанного количества десятичных знаков. */
  function round(this:void,value:number,places?:number):number;
  /** Возвращает сумму переданных чисел или элементов массива. */
  function sum(this:void,...values:number[]):number;
  /** Возвращает сумму переданных чисел или элементов массива. */
  function sum(this:void,values:number[]):number;
  /** Возвращает знак числа: -1, 0 или 1. */
  function sign(this:void,value:number):number;
  /** Возвращает одномерный шум с указанным числом октав. */
  function noise(this:void,x:number,octaves?:number):number;
  /** Возвращает двумерный шум с указанным числом октав. */
  function noise2d(this:void,x:number,y:number,octaves?:number):number;
  /** Возвращает случайное значение с нормальным распределением. */
  function normal_random(this:void):number;
}
/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /**
   * Генератор псевдослучайных чисел и байтов.
   * В VC 0.32.1 экземпляры используют общий буфер Lua. Используйте один генератор на состояние и задавайте seed явно.
   */
  interface Random {
    /** Возвращает случайное число; без границ дробное, с границами целое в указанном диапазоне. */
    random(this:Random):number;
    /** Возвращает случайное число; без границ дробное, с границами целое в указанном диапазоне. */
    random(this:Random,max:number):number;
    /** Возвращает случайное число; без границ дробное, с границами целое в указанном диапазоне. */
    random(this:Random,min:number,max:number):number;
    /** Переинициализирует генератор указанным seed. */
    seed(this:Random,seed:number):void;
    /** Возвращает указанное количество псевдослучайных байтов. */
    bytes(this:Random,length:number):Bytearray;
  }
}
/** Генерация псевдослучайных значений и UUID. */
declare namespace random {
  /** Возвращает случайное число; без границ дробное, с границами целое в указанном диапазоне. */
  function random(this:void):number;
  /** Возвращает случайное число; без границ дробное, с границами целое в указанном диапазоне. */
  function random(this:void,max:number):number;
  /** Возвращает случайное число; без границ дробное, с границами целое в указанном диапазоне. */
  function random(this:void,min:number,max:number):number;
  /** Возвращает указанное количество псевдослучайных байтов. */
  function bytes(this:void,length:number):VC.Bytearray;
  /** Создаёт строковый UUID. */
  function uuid(this:void):string;
  /**
   * Создаёт обёртку генератора; в VC 0.32.1 seed нужно задать отдельным вызовом .seed.
   * @deprecated В VC 0.32.1 конструктор игнорирует seed. Вызовите .seed явно; экземпляры используют общий буфер.
   */
  function Random(this:void,seed?:number):VC.Random;
}
