import {tokenize} from './lua-context';

/** Находит объявление превью в Lua-коде, пропуская комментарии и строки. */
export function hasPreviews(text: string): boolean {
    if (!/\.preview\s*\(\s*["']/.test(text)) return false;
    const tokens = tokenize(text);
    for (let i = 0; i < tokens.length - 4; i++) {
        if (tokens[i].type === 'name' && tokens[i + 1].value === '.' &&
            tokens[i + 2].value === 'preview' && tokens[i + 3].value === '(' &&
            tokens[i + 4].type === 'string') return true;
    }
    return false;
}
