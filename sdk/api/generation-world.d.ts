/// <reference path="generation.d.ts" />
/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /** Сохранённый объём блоков, который можно обрезать или разместить в мире. */
  interface VoxelFragment {
    /** Размещает фрагмент в открытом мире с указанным поворотом. */
    place(this: VoxelFragment, position: Vec3, rotation?: Rotation): void;
  }
}
/** Генераторы мира и сохранённые фрагменты блоков. */
declare namespace generation {
  /**
   * Копирует область мира между a и b во фрагмент; crop обрезает, saveEntities сохраняет сущности.
   * Границы области включены. Нужны открытый мир и загруженные чанки.
   */
  function create_fragment(this: void, a: VC.Vec3, b: VC.Vec3, crop?: boolean, saveEntities?: boolean): VC.VoxelFragment;
}
