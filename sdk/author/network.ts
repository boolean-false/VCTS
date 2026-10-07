import {Scope,Task} from "./core";
/** VC does not expose native cancellation; disposal suppresses result delivery. */
export function request(this:void,url:string,options:Omit<VC.HttpRequest,"on_response">,scope?:Scope):Task<VC.HttpResponse> {
  const task=new Task<VC.HttpResponse>();
  if(scope){const release=scope.own(()=>task.cancel());task.onDone(()=>release()).onError(()=>release());}
  if(task.status==="pending") {
    try {network.request(url,{...options,on_response:response=>task.resolve(response)});}catch(error){task.reject(error);}
  }
  return task;
}
