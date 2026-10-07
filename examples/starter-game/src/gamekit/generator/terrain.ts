export function create(this:void,_context:VC.GeneratorContext):VC.GeneratorCallbacks {
  return {generate_heightmap:(_x,_z,width,depth)=>{const map=Heightmap(width,depth);map.add(0.25);return map;}};
}
