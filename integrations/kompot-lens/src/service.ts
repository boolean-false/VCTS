// Языковой сервис Kompot без зависимости от VS Code: дополнение, наведение,
// параметры, переход к определению. Работает поверх каталогов API
// (интроспекция модулей) и разбора контекста под курсором.
import * as path from 'node:path';
import {analyze, parseAliases, callAt, wordAt, Aliases} from './lua-context';
import {Catalogs, ModuleCatalog, Member, ThemeInfo, uiMembers, uiContractNames, propsOf, markdown, signature} from './catalog';
import {findContent, moduleName, listModules, listTextures, listImageSources, findEngineRes} from './project';
import {Prop} from './docs';

export type ItemKind = 'component' | 'function' | 'method' | 'table' | 'color' | 'value' | 'property' | 'enum' | 'module' | 'icon' | 'style';

export type Item = {
    label: string;
    kind: ItemKind;
    detail?: string;
    doc?: string;
    insert?: string;       // сниппет VS Code
    color?: string;        // #RRGGBBAA для образца цвета
    image?: string;        // файл картинки для документации
    sort?: string;
    filter?: string;
    preselect?: boolean;
};

export type Env = {
    content: string;
    file: string;
    aliases: Aliases;
    modules: Map<string, ModuleCatalog>; // псевдоним -> каталог
    kompot: ModuleCatalog | null;
    modifier: ModuleCatalog | null;
    themes: ThemeInfo[];
};

const KOMPOT = 'kompot:kompot';
const MODIFIER = 'kompot:kompot/core/modifier';

export class Service {
    constructor(private catalogs: Catalogs, private settings: (file?: string) => {contentPath?: string; enginePath?: string} = () => ({}),
        private luaLSTypes = false) {}

    async env(file: string, text: string, offset = text.length): Promise<Env | null> {
        const content = findContent(file, this.settings(file).contentPath);
        if (!content) return null;
        const aliases = parseAliases(text.slice(0, offset));
        const own = moduleName(file, content);
        const modules = new Map<string, ModuleCatalog>();
        const wanted = new Set<string>(Object.values(aliases.modules));
        wanted.add(KOMPOT);
        wanted.add(MODIFIER);
        if (own) wanted.delete(own);
        const loaded = new Map<string, ModuleCatalog>();
        await Promise.all([...wanted].map(async m => loaded.set(m, await this.catalogs.get(content, m, file))));
        for (const [alias, m] of Object.entries(aliases.modules)) {
            const c = loaded.get(m);
            if (c) modules.set(alias, c);
        }
        const themes: ThemeInfo[] = [];
        for (const c of modules.values()) {
            if (c.theme && c.module !== KOMPOT) themes.push(c.theme);
        }
        const kompot = loaded.get(KOMPOT) || null;
        if (!themes.length && kompot?.theme) themes.push(kompot.theme);
        return {content, file, aliases, modules, kompot, modifier: loaded.get(MODIFIER) || null, themes};
    }

    // --- разрешение имён ---------------------------------------------------

    private membersOf(env: Env, parts: string[]): {prefix: string; members: Member[]} | null {
        const [root, ...rest] = parts.map(p => p.replace(/\(\)$/, ''));
        if (env.aliases.ui.includes(root) && !rest.length) return {prefix: root, members: uiMembers(env.themes)};
        const cat = env.modules.get(root);
        if (!cat) return null;
        let members = cat.members;
        let prefix = root;
        for (const part of rest) {
            // K.M.<...> - модификаторы
            if ((part === 'M' || part === 'Modifier') && cat.module === KOMPOT && env.modifier) {
                members = env.modifier.members;
                prefix += '.' + part;
                continue;
            }
            const m = members.find(x => x.name === part);
            if (!m || !m.members) return null;
            members = m.members;
            prefix += '.' + part;
        }
        return {prefix, members};
    }

    private resolveCallee(env: Env, callee: string): {prefix: string; member: Member} | null {
        if (callee.includes(':')) {
            const root = callee.split(':')[0];
            if (root && !this.isModifierRoot(env, root)) return null;
            const name = callee.split(':').pop()!;
            const m = env.modifier?.members.find(x => x.name === name);
            return m ? {prefix: 'M', member: m} : null;
        }
        const parts = callee.split('.');
        const name = parts.pop()!;
        const scope = this.membersOf(env, parts);
        const m = scope?.members.find(x => x.name === name);
        return m && scope ? {prefix: scope.prefix, member: m} : null;
    }

    private isModifierRoot(env: Env, root: string): boolean {
        if (env.aliases.modifiers.includes(root) || root === 'props.modifier') return true;
        const [alias, member] = root.split('.');
        return (member === 'M' || member === 'Modifier') && env.modules.get(alias)?.module === KOMPOT;
    }

    private isModifierContext(env: Env, root: string | null, path?: string, previous?: string | null): boolean {
        return (!!path && this.isModifierRoot(env, path)) || (!!root && this.isModifierRoot(env, root)) ||
            (root === '()' && !!previous && !!env.modifier?.members.some(m => m.name === previous));
    }

    private isColors(env: Env, parts: string[]): boolean {
        const clean = parts.map(p => p.replace(/\(\)$/, ''));
        const last = clean[clean.length - 1];
        if (last !== 'colors' && !env.aliases.colors.includes(last)) return false;
        if (clean.length === 1) return env.aliases.colors.includes(last);
        if (clean.length === 2) return clean[1] === 'colors' && env.aliases.themes.includes(clean[0]);
        const catalog = env.modules.get(clean[0]);
        return clean.length === 3 && clean[2] === 'colors' &&
            ((clean[1] === 'theme' && (catalog?.module === KOMPOT || !!catalog?.theme)) ||
                (clean[1] === 'BASE_THEME' && catalog?.module === KOMPOT));
    }

    private colorThemes(env: Env, parts: string[]): ThemeInfo[] {
        const clean = parts.map(p => p.replace(/\(\)$/, ''));
        if (clean.length === 3 && clean[2] === 'colors') {
            const catalog = env.modules.get(clean[0]);
            if (clean[1] === 'BASE_THEME' && catalog?.module === KOMPOT && catalog.theme) return [catalog.theme];
            if (clean[1] === 'theme' && catalog?.module !== KOMPOT && catalog?.theme) return [catalog.theme];
        }
        return env.themes;
    }

    private colorItems(env: Env, themes: ThemeInfo[] = env.themes): Item[] {
        const colors = new Map<string, string>();
        for (const th of themes) {
            for (const [k, v] of Object.entries(th.colors)) if (!colors.has(k)) colors.set(k, v);
        }
        return [...colors].sort().map(([k, v]) => ({label: k, kind: 'color' as ItemKind, detail: v, color: v, doc: `Роль цвета темы: \`${v}\``}));
    }

    private memberItem(prefix: string, m: Member, kompot = false): Item {
        const kind: ItemKind = m.kind === 'component' ? 'component' : m.kind === 'function' ? 'function'
            : m.kind === 'method' ? 'method' : m.kind === 'table' ? 'table' : m.kind === 'color' ? 'color' : 'value';
        const item: Item = {label: m.name, kind, doc: markdown(prefix, m)};
        if (kompot && m.kind === 'function' && ['Box', 'Row', 'Column', 'FlowRow'].includes(m.name)) {
            item.detail = 'контейнер с дочерними элементами';
            item.insert = `${m.name}({$1}, function()\n\t$0\nend)`;
            return item;
        }
        if (m.kind === 'component' || (m.kind === 'function' && m.doc.props.length && /^[A-Z]/.test(m.name))) {
            item.detail = 'компонент';
            item.insert = `${m.name}({$1})$0`;
        } else if (m.kind === 'function' || m.kind === 'method') {
            item.detail = signature(prefix, m);
            const params = m.params.filter(p => p !== 'self');
            item.insert = `${m.name}(${params.map((p, i) => `\${${i + 1}:${p}}`).join(', ')})$0`;
        } else if (m.kind === 'color') {
            item.color = String(m.value);
            item.detail = String(m.value);
        } else if (m.kind === 'value') {
            item.detail = String(m.value);
        }
        return item;
    }

    // --- дополнение ------------------------------------------------------------

    async complete(file: string, text: string, offset: number): Promise<Item[]> {
        const before = text.slice(0, offset);
        const ctx = analyze(before);
        if (ctx.kind === 'none') return [];
        // require "..." работает и без Kompot в файле
        if (ctx.kind === 'string-arg' && ctx.callee === 'require') {
            const content = findContent(file, this.settings(file).contentPath);
            return content ? listModules(content).map(m => ({label: m, kind: 'module' as ItemKind})) : [];
        }
        const env = await this.env(file, text, offset);
        if (!env) return [];

        if (ctx.kind === 'member') {
            if (this.isColors(env, ctx.path)) return this.colorItems(env, this.colorThemes(env, ctx.path));
            const scope = this.membersOf(env, ctx.path);
            if (!scope) return [];
            if (this.luaLSTypes && ctx.path.length === 1 && env.aliases.ui.includes(ctx.path[0])) {
                return scope.members.filter(m => !uiContractNames.has(m.name))
                    .map(m => this.memberItem(scope.prefix, m));
            }
            const catalog = env.modules.get(ctx.path[0]);
            if (this.luaLSTypes && catalog?.module === KOMPOT) {
                if (ctx.path.length !== 1) return [];
                return scope.members.filter(m => ['Box', 'Row', 'Column', 'FlowRow'].includes(m.name))
                    .map(m => ({...this.memberItem(scope.prefix, m, true), label: `${m.name} (блок)`}));
            }
            if (this.luaLSTypes && catalog?.module === 'kompot:ui' && ctx.path.length === 1) return [];
            return scope.members.map(m => this.memberItem(scope.prefix, m,
                catalog?.module === KOMPOT));
        }
        if (ctx.kind === 'method') {
            if (this.luaLSTypes) return [];
            if (!this.isModifierContext(env, ctx.root, ctx.path, ctx.previous) || !env.modifier) return [];
            return env.modifier.members.filter(m => m.kind === 'method').map(m => this.memberItem('M', m));
        }
        if (ctx.kind === 'prop') {
            const r = this.resolveCallee(env, ctx.callee);
            if (!r) return [];
            if (this.luaLSTypes && (['kompot:kompot', 'kompot:ui'].includes(env.modules.get(r.prefix)?.module || '') ||
                (env.aliases.ui.includes(r.prefix) && uiContractNames.has(r.member.name)))) return [];
            const kompotAlias = [...env.modules].find(([, c]) => c.module === KOMPOT)?.[0];
            const modAlias = env.aliases.modifiers[0] || (kompotAlias ? kompotAlias + '.M' : '');
            return propsOf(r.member).filter(p => !ctx.present.includes(p.name)).map(p => propItem(p, modAlias));
        }
        if (ctx.kind === 'value') {
            return this.valueItems(env, ctx.callee, ctx.prop, true);
        }
        if (ctx.kind === 'value-expr') {
            return this.valueItems(env, ctx.callee, ctx.prop, false);
        }
        if (ctx.kind === 'string-arg') {
            if (ctx.index === 0 && this.resolveCallee(env, ctx.callee)?.member.name === 'Icon') return this.iconItems(env);
            if (ctx.index === 0 && ['Image', 'nine_patch'].includes(this.resolveCallee(env, ctx.callee)?.member.name || ''))
                return this.imageItems(env, true);
            return [];
        }
        return [];
    }

    private valueItems(env: Env, callee: string | null, prop: string, quoted: boolean): Item[] {
        const resolved = callee && this.resolveCallee(env, callee);
        const root = callee?.split('.')[0] || '';
        const catalog = env.modules.get(root);
        const property = resolved && propsOf(resolved.member).find(p => p.name === prop);
        // Kompot UI now documents properties through LuaLS annotations rather than
        // source comments. Keep project-specific icon and texture suggestions here.
        if (resolved && (catalog?.module === 'kompot:ui' || env.aliases.ui.includes(root))) {
            if (/(^|_)icon$/.test(prop)) return this.iconItems(env).map(i => ({...i, insert: quoted ? i.label : `"${i.label}"`}));
            if (prop === 'src') return this.imageItems(env, quoted);
            if (!quoted && prop === 'variant' && resolved.member.name === 'Button') {
                return ['default', 'primary', 'secondary', 'danger', 'ghost', 'toggle'].map((value, i) => ({
                    label: value, kind: 'enum' as ItemKind, insert: `"${value}"`, sort: String(i).padStart(3, '0'),
                }));
            }
        }
        if (!property) return [];
        if (property.values.length) {
            return property.values.map((v, i) => ({label: v, kind: 'enum' as ItemKind,
                detail: `${prop} = "${v}"`, insert: quoted ? v : `"${v}"`, sort: String(i).padStart(3, '0')}));
        }
        const theme = catalog?.module === KOMPOT ? null : catalog?.theme;
        const themes = theme ? [theme] : env.themes;
        if (prop === 'style') {
            const seen = new Set<string>();
            const out: Item[] = [];
            for (const th of themes) {
                for (const st of th.styles) {
                    if (seen.has(st.name)) continue;
                    seen.add(st.name);
                    out.push({label: st.name, kind: 'style', detail: st.font, insert: quoted ? st.name : `"${st.name}"`,
                        doc: `Стиль текста темы «${th.name}»: шрифт \`${st.font}\`${st.bold ? `, жирный \`${st.bold}\`` : ''}`});
                }
            }
            return out;
        }
        if (/icon$/.test(prop)) return this.iconItems(env).map(i => ({...i, insert: quoted ? i.label : `"${i.label}"`}));
        if (prop === 'src') return this.imageItems(env, quoted);
        if (!quoted) {
            if (prop === 'modifier') {
                const kompotAlias = [...env.modules].find(([, c]) => c.module === KOMPOT)?.[0];
                const alias = env.aliases.modifiers[0] || (kompotAlias ? kompotAlias + '.M' : '');
                return alias ? [{label: alias + ':', kind: 'value', detail: 'цепочка модификаторов',
                    insert: alias + ':', filter: alias, sort: '0', preselect: true}] : [];
            }
            if (prop === 'accent' || /(^|_)color$/.test(prop)) {
                const alias = [...env.modules].find(([, c]) => c.module === KOMPOT)?.[0];
                if (!alias) return [];
                return this.colorItems(env, themes).map(i => ({...i, insert: `${alias}.theme().colors.${i.label}`}));
            }
            if (['enabled', 'selected', 'checked', 'visible', 'expanded', 'interactive', 'wrap', 'fill_cross', 'propagate_min'].includes(prop)) {
                return ['true', 'false'].map(v => ({label: v, kind: 'value' as ItemKind, insert: v}));
            }
        }
        return [];
    }

    private iconItems(env: Env): Item[] {
        const atlases = new Set(env.themes.map(t => t.icons).filter(Boolean));
        const out: Item[] = [];
        for (const atlas of atlases) {
            for (const t of listTextures(atlas, env.content)) {
                out.push({label: t.name, kind: 'icon', detail: `${atlas}:${t.name}`, image: t.file});
            }
        }
        return out;
    }

    private imageItems(env: Env, quoted: boolean): Item[] {
        return listImageSources(env.content, findEngineRes(env.content, this.settings(env.file).enginePath)).map(t => ({
            label: t.name, kind: 'icon', detail: 'изображение', image: t.file,
            insert: quoted ? t.name : `"${t.name}"`,
        }));
    }

    // --- наведение, параметры, определение -------------------------------------

    private async memberAt(file: string, text: string, offset: number): Promise<{env: Env; prefix: string; member: Member} | null> {
        const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
        const lineEnd = text.indexOf('\n', offset);
        const line = text.slice(lineStart, lineEnd < 0 ? text.length : lineEnd);
        const w = wordAt(line, offset - lineStart);
        if (!w || !/[.:]/.test(w.expr)) return null;
        const env = await this.env(file, text, offset);
        if (!env) return null;
        if (w.expr.startsWith(':')) {
            const colon = line.lastIndexOf(':', offset - lineStart);
            const context = colon >= 0 ? analyze(line.slice(0, colon + 1)) : null;
            if (context?.kind !== 'method' ||
                !this.isModifierContext(env, context.root, context.path, context.previous)) return null;
        }
        const r = this.resolveCallee(env, w.expr);
        return r ? {env, ...r} : null;
    }

    private hasLuaLSTypedMember(env: Env, prefix: string, member: Member): boolean {
        if (!this.luaLSTypes) return false;
        if (prefix === 'M') return true;
        if (env.aliases.ui.includes(prefix)) return uiContractNames.has(member.name);
        const [root, nested] = prefix.split('.');
        const module = env.modules.get(root)?.module;
        return (module === KOMPOT || module === 'kompot:ui') &&
            (!nested || (module === KOMPOT && (nested === 'M' || nested === 'Modifier')));
    }

    async hover(file: string, text: string, offset: number): Promise<string | null> {
        const r = await this.memberAt(file, text, offset);
        if (!r || this.hasLuaLSTypedMember(r.env, r.prefix, r.member)) return null;
        let md = markdown(r.prefix, r.member);
        if (r.member.file) md += `\n\n*${path.basename(r.member.file)}:${r.member.line}*`;
        return md;
    }

    async definition(file: string, text: string, offset: number): Promise<{file: string; line: number} | null> {
        const r = await this.memberAt(file, text, offset);
        return r && r.member.file && r.member.line ? {file: r.member.file, line: r.member.line} : null;
    }

    async signature(file: string, text: string, offset: number): Promise<{label: string; params: string[]; active: number; doc: string} | null> {
        const call = callAt(text.slice(0, offset));
        if (!call) return null;
        const env = await this.env(file, text, offset);
        if (!env) return null;
        const r = this.resolveCallee(env, call.callee);
        if (!r || !['function', 'component', 'method'].includes(r.member.kind)) return null;
        if (this.hasLuaLSTypedMember(env, r.prefix, r.member)) return null;
        const params = r.member.params.filter(p => p !== 'self');
        return {label: signature(r.prefix, r.member), params, active: Math.min(call.index, Math.max(0, params.length - 1)),
            doc: r.member.doc.summary};
    }
}

function propItem(p: Prop, modAlias: string): Item {
    let insert: string;
    if (p.values.length) {
        insert = `${p.name} = "\${1|${p.values.map(v => v.replace(/[,|]/g, '')).join(',')}|}"`;
    } else if (/^on_/.test(p.name)) {
        const args = /\(([^)]*)\)/.exec(p.detail)?.[1] || '';
        insert = `${p.name} = function(${args.replace(/[^\w, ]/g, '')})\n\t$0\nend`;
    } else if (p.name === 'modifier') {
        insert = modAlias ? `modifier = ${modAlias}:$0` : 'modifier = $0';
    } else if (p.name === 'style' || p.name === 'text' || p.name === 'title' || p.name === 'label' || /icon$/.test(p.name)) {
        insert = `${p.name} = "$1"`;
    } else {
        insert = `${p.name} = $0`;
    }
    return {label: p.name, kind: 'property', detail: p.detail || undefined, insert,
        doc: p.detail ? `\`${p.name}\` - ${p.detail}` : undefined};
}
