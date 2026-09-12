/// <reference path="types.d.ts" />
/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /** Последовательность точек найденного пути с необязательным счётчиком посещённых узлов. */
  type Route = Vec3[] & {
    /** Количество узлов, посещённых при поиске пути, если движок его сообщил. */
    total_visited?:number
  };
}
/**
 * Поиск пути в мире с помощью настраиваемых агентов.
 * Нужен открытый мир. Пустой асинхронный маршрут означает неудачу; undefined означает ожидание или отсутствие агента.
 */
declare namespace pathfinding {
  /** Создаёт агента поиска пути и возвращает его ID. */
  function create_agent(this:void):number;
  /** Удаляет агента и сообщает результат. */
  function remove_agent(this:void,id:number):boolean;
  /** Включает или выключает агента. */
  function set_enabled(this:void,id:number,enabled:boolean):void;
  /** Проверяет, включён ли агент. */
  function is_enabled(this:void,id:number):boolean;
  /** Выполняет поиск пути от start до target и возвращает маршрут или undefined. */
  function make_route(this:void,id:number,start:VC.Vec3,target:VC.Vec3):VC.Route|undefined;
  /** Запускает поиск пути в фоне; результат забирается через pull_route. */
  function make_route_async(this:void,id:number,start:VC.Vec3,target:VC.Vec3):void;
  /** Забирает готовый маршрут; undefined означает ожидание или отсутствие агента, пустой маршрут неудачу. */
  function pull_route(this:void,id:number):VC.Route|undefined;
  /** Ограничивает число посещаемых блоков при поиске. */
  function set_max_visited(this:void,id:number,blocks:number):void;
  /** Задаёт допустимую высоту прыжка агента. */
  function set_jump_height(this:void,id:number,height:number):void;
  /** Задаёт дополнительную стоимость прохождения блоков с указанным тегом. */
  function avoid_tag(this:void,id:number,tag:string,cost?:number):void;
}
