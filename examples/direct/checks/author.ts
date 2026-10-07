/// <reference path="../../../sdk/headless.d.ts" />
import {EventBus,Scope,Scheduler,Store} from "../../../sdk/author/core";
import {request} from "../../../sdk/author/network";
const bus=new EventBus<{damage:[target:number,amount:number]}>();
bus.on("damage",(target,amount)=>{},new Scope());
bus.emit("damage",1,10);
// @ts-expect-error payload must match the application contract
bus.emit("damage",1,"ten");
// @ts-expect-error event must be declared
bus.emit("destroy",1);
new Scheduler().wait(1).onDone(()=>{});
request("http://localhost/",{method:"GET"}).onDone(response=>{const status:number=response.status;});
// @ts-expect-error native HTTP header lines are not a dictionary
request("http://localhost/",{method:"GET",headers:{accept:"text/plain"}});
