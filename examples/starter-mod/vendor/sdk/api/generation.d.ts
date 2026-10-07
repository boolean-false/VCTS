/// <reference path="types.d.ts" />
/** Coordinates and sizes must be valid integers. Binary map operations require matching sizes. */
declare namespace VC {
  interface Heightmap {
    readonly width: number; readonly height: number;
    /** Native setter-only properties: reading them returns nil. */
    get noiseSeed(): undefined; set noiseSeed(value: number);
    get normalNoise(): undefined; set normalNoise(value: boolean);
    dump(this: Heightmap, filename: string): void;
    at(this: Heightmap, x: number, y: number): number;
    noise(this: Heightmap, offset: Vec2, scale: number, octaves?: number, multiplier?: number, shiftX?: Heightmap, shiftY?: Heightmap): void;
    cellnoise(this: Heightmap, offset: Vec2, scale: number, octaves?: number, multiplier?: number, shiftX?: Heightmap, shiftY?: Heightmap): void;
    pow(this: Heightmap, value: Heightmap | number): void;
    add(this: Heightmap, value: Heightmap | number): void;
    sub(this: Heightmap, value: Heightmap | number): void;
    mul(this: Heightmap, value: Heightmap | number): void;
    min(this: Heightmap, value: Heightmap | number): void;
    max(this: Heightmap, value: Heightmap | number): void;
    abs(this: Heightmap): void;
    floor(this: Heightmap): void;
    round(this: Heightmap): void;
    ceil(this: Heightmap): void;
    sin(this: Heightmap): void;
    cos(this: Heightmap): void;
    tan(this: Heightmap): void;
    resize(this: Heightmap, width: number, height: number, interpolation: "nearest" | "linear" | "cubic"): void;
    crop(this: Heightmap, x: number, y: number, width: number, height: number): void;
    mixin(this: Heightmap, value: Heightmap | number, factor: Heightmap | number): void;
  }
  interface VoxelFragment { readonly size: Vec3; crop(this: VoxelFragment): void; }
  type Rotation = 0 | 1 | 2 | 3;
  type StructurePlacement = [name: string | number, position: Vec3, rotation: Rotation, priority?: number];
  type BlockPlacement = [kind: ":block", blockId: number, position: Vec3, rotation?: Rotation, priority?: number];
  type LinePlacement = [kind: ":line", blockId: number, start: Vec3, end: Vec3, radius: number, priority?: number];
  type Placement = StructurePlacement | BlockPlacement | LinePlacement;
  interface GeneratorContext { readonly seed: number; readonly dir: string; readonly file: string; }
  interface GeneratorCallbacks {
    generate_heightmap?(this: void, x: number, y: number, width: number, height: number, bpd: number, inputs?: Heightmap[]): Heightmap;
    generate_biome_parameters?(this: void, x: number, y: number, width: number, height: number, bpd: number): LuaMultiReturn<Heightmap[]>;
    place_structures?(this: void, x: number, z: number, width: number, depth: number, heights: Heightmap, chunkHeight: number): Placement[];
    place_structures_wide?(this: void, x: number, z: number, width: number, depth: number, chunkHeight: number): Placement[];
  }
}
/** Callable userdata constructor, not a TypeScript class. */
declare const Heightmap: (this: void, width: number, height: number) => VC.Heightmap;
declare namespace generation {
  function load_fragment(this: void, source: string | VC.Bytearray): VC.VoxelFragment;
  function save_fragment(this: void, fragment: VC.VoxelFragment, filename: string): void;
  function get_generators(this: void): Record<string, string>;
  function get_default_generator(this: void): string;
}
