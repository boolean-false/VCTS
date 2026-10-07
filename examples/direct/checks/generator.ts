/// <reference path="../../../sdk/generator.d.ts" />
export {};
const map=Heightmap(4,4);
map.noiseSeed=42;
// @ts-expect-error seed setter has no getter
const seed:number=map.noiseSeed;
// @ts-expect-error generator has no player globals
player.get_pos(1);
// @ts-expect-error generator has no gameplay world
world.is_open();
// @ts-expect-error generator has no network
network.is_available();
// @ts-expect-error fragment world operations are not safe in generator states
generation.create_fragment([0,0,0],[1,1,1]);
const fragment=generation.load_fragment("genprobe:test.vox");
// @ts-expect-error fragment placement is gameplay only
fragment.place([0,0,0]);
// @ts-expect-error userdata operations mutate in place and are not chainable
map.add(1).mul(2);
