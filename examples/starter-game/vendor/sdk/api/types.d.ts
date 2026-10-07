/// <reference path="../language-extensions.d.ts" />

/** Types only. No runtime object named VC is emitted or required. */
declare namespace VC {
  type Vec2 = [number, number];
  type Vec3 = [number, number, number];
  type Vec4 = [number, number, number, number];
  type MaybeXYZ = LuaMultiReturn<[number?, number?, number?]>;
  type Value = undefined | boolean | number | string | Value[] | { [key: string]: Value };
  type ObjectValue = { [key: string]: Value };
  /** Opaque FFI value. Not a JS/TS array: do not use array methods or TS indexing. */
  interface Bytearray { readonly __vcBytearray: unique symbol; }
  type BlockState = [rotation: number, segment: number, userbits: number];
  interface BlockRayHit {
    block: number; endpoint: Vec3; iendpoint: Vec3; length: number; normal: Vec3;
  }
  interface WorldInfo { name: string; icon: string; version: Vec2; }
}
