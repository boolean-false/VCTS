/// <reference path="types.d.ts" />
declare namespace VC {
  /** CPU-side RGBA pixels. Coordinates start at 0; packed color is native little-endian RGBA. */
  interface Canvas {
    readonly width: number; readonly height: number;
    at(this: Canvas, x: number, y: number): number | undefined;
    set(this: Canvas, x: number, y: number, packedColor: number): void;
    set(this: Canvas, x: number, y: number, r: number, g: number, b: number, a?: number): void;
    line(this: Canvas, x1: number, y1: number, x2: number, y2: number, packedColor: number): void;
    line(this: Canvas, x1: number, y1: number, x2: number, y2: number, r: number, g: number, b: number, a?: number): void;
    rect(this: Canvas, x: number, y: number, width: number, height: number, packedColor: number): void;
    rect(this: Canvas, x: number, y: number, width: number, height: number, r: number, g: number, b: number, a?: number): void;
    clear(this: Canvas): void;
    clear(this: Canvas, packedColor: number): void;
    clear(this: Canvas, r: number, g: number, b: number, a?: number): void;
    blit(this: Canvas, source: Canvas, x: number, y: number): void;
    mul(this: Canvas, source: Canvas | number): void;
    mul(this: Canvas, r: number, g: number, b: number, a?: number): void;
    /** Color-table overload in current native code is broken; use a Canvas operand. */
    add(this: Canvas, source: Canvas): void;
    sub(this: Canvas, source: Canvas): void;
    /** Without an attached GPU texture this is a no-op. */
    update(this: Canvas): void;
    unbind_texture(this: Canvas): void;
    encode(this: Canvas, format?: "png"): Bytearray;
    get_data(this: Canvas): Bytearray;
    /** Exactly width*height*4 bytes. Invalid lengths are a native precondition. */
    set_data(this: Canvas, bytes: number[] | Bytearray): void;
  }
  interface CanvasConstructor {
    (this: void, size: Vec2): Canvas;
    decode(this: void, bytes: Bytearray, format: "png"): Canvas;
  }
}
declare const Canvas: VC.CanvasConstructor;
