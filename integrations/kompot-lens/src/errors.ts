// Разбор текста ошибок Lua: строки файла из трассировки.
import * as path from 'node:path';

/** Строки файла file, упомянутые в тексте ошибки ("path:12:" или "[string "..."]:12:"). */
export function errorLines(error: string, file: string): number[] {
    const out: number[] = [];
    const base = path.basename(file);
    const re = /([^\s"'\[\]()]+\.(?:lua|ts))"?\]?:(\d+):/g;
    for (let m; (m = re.exec(error));) {
        if (path.basename(m[1]) === base && (m[1] === file || file.endsWith(m[1].replace(/^\.\.\./, '')))) {
            out.push(parseInt(m[2], 10));
        }
    }
    return out;
}
