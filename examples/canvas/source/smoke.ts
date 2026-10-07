declare function assert(this:void, value:unknown,message?:string):void;
export function run(this:void):string[] {
  const cases:string[]=[];
  const check=(v:unknown,n:string):void=>{assert(v,n);cases.push(n);};
  const c=Canvas([4,4]);
  check(c.width===4 && c.height===4 && c.at(0,0)===0,"zero initialization");
  c.set(0,0,1,2,3,4);check(c.at(0,0)===67305985,"RGBA packing");
  c.set(1,0,67305985);check(c.at(1,0)===c.at(0,0),"packed color");
  check(c.at(-1,0)===undefined && c.at(4,0)===undefined,"out of bounds returns nil");
  c.clear(10,20,30);check(c.at(3,3)===4280161290,"clear RGB defaults alpha");
  c.clear();check(c.at(2,2)===0,"clear transparent");
  c.line(0,0,3,0,1,2,3,4);check(c.at(2,0)===67305985,"line pixels");
  c.rect(1,1,2,2,1,2,3,4);check(c.at(1,1)===67305985,"rectangle pixels");
  const other=Canvas([4,4]);other.clear(1,2,3,4);
  c.clear();c.blit(other,0,0);check(c.at(3,3)===67305985,"blit canvas");
  c.add(other);check(c.at(0,0)===134611970,"add canvas");
  c.sub(other);check(c.at(0,0)===67305985,"subtract canvas");
  c.mul(255,255,255,255);check(c.at(0,0)===67305985,"multiply color");
  other.clear(255,255,255,255);c.mul(other);check(c.at(0,0)===67305985,"multiply canvas");
  const decoded=Canvas.decode(c.encode("png"),"png");
  check(decoded.width===4 && decoded.at(2,2)===c.at(2,2),"PNG round trip");
  const tiny=Canvas([1,1]);tiny.set_data([1,2,3,4]);check(tiny.at(0,0)===67305985,"table data");
  const copy=Canvas([1,1]);copy.set_data(tiny.get_data());check(copy.at(0,0)===67305985,"Bytearray data");
  copy.update();copy.unbind_texture();check(copy.at(0,0)===67305985,"unbound update and unbind");
  return cases;
}
