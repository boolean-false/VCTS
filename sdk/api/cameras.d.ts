/// <reference path="math.d.ts" />
/** Чтение и настройка камер мира. */
declare namespace cameras {
  /** Возвращает ID камеры по имени. */
  function index(this:void,name:string):number;
  /** Возвращает имя камеры по ID. */
  function name(this:void,id:number):string;
  /** Возвращает положение камеры в мире. */
  function get_pos(this:void,id:number):VC.Vec3;
  /** Задаёт положение камеры в мире. */
  function set_pos(this:void,id:number,value:VC.Vec3):void;
  /** Возвращает матрицу вращения камеры. */
  function get_rot(this:void,id:number):VC.Mat4;
  /** Задаёт матрицу вращения камеры. */
  function set_rot(this:void,id:number,value:VC.Mat4):void;
  /** Возвращает масштаб приближения камеры. */
  function get_zoom(this:void,id:number):number;
  /** Задаёт масштаб приближения камеры. */
  function set_zoom(this:void,id:number,value:number):void;
  /** Возвращает угол поля зрения камеры в градусах. */
  function get_fov(this:void,id:number):number;
  /** Задаёт угол поля зрения камеры в градусах. */
  function set_fov(this:void,id:number,value:number):void;
  /** Проверяет, использует ли камера перспективную проекцию. */
  function is_perspective(this:void,id:number):boolean;
  /** Включает или выключает перспективную проекцию. */
  function set_perspective(this:void,id:number,value:boolean):void;
  /** Проверяет, перевёрнуто ли изображение камеры. */
  function is_flipped(this:void,id:number):boolean;
  /** Включает или выключает переворот изображения камеры. */
  function set_flipped(this:void,id:number,value:boolean):void;
  /** Возвращает вектор направления камеры вперёд. */
  function get_front(this:void,id:number):VC.Vec3;
  /** Возвращает вектор направления камеры вправо. */
  function get_right(this:void,id:number):VC.Vec3;
  /** Возвращает вектор направления камеры вверх. */
  function get_up(this:void,id:number):VC.Vec3;
  /** Направляет камеру на target; factor задаёт степень приближения к нужному повороту. */
  function look_at(this:void,id:number,target:VC.Vec3,factor?:number):void;
  /** Возвращает обёртку камеры по имени или ID. */
  function get(this:void,name:string|number):VC.Camera;
}
/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /** Обёртка камеры для чтения и изменения её параметров. */
  interface Camera {
    /** Числовой ID камеры. */
    readonly cid:number;
    /** Возвращает имя камеры. */
    get_name(this:Camera):string;
    /** Возвращает числовой ID камеры. */
    get_index(this:Camera):number;
    /** Возвращает положение камеры в мире. */
    get_pos(this:Camera):VC.Vec3;
    /** Задаёт положение камеры в мире. */
    set_pos(this:Camera,value:VC.Vec3):void;
    /** Возвращает матрицу вращения камеры. */
    get_rot(this:Camera):VC.Mat4;
    /** Задаёт матрицу вращения камеры. */
    set_rot(this:Camera,value:VC.Mat4):void;
    /** Возвращает масштаб приближения камеры. */
    get_zoom(this:Camera):number;
    /** Задаёт масштаб приближения камеры. */
    set_zoom(this:Camera,value:number):void;
    /** Возвращает угол поля зрения камеры в градусах. */
    get_fov(this:Camera):number;
    /** Задаёт угол поля зрения камеры в градусах. */
    set_fov(this:Camera,value:number):void;
    /** Проверяет, использует ли камера перспективную проекцию. */
    is_perspective(this:Camera):boolean;
    /** Включает или выключает перспективную проекцию. */
    set_perspective(this:Camera,value:boolean):void;
    /** Проверяет, перевёрнуто ли изображение камеры. */
    is_flipped(this:Camera):boolean;
    /** Включает или выключает переворот изображения камеры. */
    set_flipped(this:Camera,value:boolean):void;
    /** Возвращает вектор направления камеры вперёд. */
    get_front(this:Camera):VC.Vec3;
    /** Возвращает вектор направления камеры вправо. */
    get_right(this:Camera):VC.Vec3;
    /** Возвращает вектор направления камеры вверх. */
    get_up(this:Camera):VC.Vec3;
    /** Направляет камеру на target; factor задаёт степень приближения к нужному повороту. */
    look_at(this:Camera,target:Vec3,factor?:number):void;
  }
}
