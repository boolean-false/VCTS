// Документация из комментариев Lua над функциями Kompot и дизайн-систем.
//
//   -- Плоская кнопка. props: text, icon (слева), on_click,
//   --   variant ("default"|"primary"|"danger"), size ("sm"|"md"|"lg")
//
// -> summary: "Плоская кнопка."
//    props: text, icon ("слева"), on_click, variant (значения default,
//    primary, danger), size (sm, md, lg).

export type Prop = {name: string; detail: string; values: string[]};
export type Doc = {summary: string; props: Prop[]};

// Разбивает строку по запятым верхнего уровня (скобки и кавычки не режутся).
function splitTop(text: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let quote = '';
    let cur = '';
    for (const ch of text) {
        if (quote) {
            if (ch === quote) quote = '';
        } else if (ch === '"' || ch === "'") {
            quote = ch;
        } else if (ch === '(' || ch === '{' || ch === '[') {
            depth++;
        } else if (ch === ')' || ch === '}' || ch === ']') {
            depth = Math.max(0, depth - 1);
        } else if (ch === ',' && depth === 0) {
            out.push(cur);
            cur = '';
            continue;
        }
        cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out;
}

function parseProp(piece: string): Prop | null {
    const m = /^\s*([A-Za-z_]\w*)(.*)$/s.exec(piece);
    if (!m) return null;
    let detail = m[2].trim().replace(/\.$/, '');
    // "item(i) (содержимое)" -> сигнатура в detail
    const values: string[] = [];
    for (const q of detail.matchAll(/"([^"]*)"/g)) {
        if (q[1] && !values.includes(q[1])) values.push(q[1]);
    }
    detail = detail.replace(/^\((.*)\)$/s, '$1').trim();
    return {name: m[1], detail, values};
}

export function parseDoc(lines: string[] | undefined): Doc {
    const doc: Doc = {summary: '', props: []};
    if (!lines || !lines.length) return doc;
    const summary: string[] = [];
    let propsText = '';
    let inProps = false;
    for (const raw of lines) {
        const line = raw.replace(/\s+$/, '');
        if (!inProps) {
            const idx = line.search(/\bprops:/);
            if (idx >= 0) {
                inProps = true;
                const before = line.slice(0, idx).trim();
                if (before) summary.push(before);
                propsText += ' ' + line.slice(idx + 'props:'.length);
                continue;
            }
            summary.push(line.trim());
        } else if (/^\s{2,}\S/.test(line)) {
            // продолжение списка свойств - строки с отступом
            propsText += ' ' + line.trim();
        } else {
            inProps = false;
            summary.push(line.trim());
        }
    }
    doc.summary = summary.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    for (const piece of splitTop(propsText)) {
        const p = parseProp(piece);
        if (p && !doc.props.some(x => x.name === p.name)) doc.props.push(p);
    }
    return doc;
}
