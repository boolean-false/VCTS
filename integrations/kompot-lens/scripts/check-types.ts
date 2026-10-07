import * as fs from 'node:fs';
import * as path from 'node:path';

const root = path.resolve(__dirname, '../..');
const pack = path.resolve(root, '../kompot/pack/annotations');
if (fs.existsSync(pack)) {
    for (const name of ['kompot.lua', 'ui.lua']) {
        const bundled = fs.readFileSync(path.join(root, 'luals/kompot/library', name));
        const project = fs.readFileSync(path.join(pack, name));
        if (!bundled.equals(project)) throw new Error(`${name}: bundled LuaLS types differ from Kompot pack annotations`);
    }
}
