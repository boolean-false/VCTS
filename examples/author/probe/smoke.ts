declare function assert(this:void,value:unknown,message?:string):void;
import {Scope,Scheduler,EventBus,Store,Task,Schema} from "../../../sdk/author/core";
export function run(this:void):string[] {
  const cases:string[]=[];
  const check=(v:unknown,n:string):void=>{assert(v,n);cases.push(n);};
  const scope=new Scope(),order:number[]=[];
  const once=scope.own(()=>order.push(1));scope.own(()=>order.push(2));once();once();scope.dispose();scope.dispose();
  check(order.join(",")==="1,2" && scope.disposed,"scope idempotent individual disposal");
  scope.own(()=>order.push(3));check(order.join(",")==="1,2,3","late cleanup executes immediately");
  const failureScope=new Scope();failureScope.own(()=>order.push(4));failureScope.own(()=>{throw new Error("cleanup");});
  let failed=false;try{failureScope.dispose();}catch{failed=true;}
  check(failed&&order[3]===4&&failureScope.disposed,"cleanup errors still dispose remaining resources");
  const bus=new EventBus<{changed:[value:number]}>(),listeners=new Scope(),received:number[]=[];
  let removeSecond=():void=>{};
  bus.on("changed",v=>{received.push(v);removeSecond();bus.on("changed",n=>received.push(n+10),listeners);},listeners);
  removeSecond=bus.on("changed",v=>received.push(v+100),listeners);
  bus.emit("changed",1);check(received.join(",")==="1","event removal/addition during dispatch");
  bus.emit("changed",2);check(received.join(",")==="1,2,12","event snapshot dispatch");
  listeners.dispose();bus.emit("changed",3);check(received.length===3,"scoped event disconnect");
  const clock=new Scheduler(),timers=new Scope();let fired=0;
  clock.after(1,()=>{fired++;clock.after(0,()=>fired++);},timers);
  clock.tick(0.5);check(fired===0,"timer waits for deadline");
  clock.tick(0.5);check(fired===1,"new timers wait until next tick");
  clock.tick(0);check(fired===2,"zero delay scheduled during callback");
  clock.every(0.5,()=>fired++,timers);clock.tick(10);check(fired===3,"interval coalesces missed deadlines");
  timers.dispose();clock.tick(10);check(fired===3,"scope cancels intervals");
  let done=0;const wait=clock.wait(1);wait.onDone(()=>done++);clock.tick(1);wait.onDone(()=>done++);
  check(wait.status==="done" && done===2,"task completion and late delivery");
  const cancelledScope=new Scope(),cancelled=clock.wait(1,cancelledScope);cancelled.onDone(()=>done++);cancelledScope.dispose();clock.tick(1);
  check(cancelled.status==="cancelled" && done===2,"scope cancellation suppresses task delivery");
  const task=new Task<number>();let error:unknown;task.onError(e=>{error=e;});task.reject("expected");task.resolve(42);
  check(task.status==="failed" && error==="expected","task rejection is terminal");
  type State={count:number};
  const schema:Schema<State>={version:2,decode:data=>{
    if(typeof data!=="object"||data===null||!("count" in data)||typeof data.count!=="number")throw new Error("count expected");return {count:data.count};
  },encode:data=>({count:data.count}),migrate:(data,version)=>{
    if(version!==1||typeof data!=="number")throw new Error("cannot migrate");return {count:data};
  }};
  const defaults={count:1},store=new Store("world:author-state.json",schema,defaults);store.value.count=2;
  check(defaults.count===1,"store owns default state");
  const snapshot=store.snapshot();(snapshot.data as {count:number}).count=9;check(store.value.count===2,"snapshot detached from live state");
  store.restore({version:1,data:7});check(store.value.count===7,"versioned state migration");
  let future=false;try{store.restore({version:3,data:{count:100}});}catch{future=true;}
  check(future&&store.value.count===7,"future save rejected without mutation");
  let invalid=false;try{store.restore({version:2,data:{count:"wrong"}});}catch{invalid=true;}
  check(invalid&&store.value.count===7,"invalid save rejected without mutation");
  store.save();const loaded=new Store("world:author-state.json",schema,defaults);check(loaded.value.count===7,"native save/load validated state");
  return cases;
}
