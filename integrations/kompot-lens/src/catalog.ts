import {findPack} from './project';
// Каталог API: что экспортируют модули Kompot и дизайн-систем. Строится
// интроспекцией (host.lua introspect): имена, параметры, место объявления и
// комментарии над ним. Работает для любой дизайн-системы и своих модулей.
import {parseDoc, Doc, Prop} from './docs';

export type Member = {
    name: string;
    kind: 'function' | 'component' | 'method' | 'table' | 'color' | 'value';
    params: string[];
    vararg: boolean;
    file?: string;
    line?: number;
    doc: Doc;
    value?: string | number | boolean;
    members?: Member[];
};

export type ThemeInfo = {
    name: string;
    colors: Record<string, string>;
    styles: {name: string; font: string; bold?: string}[];
    icons: string;
    ui: Member[];
};

export type ModuleCatalog = {module: string; members: Member[]; theme: ThemeInfo | null; error?: string};

function toMember(raw: any): Member {
    return {
        name: raw.name,
        kind: raw.kind,
        params: raw.params || [],
        vararg: !!raw.vararg,
        file: raw.file,
        line: raw.line,
        doc: parseDoc(raw.doc),
        value: raw.value,
        members: raw.members ? raw.members.map(toMember) : undefined,
    };
}

export function toCatalog(raw: any): ModuleCatalog {
    const members = (raw.members || []).map(toMember);
    if (raw.module === 'kompot:kompot') {
        const row = members.find((m: Member) => m.name === 'Row');
        const column = members.find((m: Member) => m.name === 'Column');
        if (row && column && !column.doc.props.length) {
            column.doc.props = [...row.doc.props];
        }
    }
    const theme = raw.theme ? {
        name: raw.theme.name,
        colors: raw.theme.colors || {},
        styles: raw.theme.styles || [],
        icons: raw.theme.icons || '',
        ui: (raw.theme.ui || []).map(toMember),
    } : null;
    return {module: raw.module, members, theme, error: raw.error};
}

// Общий набор K.ui() (kompot/docs/DESIGN_SYSTEM.md): свойства, если у
// реализации в дизайн-системе нет своей документации.
const CONTRACT: Record<string, string> = {
    Button: 'text, icon, on_click, variant ("primary"|"secondary"|"ghost"|"danger"), enabled, modifier',
    IconButton: 'icon, on_click, selected, enabled, tooltip',
    Checkbox: 'checked, on_change(bool), label, enabled',
    Switch: 'checked, on_change(bool), label',
    Slider: 'value, min, max, steps, on_change(v), format(v)',
    TextField: 'value, on_change, on_submit, label, hint, supporting, error',
    Tabs: 'tabs, selected (индекс), on_select(i)',
    Segmented: 'options, selected (индекс), on_select(i)',
    Panel: 'title, accent, modifier',
    ListItem: 'headline, supporting, icon, trailing (строка или функция), on_click, selected',
    Badge: 'count',
    ProgressBar: 'progress (0..1, nil - бегущая)',
    Tooltip: 'text',
    Dialog: 'visible, on_dismiss, title, text, confirm ({text, on_click, variant}), dismiss ({text, on_click})',
    Menu: 'expanded, on_dismiss, width',
    MenuItem: 'text, icon, shortcut, on_click, enabled',
    Scrollbar: 'state',
    Divider: '',
};

/** Names already described by KompotUiContract in LuaLS. */
export const uiContractNames = new Set(Object.keys(CONTRACT));

/** Компоненты K.ui(): объединение исполнений дизайн-систем + контракт. */
export function uiMembers(themes: ThemeInfo[]): Member[] {
    const by = new Map<string, Member>();
    for (const th of themes) {
        for (const m of th.ui) {
            if (!by.has(m.name)) by.set(m.name, m);
        }
    }
    for (const [name, props] of Object.entries(CONTRACT)) {
        const existing = by.get(name);
        const contract = parseDoc(['Общий набор K.ui(). props: ' + props]);
        if (!existing) {
            by.set(name, {name, kind: 'component', params: ['props'], vararg: false, doc: contract});
        } else if (!existing.doc.props.length) {
            by.set(name, {...existing, doc: {summary: existing.doc.summary || contract.summary, props: contract.props}});
        }
    }
    return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Свойства компонента: из документации; плюс общие key и modifier. */
export function propsOf(member: Member): Prop[] {
    const props = [...member.doc.props];
    for (const extra of ['modifier', 'key']) {
        if (!props.some(p => p.name === extra) && (member.kind === 'component' || props.length)) {
            props.push({name: extra, detail: extra === 'key' ? 'идентичность в списке' : 'модификаторы (применяются первыми)', values: []});
        }
    }
    return props;
}

export function signature(prefix: string, m: Member): string {
    const params = m.params.filter(p => p !== 'self');
    if (m.vararg) params.push('...');
    const sep = m.kind === 'method' ? ':' : '.';
    return `${prefix}${sep}${m.name}(${params.join(', ')})`;
}

/** Документация члена в Markdown. */
export function markdown(prefix: string, m: Member): string {
    const out: string[] = [];
    if (m.kind === 'function' || m.kind === 'component' || m.kind === 'method') {
        out.push('```lua\n' + signature(prefix, m) + '\n```');
    } else if (m.kind === 'color') {
        out.push(`\`${prefix}.${m.name}\` = ${m.value}`);
    } else if (m.kind === 'value') {
        out.push(`\`${prefix}.${m.name}\` = \`${String(m.value)}\``);
    }
    if (m.doc.summary) out.push(m.doc.summary.replace(/\n(?!\n)/g, ' '));
    const props = m.doc.props;
    if (props.length) {
        out.push('**Свойства:**\n\n' + props.map(p => `- \`${p.name}\`${p.detail ? ' - ' + p.detail : ''}`).join('\n'));
    }
    if (m.members && m.kind === 'table') {
        const names = m.members.slice(0, 40).map(x => '`' + x.name + '`').join(', ');
        if (names) out.push(names);
    }
    return out.join('\n\n');
}

/** Кэш каталогов: пересчёт при изменении Lua-файлов каталога content. */
export class Catalogs {
    private cache = new Map<string, Promise<ModuleCatalog>>();

    constructor(private introspect: (content: string, modules: string[], projectFile?: string) => Promise<any>) {}

    get(content: string, module: string, projectFile?: string): Promise<ModuleCatalog> {
        const key = content + '\0' + module + '\0' + (projectFile && findPack(projectFile)?.root || '');
        let p = this.cache.get(key);
        if (!p) {
            p = this.introspect(content, [module], projectFile).then(res => {
                if (!res.ok) return {module, members: [], theme: null, error: res.error};
                return toCatalog(res.catalogs[0]);
            }).catch(e => ({module, members: [], theme: null, error: String(e.message || e)}));
            this.cache.set(key, p);
        }
        return p;
    }

    invalidate(): void {
        this.cache.clear();
    }
}
