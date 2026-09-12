/** Функция освобождения ресурса или отмены операции. Авторский слой компилируется в пак и не требует отдельного SDK при исполнении. */
export type Dispose = (this:void)=>void;
/** Объединяет ресурсы и освобождает их при завершении области. */
export class Scope {
  private cleanups:Dispose[]=[];
  private closed=false;
  /** Показывает, завершена ли область и освобождены ли её ресурсы. */
  get disposed():boolean {return this.closed;}
  /** Регистрирует освобождение ресурса и возвращает функцию однократного освобождения; закрытая область вызывает её сразу. */
  own(this:Scope,cleanup:Dispose):Dispose {
    let active=true;
    const dispose=():void=>{if(active){active=false;const i=this.cleanups.indexOf(dispose);if(i>=0)this.cleanups.splice(i,1);cleanup();}};
    if(this.closed)dispose();else this.cleanups.push(dispose);
    return dispose;
  }
  /** Освобождает ресурсы в обратном порядке; повторный вызов безопасен. После очистки передаёт первую возникшую ошибку. */
  dispose(this:Scope):void {
    if(this.closed)return;
    this.closed=true;
    const pending=this.cleanups;this.cleanups=[];
    let failed=false,error:unknown;
    for(let i=pending.length-1;i>=0;i--) {
      try {pending[i]!();} catch(e){if(!failed){failed=true;error=e;}}
    }
    if(failed)throw error;
  }
}

type EventShape<M>={[K in keyof M]:unknown[]};
type Subscription={event:string;active:boolean;handler:(this:void,...args:unknown[])=>void};
/** Типизированные события внутри пака. Новые подписки во время emit действуют со следующего вызова; удалённые пропускаются сразу. */
export class EventBus<M extends EventShape<M>> {
  private subscriptions:Subscription[]=[];
  /** Подписывает обработчик на событие и возвращает отмену подписки; scope связывает срок жизни с областью. */
  on<K extends keyof M & string>(this:EventBus<M>,event:K,handler:(this:void,...args:M[K])=>void,scope?:Scope):Dispose {
    const entry:Subscription={event,active:true,handler:handler as (this:void,...args:unknown[])=>void};
    this.subscriptions.push(entry);
    const remove=():void=>{entry.active=false;const i=this.subscriptions.indexOf(entry);if(i>=0)this.subscriptions.splice(i,1);};
    return scope?scope.own(remove):remove;
  }
  /** Вызывает активных подписчиков события с типизированными аргументами. */
  emit<K extends keyof M & string>(this:EventBus<M>,event:K,...args:M[K]):void {
    for(const item of this.subscriptions.slice())if(item.active && item.event===event)item.handler(...args);
  }
}

type Job={at:number;interval:number;active:boolean;callback:Dispose};
/** Планирует вызовы по времени в секундах. Продвигайте время вручную через tick из обработчика обновления. */
export class Scheduler {
  private now=0;
  private jobs:Job[]=[];
  /** Планирует один вызов через seconds секунд и возвращает отмену; scope ограничивает срок жизни. */
  after(this:Scheduler,seconds:number,callback:Dispose,scope?:Scope):Dispose{return this.add(seconds,0,callback,scope);}
  /** Планирует повторные вызовы с положительным интервалом в секундах и возвращает отмену. */
  every(this:Scheduler,seconds:number,callback:Dispose,scope?:Scope):Dispose {
    if(!(seconds>0))throw new Error("interval must be positive");
    return this.add(seconds,seconds,callback,scope);
  }
  private add(this:Scheduler,delay:number,interval:number,callback:Dispose,scope?:Scope):Dispose {
    if(!Number.isFinite(delay)||delay<0)throw new Error("delay must be finite and nonnegative");
    const job:Job={at:this.now+delay,interval,active:true,callback};this.jobs.push(job);
    const cancel=():void=>{job.active=false;const i=this.jobs.indexOf(job);if(i>=0)this.jobs.splice(i,1);};
    const dispose=scope?scope.own(cancel):cancel;
    if(interval===0)job.callback=()=>{try{callback();}finally{dispose();}};
    return dispose;
  }
  /** Продвигает время на seconds секунд и выполняет готовые задания; повторное задание вызывается не более одного раза за tick. */
  tick(this:Scheduler,seconds:number):void {
    if(!Number.isFinite(seconds)||seconds<0)throw new Error("delta must be finite and nonnegative");
    this.now+=seconds;
    for(const job of this.jobs.slice())if(job.active && this.now>=job.at) {
      if(job.interval>0)job.at=this.now+job.interval;
      else {job.active=false;const i=this.jobs.indexOf(job);if(i>=0)this.jobs.splice(i,1);}
      job.callback();
    }
  }
  /** Удаляет все запланированные задания. */
  clear(this:Scheduler):void {for(const job of this.jobs)job.active=false;this.jobs=[];}
  /** Возвращает Task, завершающийся через seconds секунд; отмена задачи удаляет ожидание. */
  wait(this:Scheduler,seconds:number,scope?:Scope):Task<void> {
    const task=new Task<void>();const cancel=this.after(seconds,()=>task.resolve(undefined));
    task.onCancel(cancel);
    if(scope){const release=scope.own(()=>task.cancel());task.onDone(()=>release()).onError(()=>release());}
    return task;
  }
}

/** Явный результат асинхронной операции. Отмена прекращает доставку результата, но не останавливает запрос движка. */
export class Task<T> {
  private state:"pending"|"done"|"failed"|"cancelled"="pending";
  private result:T|undefined;
  private error:unknown;
  private success:((this:void,value:T)=>void)[]=[];
  private failure:((this:void,error:unknown)=>void)[]=[];
  private cancellation:Dispose[]=[];
  /** Текущее состояние: ожидание, успех, ошибка или отмена. */
  get status():"pending"|"done"|"failed"|"cancelled" {return this.state;}
  /** Регистрирует обработчик успеха; для завершённой задачи вызывает его сразу. Возвращает эту задачу. */
  onDone(this:Task<T>,handler:(this:void,value:T)=>void):Task<T> {
    if(this.state==="done")handler(this.result as T);else if(this.state==="pending")this.success.push(handler);
    return this;
  }
  /** Регистрирует обработчик ошибки; для завершившейся с ошибкой задачи вызывает его сразу. */
  onError(this:Task<T>,handler:(this:void,error:unknown)=>void):Task<T> {
    if(this.state==="failed")handler(this.error);else if(this.state==="pending")this.failure.push(handler);
    return this;
  }
  /** Регистрирует обработчик отмены; для отменённой задачи вызывает его сразу. */
  onCancel(this:Task<T>,handler:Dispose):Task<T> {
    if(this.state==="cancelled")handler();else if(this.state==="pending")this.cancellation.push(handler);
    return this;
  }
  /** Завершает ожидающую задачу значением и вызывает обработчики успеха. */
  resolve(this:Task<T>,value:T):void {
    if(this.state!=="pending")return;this.state="done";this.result=value;
    const handlers=this.success;this.success=[];this.failure=[];this.cancellation=[];
    for(const handler of handlers)handler(value);
  }
  /** Завершает ожидающую задачу ошибкой и вызывает обработчики ошибки. */
  reject(this:Task<T>,error:unknown):void {
    if(this.state!=="pending")return;this.state="failed";this.error=error;
    const handlers=this.failure;this.success=[];this.failure=[];this.cancellation=[];
    for(const handler of handlers)handler(error);
  }
  /** Отменяет ожидающую задачу и вызывает обработчики отмены; повторный вызов безопасен. */
  cancel(this:Task<T>):void {
    if(this.state!=="pending")return;this.state="cancelled";
    const handlers=this.cancellation;this.success=[];this.failure=[];this.cancellation=[];
    for(const handler of handlers)handler();
  }
}

/** Контракт проверки, сериализации и миграции сохраняемых данных. */
export interface Schema<T> {
  /** Положительный целый номер текущей версии схемы. */
  readonly version:number;
  /** Проверяет динамические данные и возвращает значение типа T; неверные данные должны вызывать ошибку. */
  decode(this:void,data:unknown):T;
  /** Преобразует значение T в данные, совместимые с сериализатором VC. */
  encode(this:void,data:T):VC.Value;
  /** Преобразует данные старой версии fromVersion в текущую перед проверкой decode. */
  migrate?(this:void,data:unknown,fromVersion:number):unknown;
}
function object(this:void,value:unknown):Record<string,unknown> {
  if(typeof value!=="object" || value===null || Array.isArray(value))throw new Error("object expected");
  return value as Record<string,unknown>;
}
/** Хранилище JSON с проверкой схемы и версий. Неверные и будущие версии вызывают ошибку; значения копируются через схему. */
export class Store<T> {
  /** Текущее изменяемое значение хранилища. */
  value:T;
  /** Создаёт хранилище по пути path; загружает имеющийся файл или использует независимую копию defaults. */
  constructor(private path:string,private schema:Schema<T>,defaults:T) {
    if(!Number.isInteger(schema.version)||schema.version<1)throw new Error("schema version must be positive integer");
    this.value=this.clone(defaults);
    if(file.isfile(path))this.restore(json.parse(file.read(path)));
  }
  private clone(this:Store<T>,value:T):T {return this.schema.decode(json.parse(json.tostring(this.schema.encode(value))));}
  /** Проверяет сохранение, при необходимости мигрирует и заменяет текущее значение его копией. */
  restore(this:Store<T>,envelope:unknown):void {
    const saved=object(envelope),version=saved.version;
    if(typeof version!=="number" || !Number.isInteger(version)||version<1||version>this.schema.version)throw new Error("unsupported save version");
    let data=saved.data;
    if(version!==this.schema.version) {
      if(!this.schema.migrate)throw new Error("save migration required");
      data=this.schema.migrate(data,version);
    }
    const decoded=this.schema.decode(data);this.value=this.clone(decoded);
  }
  /** Возвращает независимые сериализуемые данные вместе с номером версии схемы. */
  snapshot(this:Store<T>):{version:number;data:VC.Value} {return {version:this.schema.version,data:this.schema.encode(this.clone(this.value))};}
  /** Сохраняет текущий снимок данных в JSON-файл по пути хранилища. */
  save(this:Store<T>):void {const text=json.tostring(this.snapshot());file.write(this.path,text);}
}
