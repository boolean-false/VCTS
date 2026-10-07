// Portable Lua 5.4 runner. Runs in a child process, never in the extension host.
import * as fs from 'node:fs';
import * as path from 'node:path';
import {LuaFactory} from 'wasmoon';

async function main() {
    // Emscripten's synchronous stdio must also work with pipes, not only a TTY.
    (process.stdin as any)._handle?.setBlocking(true);
    (process.stdout as any)._handle?.setBlocking(true);
    const [host, ...args] = process.argv.slice(2);
    const factory = new LuaFactory(path.join(__dirname, 'lua.wasm'));
    const wasm = await factory.getLuaModule();
    // TTY emulation waits to fill a read buffer and stalls pipe-based sessions.
    // Forward fd 0 reads directly so a complete input line is delivered immediately.
    const virtualFS = wasm.module.FS as any;
    const read = virtualFS.read.bind(virtualFS);
    virtualFS.read = (stream: any, buffer: Uint8Array, offset: number, length: number, position?: number) =>
        stream.fd === 0 ? fs.readSync(0, buffer, offset, length, null) : read(stream, buffer, offset, length, position);
    const engine = await factory.createEngine({injectObjects: false});
    let nextFile = 0;
    const mounted = new Map<string, string>();
    engine.global.set('__preview_mount', (name: string) => {
        const real = path.resolve(name);
        if (mounted.has(real)) return mounted.get(real);
        try {
            const virtual = `/files/${nextFile++}`;
            factory.mountFileSync(wasm, virtual, fs.readFileSync(real));
            mounted.set(real, virtual);
            return virtual;
        } catch { return undefined; }
    });
    engine.global.set('__preview_args', args);
    engine.global.set('__preview_host', host);
    engine.doStringSync(`
        arg = {[0] = __preview_host}
        for i = 1, #__preview_args do arg[i] = __preview_args[i] end
        local mount = __preview_mount
        __preview_mount, __preview_args, __preview_host = nil, nil, nil
        local original_loadfile, original_open = loadfile, io.open
        function loadfile(filename, mode, env)
            if not filename then return original_loadfile(nil, mode, env) end
            local file = mount(filename)
            if not file then return nil, 'Cannot read file: ' .. filename end
            local f = assert(original_open(file, 'rb'))
            local source = f:read('a'); f:close()
            return load(source, '@' .. filename, mode, env or _ENV)
        end
        function dofile(filename)
            return assert(loadfile(filename))()
        end
        function io.open(filename, mode)
            mode = mode or 'r'
            if mode:sub(1, 1) ~= 'r' then return nil, 'Preview file system is read-only' end
            local file = mount(filename)
            if not file then return nil, 'Cannot read file: ' .. filename end
            return original_open(file, mode)
        end
        assert(loadfile(arg[0]))()
    `);
    engine.global.close();
}
main().catch(error => { console.error(error.message || error); process.exitCode = 1; });
