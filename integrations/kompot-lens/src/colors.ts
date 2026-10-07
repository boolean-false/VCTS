// Образцы и выбор цвета для K.hex("#RRGGBB[AA]") и hex("...") в Lua.
import * as vscode from 'vscode';

const RE = /\bhex\s*\(\s*["']#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})["']/g;

export function registerColors(context: vscode.ExtensionContext, selector: vscode.DocumentSelector) {
    context.subscriptions.push(vscode.languages.registerColorProvider(selector, {
        provideDocumentColors(doc) {
            const out: vscode.ColorInformation[] = [];
            const text = doc.getText();
            for (let m; (m = RE.exec(text));) {
                const h = m[1];
                const start = m.index + m[0].indexOf('#');
                const range = new vscode.Range(doc.positionAt(start), doc.positionAt(start + 1 + h.length));
                const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
                out.push(new vscode.ColorInformation(range, new vscode.Color(n(0), n(2), n(4), h.length === 8 ? n(6) : 1)));
            }
            return out;
        },
        provideColorPresentations(color, ctx) {
            const b = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0').toUpperCase();
            const had = ctx.document.getText(ctx.range).length === 9;
            const text = '#' + b(color.red) + b(color.green) + b(color.blue) + (had || color.alpha < 1 ? b(color.alpha) : '');
            return [new vscode.ColorPresentation(text)];
        },
    }));
}
