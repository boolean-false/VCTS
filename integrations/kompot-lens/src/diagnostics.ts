// Ошибки превью - подчёркивания в коде: строка из трассировки Lua, если
// она в этом файле, иначе строка объявления превью.
import * as vscode from 'vscode';
import {errorLines} from './errors';

export type PreviewError = {name: string; error: string; source?: string; line?: number};
export type MissingImage = {name: string; src: string; line?: number};

export function previewDiagnostics(doc: vscode.TextDocument, errors: PreviewError[], moduleError: string | null, missing: MissingImage[] = []): vscode.Diagnostic[] {
    const out: vscode.Diagnostic[] = [];
    const add = (line: number, message: string) => {
        const l = Math.min(Math.max(0, line - 1), doc.lineCount - 1);
        const range = doc.lineAt(l).range;
        const d = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
        d.source = 'Kompot';
        out.push(d);
    };
    const first = (text: string) => text.split('\n')[0].replace(/^[^\s]+\.lua:\d+:\s*/, '');
    if (moduleError) {
        const lines = errorLines(moduleError, doc.uri.fsPath);
        add(lines[0] || 1, 'Модуль не загружен: ' + first(moduleError));
    }
    for (const e of errors) {
        const lines = errorLines(e.error, doc.uri.fsPath);
        add(lines[0] || e.line || 1, `Превью «${e.name}»: ${first(e.error)}`);
    }
    for (const m of missing) {
        const l = Math.min(Math.max(0, (m.line || 1) - 1), doc.lineCount - 1);
        const d = new vscode.Diagnostic(doc.lineAt(l).range, `Превью «${m.name}»: изображение «${m.src}» не найдено`, vscode.DiagnosticSeverity.Warning);
        d.source = 'Kompot';
        out.push(d);
    }
    return out;
}
