/// <reference path="types.d.ts" />

/** Sources: libvecn.cpp and internal/maths_inline.lua. Angles are in degrees. */
declare namespace vec2 {
  function add(this: void, a: VC.Vec2, b: VC.Vec2 | number, dest?: VC.Vec2): VC.Vec2;
  function sub(this: void, a: VC.Vec2, b: VC.Vec2 | number, dest?: VC.Vec2): VC.Vec2;
  function mul(this: void, a: VC.Vec2, b: VC.Vec2 | number, dest?: VC.Vec2): VC.Vec2;
  function div(this: void, a: VC.Vec2, b: VC.Vec2 | number, dest?: VC.Vec2): VC.Vec2;
  function pow(this: void, a: VC.Vec2, b: VC.Vec2 | number, dest?: VC.Vec2): VC.Vec2;
  function normalize(this: void, value: VC.Vec2, dest?: VC.Vec2): VC.Vec2;
  function round(this: void, value: VC.Vec2, dest?: VC.Vec2): VC.Vec2;
  function inverse(this: void, value: VC.Vec2, dest?: VC.Vec2): VC.Vec2;
  /** Lua override returns nil with dest; native generator-state version returns dest. */
  function abs(this: void, value: VC.Vec2): VC.Vec2;
  function abs(this: void, value: VC.Vec2, dest: VC.Vec2): VC.Vec2 | undefined;
  function distance(this: void, a: VC.Vec2, b: VC.Vec2): number;
  function dot(this: void, a: VC.Vec2, b: VC.Vec2): number;
  function length(this: void, value: VC.Vec2): number;
  function tostring(this: void, value: VC.Vec2): string;
  function mix(this: void, a: VC.Vec2, b: VC.Vec2, t: number, dest?: VC.Vec2): VC.Vec2;
  function angle(this: void, value: VC.Vec2): number;
  function angle(this: void, x: number, y: number): number;
  function rotate(this: void, value: VC.Vec2, degrees: number, dest?: VC.Vec2): VC.Vec2;
}

declare namespace vec3 {
  function add(this: void, a: VC.Vec3, b: VC.Vec3 | number, dest?: VC.Vec3): VC.Vec3;
  function sub(this: void, a: VC.Vec3, b: VC.Vec3 | number, dest?: VC.Vec3): VC.Vec3;
  function mul(this: void, a: VC.Vec3, b: VC.Vec3 | number, dest?: VC.Vec3): VC.Vec3;
  function div(this: void, a: VC.Vec3, b: VC.Vec3 | number, dest?: VC.Vec3): VC.Vec3;
  function pow(this: void, a: VC.Vec3, b: VC.Vec3 | number, dest?: VC.Vec3): VC.Vec3;
  function normalize(this: void, value: VC.Vec3, dest?: VC.Vec3): VC.Vec3;
  function round(this: void, value: VC.Vec3, dest?: VC.Vec3): VC.Vec3;
  function inverse(this: void, value: VC.Vec3, dest?: VC.Vec3): VC.Vec3;
  /** Lua override returns nil with dest; native generator-state version returns dest. */
  function abs(this: void, value: VC.Vec3): VC.Vec3;
  function abs(this: void, value: VC.Vec3, dest: VC.Vec3): VC.Vec3 | undefined;
  function distance(this: void, a: VC.Vec3, b: VC.Vec3): number;
  function dot(this: void, a: VC.Vec3, b: VC.Vec3): number;
  function length(this: void, value: VC.Vec3): number;
  function tostring(this: void, value: VC.Vec3): string;
  function mix(this: void, a: VC.Vec3, b: VC.Vec3, t: number, dest?: VC.Vec3): VC.Vec3;
  function spherical_rand(this: void, radius: number, dest?: VC.Vec3): VC.Vec3;
}

declare namespace vec4 {
  function add(this: void, a: VC.Vec4, b: VC.Vec4 | number, dest?: VC.Vec4): VC.Vec4;
  function sub(this: void, a: VC.Vec4, b: VC.Vec4 | number, dest?: VC.Vec4): VC.Vec4;
  function mul(this: void, a: VC.Vec4, b: VC.Vec4 | number, dest?: VC.Vec4): VC.Vec4;
  function div(this: void, a: VC.Vec4, b: VC.Vec4 | number, dest?: VC.Vec4): VC.Vec4;
  function pow(this: void, a: VC.Vec4, b: VC.Vec4 | number, dest?: VC.Vec4): VC.Vec4;
  function normalize(this: void, value: VC.Vec4, dest?: VC.Vec4): VC.Vec4;
  function round(this: void, value: VC.Vec4, dest?: VC.Vec4): VC.Vec4;
  function inverse(this: void, value: VC.Vec4, dest?: VC.Vec4): VC.Vec4;
  function abs(this: void, value: VC.Vec4, dest?: VC.Vec4): VC.Vec4;
  function distance(this: void, a: VC.Vec4, b: VC.Vec4): number;
  function dot(this: void, a: VC.Vec4, b: VC.Vec4): number;
  function length(this: void, value: VC.Vec4): number;
  function tostring(this: void, value: VC.Vec4): string;
  function mix(this: void, a: VC.Vec4, b: VC.Vec4, t: number, dest?: VC.Vec4): VC.Vec4;
}
declare namespace VC {
  type Mat4 = [number,number,number,number,number,number,number,number,number,number,number,number,number,number,number,number];
  /** Order is w, x, y, z. */
  type Quat = [w: number, x: number, y: number, z: number];
  interface DecomposedMatrix {
    scale: Vec3; rotation: Mat4; quaternion: Quat; translation: Vec3;
    skew: Vec3; perspective: Vec4;
  }
}
/** Source: libmat4.cpp + internal/maths_inline.lua. */
declare namespace mat4 {
  function idt(this: void, dest?: VC.Mat4): VC.Mat4;
  function mul(this: void, a: VC.Mat4, b: VC.Mat4, dest?: VC.Mat4): VC.Mat4;
  /** C++ extends a vec3 input to homogeneous vec4; result contains FOUR components. */
  function mul(this: void, a: VC.Mat4, b: VC.Vec3 | VC.Vec4, dest?: VC.Vec4): VC.Vec4;
  function scale(this: void, value: VC.Vec3): VC.Mat4;
  function scale(this: void, matrix: VC.Mat4, value: VC.Vec3, dest?: VC.Mat4): VC.Mat4;
  function translate(this: void, value: VC.Vec3): VC.Mat4;
  function translate(this: void, matrix: VC.Mat4, value: VC.Vec3, dest?: VC.Mat4): VC.Mat4;
  function rotate(this: void, axis: VC.Vec3, degrees: number): VC.Mat4;
  function rotate(this: void, matrix: VC.Mat4, axis: VC.Vec3, degrees: number, dest?: VC.Mat4): VC.Mat4;
  function inverse(this: void, matrix: VC.Mat4, dest?: VC.Mat4): VC.Mat4;
  function transpose(this: void, matrix: VC.Mat4, dest?: VC.Mat4): VC.Mat4;
  function determinant(this: void, matrix: VC.Mat4): number;
  function decompose(this: void, matrix: VC.Mat4): VC.DecomposedMatrix | undefined;
  function look_at(this: void, eye: VC.Vec3, center: VC.Vec3, up: VC.Vec3, dest?: VC.Mat4): VC.Mat4;
  function perspective(this: void, fov: number, ratio: number, near: number, far: number, dest?: VC.Mat4): VC.Mat4;
  function from_quat(this: void, value: VC.Quat, dest?: VC.Mat4): VC.Mat4;
  function tostring(this: void, matrix: VC.Mat4, multiline?: boolean): string;
}
/** Source: libquat.cpp. Destination overloads of mul/mul_vec3 return no values. */
declare namespace quat {
  function from_mat4(this: void, matrix: VC.Mat4, dest?: VC.Quat): VC.Quat;
  function from_euler(this: void, degrees: VC.Vec3, dest?: VC.Quat): VC.Quat;
  function slerp(this: void, a: VC.Quat, b: VC.Quat, t: number, dest?: VC.Quat): VC.Quat;
  function tostring(this: void, value: VC.Quat): string;
  function mul(this: void, a: VC.Quat, b: VC.Quat): VC.Quat;
  function mul(this: void, a: VC.Quat, b: VC.Quat, dest: VC.Quat): void;
  function mul_vec3(this: void, rotation: VC.Quat, value: VC.Vec3): VC.Vec3;
  function mul_vec3(this: void, rotation: VC.Quat, value: VC.Vec3, dest: VC.Vec3): void;
}
