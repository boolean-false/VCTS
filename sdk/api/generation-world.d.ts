/// <reference path="generation.d.ts" />
declare namespace VC {
  interface VoxelFragment { place(this: VoxelFragment, position: Vec3, rotation?: Rotation): void; }
}
declare namespace generation {
  /** Inclusive endpoints. Requires an open world and loaded chunks. */
  function create_fragment(this: void, a: VC.Vec3, b: VC.Vec3, crop?: boolean, saveEntities?: boolean): VC.VoxelFragment;
}
