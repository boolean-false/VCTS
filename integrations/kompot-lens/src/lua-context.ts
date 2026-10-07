// Контекст Lua-кода под курсором для автодополнения Kompot.
//
// Текст до курсора разбирается небольшим лексером (строки, комментарии,
// скобки), и определяется, что сейчас пишут:
//   CT.Bu|                -> член модуля   {kind: 'member', path: ['CT'], partial: 'Bu'}
//   M:padding(8):ba|      -> метод цепочки {kind: 'method', root: 'M', previous: 'padding'}
//   CT.Button({te|        -> свойство      {kind: 'prop', callee: 'CT.Button'}
//   CT.Button({variant = "|  -> значение  {kind: 'value', callee: 'CT.Button', prop: 'variant'}
//   K.Icon("|             -> строка-аргумент {kind: 'string-arg', callee: 'K.Icon', index: 0}

export type Token = {type: 'name' | 'string' | 'number' | 'op'; value: string; start: number; end: number; closed?: boolean};

export type LuaContext =
    | {kind: 'member'; path: string[]; partial: string}
    | {kind: 'method'; root: string | null; previous: string | null; partial: string; path?: string}
    | {kind: 'prop'; callee: string; present: string[]; partial: string}
    | {kind: 'value'; callee: string | null; prop: string; partial: string}
    | {kind: 'value-expr'; callee: string | null; prop: string; partial: string}
    | {kind: 'string-arg'; callee: string; index: number; partial: string}
    | {kind: 'none'};

const NAME = /[A-Za-z_][A-Za-z0-9_]*/y;
const NUMBER = /(?:0[xX][0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)/y;
const OPS = ['...', '..', '==', '~=', '<=', '>=', '::', '//', '<<', '>>'];

/** Лексер Lua: комментарии пропускаются, незакрытая строка в конце помечается closed = false. */
export function tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const n = text.length;
    while (i < n) {
        const c = text[i];
        if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue; }
        if (c === '-' && text[i + 1] === '-') {
            const long = /^--\[(=*)\[/.exec(text.slice(i, i + 20));
            if (long) {
                const close = ']' + long[1] + ']';
                const e = text.indexOf(close, i + long[0].length);
                i = e < 0 ? n : e + close.length;
            } else {
                const e = text.indexOf('\n', i);
                i = e < 0 ? n : e + 1;
            }
            continue;
        }
        if (c === '"' || c === "'") {
            let j = i + 1;
            let closed = false;
            while (j < n) {
                if (text[j] === '\\') { j += 2; continue; }
                if (text[j] === c) { closed = true; break; }
                if (text[j] === '\n') break;
                j++;
            }
            tokens.push({type: 'string', value: text.slice(i + 1, Math.min(j, n)), start: i, end: closed ? j + 1 : Math.min(j, n), closed});
            i = closed ? j + 1 : Math.min(j, n);
            continue;
        }
        if (c === '[' && /^\[=*\[/.test(text.slice(i, i + 12))) {
            const m = /^\[(=*)\[/.exec(text.slice(i, i + 12))!;
            const close = ']' + m[1] + ']';
            const e = text.indexOf(close, i + m[0].length);
            tokens.push({type: 'string', value: text.slice(i + m[0].length, e < 0 ? n : e), start: i, end: e < 0 ? n : e + close.length, closed: e >= 0});
            i = e < 0 ? n : e + close.length;
            continue;
        }
        NAME.lastIndex = i;
        const name = NAME.exec(text);
        if (name) {
            tokens.push({type: 'name', value: name[0], start: i, end: i + name[0].length});
            i += name[0].length;
            continue;
        }
        NUMBER.lastIndex = i;
        const num = NUMBER.exec(text);
        if (num && num[0].length > 0) {
            tokens.push({type: 'number', value: num[0], start: i, end: i + num[0].length});
            i += num[0].length;
            continue;
        }
        const op = OPS.find(o => text.startsWith(o, i)) || c;
        tokens.push({type: 'op', value: op, start: i, end: i + op.length});
        i += op.length;
    }
    return tokens;
}

const OPEN: Record<string, string> = {'(': ')', '{': '}', '[': ']'};
const CLOSE: Record<string, string> = {')': '(', '}': '{', ']': '['};

/** Выражение-«путь» перед индексом tokens[end - 1]: CT.Button, K.theme().colors, M:padding(8):bg. */
export function expressionBefore(tokens: Token[], end: number, source?: string): {parts: string[]; start: number} | null {
    const parts: string[] = [];
    let i = end - 1;
    while (i >= 0) {
        const t = tokens[i];
        if (t.type === 'name') {
            parts.unshift(t.value);
            i--;
        } else if (t.value === ')') {
            // вызов: пропускаем аргументы
            let depth = 0;
            let j = i;
            for (; j >= 0; j--) {
                if (tokens[j].value === ')') depth++;
                else if (tokens[j].value === '(') {
                    depth--;
                    if (depth === 0) break;
                }
            }
            if (j < 0) return null;
            i = j - 1;
            if (i < 0 || tokens[i].type !== 'name' ||
                source?.slice(tokens[i].end, tokens[j].start).includes('\n')) {
                // выражение в скобках - корень цепочки: (props.modifier or M):height()
                parts.unshift('()');
                break;
            }
            parts.unshift(tokens[i].value + '()');
            i--;
        } else {
            return null;
        }
        if (i >= 0 && (tokens[i].value === '.' || tokens[i].value === ':')) {
            if (tokens[i].value === ':') parts[0] = ':' + parts[0];
            i--;
            continue;
        }
        break;
    }
    return parts.length ? {parts, start: i + 1} : null;
}

/** Имя вызываемого перед открывающей скобкой tokens[open]: CT.Button, K.Icon, M:padding. */
function calleeAt(tokens: Token[], open: number): string | null {
    const e = expressionBefore(tokens, open);
    if (!e) return null;
    return e.parts.map((p, i) => (i && !p.startsWith(':') ? '.' : '') + p).join('').replace(/^:/, '');
}

export function analyze(textBefore: string): LuaContext {
    const tokens = tokenize(textBefore);
    const last = tokens[tokens.length - 1];

    // Курсор внутри незакрытой строки
    if (last && last.type === 'string' && !last.closed) {
        return stringContext(tokens, tokens.length - 1, last.value);
    }

    // Недописанное имя в конце - часть ввода
    let partial = '';
    let end = tokens.length;
    if (last && last.type === 'name' && last.end === textBefore.length) {
        partial = last.value;
        end--;
    }
    const prev = tokens[end - 1];

    if (prev && (prev.value === '.' || prev.value === ':')) {
        const e = expressionBefore(tokens, end - 1, textBefore);
        if (!e) return {kind: 'none'};
        if (prev.value === '.') return {kind: 'member', path: e.parts, partial};
        const methods = e.parts.filter(p => p.startsWith(':'));
        const previous = methods.length ? methods[methods.length - 1].slice(1).replace(/\(\)$/, '') : null;
        const root = e.parts[0] === '()' ? '()' : e.parts[0].replace(/\(\)$/, '');
        const first = e.parts.findIndex(p => p.startsWith(':'));
        const rootPath = e.parts.slice(0, first < 0 ? e.parts.length : first).join('.');
        const ctx: LuaContext = {kind: 'method', root: root.startsWith(':') ? null : root, previous, partial};
        if (rootPath.includes('.')) ctx.path = rootPath;
        return ctx;
    }

    // Поле таблицы: ищем незакрытую '{'
    const stack: number[] = [];
    for (let i = 0; i < end; i++) {
        const v = tokens[i].value;
        if (tokens[i].type === 'op' && OPEN[v]) stack.push(i);
        else if (tokens[i].type === 'op' && CLOSE[v] && stack.length) stack.pop();
    }
    const open = stack[stack.length - 1];
    if (open !== undefined && tokens[open].value === '{') {
        // props = | / props = pri|: значение без кавычек.
        if (prev?.value === '=' && tokens[end - 2]?.type === 'name' &&
            ['{', ',', ';'].includes(tokens[end - 3]?.value)) {
            return {kind: 'value-expr', callee: tableCallee(tokens, open), prop: tokens[end - 2].value, partial};
        }
        // позиция ключа: сразу после '{' или ','
        const atKey = prev && (prev.value === '{' || prev.value === ',' || prev.value === ';');
        const callee = tableCallee(tokens, open);
        if (atKey && callee) {
            return {kind: 'prop', callee, present: presentKeys(tokens, open, end), partial};
        }
    }
    return {kind: 'none'};
}

// '{' - аргумент вызова? CT.Button({ или CT.Button{
function tableCallee(tokens: Token[], open: number): string | null {
    const before = tokens[open - 1];
    if (!before) return null;
    if (before.value === '(' ) return calleeAt(tokens, open - 1);
    if (before.value === ',') {
        // второй аргумент: K.Text("x", {
        let depth = 0;
        for (let j = open - 1; j >= 0; j--) {
            const v = tokens[j].value;
            if (CLOSE[v]) depth++;
            else if (OPEN[v]) {
                if (depth === 0) return v === '(' ? calleeAt(tokens, j) : null;
                depth--;
            }
        }
        return null;
    }
    if (before.type === 'name' || before.value === ')') return calleeAt(tokens, open);
    return null;
}

// Ключи, уже записанные в таблице (на её верхнем уровне).
function presentKeys(tokens: Token[], open: number, end: number): string[] {
    const keys: string[] = [];
    let depth = 0;
    for (let i = open + 1; i < end; i++) {
        const v = tokens[i].value;
        if (OPEN[v]) depth++;
        else if (CLOSE[v]) depth--;
        else if (depth === 0 && tokens[i].type === 'name' && tokens[i + 1]?.value === '=' && tokens[i + 2]?.value !== '=') {
            const p = tokens[i - 1]?.value;
            if (p === '{' || p === ',' || p === ';') keys.push(tokens[i].value);
        }
    }
    return keys;
}

function stringContext(tokens: Token[], index: number, partial: string): LuaContext {
    const prev = tokens[index - 1];
    if (!prev) return {kind: 'none'};
    // prop = "|
    if (prev.value === '=' && tokens[index - 2]?.type === 'name') {
        const prop = tokens[index - 2].value;
        let callee: string | null = null;
        let depth = 0;
        for (let j = index - 3; j >= 0; j--) {
            const v = tokens[j].value;
            if (CLOSE[v]) depth++;
            else if (OPEN[v]) {
                if (depth === 0) {
                    if (v === '{') callee = tableCallee(tokens, j);
                    break;
                }
                depth--;
            }
        }
        return {kind: 'value', callee, prop, partial};
    }
    // Call("|  или  Call(a, "|
    if (prev.value === '(' || prev.value === ',') {
        let depth = 0;
        let index2 = 0;
        for (let j = index - 1; j >= 0; j--) {
            const v = tokens[j].value;
            if (CLOSE[v]) depth++;
            else if (OPEN[v]) {
                if (depth === 0) {
                    if (v !== '(') return {kind: 'none'};
                    const callee = calleeAt(tokens, j);
                    return callee ? {kind: 'string-arg', callee, index: index2, partial} : {kind: 'none'};
                }
                depth--;
            } else if (depth === 0 && v === ',') index2++;
        }
    }
    // require "pack:path"
    if (prev.type === 'name') {
        return {kind: 'string-arg', callee: prev.value, index: 0, partial};
    }
    return {kind: 'none'};
}

/** Псевдонимы файла: local X = require "pack:path", local M = K.M, local UI = K.ui(), local c = K.theme().colors. */
export type Aliases = {
    modules: Record<string, string>;
    modifiers: string[];
    ui: string[];
    themes: string[];
    colors: string[];
};

export function parseAliases(text: string, kompotModule = 'kompot:kompot'): Aliases {
    const result: Aliases = {modules: {}, modifiers: [], ui: [], themes: [], colors: []};
    const tokens = tokenize(text);
    const value = (i: number) => tokens[i]?.value;
    const add = (list: string[], name: string) => { if (!list.includes(name)) list.push(name); };
    for (let i = 0; i + 3 < tokens.length; i++) {
        if (value(i) !== 'local' || tokens[i + 1].type !== 'name' || value(i + 2) !== '=') continue;
        const name = value(i + 1);
        const rhs = i + 3;
        // Более позднее локальное присваивание скрывает прежний псевдоним.
        delete result.modules[name];
        for (const list of [result.modifiers, result.ui, result.themes, result.colors]) {
            const at = list.indexOf(name);
            if (at >= 0) list.splice(at, 1);
        }
        if (value(rhs) === 'require') {
            const arg = value(rhs + 1) === '(' ? rhs + 2 : rhs + 1;
            const module = tokens[arg]?.type === 'string' ? value(arg) : '';
            if (/^[\w-]+:[\w/.-]+$/.test(module)) {
                result.modules[name] = module;
                if (module === 'kompot:kompot/core/modifier') add(result.modifiers, name);
            }
            continue;
        }
        const root = value(rhs);
        if (tokens[rhs]?.type !== 'name') continue;
        if (result.modules[root] && value(rhs + 1) !== '.') result.modules[name] = result.modules[root];
        if (result.modifiers.includes(root) && value(rhs + 1) !== '.') add(result.modifiers, name);
        if (result.themes.includes(root) && value(rhs + 1) === '.' && value(rhs + 2) === 'colors') add(result.colors, name);
        if (value(rhs + 1) !== '.' || tokens[rhs + 2]?.type !== 'name') continue;
        const member = value(rhs + 2);
        if (result.modules[root] === kompotModule) {
            if (member === 'M' || member === 'Modifier') add(result.modifiers, name);
            else if (member === 'ui' && value(rhs + 3) === '(' && value(rhs + 4) === ')') add(result.ui, name);
            else if (member === 'BASE_THEME' && value(rhs + 3) === '.' && value(rhs + 4) === 'colors') add(result.colors, name);
        }
        if (result.modules[root] && member === 'theme' && value(rhs + 3) === '(' && value(rhs + 4) === ')') {
            if (value(rhs + 5) === '.' && value(rhs + 6) === 'colors') add(result.colors, name);
            else add(result.themes, name);
        }
    }
    return result;
}

/** Вызов, внутри скобок которого курсор: callee и номер аргумента (для подсказки параметров). */
export function callAt(textBefore: string): {callee: string; index: number} | null {
    const tokens = tokenize(textBefore);
    const last = tokens[tokens.length - 1];
    const end = last && last.type === 'string' && !last.closed ? tokens.length - 1 : tokens.length;
    let depth = 0;
    let index = 0;
    for (let j = end - 1; j >= 0; j--) {
        const v = tokens[j].value;
        if (tokens[j].type !== 'op') continue;
        if (CLOSE[v]) depth++;
        else if (OPEN[v]) {
            if (depth === 0) {
                if (v !== '(') return null;
                const callee = calleeAt(tokens, j);
                return callee ? {callee, index} : null;
            }
            depth--;
        } else if (depth === 0 && v === ',') index++;
    }
    return null;
}

/** Выражение под курсором целиком: CT.Button, M:padding (для наведения и перехода). */
export function wordAt(line: string, character: number): {expr: string; name: string} | null {
    const re = /[A-Za-z_][\w]*(?:\s*[.:]\s*[A-Za-z_][\w]*)*/g;
    for (let m; (m = re.exec(line));) {
        if (m.index <= character && character <= m.index + m[0].length) {
            // до слова под курсором включительно
            const upto = m[0].slice(0, character - m.index);
            const rest = /^[\w]*/.exec(m[0].slice(character - m.index))![0];
            let expr = (upto + rest).replace(/\s+/g, '');
            const name = /[A-Za-z_]\w*$/.exec(expr)![0];
            // метод цепочки после ')': M:padding(8):background
            if (!/[.:]/.test(expr) && /:\s*$/.test(line.slice(0, m.index))) expr = ':' + expr;
            return {expr, name};
        }
    }
    return null;
}
