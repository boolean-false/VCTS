export function create(this: void, context: VC.GeneratorContext): VC.GeneratorCallbacks {
  assert(context.seed === 42,"generator seed context");
  assert(context.dir.includes("genprobe:generators/typed.files"),"generator directory context");
  assert(context.file.endsWith("script.lua"),"generator file context");
  const stone = block.index("base:stone");
  return {
    generate_biome_parameters: (x,y,w,h,bpd) => {
      assert(bpd>0,"biome callback dot ABI");
      const first=Heightmap(w,h), second=Heightmap(w,h);
      first.add(0.25); second.add(0.75);
      return $multi(first,second);
    },
    generate_heightmap: (x,y,w,h,bpd,inputs) => {
      assert(inputs?.length===2 && inputs[0]?.at(0,0)===0.25 && inputs[1]?.at(0,0)===0.75,"biome multi-return/input order");
      // Ensure a TSTL helper is required inside the isolated generator state.
      const values=[0.125,0.125];
      const map=Heightmap(w,h);
      for(const value of values.map(v=>v)) map.add(value);
      return map;
    },
    place_structures: (x,z,w,d,heights,chunkHeight) => {
      assert(heights.width===w && heights.height===d && chunkHeight>100,"structure callback ABI");
      return x===0 && z===0 ? [[":block",stone,[2,100,2],0,3]] : [];
    },
    place_structures_wide: (x,z,w,d,chunkHeight) => [] ,
  };
}
