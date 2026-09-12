/// <reference path="types.d.ts" />
/**
 * Воспроизведение звуков и аудиопотоков.
 * ID 0 означает неудачу воспроизведения. В headless аудиоустройства недоступны.
 */
declare namespace audio {
  /** Воспроизводит звуковой ресурс в точке мира и возвращает ID источника; volume задаёт громкость, pitch высоту тона. */
  function play_sound(this:void,name:string,x:number,y:number,z:number,volume:number,pitch:number,channel?:string,loop?:boolean):number;
  /** Воспроизводит поток из файла в точке мира и возвращает ID источника. */
  function play_stream(this:void,path:string,x:number,y:number,z:number,volume:number,pitch:number,channel?:string,loop?:boolean):number;
  /** Воспроизводит звук без пространственного позиционирования и возвращает ID источника. */
  function play_sound_2d(this:void,name:string,volume:number,pitch:number,channel?:string,loop?:boolean):number;
  /** Воспроизводит поток из файла без пространственного позиционирования. */
  function play_stream_2d(this:void,path:string,volume:number,pitch:number,channel?:string,loop?:boolean):number;
  /** Останавливает источник звука по ID. */
  function stop(this:void,id:number):void;
  /** Приостанавливает воспроизведение источника по ID. */
  function pause(this:void,id:number):void;
  /** Возобновляет воспроизведение источника по ID. */
  function resume(this:void,id:number):void;
  /** Включает или выключает повторение звука. */
  function set_loop(this:void,id:number,value:boolean):void;
  /** Задаёт громкость источника. */
  function set_volume(this:void,id:number,value:number):void;
  /** Задаёт высоту тона и скорость воспроизведения источника. */
  function set_pitch(this:void,id:number,value:number):void;
  /** Перемещает позицию воспроизведения на указанную секунду. */
  function set_time(this:void,id:number,seconds:number):void;
  /** Задаёт положение источника в мире. */
  function set_position(this:void,id:number,x:number,y:number,z:number):void;
  /** Задаёт скорость движения источника звука. */
  function set_velocity(this:void,id:number,x:number,y:number,z:number):void;
  /** Проверяет, воспроизводится ли источник. */
  function is_playing(this:void,id:number):boolean;
  /** Проверяет, приостановлен ли источник. */
  function is_paused(this:void,id:number):boolean;
  /** Проверяет, включено ли повторение источника. */
  function is_loop(this:void,id:number):boolean;
  /** Возвращает громкость источника. */
  function get_volume(this:void,id:number):number;
  /** Возвращает высоту тона источника. */
  function get_pitch(this:void,id:number):number;
  /** Возвращает текущую позицию воспроизведения в секундах. */
  function get_time(this:void,id:number):number;
  /** Возвращает длительность звука в секундах. */
  function get_duration(this:void,id:number):number;
  /** Возвращает положение источника отдельными координатами Lua. */
  function get_position(this:void,id:number):VC.MaybeXYZ;
  /** Возвращает скорость источника отдельными координатами Lua. */
  function get_velocity(this:void,id:number):VC.MaybeXYZ;
  /** Возвращает число источников звука. */
  function count_speakers(this:void):number;
  /** Возвращает число аудиопотоков. */
  function count_streams(this:void):number;
}
/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /** Буфер аудиоданных PCM для создания звуковых ресурсов. */
  interface PCMStream {
    /** Добавляет сырые PCM-байты в буфер потока. */
    feed(this:PCMStream,bytes:Bytearray):void;
    /**
     * Публикует поток под именем звукового ресурса alias.
     * Нужны графические ресурсы клиента.
     */
    share(this:PCMStream,alias:string):void;
    /**
     * Создаёт звуковой ресурс из накопленных PCM-данных и расходует буфер.
     * Нужны графические ресурсы клиента. Накопленный PCM-буфер расходуется.
     */
    create_sound(this:PCMStream,alias:string):void;
  }
}
/** Воспроизведение звуков и аудиопотоков. */
declare namespace audio {
  /** Создаёт PCM-буфер с частотой дискретизации, числом каналов и битами на отсчёт. */
  function PCMStream(this:void,sampleRate:number,channels:number,bitsPerSample:number):VC.PCMStream;
}
