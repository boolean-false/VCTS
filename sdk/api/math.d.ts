/// <reference path="types.d.ts" />

/**
 * Операции с двумерными векторами.
 * Источники: libvecn.cpp и internal/maths_inline.lua. Углы задаются в градусах.
 */
declare namespace vec2 {
  /**
   * Складывает векторы покомпонентно или прибавляет число; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function add(this: void, a: VC.Vec2, b: VC.Vec2 | number, dest?: VC.Vec2): VC.Vec2;
  /**
   * Вычитает вектор или число покомпонентно; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function sub(this: void, a: VC.Vec2, b: VC.Vec2 | number, dest?: VC.Vec2): VC.Vec2;
  /**
   * Умножает компоненты вектора на компоненты другого вектора или число; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function mul(this: void, a: VC.Vec2, b: VC.Vec2 | number, dest?: VC.Vec2): VC.Vec2;
  /**
   * Делит компоненты вектора на компоненты другого вектора или число; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function div(this: void, a: VC.Vec2, b: VC.Vec2 | number, dest?: VC.Vec2): VC.Vec2;
  /**
   * Возводит компоненты вектора в соответствующие степени; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function pow(this: void, a: VC.Vec2, b: VC.Vec2 | number, dest?: VC.Vec2): VC.Vec2;
  /**
   * Возвращает вектор единичной длины; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function normalize(this: void, value: VC.Vec2, dest?: VC.Vec2): VC.Vec2;
  /**
   * Округляет компоненты вектора до ближайших целых; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function round(this: void, value: VC.Vec2, dest?: VC.Vec2): VC.Vec2;
  /**
   * Возвращает вектор с противоположным направлением; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function inverse(this: void, value: VC.Vec2, dest?: VC.Vec2): VC.Vec2;
  /**
   * Возвращает модули компонентов вектора; dest принимает результат, если передан.
   * Обёртка Lua с dest возвращает undefined; штатная версия в состоянии генератора возвращает dest.
   */
  function abs(this: void, value: VC.Vec2): VC.Vec2;
  /**
   * Возвращает модули компонентов вектора; dest принимает результат, если передан.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function abs(this: void, value: VC.Vec2, dest: VC.Vec2): VC.Vec2 | undefined;
  /** Возвращает расстояние между векторами. */
  function distance(this: void, a: VC.Vec2, b: VC.Vec2): number;
  /** Возвращает скалярное произведение векторов. */
  function dot(this: void, a: VC.Vec2, b: VC.Vec2): number;
  /** Возвращает длину вектора. */
  function length(this: void, value: VC.Vec2): number;
  /** Возвращает строковое представление вектора. */
  function tostring(this: void, value: VC.Vec2): string;
  /**
   * Линейно смешивает a и b по коэффициенту t; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function mix(this: void, a: VC.Vec2, b: VC.Vec2, t: number, dest?: VC.Vec2): VC.Vec2;
  /** Возвращает угол направления вектора или координат x, y в градусах. */
  function angle(this: void, value: VC.Vec2): number;
  /** Возвращает угол направления вектора или координат x, y в градусах. */
  function angle(this: void, x: number, y: number): number;
  /**
   * Поворачивает вектор на degrees градусов; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function rotate(this: void, value: VC.Vec2, degrees: number, dest?: VC.Vec2): VC.Vec2;
}

/** Операции с трёхмерными векторами. */
declare namespace vec3 {
  /**
   * Складывает векторы покомпонентно или прибавляет число; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function add(this: void, a: VC.Vec3, b: VC.Vec3 | number, dest?: VC.Vec3): VC.Vec3;
  /**
   * Вычитает вектор или число покомпонентно; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function sub(this: void, a: VC.Vec3, b: VC.Vec3 | number, dest?: VC.Vec3): VC.Vec3;
  /**
   * Умножает компоненты вектора на компоненты другого вектора или число; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function mul(this: void, a: VC.Vec3, b: VC.Vec3 | number, dest?: VC.Vec3): VC.Vec3;
  /**
   * Делит компоненты вектора на компоненты другого вектора или число; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function div(this: void, a: VC.Vec3, b: VC.Vec3 | number, dest?: VC.Vec3): VC.Vec3;
  /**
   * Возводит компоненты вектора в соответствующие степени; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function pow(this: void, a: VC.Vec3, b: VC.Vec3 | number, dest?: VC.Vec3): VC.Vec3;
  /**
   * Возвращает вектор единичной длины; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function normalize(this: void, value: VC.Vec3, dest?: VC.Vec3): VC.Vec3;
  /**
   * Округляет компоненты вектора до ближайших целых; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function round(this: void, value: VC.Vec3, dest?: VC.Vec3): VC.Vec3;
  /**
   * Возвращает вектор с противоположным направлением; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function inverse(this: void, value: VC.Vec3, dest?: VC.Vec3): VC.Vec3;
  /**
   * Возвращает модули компонентов вектора; dest принимает результат, если передан.
   * Обёртка Lua с dest возвращает undefined; штатная версия в состоянии генератора возвращает dest.
   */
  function abs(this: void, value: VC.Vec3): VC.Vec3;
  /**
   * Возвращает модули компонентов вектора; dest принимает результат, если передан.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function abs(this: void, value: VC.Vec3, dest: VC.Vec3): VC.Vec3 | undefined;
  /** Возвращает расстояние между векторами. */
  function distance(this: void, a: VC.Vec3, b: VC.Vec3): number;
  /** Возвращает скалярное произведение векторов. */
  function dot(this: void, a: VC.Vec3, b: VC.Vec3): number;
  /** Возвращает длину вектора. */
  function length(this: void, value: VC.Vec3): number;
  /** Возвращает строковое представление вектора. */
  function tostring(this: void, value: VC.Vec3): string;
  /**
   * Линейно смешивает a и b по коэффициенту t; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function mix(this: void, a: VC.Vec3, b: VC.Vec3, t: number, dest?: VC.Vec3): VC.Vec3;
  /**
   * Возвращает случайный вектор на сфере заданного радиуса; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function spherical_rand(this: void, radius: number, dest?: VC.Vec3): VC.Vec3;
}

/** Операции с четырёхмерными векторами. */
declare namespace vec4 {
  /**
   * Складывает векторы покомпонентно или прибавляет число; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function add(this: void, a: VC.Vec4, b: VC.Vec4 | number, dest?: VC.Vec4): VC.Vec4;
  /**
   * Вычитает вектор или число покомпонентно; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function sub(this: void, a: VC.Vec4, b: VC.Vec4 | number, dest?: VC.Vec4): VC.Vec4;
  /**
   * Умножает компоненты вектора на компоненты другого вектора или число; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function mul(this: void, a: VC.Vec4, b: VC.Vec4 | number, dest?: VC.Vec4): VC.Vec4;
  /**
   * Делит компоненты вектора на компоненты другого вектора или число; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function div(this: void, a: VC.Vec4, b: VC.Vec4 | number, dest?: VC.Vec4): VC.Vec4;
  /**
   * Возводит компоненты вектора в соответствующие степени; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function pow(this: void, a: VC.Vec4, b: VC.Vec4 | number, dest?: VC.Vec4): VC.Vec4;
  /**
   * Возвращает вектор единичной длины; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function normalize(this: void, value: VC.Vec4, dest?: VC.Vec4): VC.Vec4;
  /**
   * Округляет компоненты вектора до ближайших целых; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function round(this: void, value: VC.Vec4, dest?: VC.Vec4): VC.Vec4;
  /**
   * Возвращает вектор с противоположным направлением; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function inverse(this: void, value: VC.Vec4, dest?: VC.Vec4): VC.Vec4;
  /**
   * Возвращает модули компонентов вектора; dest принимает результат, если передан.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function abs(this: void, value: VC.Vec4, dest?: VC.Vec4): VC.Vec4;
  /** Возвращает расстояние между векторами. */
  function distance(this: void, a: VC.Vec4, b: VC.Vec4): number;
  /** Возвращает скалярное произведение векторов. */
  function dot(this: void, a: VC.Vec4, b: VC.Vec4): number;
  /** Возвращает длину вектора. */
  function length(this: void, value: VC.Vec4): number;
  /** Возвращает строковое представление вектора. */
  function tostring(this: void, value: VC.Vec4): string;
  /**
   * Линейно смешивает a и b по коэффициенту t; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function mix(this: void, a: VC.Vec4, b: VC.Vec4, t: number, dest?: VC.Vec4): VC.Vec4;
}
/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /** Матрица 4×4 в виде таблицы из 16 чисел. */
  type Mat4 = [number,number,number,number,number,number,number,number,number,number,number,number,number,number,number,number];
  /**
   * Кватернион вращения с порядком компонентов w, x, y, z.
   * Порядок компонентов: w, x, y, z.
   */
  type Quat = [w: number, x: number, y: number, z: number];
  /** Составляющие преобразования, извлечённые из матрицы. */
  interface DecomposedMatrix {
    /** Масштаб по трём осям. */
    scale: Vec3;
    /** Матрица вращения. */
    rotation: Mat4;
    /** Кватернион вращения. */
    quaternion: Quat;
    /** Вектор переноса. */
    translation: Vec3;
    /** Составляющие сдвига осей. */
    skew: Vec3;
    /** Составляющие перспективного преобразования. */
    perspective: Vec4;
  }
}
/**
 * Матрицы преобразований размером 4×4.
 * Источники: libmat4.cpp и internal/maths_inline.lua.
 */
declare namespace mat4 {
  /**
   * Создаёт единичную матрицу; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function idt(this: void, dest?: VC.Mat4): VC.Mat4;
  /**
   * Умножает матрицу на матрицу или вектор; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function mul(this: void, a: VC.Mat4, b: VC.Mat4, dest?: VC.Mat4): VC.Mat4;
  /**
   * Умножает матрицу на матрицу или вектор; dest принимает результат.
   * Входной Vec3 расширяется до однородного Vec4; результат содержит четыре компонента.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function mul(this: void, a: VC.Mat4, b: VC.Vec3 | VC.Vec4, dest?: VC.Vec4): VC.Vec4;
  /** Создаёт матрицу масштаба либо применяет масштаб к переданной матрице. */
  function scale(this: void, value: VC.Vec3): VC.Mat4;
  /**
   * Создаёт матрицу масштаба либо применяет масштаб к переданной матрице.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function scale(this: void, matrix: VC.Mat4, value: VC.Vec3, dest?: VC.Mat4): VC.Mat4;
  /** Создаёт матрицу переноса либо применяет перенос к переданной матрице. */
  function translate(this: void, value: VC.Vec3): VC.Mat4;
  /**
   * Создаёт матрицу переноса либо применяет перенос к переданной матрице.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function translate(this: void, matrix: VC.Mat4, value: VC.Vec3, dest?: VC.Mat4): VC.Mat4;
  /** Создаёт вращение вокруг axis на degrees градусов либо применяет его к матрице. */
  function rotate(this: void, axis: VC.Vec3, degrees: number): VC.Mat4;
  /**
   * Создаёт вращение вокруг axis на degrees градусов либо применяет его к матрице.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function rotate(this: void, matrix: VC.Mat4, axis: VC.Vec3, degrees: number, dest?: VC.Mat4): VC.Mat4;
  /**
   * Возвращает обратную матрицу; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function inverse(this: void, matrix: VC.Mat4, dest?: VC.Mat4): VC.Mat4;
  /**
   * Возвращает транспонированную матрицу; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function transpose(this: void, matrix: VC.Mat4, dest?: VC.Mat4): VC.Mat4;
  /** Возвращает определитель матрицы. */
  function determinant(this: void, matrix: VC.Mat4): number;
  /** Разлагает матрицу на составляющие преобразования или возвращает undefined при неудаче. */
  function decompose(this: void, matrix: VC.Mat4): VC.DecomposedMatrix | undefined;
  /**
   * Создаёт матрицу взгляда из eye на center с направлением вверх up.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function look_at(this: void, eye: VC.Vec3, center: VC.Vec3, up: VC.Vec3, dest?: VC.Mat4): VC.Mat4;
  /**
   * Создаёт перспективную проекцию; fov задаёт поле зрения, ratio соотношение сторон, near и far границы отсечения.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function perspective(this: void, fov: number, ratio: number, near: number, far: number, dest?: VC.Mat4): VC.Mat4;
  /**
   * Создаёт матрицу вращения из кватерниона.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function from_quat(this: void, value: VC.Quat, dest?: VC.Mat4): VC.Mat4;
  /** Возвращает строковое представление матрицы; multiline включает несколько строк. */
  function tostring(this: void, matrix: VC.Mat4, multiline?: boolean): string;
}
/**
 * Кватернионы вращения.
 * Источник: libquat.cpp. Перегрузки mul и mul_vec3 с dest ничего не возвращают.
 */
declare namespace quat {
  /**
   * Извлекает кватернион вращения из матрицы; dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function from_mat4(this: void, matrix: VC.Mat4, dest?: VC.Quat): VC.Quat;
  /**
   * Создаёт кватернион из углов Эйлера в градусах.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function from_euler(this: void, degrees: VC.Vec3, dest?: VC.Quat): VC.Quat;
  /**
   * Сферически интерполирует кватернионы a и b по коэффициенту t.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function slerp(this: void, a: VC.Quat, b: VC.Quat, t: number, dest?: VC.Quat): VC.Quat;
  /** Возвращает строковое представление кватерниона. */
  function tostring(this: void, value: VC.Quat): string;
  /** Перемножает кватернионы; при dest записывает результат туда без возвращаемого значения. */
  function mul(this: void, a: VC.Quat, b: VC.Quat): VC.Quat;
  /**
   * Перемножает кватернионы; при dest записывает результат туда без возвращаемого значения.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function mul(this: void, a: VC.Quat, b: VC.Quat, dest: VC.Quat): void;
  /** Поворачивает вектор кватернионом; при dest записывает результат туда без возвращаемого значения. */
  function mul_vec3(this: void, rotation: VC.Quat, value: VC.Vec3): VC.Vec3;
  /**
   * Поворачивает вектор кватернионом; при dest записывает результат туда без возвращаемого значения.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function mul_vec3(this: void, rotation: VC.Quat, value: VC.Vec3, dest: VC.Vec3): void;
}
