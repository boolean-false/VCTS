// Где лежат паки и ресурсы: каталог content (рядом пак kompot), имя модуля
// файла ("pack:path"), ресурсы движка (res) для текстур блоков.
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Каталог content: ближайший предок, в котором есть пак kompot. */
export function findContent(file: string, configured = ''): string | null {
    if (configured) {
        const directory = path.resolve(configured);
        return isKompotPack(directory) ? directory : null;
    }
    let dir = path.dirname(file);
    for (let i = 0; i < 12; i++) {
        if (isKompotPack(dir)) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return null;
}

function isKompotPack(directory:string):boolean {
    try { const pkg=JSON.parse(fs.readFileSync(path.join(directory,'kompot','package.json'),'utf8'));return pkg.id==='kompot'; }catch{return false;}
}

/** <content>/<pack>/modules/<path>.lua -> "pack:path". */
export function moduleName(file: string, content: string): string | null {
    const rel = path.relative(content, file).split(path.sep).join('/');
    const m = /^([\w-]+)\/modules\/(.+)\.lua$/.exec(rel);
    if (m) return `${m[1]}:${m[2]}`;
    const pack = findPack(file);
    const relative = pack && path.relative(path.join(pack.root, 'modules'), file).split(path.sep).join('/');
    return relative && !relative.startsWith('../') && !path.isAbsolute(relative) && relative.endsWith('.lua')
        ? `${pack!.id}:${relative.slice(0, -4)}` : null;
}

/** Все модули паков каталога (для дополнения require). */
export function listModules(content: string): string[] {
    const out: string[] = [];
    let packs: string[] = [];
    try { packs = fs.readdirSync(content); } catch { return out; }
    for (const pack of packs) {
        const root = path.join(content, pack, 'modules');
        const walk = (dir: string, prefix: string) => {
            let entries: fs.Dirent[] = [];
            try { entries = fs.readdirSync(dir, {withFileTypes: true}); } catch { return; }
            for (const e of entries) {
                if (e.isDirectory()) walk(path.join(dir, e.name), prefix + e.name + '/');
                else if (e.name.endsWith('.lua')) out.push(`${pack}:${prefix}${e.name.slice(0, -4)}`);
            }
        };
        walk(root, '');
    }
    return out.sort();
}

/** Папка res движка: настройка, иначе по latest.log игры рядом с content. */
export function findEngineRes(content: string, configured = ''): string | null {
    const candidates: string[] = [];
    if (configured) candidates.push(configured, path.join(configured, 'res'), path.join(configured, 'usr/share/VoxelCore/res'));
    try {
        const log = fs.readFileSync(path.join(path.dirname(content), 'latest.log'), 'utf8');
        const m = /executable path: (.+)/.exec(log);
        if (m) {
            const root = path.dirname(path.dirname(path.dirname(m[1].trim())));
            candidates.push(path.join(root, 'usr/share/VoxelCore/res'), path.join(root, 'res'));
        }
    } catch { /* нет журнала игры */ }
    return candidates.find(c => fs.existsSync(path.join(c, 'content', 'base'))) || null;
}

/** Файл атласа "атлас:имя" или текстуры "путь/к/текстуре". */
export function findTexture(src: string, content: string, res: string | null): string | null {
    const i = src.indexOf(':');
    const segments = (i < 0 ? src : src.slice(0, i) + '/' + src.slice(i + 1)).split('/');
    if (!segments.length || segments.some(s => !s || s === '.' || s === '..' || !/^[\w.-]+$/.test(s))) return null;
    const relative = path.join('textures', ...segments) + '.png';
    const roots = [content];
    if (res) roots.push(path.join(res, 'content'));
    for (const root of roots) {
        let packs: string[] = [];
        try { packs = fs.readdirSync(root); } catch { continue; }
        for (const pack of packs) {
            const file = path.join(root, pack, relative);
            if (fs.existsSync(file)) return file;
        }
    }
    if (res) {
        const file = path.join(res, relative);
        if (fs.existsSync(file)) return file;
    }
    return null;
}

/** Источники для K.Image: записи атласов и обычные пути к PNG. */
export function listImageSources(content: string, res: string | null): {name: string; file: string}[] {
    const out = new Map<string, string>();
    const roots = [content, ...(res ? [path.join(res, 'content')] : [])];
    const walk = (dir: string, prefix = '') => {
        let entries: fs.Dirent[] = [];
        try { entries = fs.readdirSync(dir, {withFileTypes: true}); } catch { return; }
        for (const e of entries) {
            if (e.isDirectory()) walk(path.join(dir, e.name), prefix + e.name + '/');
            else if (e.isFile() && e.name.endsWith('.png')) {
                const name = prefix + e.name.slice(0, -4);
                if (!out.has(name)) out.set(name, path.join(dir, e.name));
                const slash = name.indexOf('/');
                if (slash > 0 && !out.has(name.slice(0, slash) + ':' + name.slice(slash + 1)))
                    out.set(name.slice(0, slash) + ':' + name.slice(slash + 1), path.join(dir, e.name));
            }
        }
    };
    for (const root of roots) {
        let packs: string[] = [];
        try { packs = fs.readdirSync(root); } catch { continue; }
        for (const pack of packs) walk(path.join(root, pack, 'textures'));
    }
    if (res) walk(path.join(res, 'textures'));
    return [...out].map(([name, file]) => ({name, file})).sort((a, b) => a.name.localeCompare(b.name));
}

/** Имена картинок атласа (иконки для дополнения). */
export function listTextures(atlas: string, content: string): {name: string; file: string}[] {
    const out: {name: string; file: string}[] = [];
    let packs: string[] = [];
    try { packs = fs.readdirSync(content); } catch { return out; }
    for (const pack of packs) {
        const dir = path.join(content, pack, 'textures', atlas);
        let files: string[] = [];
        try { files = fs.readdirSync(dir); } catch { continue; }
        for (const f of files) {
            if (f.endsWith('.png')) out.push({name: f.slice(0, -4), file: path.join(dir, f)});
        }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Package containing a module; the manifest id is the require namespace. */
export function findPack(file: string): {root: string; id: string} | null {
    let dir = path.dirname(file);
    for (let i = 0; i < 12; i++) {
        try {
            const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
            if (typeof manifest.id === 'string' && /^[\w-]+$/.test(manifest.id)) return {root: dir, id: manifest.id};
        } catch { /* ascend */ }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return null;
}

/** Supports a pack, content directory or game/project workspace. */
export function usesKompot(root: string, depth = 3): boolean {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
        if (pkg.id === 'kompot' || Array.isArray(pkg.dependencies) && pkg.dependencies.includes('kompot')) return true;
    } catch { /* folder without a package */ }
    if (!depth) return false;
    try {
        return fs.readdirSync(root, {withFileTypes: true}).some(entry =>
            entry.isDirectory() && !entry.name.startsWith('.') &&
            !['node_modules', 'modules', 'textures', 'fonts', 'docs', 'out', 'dist'].includes(entry.name) &&
            usesKompot(path.join(root, entry.name), depth - 1));
    } catch { return false; }
}
