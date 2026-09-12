/// <reference path="types.d.ts" />

/**
 * Файлы и виртуальные пути VoxelCore вида точка_входа:путь.
 * Источники: libfile.cpp и internal/extensions/file.lua. Пути имеют вид точка_входа:путь. Запись учитывает разрешения VC.
 */
declare namespace file {
  /** Проверяет существование файла или каталога. */
  function exists(this: void, path: string): boolean;
  /** Ищет ресурс по виртуальному пути и возвращает найденный путь или undefined. */
  function find(this: void, path: string): string | undefined;
  /** Проверяет, указывает ли путь на каталог. */
  function isdir(this: void, path: string): boolean;
  /** Проверяет, указывает ли путь на обычный файл. */
  function isfile(this: void, path: string): boolean;
  /**
   * Возвращает размер файла в байтах.
   * Для отсутствующего файла текущий движок возвращает -1.
   */
  function length(this: void, path: string): number;
  /** Возвращает список элементов каталога. */
  function list(this: void, path: string): string[];
  /** Собирает элементы каталога ресурсов из всех источников контента. */
  function list_all_res(this: void, path: string): string[];
  /** Создаёт один каталог и сообщает результат. */
  function mkdir(this: void, path: string): boolean;
  /** Создаёт каталог вместе с недостающими родительскими каталогами. */
  function mkdirs(this: void, path: string): boolean;
  /** Читает файл целиком как строку. */
  function read(this: void, path: string): string;
  /**
   * Читает файл как байты; useTable=true возвращает массив вместо Bytearray.
   * @param useTable true возвращает обычный массив байтов, false или отсутствие аргумента возвращает Bytearray.
   */
  function read_bytes(this: void, path: string, useTable: true): number[];
  /**
   * Читает файл как байты; useTable=true возвращает массив вместо Bytearray.
   * @param useTable true возвращает обычный массив байтов, false или отсутствие аргумента возвращает Bytearray.
   */
  function read_bytes(this: void, path: string, useTable?: false): VC.Bytearray;
  /**
   * Читает файл как байты; useTable=true возвращает массив вместо Bytearray.
   * @param useTable true возвращает обычный массив байтов, false или отсутствие аргумента возвращает Bytearray.
   */
  function read_bytes(this: void, path: string, useTable: boolean): number[] | VC.Bytearray;
  /**
   * Записывает строку в файл.
   * Возврат движка не гарантирует успех; учитывайте исключения и проверяйте записанные данные.
   */
  function write(this: void, path: string, text: string): void;
  /** Записывает байты в файл и возвращает результат записи. */
  function write_bytes(this: void, path: string, data: VC.Bytearray | number[]): boolean;
  /** Удаляет файл или пустой каталог и сообщает результат. */
  function remove(this: void, path: string): boolean;
  /** Удаляет каталог с содержимым и возвращает число удалённых элементов. */
  function remove_tree(this: void, path: string): number;
  /** Преобразует виртуальный путь в путь файловой системы. */
  function resolve(this: void, path: string): string;
  /** Объединяет списки данных из одноимённых ресурсов разных паков. */
  function read_combined_list(this: void, path: string): VC.Value[];
  /** Объединяет объекты данных из одноимённых ресурсов разных паков. */
  function read_combined_object(this: void, path: string): VC.ObjectValue;
  /** Проверяет доступность записи по виртуальному пути. */
  function is_writeable(this: void, path: string): boolean;
  /** Подключает файловый источник и возвращает его точку входа. */
  function mount(this: void, path: string): string;
  /** Отключает файловый источник по имени точки входа. */
  function unmount(this: void, entryPoint: string): void;
  /** Создаёт файловое устройство в памяти и возвращает точку входа. */
  function create_memory_device(this: void): string;
  /** Создаёт ZIP-архив из содержимого каталога. */
  function create_zip(this: void, directory: string, output: string): void;
  /** Возвращает имя последнего элемента пути или undefined. */
  function name(this: void, path: string): string | undefined;
  /** Возвращает имя файла без расширения. */
  function stem(this: void, path: string): string;
  /** Возвращает расширение файла или undefined. */
  function ext(this: void, path: string): string | undefined;
  /** Возвращает точку входа виртуального пути или undefined. */
  function prefix(this: void, path: string): string | undefined;
  /** Возвращает путь родительского каталога. */
  function parent(this: void, path: string): string;
  /** Возвращает путь без расширения файла. */
  function remove_ext(this: void, path: string): string;
  /** Возвращает часть виртуального пути после точки входа. */
  function path(this: void, path: string): string;
  /** Объединяет путь каталога и вложенный путь. */
  function join(this: void, directory: string, path: string): string;
  /** Читает файл как массив строк. */
  function readlines(this: void, path: string): string[];
}

/**
 * Разбор и сериализация JSON.
 * Источники: libjson.cpp, libtoml.cpp, libyaml.cpp. Разбор не проверяет соответствие схеме TypeScript.
 */
declare namespace json {
  /** Разбирает текст JSON; результат unknown нужно проверить перед использованием. */
  function parse(this: void, text: string): unknown;
  /** Сериализует значение в текст JSON. */
  function tostring(this: void, value: VC.Value, pretty?: boolean, escapeUTF?: boolean): string;
}
/** Разбор и сериализация TOML. */
declare namespace toml {
  /** Разбирает текст TOML; результат unknown нужно проверить перед использованием. */
  function parse(this: void, text: string): unknown;
  /** Сериализует значение в текст TOML. */
  function tostring(this: void, value: VC.ObjectValue): string;
}
/** Разбор и сериализация YAML. */
declare namespace yaml {
  /** Разбирает текст YAML; результат unknown нужно проверить перед использованием. */
  function parse(this: void, text: string): unknown;
  /** Сериализует значение в текст YAML. */
  function tostring(this: void, value: VC.Value): string;
}
/**
 * Кодирование байтов в Base64 и обратно.
 * Источник: libbase64.cpp. По умолчанию декодирование возвращает FFI-буфер Bytearray.
 */
declare namespace base64 {
  /** Кодирует байты в строку Base64. */
  function encode(this: void, bytes: VC.Bytearray | number[]): string;
  /**
   * Декодирует Base64 в байты; useTable=true возвращает массив.
   * @param useTable true возвращает обычный массив байтов, false или отсутствие аргумента возвращает Bytearray.
   */
  function decode(this: void, text: string, useTable: true): number[];
  /**
   * Декодирует Base64 в байты; useTable=true возвращает массив.
   * @param useTable true возвращает обычный массив байтов, false или отсутствие аргумента возвращает Bytearray.
   */
  function decode(this: void, text: string, useTable?: false): VC.Bytearray;
  /**
   * Декодирует Base64 в байты; useTable=true возвращает массив.
   * @param useTable true возвращает обычный массив байтов, false или отсутствие аргумента возвращает Bytearray.
   */
  function decode(this: void, text: string, useTable: boolean): VC.Bytearray | number[];
  /** Кодирует байты в вариант Base64 для URL. */
  function encode_urlsafe(this: void, bytes: VC.Bytearray | number[]): string;
  /**
   * Декодирует вариант Base64 для URL; useTable=true возвращает массив.
   * @param useTable true возвращает обычный массив байтов, false или отсутствие аргумента возвращает Bytearray.
   */
  function decode_urlsafe(this: void, text: string, useTable: true): number[];
  /**
   * Декодирует вариант Base64 для URL; useTable=true возвращает массив.
   * @param useTable true возвращает обычный массив байтов, false или отсутствие аргумента возвращает Bytearray.
   */
  function decode_urlsafe(this: void, text: string, useTable?: false): VC.Bytearray;
  /**
   * Декодирует вариант Base64 для URL; useTable=true возвращает массив.
   * @param useTable true возвращает обычный массив байтов, false или отсутствие аргумента возвращает Bytearray.
   */
  function decode_urlsafe(this: void, text: string, useTable: boolean): VC.Bytearray | number[];
}
