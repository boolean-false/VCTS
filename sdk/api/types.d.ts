/// <reference types="@typescript-to-lua/language-extensions" />

/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /** Две числовые координаты: x, y. */
  type Vec2 = [number, number];
  /** Три числовые координаты: x, y, z. */
  type Vec3 = [number, number, number];
  /** Четыре числовых компонента вектора или цвета. */
  type Vec4 = [number, number, number, number];
  /** Три отдельных значения Lua; отсутствующие координаты представлены undefined. */
  type MaybeXYZ = LuaMultiReturn<[number?, number?, number?]>;
  /** Значение, допустимое в данных Lua и сериализаторах VCTS. */
  type Value = undefined | boolean | number | string | Value[] | {
    /** Значение данных по строковому ключу. */
    [key: string]: Value
  };
  /** Объект данных со строковыми ключами и значениями VC.Value. */
  type ObjectValue = {
    /** Значение данных по строковому ключу. */
    [key: string]: Value
  };
  /**
   * Непрозрачный буфер байтов движка на базе FFI.
   * Методы Array и индексация TypeScript неприменимы.
   */
  interface Bytearray {
    /** Маркер типа, отличающий буфер движка от обычного массива. */
    readonly __vcBytearray: unique symbol;
  }
  /** Поворот, сегмент и пользовательские биты состояния блока в одной таблице. */
  type BlockState = [rotation: number, segment: number, userbits: number];
  /** Результат пересечения луча с блоком. */
  interface BlockRayHit {
    /** ID блока в точке пересечения. */
    block: number;
    /** Точная точка пересечения луча в мировых координатах. */
    endpoint: Vec3;
    /** Целочисленные координаты ячейки блока. */
    iendpoint: Vec3;
    /** Расстояние от начала луча до пересечения. */
    length: number;
    /** Нормаль грани в точке пересечения. */
    normal: Vec3;
  }
  /** Имя, значок и версия сохранённого мира. */
  interface WorldInfo {
    /** Имя сохранённого мира. */
    name: string;
    /** Путь значка мира. */
    icon: string;
    /** Основной и дополнительный номера версии мира. */
    version: Vec2;
  }
}
