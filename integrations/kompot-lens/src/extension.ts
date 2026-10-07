// Kompot Lens: превью UI Kompot справа от кода и языковая поддержка
// (дополнение, документация, параметры, переход к определению) для Lua.
import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {PreviewController} from './preview';
import {hasPreviews} from './preview-source';
import {Service, Item, ItemKind} from './service';
import {Catalogs} from './catalog';
import {runHost} from './host';
import {findContent} from './project';
import {registerColors} from './colors';
import {tokenize} from './lua-context';
import {configureLuaLS} from './luals';

const LUA: vscode.DocumentSelector = [{language: 'lua', scheme: 'file'}, {language: 'lua', scheme: 'untitled'}];

const KINDS: Record<ItemKind, vscode.CompletionItemKind> = {
    component: vscode.CompletionItemKind.Class,
    function: vscode.CompletionItemKind.Function,
    method: vscode.CompletionItemKind.Method,
    table: vscode.CompletionItemKind.Module,
    color: vscode.CompletionItemKind.Color,
    value: vscode.CompletionItemKind.Constant,
    property: vscode.CompletionItemKind.Property,
    enum: vscode.CompletionItemKind.EnumMember,
    module: vscode.CompletionItemKind.Module,
    icon: vscode.CompletionItemKind.File,
    style: vscode.CompletionItemKind.Text,
};

function settings(file?: string) {
    const c = vscode.workspace.getConfiguration('kompot', file ? vscode.Uri.file(file) : null);
    return {contentPath: c.get('contentPath', ''), enginePath: c.get('enginePath', ''),
        lua: c.get('luaExecutable', ''), sandbox: c.get('sandbox', true)};
}

function toItem(item: Item, range: vscode.Range | undefined): vscode.CompletionItem {
    const ci = new vscode.CompletionItem(item.label, KINDS[item.kind]);
    if (item.detail) ci.detail = item.detail;
    if (item.kind === 'color' && item.color) {
        // образец цвета: документация - сам цвет
        ci.documentation = item.color.slice(0, 7);
        ci.detail = item.color;
    } else if (item.doc || item.image) {
        const md = new vscode.MarkdownString(item.doc || '');
        if (item.image) {
            md.supportHtml = true;
            md.baseUri = vscode.Uri.file(path.dirname(item.image) + path.sep);
            md.appendMarkdown(`\n\n<img src="${vscode.Uri.file(item.image).toString()}" width="32" height="32" style="background:#444">`);
        }
        ci.documentation = md;
    }
    if (item.insert) ci.insertText = new vscode.SnippetString(item.insert);
    if (item.sort) ci.sortText = item.sort;
    if (item.filter) ci.filterText = item.filter;
    if (item.preselect) ci.preselect = true;
    if (range) ci.range = range;
    return ci;
}

// Диапазон вводимого слова (или содержимого строки до курсора).
function inputRange(doc: vscode.TextDocument, pos: vscode.Position): vscode.Range {
    const before = doc.lineAt(pos.line).text.slice(0, pos.character);
    let start: number;
    const last = tokenize(before).at(-1);
    if (last?.type === 'string' && !last.closed && last.end === before.length) {
        const bracket = /^\[(=*)\[/.exec(before.slice(last.start));
        start = last.start + (bracket ? bracket[0].length : 1);
    } else {
        const m = /[A-Za-z_]\w*$/.exec(before);
        start = m ? pos.character - m[0].length : pos.character;
    }
    return new vscode.Range(pos.line, start, pos.line, pos.character);
}

export function activate(context: vscode.ExtensionContext) {
    let setupPending = false;
    let setupRunning = false;
    const setupLuaLS = async () => {
        setupPending = true;
        if (setupRunning) return;
        setupRunning = true;
        try {
            while (setupPending) {
                setupPending = false;
                await configureLuaLS(context);
            }
        } catch (error) { console.error('Kompot Lens: LuaLS setup failed', error); }
        finally { setupRunning = false; }
    };
    setupLuaLS();
    const catalogs = new Catalogs((content, modules, projectFile) => {
        const s = settings(projectFile);
        return runHost('introspect', content, modules, [], [], {lua: s.lua, sandbox: s.sandbox, projectFile});
    });
    const service = new Service(catalogs, settings, !!vscode.extensions.getExtension('sumneko.lua'));
    const diagnostics = vscode.languages.createDiagnosticCollection('kompot');
    const preview = new PreviewController(context, diagnostics);
    registerColors(context, LUA);
    const trusted = () => vscode.workspace.isTrusted;
    const updatePreviewAction = () => {
        const doc = vscode.window.activeTextEditor?.document;
        void vscode.commands.executeCommand('setContext', 'kompot.hasPreviews',
            !!doc && ['lua','typescript'].includes(doc.languageId) && hasPreviews(doc.getText()));
    };
    updatePreviewAction();

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('kompot.previewView', preview, {webviewOptions: {retainContextWhenHidden: true}}),
        vscode.commands.registerCommand('kompot.openPreview', (uri?: vscode.Uri, name?: string) =>
            preview.open(uri instanceof vscode.Uri ? uri : undefined, typeof name === 'string' ? name : undefined)),
        vscode.commands.registerCommand('kompot.chooseContent', async (resource?: vscode.Uri) => {
            const uri = resource instanceof vscode.Uri ? resource : vscode.window.activeTextEditor?.document.uri;
            const picked = await vscode.window.showOpenDialog({canSelectFolders: true, canSelectFiles: false, canSelectMany: false,
                title: 'Каталог паков с Kompot', openLabel: 'Выбрать каталог паков',
                defaultUri: uri ? vscode.Uri.file(path.dirname(uri.fsPath)) : undefined});
            if (!picked?.length) return;
            let directory = picked[0].fsPath;
            if (path.basename(directory) === 'kompot' && fs.existsSync(path.join(directory, 'package.json'))) directory = path.dirname(directory);
            if (!fs.existsSync(path.join(directory, 'kompot', 'package.json'))) {
                await vscode.window.showErrorMessage('В выбранном каталоге нет пака kompot. Выберите папку, содержащую kompot/package.json.');
                return;
            }
            const folder = uri && vscode.workspace.getWorkspaceFolder(uri);
            await vscode.workspace.getConfiguration('kompot', folder?.uri || uri).update('contentPath', directory,
                folder ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace);
        }),
        vscode.commands.registerCommand('kompot.refresh', () => {
            catalogs.invalidate();
            preview.refresh();
            setupLuaLS();
        }),
        vscode.commands.registerCommand('kompot.newPreview', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            await editor.insertSnippet(new vscode.SnippetString(
                editor.document.languageId==='typescript'
                ? 'K.preview("${1:Имя}", {width: ${2:360}, height: ${3:200}, theme: ${4:K.BASE_THEME}, group: "${5:Компоненты}"}, () => {\n\t$0\n});\n'
                : 'K.preview("${1:Имя}", {width = ${2:360}, height = ${3:200}, theme = ${4:K.BASE_THEME}, group = "${5:Компоненты}"}, function()\n\t$0\nend)\n'));
            await preview.open(editor.document.uri);
        }),

        // --- превью следует за активным редактором ---
        vscode.window.onDidChangeActiveTextEditor(editor => {
            updatePreviewAction();
            if (editor && ['lua','typescript'].includes(editor.document.languageId) && preview.isOpen && hasPreviews(editor.document.getText())) {
                preview.show(editor.document.uri);
            }
        }),
        vscode.workspace.onDidChangeTextDocument(e => {
            if (vscode.window.activeTextEditor?.document.uri.toString() === e.document.uri.toString()) updatePreviewAction();
            preview.changed(e.document);
        }),
        vscode.workspace.onDidSaveTextDocument(doc => {
            if (doc.languageId === 'lua') {
                catalogs.invalidate();
                preview.saved(doc);
            }
        }),
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('Lua.workspace.library') || e.affectsConfiguration('Lua.runtime.plugin')) setupLuaLS();
            if (e.affectsConfiguration('kompot')) {
                catalogs.invalidate();
                preview.refresh();
                if (e.affectsConfiguration('kompot.contentPath')) { watchPackLocations(); setupLuaLS(); }
            }
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => { watchPackLocations(); setupLuaLS(); }),
        diagnostics,
        vscode.workspace.onDidCloseTextDocument(doc => diagnostics.delete(doc.uri)),
        {dispose: () => preview.dispose()},
    );
    if (vscode.workspace.onDidGrantWorkspaceTrust) {
        context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(() => {
            preview.refresh();
            setupLuaLS();
        }));
    }
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{lua,ts}');
    const invalidate = () => catalogs.invalidate();
    context.subscriptions.push(watcher, watcher.onDidChange(invalidate), watcher.onDidCreate(invalidate), watcher.onDidDelete(invalidate));
    const images = vscode.workspace.createFileSystemWatcher('**/*.png');
    const refreshImages = () => preview.refresh();
    context.subscriptions.push(images, images.onDidChange(refreshImages), images.onDidCreate(refreshImages), images.onDidDelete(refreshImages));

    let projectTimer: NodeJS.Timeout | undefined;
    const projectChanged = () => {
        if (projectTimer) clearTimeout(projectTimer);
        projectTimer = setTimeout(() => { projectTimer = undefined; catalogs.invalidate(); preview.refresh(); void setupLuaLS(); }, 250);
    };
    context.subscriptions.push({dispose: () => { if (projectTimer) clearTimeout(projectTimer); }});
    const packages = vscode.workspace.createFileSystemWatcher('**/{package.json,.luarc.json,.luarc.jsonc,vcts.config.json,*tsconfig.json}');
    const types = vscode.workspace.createFileSystemWatcher('**/annotations/*.lua');
    context.subscriptions.push(packages, types,
        packages.onDidChange(projectChanged), packages.onDidCreate(projectChanged), packages.onDidDelete(projectChanged),
        types.onDidChange(projectChanged), types.onDidCreate(projectChanged), types.onDidDelete(projectChanged));
    let packWatchers: vscode.Disposable[] = [];
    function watchPackLocations() {
        for (const watcher of packWatchers) watcher.dispose();
        packWatchers = [];
        const locations = new Set<string>();
        for (const folder of vscode.workspace.workspaceFolders || []) {
            if (folder.uri.scheme !== 'file') continue;
            const root = folder.uri.fsPath;
            const configured = settings(root).contentPath;
            if (configured) locations.add(configured);
            // The workspace is often just one pack; Kompot can be installed next to it later.
            locations.add(path.dirname(root));
            locations.add(root);
            locations.add(path.join(root, 'content'));
        }
        for (const location of locations) {
            const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(location, '{kompot,kompot/package.json,kompot/annotations,kompot/annotations/*.lua}'));
            packWatchers.push(watcher, watcher.onDidChange(projectChanged), watcher.onDidCreate(projectChanged), watcher.onDidDelete(projectChanged));
        }
    }
    watchPackLocations();
    context.subscriptions.push({dispose: () => packWatchers.forEach(w => w.dispose())});

    // --- языковая поддержка ---
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(LUA, {
            async provideCompletionItems(doc, pos) {
                if (!trusted() || doc.uri.scheme !== 'file') return;
                const text = doc.getText();
                const offset = doc.offsetAt(pos);
                const items = await service.complete(doc.uri.fsPath, text, offset);
                if (!items.length) return;
                const range = inputRange(doc, pos);
                return new vscode.CompletionList(items.map(i => toItem(i, range)), false);
            },
        }, '.', ':', '"', "'", '{', ',', '='),

        vscode.languages.registerHoverProvider(LUA, {
            async provideHover(doc, pos) {
                if (!trusted() || doc.uri.scheme !== 'file') return;
                const md = await service.hover(doc.uri.fsPath, doc.getText(), doc.offsetAt(pos));
                return md ? new vscode.Hover(new vscode.MarkdownString(md)) : undefined;
            },
        }),

        vscode.languages.registerSignatureHelpProvider(LUA, {
            async provideSignatureHelp(doc, pos) {
                if (!trusted() || doc.uri.scheme !== 'file') return;
                const sig = await service.signature(doc.uri.fsPath, doc.getText(), doc.offsetAt(pos));
                if (!sig) return;
                const info = new vscode.SignatureInformation(sig.label, sig.doc ? new vscode.MarkdownString(sig.doc) : undefined);
                info.parameters = sig.params.map(p => new vscode.ParameterInformation(p));
                const help = new vscode.SignatureHelp();
                help.signatures = [info];
                help.activeSignature = 0;
                help.activeParameter = sig.active;
                return help;
            },
        }, '(', ','),

        vscode.languages.registerDefinitionProvider(LUA, {
            async provideDefinition(doc, pos) {
                if (!trusted() || doc.uri.scheme !== 'file') return;
                const def = await service.definition(doc.uri.fsPath, doc.getText(), doc.offsetAt(pos));
                return def ? new vscode.Location(vscode.Uri.file(def.file), new vscode.Position(def.line - 1, 0)) : undefined;
            },
        }),

        // «Превью» над каждым K.preview("...")
        vscode.languages.registerCodeLensProvider([{language: 'lua', scheme: 'file'}, {language: 'lua', scheme: 'untitled'}, {language: 'typescript', scheme: 'file'}], {
            provideCodeLenses(doc) {
                if (doc.uri.scheme !== 'file') return [];
                const lenses: vscode.CodeLens[] = [];
                const re = /\.preview\s*\(\s*["']([^"']+)["']/g;
                const text = doc.getText();
                for (let m; (m = re.exec(text));) {
                    const range = doc.lineAt(doc.positionAt(m.index).line).range;
                    lenses.push(new vscode.CodeLens(range, {title: '$(eye) Превью', command: 'kompot.openPreview', arguments: [doc.uri, m[1]]}));
                }
                return lenses;
            },
        }),
    );

    // API для интеграционных тестов
    return {preview, service, catalogs};
}

export function deactivate() {}
