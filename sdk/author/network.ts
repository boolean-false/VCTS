import {Scope,Task} from "./core";
/** Отправляет HTTP-запрос и возвращает Task ответа. Завершение scope отменяет доставку результата; сам запрос движка продолжается. */
export function request(this:void,url:string,options:Omit<VC.HttpRequest,"on_response">,scope?:Scope):Task<VC.HttpResponse> {
  const task=new Task<VC.HttpResponse>();
  if(scope){const release=scope.own(()=>task.cancel());task.onDone(()=>release()).onError(()=>release());}
  if(task.status==="pending") {
    try {network.request(url,{...options,on_response:response=>task.resolve(response)});}catch(error){task.reject(error);}
  }
  return task;
}
