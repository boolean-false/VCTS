/// <reference path="types.d.ts" />
/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /** Изменяемая двумерная карта числовых высот. */
  interface Heightmap {
    /** Ширина карты в отсчётах. */
    readonly width: number;
    /** Высота карты в отсчётах. */
    readonly height: number;
    /**
     * Задаёт seed шума; чтение свойства возвращает undefined.
     * Свойства поддерживают только запись; чтение возвращает undefined.
     */
    get noiseSeed(): undefined;
    /** Задаёт seed шума; чтение свойства возвращает undefined. */
    set noiseSeed(value: number);
    /** Задаёт режим нормализованного шума; чтение возвращает undefined. */
    get normalNoise(): undefined;
    /** Задаёт режим нормализованного шума; чтение возвращает undefined. */
    set normalNoise(value: boolean);
    /** Записывает карту высот в файл. */
    dump(this: Heightmap, filename: string): void;
    /** Возвращает значение карты в координатах x, y. */
    at(this: Heightmap, x: number, y: number): number;
    /** Заполняет карту шумом с заданными смещением, масштабом и октавами; shiftX и shiftY искажают координаты. */
    noise(this: Heightmap, offset: Vec2, scale: number, octaves?: number, multiplier?: number, shiftX?: Heightmap, shiftY?: Heightmap): void;
    /** Заполняет карту ячеистым шумом; параметры задают масштаб, октавы и смещение координат. */
    cellnoise(this: Heightmap, offset: Vec2, scale: number, octaves?: number, multiplier?: number, shiftX?: Heightmap, shiftY?: Heightmap): void;
    /** Возводит значения карты в степень числа или соответствующих значений другой карты на месте. */
    pow(this: Heightmap, value: Heightmap | number): void;
    /** Прибавляет число или соответствующие значения другой карты на месте. */
    add(this: Heightmap, value: Heightmap | number): void;
    /** Вычитает число или соответствующие значения другой карты на месте. */
    sub(this: Heightmap, value: Heightmap | number): void;
    /** Умножает значения на число или соответствующие значения другой карты на месте. */
    mul(this: Heightmap, value: Heightmap | number): void;
    /** Заменяет значения минимумом из текущего значения и числа либо другой карты. */
    min(this: Heightmap, value: Heightmap | number): void;
    /** Заменяет значения максимумом из текущего значения и числа либо другой карты. */
    max(this: Heightmap, value: Heightmap | number): void;
    /** Заменяет значения карты их модулями на месте. */
    abs(this: Heightmap): void;
    /** Округляет значения карты вниз на месте. */
    floor(this: Heightmap): void;
    /** Округляет значения карты до ближайших целых на месте. */
    round(this: Heightmap): void;
    /** Округляет значения карты вверх на месте. */
    ceil(this: Heightmap): void;
    /** Применяет синус к каждому значению карты на месте. */
    sin(this: Heightmap): void;
    /** Применяет косинус к каждому значению карты на месте. */
    cos(this: Heightmap): void;
    /** Применяет тангенс к каждому значению карты на месте. */
    tan(this: Heightmap): void;
    /** Меняет размеры карты с выбранным способом интерполяции. */
    resize(this: Heightmap, width: number, height: number, interpolation: "nearest" | "linear" | "cubic"): void;
    /** Оставляет прямоугольную область карты на месте. */
    crop(this: Heightmap, x: number, y: number, width: number, height: number): void;
    /** Смешивает карту с числом или другой картой по коэффициенту factor на месте. */
    mixin(this: Heightmap, value: Heightmap | number, factor: Heightmap | number): void;
  }
  /** Сохранённый объём блоков, который можно обрезать или разместить в мире. */
  interface VoxelFragment {
    /** Размеры фрагмента по трём осям. */
    readonly size: Vec3;
    /** Обрезает пустые края фрагмента на месте. */
    crop(this: VoxelFragment): void;
  }
  /** Четверть оборота фрагмента вокруг вертикальной оси: 0, 1, 2 или 3. */
  type Rotation = 0 | 1 | 2 | 3;
  /** Имя структуры, положение, поворот и необязательный приоритет размещения. */
  type StructurePlacement = [name: string | number, position: Vec3, rotation: Rotation, priority?: number];
  /** Команда генератора для размещения одного блока. */
  type BlockPlacement = [kind: ":block", blockId: number, position: Vec3, rotation?: Rotation, priority?: number];
  /** Команда генератора для размещения линии блоков с заданным радиусом. */
  type LinePlacement = [kind: ":line", blockId: number, start: Vec3, end: Vec3, radius: number, priority?: number];
  /** Команда генератора для размещения структуры, блока или линии. */
  type Placement = StructurePlacement | BlockPlacement | LinePlacement;
  /** Seed и пути, переданные фабрике генератора. */
  interface GeneratorContext {
    /** Числовой seed генератора. */
    readonly seed: number;
    /** Каталог ресурсов генератора. */
    readonly dir: string;
    /** Путь файла скрипта генератора. */
    readonly file: string;
  }
  /** Обработчики генерации высот, биомов и структур. */
  interface GeneratorCallbacks {
    /** Создаёт карту высот области; bpd задаёт плотность блоков на отсчёт, inputs передаёт входные карты. */
    generate_heightmap?(this: void, x: number, y: number, width: number, height: number, bpd: number, inputs?: Heightmap[]): Heightmap;
    /** Создаёт карты параметров биомов и возвращает их отдельными значениями Lua через $multi. */
    generate_biome_parameters?(this: void, x: number, y: number, width: number, height: number, bpd: number): LuaMultiReturn<Heightmap[]>;
    /** Возвращает размещения структур и блоков для области с готовой картой высот. */
    place_structures?(this: void, x: number, z: number, width: number, depth: number, heights: Heightmap, chunkHeight: number): Placement[];
    /** Возвращает размещения крупных структур на этапе широкой генерации. */
    place_structures_wide?(this: void, x: number, z: number, width: number, depth: number, chunkHeight: number): Placement[];
  }
}
/**
 * Создаёт изменяемую карту высот с положительными целыми размерами.
 * Конструктор вызывается как функция Lua и возвращает userdata движка.
 */
declare const Heightmap: (this: void, width: number, height: number) => VC.Heightmap;
/** Генераторы мира и сохранённые фрагменты блоков. */
declare namespace generation {
  /** Загружает фрагмент блоков из файла или бинарного буфера. */
  function load_fragment(this: void, source: string | VC.Bytearray): VC.VoxelFragment;
  /** Сохраняет фрагмент блоков в файл. */
  function save_fragment(this: void, fragment: VC.VoxelFragment, filename: string): void;
  /** Возвращает словарь доступных генераторов и их названий. */
  function get_generators(this: void): Record<string, string>;
  /** Возвращает ID генератора по умолчанию. */
  function get_default_generator(this: void): string;
}
