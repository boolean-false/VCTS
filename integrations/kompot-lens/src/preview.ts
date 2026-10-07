// Превью Kompot во вторичной боковой панели справа от кода. Показывает все
// K.preview активного Lua-файла, обновляется после сохранения (или при наборе
// в режиме live), переходит к объявлению, ведёт интерактивную сессию.
import * as vscode from 'vscode';
const PreviewRender = require('../media/render');
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {findContent, moduleName, findEngineRes, findTexture, findPack} from './project';
import {runHost, Session, Override, FontMetrics} from './host';
import {previewDiagnostics} from './diagnostics';
import {hasPreviews} from './preview-source';
import {VctsPreview,prepareVcts,reuseVcts,cleanupVcts,mapVctsDocument,mapVctsError,vctsConfig} from './vcts';

type Config = {lua: string; sandbox: boolean; contentPath: string; enginePath: string; delay: number; updateMode: 'onSave' | 'live'};

function config(uri?: vscode.Uri | null): Config {
    const c = vscode.workspace.getConfiguration('kompot', uri || null);
    return {
        lua: c.get('luaExecutable', ''),
        sandbox: c.get('sandbox', true),
        contentPath: c.get('contentPath', ''),
        enginePath: c.get('enginePath', ''),
        delay: c.get('previewDelay', 200),
        updateMode: c.get('previewUpdateMode', 'onSave'),
    };
}

export class PreviewController implements vscode.WebviewViewProvider {
    private vcts:VctsPreview|null=null;
    private view: vscode.WebviewView | null = null;
    private uri: vscode.Uri | null = null;
    private requestedUri: vscode.Uri | null = null;
    private endedWhileHidden: string | null = null;
    private timer: NodeJS.Timeout | null = null;
    private revision = 0;
    private assetRevision = 0;
    private fontMetrics: FontMetrics = {};
    private fontSignatures: Record<string, string> = {};
    private session: Session | null = null;
    private sessionName: string | null = null;
    private pointer = {x: -1, y: -1, down: false, rdown: false, wheel: 0, cancel: false};
    private keys: {key: string; shift: boolean}[] = [];
    private pending = false;
    private awaiting = false;
    private animating = false;
    private pump: NodeJS.Timeout | null = null;
    private lastFrame = Date.now();
    private snapshots = new Map<number, (images: Record<string, string>) => void>();
    private scrolls = new Map<number, (position: {top: number; max: number}) => void>();
    private rendered: ((count: number) => void)[] = [];
    /** Для тестов: число кадров интерактивной сессии и последний документ. */
    rasterFontCount = 0;
    rasterError = '';
    frames = 0;
    lastDoc: any = null;

    constructor(private context: vscode.ExtensionContext, private diagnostics?: vscode.DiagnosticCollection) {}

    /** Открывает панель для документа (или активного редактора). */
    async open(uri?: vscode.Uri, focus?: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        const target = uri || editor?.document.uri || this.uri;
        if (!target) {
            vscode.window.showInformationMessage('Откройте Lua- или TS-файл с K.preview.');
            return;
        }
        this.requestedUri = target;
        await vscode.commands.executeCommand('kompot.previewView.focus');
        this.view?.show(true);
        this.show(target);
        if (focus) this.view?.webview.postMessage({type: 'focus', name: focus});
    }

    get isOpen(): boolean {
        return !!this.view?.visible;
    }

    resolveWebviewView(view: vscode.WebviewView): void {
        this.view = view;
        view.webview.options = {enableScripts: true, localResourceRoots: this.roots(this.requestedUri || this.uri)};
        view.webview.html = this.html(view.webview);
        view.webview.onDidReceiveMessage(m => this.message(m));
        view.onDidDispose(() => {
            if (this.view !== view) return;
            this.stopSession();cleanupVcts(this.vcts);this.vcts=null;
            this.view = null;
        });
        view.onDidChangeVisibility(() => {
            if (!view.visible) {
                this.endedWhileHidden = this.sessionName;
                this.stopSession();
            } else {
                if (this.endedWhileHidden) {
                    view.webview.postMessage({type: 'interactive-ended', name: this.endedWhileHidden});
                    this.endedWhileHidden = null;
                }
                const editor = vscode.window.activeTextEditor;
                if (editor && ['lua','typescript'].includes(editor.document.languageId) && hasPreviews(editor.document.getText())) this.show(editor.document.uri);
                else this.schedule(0);
            }
        });
        if (this.requestedUri || this.uri) this.show(this.requestedUri || this.uri!);
    }

    private roots(uri: vscode.Uri | null): vscode.Uri[] {
        const roots = [vscode.Uri.joinPath(this.context.extensionUri, 'out', 'media'), vscode.Uri.joinPath(this.context.extensionUri, 'media')];
        if (!uri) return roots;
        const pack = findPack(uri.fsPath);
        if (pack) roots.push(vscode.Uri.file(pack.root));
        const c = config(uri);
        const content = this.vcts?.content || findContent(uri.fsPath, c.contentPath);
        if (content) {
            roots.push(vscode.Uri.file(content));
            const res = findEngineRes(content, c.enginePath);
            if (res) roots.push(vscode.Uri.file(res));
        }
        return roots;
    }

    private html(webview: vscode.Webview): string {
        const nonce = crypto.randomBytes(16).toString('base64');
        const media = (f: string) => webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'out', 'media', f)).toString();
        const tpl = fs.readFileSync(path.join(this.context.extensionPath, 'out', 'media', 'preview.html'), 'utf8');
        return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => ({
            freetype: media('freetype.js'), raster: media('font-raster.js'), bitmap: media('font-bitmap.js'), wasm: media('freetype.wasm'),
            csp: webview.cspSource, nonce, style: media('preview.css'), render: media('render.js'), script: media('preview.js'),
        } as Record<string, string>)[k] ?? '');
    }

    /** Переключение на другой документ. */
    show(uri: vscode.Uri): void {
        this.requestedUri = uri;
        if (!this.view) return;
        if (this.uri?.toString() !== uri.toString()) {
            this.stopSession();
            this.fontMetrics = {};
            this.fontSignatures = {};
            cleanupVcts(this.vcts);this.vcts=null;
            this.uri = uri;
            this.view.webview.options = {...this.view.webview.options, localResourceRoots: this.roots(uri)};
        }
        this.view.title = 'Превью: ' + path.basename(uri.fsPath);
        this.schedule(0);
    }

    /** При наборе перерисовываем только в явно выбранном режиме live. */
    changed(doc: vscode.TextDocument): void {
        const c = config(this.uri);
        if (c.updateMode !== 'live') {
            if (this.uri?.toString() === doc.uri.toString() && doc.isDirty) this.diagnostics?.delete(doc.uri);
            return;
        }
        if (this.affectsPreview(doc, c)) this.schedule(c.delay);
    }

    /** Сохранённый исходник или модуль может изменить текущее превью. */
    saved(doc: vscode.TextDocument): void {
        if (this.affectsPreview(doc, config(this.uri))) this.schedule(0);
    }

    private affectsPreview(doc: vscode.TextDocument, c: Config): boolean {
        if (!this.view?.visible || !this.uri || !['lua','typescript'].includes(doc.languageId)) return false;
        const content = findContent(this.uri.fsPath, c.contentPath);
        // превью зависит и от модулей, которые файл подключает
        return doc.uri.toString() === this.uri.toString() || (doc.languageId==='typescript'&&vctsConfig(doc.uri.fsPath)===vctsConfig(this.uri.fsPath)) || !!(content && doc.uri.fsPath.startsWith(content + path.sep));
    }

    refresh(): void {
        if (this.view) this.view.webview.options = {...this.view.webview.options, localResourceRoots: this.roots(this.uri)};
        this.assetRevision++;
        this.fontMetrics = {};
        this.fontSignatures = {};
        this.schedule(0);
    }

    private schedule(delay: number): void {
        this.revision++; // Discard pending renders as soon as the document/configuration changes.
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => { this.timer = null; this.render(); }, delay);
    }

    // Несохранённые Lua-документы каталога content - подмены только для live.
    private overrides(content: string): Override[] {
        if(this.vcts&&content===this.vcts.content)return this.vcts.overrides;
        if (config(this.uri).updateMode !== 'live') return [];
        const out: Override[] = [];
        for (const d of vscode.workspace.textDocuments) {
            if (d.languageId !== 'lua' || !d.isDirty || d.uri.scheme !== 'file') continue;
            const m = moduleName(d.uri.fsPath, content);
            if (m) out.push({module: m, text: d.getText(), file: d.uri.fsPath});
        }
        return out;
    }

    private async render(): Promise<void> {
        if (!this.view?.visible || !this.uri) return;
        const revision = ++this.revision;
        const c = config(this.uri);
        const file = this.uri.fsPath;
        const name = path.basename(file);
        let content = findContent(file, c.contentPath);
        if(file.endsWith('.ts')){
            if(!vscode.workspace.isTrusted){this.view?.webview.postMessage({type:'message',name,text:'Доверьте рабочей области для запуска TS-превью.'});return;}
            try{
                const overlays=c.updateMode==='live'?vscode.workspace.textDocuments.filter(d=>d.languageId==='typescript'&&d.isDirty&&d.uri.scheme==='file').map(d=>({file:d.uri.fsPath,text:d.getText()})):[];
                const prepared=await prepareVcts(file,vscode.workspace.getConfiguration('kompot',this.uri).get('vctsPath',''),overlays);
                if(revision!==this.revision||!this.view?.visible){cleanupVcts(prepared);return;}
                this.stopSession(false);const first=!this.vcts;this.vcts=reuseVcts(this.vcts,prepared);content=this.vcts.content;
                if(first)this.view.webview.options={...this.view.webview.options,localResourceRoots:this.roots(this.uri)};
            }catch(error){if(revision===this.revision){this.stopSession();cleanupVcts(this.vcts);this.vcts=null;this.view?.webview.postMessage({type:'message',name,text:(error as Error).message});}return;}
        }

        const post = (m: any) => this.view?.webview.postMessage(m);
        if (!content) {
            post({type: 'message', name, text: 'Для превью нужен пак Kompot. Установите его рядом со своим паком или выберите каталог, в котором он уже находится.', action: 'choose-content'});
            return;
        }
        if (!vscode.workspace.isTrusted) {
            post({type: 'message', name, text: 'Превью запускает Lua-код проекта: доверьте рабочей области (Manage Workspace Trust).'});
            return;
        }
        const module = file.endsWith('.ts')?this.vcts?.module:moduleName(file, content);
        if (!module) {
            post({type: 'message', name, text: 'Файл не модуль пака: превью строится для файлов <пак>/modules/*.lua.'});
            return;
        }
        const started = Date.now();
        try {
            const result = await runHost('render', content, [module], [], this.overrides(content), {lua: c.lua, sandbox: c.sandbox, fontMetrics: this.fontMetrics, projectFile: this.uri.fsPath});
            if (revision !== this.revision || !this.view?.visible) return;
            if(this.vcts&&file.endsWith('.ts')){result.previews=(result.previews||[]).map(p=>mapVctsDocument(p,this.vcts!));if(result.error)result.error=mapVctsError(result.error,this.vcts);}
            const previews = (result.previews || []).filter((p: any) => !p.source || path.resolve(content, p.source) === file || p.source === file);
            let fontChanged = false;
            for (const preview of previews) {
                const fonts = [...(preview.font_requests || []).map((q: any) => ({name:q.font, file:q.file, size:q.size})),
                    ...PreviewRender.primitives(preview).filter((p: any) => p.font).map((p: any) => ({name:p.font, file:p.font_file, size:p.font_size}))];
                for (const font of fonts) {
                    const signature = `${this.vcts ? vctsConfig(file) : content}|${font.file}|${font.size}`;
                    if (this.fontSignatures[font.name] && this.fontSignatures[font.name] !== signature) {
                        delete this.fontMetrics[font.name];
                        fontChanged = true;
                    }
                    this.fontSignatures[font.name] = signature;
                }
            }
            if (fontChanged) { this.schedule(0); return; }
            const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === this.uri!.toString());
            const uris = this.uris(content, previews);
            if (doc && this.diagnostics && (!doc.isDirty || c.updateMode === 'live')) {
                const errors = previews.filter((p: any) => p.error).map((p: any) => ({name: p.name, error: p.error, line: p.line}));
                const missing = previews.flatMap((d: any) => PreviewRender.imageSources(d).map((src: string)=>({src}))
                    .filter((p: any) => p.src && !uris.images[p.src])
                    .map((p: any) => ({name: d.name, src: p.src, line: d.line})));
                const unique = [...new Map<string, {name: string; src: string; line?: number}>(
                    missing.map((m: any) => [`${m.name}\0${m.src}`, m])).values()];
                this.diagnostics.set(doc.uri, previewDiagnostics(doc, errors, result.ok ? null : result.error, unique));
            }
            post({type: 'render', revision, name, file, previews, error: result.ok ? null : result.error,
                elapsed: Date.now() - started, uris});
            // интерактивная сессия подхватывает новый код
            if (this.sessionName && previews.some((p: any) => p.name === this.sessionName)) this.startSession(this.sessionName);
        } catch (e) {
            if (revision === this.revision) post({type: 'message', name, text: String((e as Error).message || e)});
        }
    }

    // Адреса шрифтов и картинок документов для webview.
    private uris(content: string, docs: any[]): {fonts: Record<string, string>; images: Record<string, string>} {
        const out = {fonts: {} as Record<string, string>, images: {} as Record<string, string>};
        if (!this.view) return out;
        const res = findEngineRes(content, config(this.uri).enginePath);
        const own = this.uri && findPack(this.uri.fsPath);
        const texture = (src: string) => {
            const relative = src.replace(':', '/') + '.png';
            const candidate = own && !relative.split('/').includes('..') && path.join(own.root, 'textures', relative);
            return candidate && fs.existsSync(candidate) ? candidate : findTexture(src, content, res);
        };
        const fontUri = (file: string, kind?: string) => {
            if (file in out.fonts) return;
            const f = file.startsWith('@engine/')
                ? res && path.join(res,file.slice(8)) : own && file.startsWith(own.id + '/') ? path.join(own.root, file.slice(own.id.length + 1)) : path.join(content,file);
            if (f && fs.existsSync(kind === 'bitmap' ? f + '_0.png' : f)) {
                out.fonts[file] = this.view!.webview.asWebviewUri(vscode.Uri.file(f)).with({query: `v=${this.assetRevision}`}).toString();
            }
        };
        for (const d of docs) {
            for (const q of d.font_requests || []) fontUri(q.file,q.kind);
            for (const p of PreviewRender.primitives(d)) {
                if (p.font_file) fontUri(p.font_file,p.font_kind);
                if ((p.kind === 'image' || p.kind === 'nine_patch') && p.src && !(p.src in out.images)) {
                    const f = texture(p.src);
                    if (f) out.images[p.src] = this.view.webview.asWebviewUri(vscode.Uri.file(f)).with({query: `v=${this.assetRevision}`}).toString();
                }
            }
        }
        for(const d of docs) for(const src of PreviewRender.imageSources(d)) {
            if(src in out.images) continue;
            const f=texture(src);
            if(f) out.images[src]=this.view.webview.asWebviewUri(vscode.Uri.file(f)).with({query:`v=${this.assetRevision}`}).toString();
        }
        return out;
    }

    // --- интерактивный режим -------------------------------------------------

    private startSession(name: string): void {
        this.stopSession(false);
        if (!this.uri) return;
        const c = config(this.uri);
        const content = this.uri.fsPath.endsWith('.ts')?this.vcts?.content:findContent(this.uri.fsPath, c.contentPath);
        const module = this.uri.fsPath.endsWith('.ts')?this.vcts?.module:content && moduleName(this.uri.fsPath, content);
        if (!content || !module) return;
        this.sessionName = name;
        this.view?.webview.postMessage({type: 'interactive-started', name});
        try {
            const s = new Session(content, [module], name, this.overrides(content), {lua: c.lua, sandbox: c.sandbox, fontMetrics: this.fontMetrics, projectFile: this.uri.fsPath});
            this.session = s;
            this.awaiting = true; // первый кадр хост присылает сам
            s.onDocument = doc => {
                if(this.vcts&&this.uri?.fsPath.endsWith('.ts'))doc=mapVctsDocument(doc,this.vcts);
                if (this.session !== s) return;
                this.frames++;
                this.lastDoc = doc;
                this.awaiting = false;
                this.animating = !!doc.animating;
                this.view?.webview.postMessage({type: 'frame', name, doc, uris: this.uris(content, [doc])});
                this.kick();
            };
            s.onExit = err => {
                if (this.session !== s) return;
                this.session = null;
                if (err) vscode.window.showWarningMessage('Интерактивное превью остановлено: ' + err.split('\n')[0]);
                this.view?.webview.postMessage({type: 'interactive-ended', name});
                this.sessionName = null;
            };
        } catch (e) {
            vscode.window.showErrorMessage(String((e as Error).message || e));
            this.sessionName = null;
        }
    }

    private stopSession(clearName = true): void {
        if (this.pump) {
            clearInterval(this.pump);
            this.pump = null;
        }
        this.session?.dispose();
        this.session = null;
        this.keys = [];
        this.awaiting = false;
        if (clearName) this.sessionName = null;
    }

    // Кадры идут, пока есть ввод или анимации; следующий - после ответа хоста.
    private kick(): void {
        if (this.pump || !this.session) return;
        this.pump = setInterval(() => this.tick(), 33);
    }

    private tick(): void {
        const s = this.session;
        if (!s || !s.alive) {
            if (this.pump) clearInterval(this.pump);
            this.pump = null;
            return;
        }
        if (this.awaiting) return;
        if (!this.pending && !this.animating) {
            clearInterval(this.pump!);
            this.pump = null;
            return;
        }
        const now = Date.now();
        const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
        this.lastFrame = now;
        const p = this.pointer;
        const key = this.keys.shift();
        s.frame(dt, p.x, p.y, p.down, p.rdown, p.wheel, key?.key, key?.shift, p.cancel);
        p.cancel = false;
        p.wheel = 0;
        this.pending = this.keys.length > 0;
        this.awaiting = true;
    }

    // --- сообщения webview -----------------------------------------------------

    private async message(m: any): Promise<void> {
        switch (m.type) {
            case 'choose-content':
                if (this.uri) await vscode.commands.executeCommand('kompot.chooseContent', this.uri);
                break;
            case 'ready':
                this.schedule(0);
                break;
            case 'font-metrics': {
                if (m.revision !== this.revision || m.file !== this.uri?.fsPath) break;
                const changed: FontMetrics = {};
                for (const [font, values] of Object.entries(m.metrics || {})) {
                    if (!font || font.length > 512 || !values || typeof values !== 'object') continue;
                    const cached = this.fontMetrics[font] ||= {};
                    for (const [cp, width] of Object.entries(values)) {
                        if (typeof width !== 'number' || !Number.isFinite(width) || width < 0 || width > 8192) continue;
                        if (cp !== 'lh' && (!/^\d+$/.test(cp) || +cp > 0x10ffff)) continue;
                        if (cached[cp] !== width) {
                            cached[cp] = width;
                            (changed[font] ||= {})[cp] = width;
                        }
                    }
                    if (changed[font]) changed[font].lh = cached.lh;
                }
                if (!Object.keys(changed).length) break;
                if (this.session) {
                    this.session.metrics(changed);
                    this.pending = true;
                    this.kick();
                } else this.schedule(0);
                break;
            }
            case 'refresh':
                this.refresh();
                break;
            case 'reveal': {
                if (!m.source || !this.uri) break;
                const content = findContent(this.uri.fsPath, config(this.uri).contentPath) || '';
                const file = path.isAbsolute(m.source) ? m.source : path.resolve(content, m.source);
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
                const line = Math.max(0, (m.line || 1) - 1);
                await vscode.window.showTextDocument(doc, {viewColumn: vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.Active,
                    selection: new vscode.Range(line, 0, line, 0)});
                break;
            }
            case 'interactive':
                if (m.name) this.startSession(m.name);
                else this.stopSession();
                break;
            case 'input':
                if (m.name !== this.sessionName) break;
                this.pointer.x = m.x;
                this.pointer.y = m.y;
                this.pointer.down = m.down;
                this.pointer.rdown = m.rdown;
                this.pointer.wheel += m.wheel || 0;
                this.pointer.cancel ||= !!m.cancel;
                this.pending = true;
                this.kick();
                break;
            case 'key':
                if (m.name !== this.sessionName || !['tab', 'enter', 'space', 'escape', 'left', 'right', 'up', 'down'].includes(m.key)) break;
                this.keys.push({key: m.key, shift: !!m.shift});
                this.pending = true;
                this.kick();
                break;
            case 'snapshot': {
                const cb = this.snapshots.get(m.id);
                this.snapshots.delete(m.id);
                cb?.(m.images);
                break;
            }
            case 'scroll': {
                const cb = this.scrolls.get(m.id);
                this.scrolls.delete(m.id);
                cb?.({top: m.top, max: m.max});
                break;
            }
            case 'rendered': {
                this.rasterFontCount = m.rasterFontCount || 0;
                this.rasterError = m.rasterError || "";
                const waiters = this.rendered;
                this.rendered = [];
                waiters.forEach(w => w(m.count));
                break;
            }
        }
    }

    /** Для тестов: дождаться следующей отрисовки и снять PNG всех превью. */
    waitRendered(): Promise<number> {
        return new Promise(resolve => this.rendered.push(resolve));
    }

    snapshot(): Promise<Record<string, string>> {
        const id = Math.random();
        return new Promise(resolve => {
            this.snapshots.set(id, resolve);
            this.view?.webview.postMessage({type: 'snapshot', id});
        });
    }

    /** Для тестов: измерить или установить прокрутку панели. */
    scroll(top?: number): Promise<{top: number; max: number}> {
        const id = Math.random();
        return new Promise(resolve => {
            this.scrolls.set(id, resolve);
            this.view?.webview.postMessage({type: 'scroll', id, top});
        });
    }

    /** Для тестов: ввод в интерактивное превью. */
    input(name: string, x: number, y: number, down: boolean): void {
        this.message({type: 'input', name, x, y, down, rdown: false, wheel: 0});
    }

    interactive(name: string | null): void {
        this.message({type: 'interactive', name});
    }

    dispose(): void {
        this.revision++;if(this.timer)clearTimeout(this.timer);
        this.stopSession();cleanupVcts(this.vcts);this.vcts=null;
        this.view = null;
    }
}
