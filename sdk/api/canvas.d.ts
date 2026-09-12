/// <reference path="types.d.ts" />
/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /**
   * CPU-буфер пикселей RGBA с операциями рисования.
   * Координаты начинаются с 0; упакованный цвет хранится как RGBA в порядке little-endian.
   */
  interface Canvas {
    /** Ширина буфера в пикселях. */
    readonly width: number;
    /** Высота буфера в пикселях. */
    readonly height: number;
    /** Возвращает упакованный цвет пикселя или undefined вне границ; координаты начинаются с 0. */
    at(this: Canvas, x: number, y: number): number | undefined;
    /** Задаёт цвет пикселя упакованным числом или компонентами RGBA от 0 до 255. */
    set(this: Canvas, x: number, y: number, packedColor: number): void;
    /** Задаёт цвет пикселя упакованным числом или компонентами RGBA от 0 до 255. */
    set(this: Canvas, x: number, y: number, r: number, g: number, b: number, a?: number): void;
    /** Рисует линию между двумя точками цветом RGBA. */
    line(this: Canvas, x1: number, y1: number, x2: number, y2: number, packedColor: number): void;
    /** Рисует линию между двумя точками цветом RGBA. */
    line(this: Canvas, x1: number, y1: number, x2: number, y2: number, r: number, g: number, b: number, a?: number): void;
    /** Рисует прямоугольник с указанными положением, размерами и цветом. */
    rect(this: Canvas, x: number, y: number, width: number, height: number, packedColor: number): void;
    /** Рисует прямоугольник с указанными положением, размерами и цветом. */
    rect(this: Canvas, x: number, y: number, width: number, height: number, r: number, g: number, b: number, a?: number): void;
    /** Заполняет весь буфер указанным цветом; без цвета очищает его. */
    clear(this: Canvas): void;
    /** Заполняет весь буфер указанным цветом; без цвета очищает его. */
    clear(this: Canvas, packedColor: number): void;
    /** Заполняет весь буфер указанным цветом; без цвета очищает его. */
    clear(this: Canvas, r: number, g: number, b: number, a?: number): void;
    /** Копирует пиксели source в этот буфер со смещением x, y. */
    blit(this: Canvas, source: Canvas, x: number, y: number): void;
    /** Умножает цвета пикселей на другой буфер, число или компоненты цвета на месте. */
    mul(this: Canvas, source: Canvas | number): void;
    /** Умножает цвета пикселей на другой буфер, число или компоненты цвета на месте. */
    mul(this: Canvas, r: number, g: number, b: number, a?: number): void;
    /**
     * Прибавляет цвета другого буфера к пикселям на месте.
     * Перегрузка с таблицей цвета в текущем движке не работает; используйте другой Canvas.
     */
    add(this: Canvas, source: Canvas): void;
    /** Вычитает цвета другого буфера из пикселей на месте. */
    sub(this: Canvas, source: Canvas): void;
    /**
     * Обновляет привязанную GPU-текстуру из буфера пикселей.
     * Без привязанной GPU-текстуры вызов ничего не делает.
     */
    update(this: Canvas): void;
    /** Отвязывает GPU-текстуру от буфера. */
    unbind_texture(this: Canvas): void;
    /** Кодирует пиксели в PNG и возвращает байты изображения. */
    encode(this: Canvas, format?: "png"): Bytearray;
    /** Возвращает сырые байты пикселей RGBA. */
    get_data(this: Canvas): Bytearray;
    /**
     * Заменяет сырые данные пикселей RGBA.
     * Нужно ровно width*height*4 байтов. Движок требует корректного размера буфера.
     */
    set_data(this: Canvas, bytes: number[] | Bytearray): void;
  }
  /** Создание пустого Canvas и декодирование PNG. */
  interface CanvasConstructor {
    /** Создаёт буфер RGBA с положительными размерами [ширина, высота]. */
    (this: void, size: Vec2): Canvas;
    /** Декодирует байты PNG в новый буфер Canvas. */
    decode(this: void, bytes: Bytearray, format: "png"): Canvas;
  }
}
/** Создаёт CPU-буфер RGBA с указанными положительными размерами. */
declare const Canvas: VC.CanvasConstructor;
