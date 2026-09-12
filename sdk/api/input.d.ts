/// <reference path="ui.d.ts" />
/**
 * Клавиатура, мышь и игровые привязки управления.
 * Доступно только графическому клиенту. Обработчикам привязок нужен HUD или контейнер-владелец.
 */
declare namespace input {
  /** Возвращает числовой код клавиши по имени. */
  function keycode(this:void,name:string):number;
  /** Возвращает числовой код кнопки мыши по имени. */
  function mousecode(this:void,name:string):number;
  /** Добавляет обработчик привязки; owner задаёт контейнер, topLevel уровень обработки ввода. */
  function add_callback(this:void,binding:string,callback:(this:void)=>boolean|void,owner?:VC.UIContainer,topLevel?:boolean):void;
  /** Возвращает положение курсора или undefined без активного ввода. */
  function get_mouse_pos(this:void):VC.Vec2|undefined;
  /** Возвращает смещение мыши за кадр или undefined. */
  function get_mouse_delta(this:void):VC.Vec2|undefined;
  /** Возвращает прокрутку колеса мыши за кадр или undefined. */
  function get_mouse_scroll(this:void):number|undefined;
  /** Возвращает имена привязок управления или undefined. */
  function get_bindings(this:void):string[]|undefined;
  /** Возвращает отображаемое сочетание клавиш привязки или undefined. */
  function get_binding_text(this:void,binding:string):string|undefined;
  /** Проверяет активность игровой привязки управления. */
  function is_active(this:void,binding:string):boolean|undefined;
  /** Проверяет, нажата ли клавиша key:имя или кнопка mouse:имя. */
  function is_pressed(this:void,code:`key:${string}`|`mouse:${string}`):boolean|undefined;
  /** Восстанавливает привязки управления по умолчанию. */
  function reset_bindings(this:void):void;
  /** Включает или выключает указанную привязку. */
  function set_enabled(this:void,binding:string,enabled:boolean):void;
}
