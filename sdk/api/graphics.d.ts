/// <reference path="math.d.ts" />
/// <reference path="canvas.d.ts" />
/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /** Длительность анимации и функция применения к целевому объекту. */
  interface AnimationTrack<T> {
    /** Длительность анимационной дорожки. */
    duration: number;
    /** Применяет анимацию к target для времени time с указанными интенсивностью и множителем. */
    func(this: void, target: T, time: number, intensity?: number, multiplier?: number): void;
  }
  /** Оформление текстовой надписи в мире. */
  interface NotePreset {
    /** Режим отображения надписи. */
    display?:string;
    /** Цвет надписи. */
    color?:Vec4;
    /** Масштаб надписи. */
    scale?:number;
    /** Максимальная дистанция отображения надписи. */
    render_distance?:number;
    /** Непрозрачность надписи при перекрытии другими объектами. */
    xray_opacity?:number;
    /** Использование перспективы при отображении надписи. */
    perspective?:boolean;
    /** Имя шрифта надписи. */
    font?:string;
  }
  /** Текстуры, движение, время жизни и область появления частиц. */
  interface ParticlesPreset {
    /** Имя текстуры частиц. */
    texture?:string;
    /** Имена кадров анимированной текстуры. */
    frames?:string[];
    /** Включает столкновения частиц с миром. */
    collision?:boolean;
    /** Включает освещение частиц. */
    lighting?:boolean;
    /** Использует общую вертикальную ось для ориентации частиц. */
    global_up_vector?:boolean;
    /** Максимальная дистанция отображения частиц. */
    max_distance?:number;
    /** Интервал появления частиц. */
    spawn_interval?:number;
    /** Базовое время жизни частицы. */
    lifetime?:number;
    /** Случайный разброс времени жизни. */
    lifetime_spread?:number;
    /** Начальная скорость частиц. */
    velocity?:Vec3;
    /** Ускорение частиц. */
    acceleration?:Vec3;
    /** Параметры начального разлёта частиц. */
    explosion?:Vec3;
    /** Базовые размеры частицы. */
    size?:Vec3;
    /** Случайный разброс размера. */
    size_spread?:number;
    /** Случайный разброс начального угла. */
    angle_spread?:number;
    /** Минимальная угловая скорость частиц. */
    min_angular_vel?:number;
    /** Максимальная угловая скорость частиц. */
    max_angular_vel?:number;
    /** Размеры области случайного появления. */
    spawn_spread?:Vec3;
    /** Смещение места появления от источника. */
    spawn_offset?:Vec3;
    /** Форма области появления частиц. */
    spawn_shape?:string;
    /** Параметр случайного выбора участка текстуры. */
    random_sub_uv?:number;
  }
  /** Осадки, туман, освещение и параметры неба. */
  interface WeatherPreset {
    /** Параметры осадков. */
    fall?:{
      /** Имя текстуры осадков. */
      texture?:string;
      /** Вертикальная скорость осадков. */
      vspeed?:number;
      /** Горизонтальная скорость осадков. */
      hspeed?:number;
      /** Масштаб частиц осадков. */
      scale?:number;
      /** Параметр шума осадков. */
      noise?:number;
      /** Минимальная непрозрачность осадков. */
      min_opacity?:number;
      /** Максимальная непрозрачность осадков. */
      max_opacity?:number;
      /** Максимальная интенсивность осадков. */
      max_intensity?:number;
      /** Включает непрозрачное отображение осадков. */
      opaque?:boolean;
      /** Настройки частиц брызг при попадании осадков. */
      splash?:ParticlesPreset
    };
    /** Непрозрачность тумана. */
    fog_opacity?:number;
    /** Плотность тумана; имя свойства сохраняет написание API движка. */
    fog_dencity?:number;
    /** Параметр кривой изменения тумана с расстоянием. */
    fog_curve?:number;
    /** Цветовой оттенок неба. */
    sky_tint?:Vec3;
    /** Цветовой оттенок облаков. */
    clouds_tint?:Vec3;
    /** Минимальное освещение от неба по цветовым каналам. */
    min_sky_light?:Vec3;
    /** Параметр облачности. */
    clouds?:number;
    /** Частота грозовых явлений. */
    thunder_rate?:number;
  }
  /** Обёртка текстовой надписи в трёхмерном мире. */
  interface Text3D {
    /** Числовой ID надписи. */
    readonly id:number;
    /** Удаляет эту надпись из мира. */
    hide(this:Text3D):void;
    /** Возвращает положение надписи в мире. */
    get_pos(this:Text3D):Vec3|undefined;
    /** Задаёт положение надписи в мире. */
    set_pos(this:Text3D,value:Vec3):void;
    /** Возвращает горизонтальную ось плоскости надписи. */
    get_axis_x(this:Text3D):Vec3|undefined;
    /** Задаёт горизонтальную ось плоскости надписи. */
    set_axis_x(this:Text3D,value:Vec3):void;
    /** Возвращает вертикальную ось плоскости надписи. */
    get_axis_y(this:Text3D):Vec3|undefined;
    /** Задаёт вертикальную ось плоскости надписи. */
    set_axis_y(this:Text3D,value:Vec3):void;
    /** Задаёт вращение надписи матрицей. */
    set_rotation(this:Text3D,value:Mat4):void;
    /** Возвращает текст надписи или undefined. */
    get_text(this:Text3D):string|undefined;
    /** Меняет текст надписи. */
    set_text(this:Text3D,value:string):void;
    /** Обновляет оформление надписи по preset. */
    update_settings(this:Text3D,preset:NotePreset):void;
  }
}
/**
 * Поиск анимационных дорожек.
 * Источники: res/modules/animation.lua и internal/animation_codegen.lua.
 */
declare namespace animation {
  /** Возвращает анимационную дорожку по ID или undefined. */
  function get_track<T>(this: void, identifier: string): VC.AnimationTrack<T> | undefined;
}
/**
 * Загрузка графических ресурсов клиента.
 * Нужны графические ресурсы клиента.
 */
declare namespace assets {
  /** Запрашивает загрузку текстуры из path под именем alias. */
  function request_texture(this:void,path:string,alias:string):void;
  /** Загружает PNG из байтов под именем alias. */
  function load_texture(this:void,bytes:VC.Bytearray|number[],alias:string,format?:"png"):void;
  /** Разбирает текст анимации VCA и регистрирует ресурс name. */
  function parse_animation(this:void,format:"vca",source:string,name:string):void;
  /** Разбирает OBJ, XML или VCM и регистрирует модель name с необязательным скелетом. */
  function parse_model(this:void,format:"obj"|"xml"|"vcm",source:string,name:string,skeleton?:string):void;
  /** Копирует именованную текстуру в CPU-буфер Canvas или возвращает undefined. */
  function to_canvas(this:void,alias:string):VC.Canvas|undefined;
}
/**
 * Создание и управление источниками частиц.
 * Вызывайте после on_hud_open.
 */
declare namespace gfx.particles {
  /** Создаёт источник частиц в точке или на сущности, применяет настройки и возвращает ID. */
  function emit(this:void,origin:VC.Vec3|number,count:number,preset:VC.ParticlesPreset,extension?:VC.ParticlesPreset):number;
  /** Останавливает источник частиц по ID. */
  function stop(this:void,id:number):void;
  /** Проверяет, существует ли источник частиц. */
  function is_alive(this:void,id:number):boolean;
  /** Возвращает положение или UID сущности источника. */
  function get_origin(this:void,id:number):VC.Vec3|number|undefined;
  /** Привязывает источник к точке мира или сущности по UID. */
  function set_origin(this:void,id:number,origin:VC.Vec3|number):void;
}
/** Графические накладки на блоки. */
declare namespace gfx.blockwraps {
  /** Создаёт графическую накладку на блок и возвращает ID; emission задаёт свечение, tint оттенок. */
  function wrap(this:void,position:VC.Vec3,texture:string,emission?:number,tint?:VC.Vec3|VC.Vec4):number;
  /** Удаляет накладку по ID. */
  function unwrap(this:void,id:number):void;
  /** Перемещает накладку на другую позицию блока. */
  function set_pos(this:void,id:number,position:VC.Vec3):void;
  /** Задаёт общую текстуру накладки. */
  function set_texture(this:void,id:number,texture:string):void;
  /** Задаёт текстуры отдельных граней накладки. */
  function set_faces(this:void,id:number,...faces:[string?,string?,string?,string?,string?,string?]):void;
  /** Задаёт цветовые оттенки отдельных граней накладки. */
  function set_tints(this:void,id:number,...faces:[(VC.Vec3|VC.Vec4)?,(VC.Vec3|VC.Vec4)?,(VC.Vec3|VC.Vec4)?,(VC.Vec3|VC.Vec4)?,(VC.Vec3|VC.Vec4)?,(VC.Vec3|VC.Vec4)?]):void;
}
/** Настройка эффектов обработки изображения. */
declare namespace gfx.posteffects {
  /** Возвращает индекс постэффекта по имени. */
  function index(this:void,name:string):number;
  /** Задаёт эффект для указанного индекса. */
  function set_effect(this:void,index:number,name:string):void;
  /** Возвращает интенсивность постэффекта. */
  function get_intensity(this:void,index:number):number;
  /** Задаёт интенсивность постэффекта. */
  function set_intensity(this:void,index:number,value:number):void;
  /** Проверяет активность постэффекта. */
  function is_active(this:void,index:number):boolean;
  /** Задаёт параметры постэффекта. */
  function set_params(this:void,index:number,parameters:VC.ObjectValue):void;
  /** Передаёт бинарный массив параметру постэффекта по имени. */
  function set_array(this:void,index:number,name:string,data:VC.Bytearray):void;
}
/** Погода и переходы между погодными состояниями. */
declare namespace gfx.weather {
  /** Запускает переход к preset за seconds секунд с необязательным именем состояния. */
  function change(this:void,preset:VC.WeatherPreset,seconds:number,name?:string):void;
  /** Возвращает имя текущего погодного состояния. */
  function get_current(this:void):string;
  /** Возвращает параметры текущей погоды. */
  function get_current_data(this:void):VC.WeatherPreset;
  /** Возвращает текущую интенсивность осадков. */
  function get_fall_intensity(this:void):number;
  /** Проверяет, идёт ли переход между погодными состояниями. */
  function is_transition(this:void):boolean;
}
/** Графические эффекты игрового HUD. */
declare namespace gfx {
 /** Создание и настройка текстовых надписей в трёхмерном мире. */
  const text3d: {
  /** Создаёт надпись в position с настройками и возвращает ID. */
    show(this:void,position:VC.Vec3,text:string,preset:VC.NotePreset,extension?:VC.NotePreset):number;
  /** Удаляет надпись по ID. */
    hide(this:void,id:number):void;
  /** Возвращает текст надписи или undefined. */
    get_text(this:void,id:number):string|undefined;
  /** Меняет текст надписи. */
    set_text(this:void,id:number,text:string):void;
  /** Возвращает положение надписи в мире. */
    get_pos(this:void,id:number):VC.Vec3|undefined;
  /** Задаёт положение надписи в мире. */
    set_pos(this:void,id:number,position:VC.Vec3):void;
  /** Возвращает горизонтальную ось плоскости надписи. */
    get_axis_x(this:void,id:number):VC.Vec3|undefined;
  /** Задаёт горизонтальную ось плоскости надписи. */
    set_axis_x(this:void,id:number,axis:VC.Vec3):void;
  /** Возвращает вертикальную ось плоскости надписи. */
    get_axis_y(this:void,id:number):VC.Vec3|undefined;
  /** Задаёт вертикальную ось плоскости надписи. */
    set_axis_y(this:void,id:number,axis:VC.Vec3):void;
  /** Задаёт вращение надписи матрицей. */
    set_rotation(this:void,id:number,matrix:VC.Mat4):void;
  /** Обновляет оформление надписи по preset. */
    update_settings(this:void,id:number,preset:VC.NotePreset):void;
  /** Возвращает UID сущности, к которой привязана надпись. */
    get_entity(this:void,id:number):number|undefined;
  /** Привязывает надпись к сущности по UID. */
    set_entity(this:void,id:number,entity:number):void;
  /** Создаёт надпись и возвращает её обёртку Text3D. */
    "new"(this:void,position:VC.Vec3,text:string,preset:VC.NotePreset,extension?:VC.NotePreset):VC.Text3D;

};
}

/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /** Обёртка именованного скелета графического клиента. */
  interface NamedSkeleton {
    /** Имя графического скелета. */
    readonly name:string;
    /** Возвращает индекс кости по имени. */
    index(this:NamedSkeleton,bone:string):number|undefined;
    /** Возвращает имя модели кости по её индексу. */
    get_model(this:NamedSkeleton,bone:number):string|undefined;
    /** Задаёт или удаляет модель кости по индексу. */
    set_model(this:NamedSkeleton,bone:number,model:string|undefined):void;
    /** Читает матрицу кости; при переданном dest записывает её в dest. */
    get_matrix(this:NamedSkeleton,bone:number):Mat4|undefined;
    /** Задаёт матрицу кости по индексу. */
    set_matrix(this:NamedSkeleton,bone:number,matrix:Mat4):void;
    /** Возвращает текстуру по ключу скелета. */
    get_texture(this:NamedSkeleton,bone:string):string|undefined;
    /** Задаёт текстуру по ключу скелета. */
    set_texture(this:NamedSkeleton,bone:string,texture:string):void;
    /** Проверяет видимость скелета или выбранной кости. */
    is_visible(this:NamedSkeleton,bone:number):boolean|undefined;
    /** Задаёт видимость скелета целиком или выбранной кости. */
    set_visible(this:NamedSkeleton,bone:number,visible:boolean):void;
    /** Возвращает цвет скелета или выбранной кости. */
    get_color(this:NamedSkeleton,bone:number):Vec4|undefined;
    /**
     * Задаёт цвет скелета или выбранной кости.
     * @deprecated Обёртка HUD передаёт аргументы в неверном порядке. Используйте Skeleton сущности или штатную функцию движка.
     */
    set_color(this:NamedSkeleton,bone:number,color:Vec4):void;
  }
}
/** Доступ к именованным графическим скелетам. */
declare namespace gfx.skeletons {
  /** Возвращает именованный графический скелет или undefined. */
  function get(this:void,name:string):VC.NamedSkeleton|undefined;
}
