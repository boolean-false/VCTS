/// <reference path="audio.d.ts" />
/** Запись звука с устройства ввода после выдачи разрешения. */
declare namespace audio.input {
  /**
   * Запрашивает разрешение на запись звука и передаёт токен обработчику после согласия.
   * Открывает диалог разрешений VoxelCore. Обработчик вызывается только после согласия.
   */
  function request_open(this:void,callback:(this:void,token:string)=>void):void;
  /** Забирает записанные PCM-байты по токену; size ограничивает объём чтения. */
  function fetch(this:void,token:string,size?:number):VC.Bytearray|undefined;
  /**
   * Возвращает амплитуду, сохранённую последним чтением аудиоввода.
   * В VC 0.32.1 значение сбрасывается при чтении и хранит амплитуду последнего отсчёта вместо настоящего пика.
   */
  function get_max_amplitude(this:void):number;
  /** Возвращает параметры открытого устройства ввода или undefined. */
  function get_input_info(this:void):{
    /** Имя устройства записи звука. */
    device_specifier:string;
    /** Число каналов аудиоввода. */
    channels:number;
    /** Частота дискретизации в герцах. */
    sample_rate:number;
    /** Число бит на один отсчёт. */
    bits_per_sample:number
  }|undefined;
}
