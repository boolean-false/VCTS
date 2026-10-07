/// <reference path="../../../sdk/common.d.ts" />
export {};
const matrix = mat4.idt();
const code = base64.encode([1,2,3]);
// @ts-expect-error world is not registered in generator states
world.is_open();
// @ts-expect-error player is not registered in generator states
player.create("a");
void [matrix,code];
// @ts-expect-error network is not registered in generator states
network.is_available();
