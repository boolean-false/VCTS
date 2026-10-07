import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as vscode from 'vscode';
import {parse} from 'jsonc-parser';
import {findContent, usesKompot} from './project';

type Change = {action: 'set'; key: string; value: string | string[]; uri: vscode.Uri};
type LuaLSApi = {setConfig(changes: Change[]): Promise<unknown>};

export function contentForFolder(folder: vscode.WorkspaceFolder): string | null {
    const root = folder.uri.fsPath;
    const configured = vscode.workspace.getConfiguration('kompot', folder.uri).get<string>('contentPath', '');
    if (configured) return findContent(path.join(root, '__probe.lua'), configured);
    for (const candidate of [root, path.join(root, 'content')]) {
        if (findContent(path.join(candidate,'__probe.lua'),candidate)) return candidate;
    }
    return findContent(path.join(root, 'modules', '__probe.lua'));
}

function rcValue(root: string, key: string): {present: boolean; value?: unknown} {
    for (const name of ['.luarc.json', '.luarc.jsonc']) {
        try {
            const value = parse(fs.readFileSync(path.join(root, name), 'utf8'));
            if (Object.hasOwn(value, key)) return {present: true, value: value[key]};
            if (Object.hasOwn(value, 'Lua.' + key)) return {present: true, value: value['Lua.' + key]};
        } catch { /* no project configuration */ }
    }
    return {present: false};
}
const strings = (value: unknown): string[] => typeof value === 'string' ? (value.trim() ? [value] : [])
    : Array.isArray(value) ? value.filter(v => typeof v === 'string') : [];
const ends = (value: string, suffix: string) => value.replace(/\\/g, '/').endsWith(suffix);
const quote = (value: string) => '"' + Array.from(Buffer.from(value), b => '\\' + String(b).padStart(3, '0')).join('') + '"';

/** Merge only extension-owned entries; preserve other LuaLS plugins and libraries. */
export async function configureLuaLS(context: vscode.ExtensionContext): Promise<void> {
    if (!vscode.workspace.isTrusted) return;
    const extension = vscode.extensions.getExtension<LuaLSApi>('sumneko.lua');
    if (!extension) return;
    const api = await extension.activate();
    if (typeof api?.setConfig !== 'function') return;
    for (const folder of vscode.workspace.workspaceFolders || []) {
        if (folder.uri.scheme !== 'file') continue;
        const content = contentForFolder(folder);
        const stateKey = 'luals:' + folder.uri.toString();
        const previous = context.workspaceState.get<{plugin: string; library: string; modules?: string}>(stateKey);
        const enabled = !!content || usesKompot(folder.uri.fsPath);
        if (!enabled && !previous) continue;
        const lua = vscode.workspace.getConfiguration('Lua', folder.uri);
        const read = (key: string) => {
            const rc = rcValue(folder.uri.fsPath, key);
            return rc.present ? rc.value : lua.get(key);
        };
        const annotations = content && path.join(content, 'kompot', 'annotations');
        const modulesPath = path.join(context.extensionPath, 'luals', 'kompot', 'library', 'modules');
        const libraryPath = annotations && ['kompot.lua', 'ui.lua'].every(name => fs.existsSync(path.join(annotations, name)))
            ? annotations : path.join(context.extensionPath, 'luals', 'kompot', 'library');
        // Each workspace gets its own resolver, without changing another plugin's arguments.
        const id = crypto.createHash('sha256').update(folder.uri.toString() + '\0' + (content || '') + '\0' + libraryPath).digest('hex').slice(0, 16);
        const pluginPath = path.join(context.globalStorageUri.fsPath, 'resolvers', id, 'kompot.lua');
        if (enabled) {
            const script = `local kompot_content = ${quote(content || '')}\nlocal kompot_library = ${quote(libraryPath)}\nlocal kompot_modules = ${quote(modulesPath)}\n` +
                fs.readFileSync(path.join(context.extensionPath, 'luals/kompot/plugin.lua'), 'utf8');
            fs.mkdirSync(path.dirname(pluginPath), {recursive: true});
            if (!fs.existsSync(pluginPath) || fs.readFileSync(pluginPath, 'utf8') !== script) fs.writeFileSync(pluginPath, script);
        }
        const plugins = strings(read('runtime.plugin'));
        const libraries = strings(read('workspace.library'));
        const isResolver = (value: string) => value.replace(/\\/g, '/').includes('/' + context.extension.id.toLowerCase() + '/resolvers/') && ends(value, '/kompot.lua');
        const nextPlugins = plugins.filter(v => v.trim() && v !== previous?.plugin && v !== pluginPath && !ends(v, '/luals/kompot/plugin.lua') && !isResolver(v));
        const nextLibraries = libraries.filter(v => v.trim() && v !== previous?.library && v !== previous?.modules && v !== modulesPath && v !== libraryPath && !ends(v, '/luals/kompot/library') && !ends(v, '/luals/kompot/library/modules'));
        if (enabled) { nextPlugins.push(pluginPath); nextLibraries.push(libraryPath); if (libraryPath !== path.dirname(modulesPath)) nextLibraries.push(modulesPath); }
        const changes: Change[] = [];
        if (JSON.stringify(plugins) !== JSON.stringify(nextPlugins)) changes.push({action: 'set', key: 'Lua.runtime.plugin', value: nextPlugins, uri: folder.uri});
        if (JSON.stringify(libraries) !== JSON.stringify(nextLibraries)) changes.push({action: 'set', key: 'Lua.workspace.library', value: nextLibraries, uri: folder.uri});
        if (changes.length) {
            // The client starts after extension activation; verify the API actually applied changes.
            let applied = false;
            for (let attempt = 0; attempt < 20; attempt++) {
                await api.setConfig(changes);
                await new Promise(resolve => setTimeout(resolve, 500));
                applied = changes.every(change => JSON.stringify(strings(read(change.key.slice(4)))) === JSON.stringify(change.value));
                if (applied) break;
            }
            if (!applied) throw new Error('LuaLS did not apply Kompot configuration');
        }
        await context.workspaceState.update(stateKey, enabled ? {plugin: pluginPath, library: libraryPath, modules: modulesPath} : undefined);
    }
}
