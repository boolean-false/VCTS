// Запуск хоста Kompot (lua/host.lua) встроенным или выбранным Lua: рендер превью,
// интерактивная сессия, интроспекция API. На Linux процесс ограничен
// prlimit по памяти и процессорному времени.
import {spawn, ChildProcess} from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {findPack} from './project';

export type Override = {module: string; text: string; file: string};
export type FontMetrics = Record<string, Record<string, number>>;
export type HostOptions = {lua?: string; sandbox?: boolean; timeout?: number; fontMetrics?: FontMetrics; projectFile?: string};

const HOST = path.join(__dirname, '..', '..', 'lua', 'host.lua');

/** An explicit override, otherwise the interpreter shipped with the extension. */
export function findLua(configured = ''): string {
    return configured || process.execPath;
}
const RUNTIME = path.join(__dirname, '..', 'runtime', 'lua.js');
const runtimeEnv = () => ({...process.env, ELECTRON_RUN_AS_NODE: '1'});

function hasPrlimit(): boolean {
    return process.platform === 'linux' && fs.existsSync('/usr/bin/prlimit');
}

// Подмены пишутся во временные файлы: хост читает их вместо файлов на диске.
function writeOverrides(overrides: Override[], metrics: FontMetrics = {}): {args: string[]; cleanup: () => void} {
    if (!overrides.length && !Object.keys(metrics).length) return {args: [], cleanup: () => {}};
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kompot-lens-'));
    const args: string[] = [];
    overrides.forEach((o, i) => {
        const tmp = path.join(dir, `${i}.lua`);
        fs.writeFileSync(tmp, o.text);
        args.push('--override', o.module, tmp, o.file);
    });
    if (Object.keys(metrics).length) {
        const file = path.join(dir, 'metrics.lua');
        const quote = (s: string) => '"' + Array.from(Buffer.from(s), b => '\\' + String(b).padStart(3, '0')).join('') + '"';
        const entries = Object.entries(metrics).map(([font, values]) =>
            `[${quote(font)}]={${Object.entries(values).filter(([cp, width]) =>
                (cp === 'lh' || /^\d+$/.test(cp)) && Number.isFinite(width) && width >= 0)
                .map(([cp, width]) => `[${cp === 'lh' ? '"lh"' : cp}]=${width}`).join(',')}}`);
        fs.writeFileSync(file, 'return {' + entries.join(',') + '}');
        args.push('--metrics', file);
    }
    return {args, cleanup: () => fs.rmSync(dir, {recursive: true, force: true})};
}

function projectArgs(file?: string): string[] {
    const pack = file && findPack(file);
    return pack ? ['--pack', pack.id, pack.root] : [];
}

function command(configured: string | undefined, args: string[], sandbox: boolean, cpu: number): [string, string[]] {
    const lua = findLua(configured);
    const bundled = !configured;
    const argv = bundled
        ? ['--max-old-space-size=256', '--wasm-max-mem-pages=8192', RUNTIME, HOST, ...args]
        : [HOST, ...args];
    if (sandbox && hasPrlimit()) {
        const limits = bundled ? [`--cpu=${cpu}`] : [`--as=${1024 * 1024 * 1024}`, `--cpu=${cpu}`];
        return ['/usr/bin/prlimit', [...limits, '--', lua, ...argv]];
    }
    return [lua, argv];
}

/** Один запуск хоста: ответ - JSON-объект. */
export function runHost(mode: 'render' | 'introspect', content: string, modules: string[], extra: string[],
                        overrides: Override[], opts: HostOptions = {}): Promise<any> {
    const ov = writeOverrides(overrides, opts.fontMetrics);
    const [cmd, args] = command(opts.lua, [mode, content, modules.join(','), ...extra, ...ov.args, ...projectArgs(opts.projectFile)], opts.sandbox !== false, 10);
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, {cwd: content, env: runtimeEnv(), stdio: ['ignore', 'pipe', 'pipe']});
        const out: Buffer[] = [];
        let err = '';
        let size = 0;
        const timer = setTimeout(() => { child.kill('SIGKILL'); }, opts.timeout ?? 15000);
        child.stdout.on('data', (b: Buffer) => { size += b.length; if (size < 64 * 1024 * 1024) out.push(b); });
        child.stderr.on('data', (b: Buffer) => { if (err.length < 8000) err += b.toString(); });
        child.on('error', e => { clearTimeout(timer); ov.cleanup(); reject(e); });
        child.on('close', (code, signal) => {
            clearTimeout(timer);
            ov.cleanup();
            const text = Buffer.concat(out).toString('utf8').trim();
            if (!text) {
                return reject(new Error(err.trim() || `Хост Kompot завершился без ответа (${signal || code})`));
            }
            try {
                resolve(JSON.parse(text));
            } catch (e) {
                reject(new Error(`Ответ хоста не разобран: ${(e as Error).message}\n${err}`));
            }
        });
    });
}

/** Интерактивная сессия превью: кадры по событиям ввода. */
export class Session {
    private child: ChildProcess;
    private buffer = '';
    private cleanup: () => void;
    private closed = false;
    onDocument: (doc: any) => void = () => {};
    onExit: (error: string | null) => void = () => {};

    constructor(content: string, modules: string[], name: string, overrides: Override[], opts: HostOptions = {}) {
        const ov = writeOverrides(overrides, opts.fontMetrics);
        this.cleanup = ov.cleanup;
        // долгая сессия: предел процессорного времени больше
        const [cmd, args] = command(opts.lua, ['session', content, modules.join(','), name, ...ov.args, ...projectArgs(opts.projectFile)], opts.sandbox !== false, 3600);
        this.child = spawn(cmd, args, {cwd: content, env: runtimeEnv(), stdio: ['pipe', 'pipe', 'pipe']});
        let err = '';
        this.child.stdout!.on('data', (b: Buffer) => {
            this.buffer += b.toString('utf8');
            let nl;
            while ((nl = this.buffer.indexOf('\n')) >= 0) {
                const line = this.buffer.slice(0, nl);
                this.buffer = this.buffer.slice(nl + 1);
                if (!line.trim()) continue;
                try {
                    const doc = JSON.parse(line);
                    if (doc.ok === false) err = doc.error;
                    else this.onDocument(doc);
                } catch { /* неполная строка */ }
            }
        });
        this.child.stderr!.on('data', (b: Buffer) => { if (err.length < 8000) err += b.toString(); });
        this.child.on('close', () => {
            this.closed = true;
            this.cleanup();
            this.onExit(err.trim() || null);
        });
        this.child.on('error', e => { err = e.message; });
    }

    /** Кадр: dt в секундах, координаты в пикселях превью (x < 0 - указатель вне превью). */
    frame(dt: number, x: number, y: number, down: boolean, rdown: boolean, wheel: number, key = '', shift = false, cancel = false): void {
        if (this.closed) return;
        this.child.stdin!.write(`frame ${dt.toFixed(4)} ${x.toFixed(4)} ${y.toFixed(4)} ${down ? 1 : 0} ${rdown ? 1 : 0} ${wheel} ${key || '-'} ${shift ? 1 : 0} ${cancel ? 1 : 0}\n`);
    }

    /** Обновление измерений без перезапуска состояния интерактивного UI. */
    metrics(metrics: FontMetrics): void {
        if (this.closed) return;
        for (const [font, values] of Object.entries(metrics)) {
            const encodedFont = Buffer.from(font).toString('hex');
            const pairs = Object.entries(values).filter(([cp]) => /^\d+$/.test(cp))
                .flatMap(([cp, width]) => [cp, String(width)]).join(' ');
            this.child.stdin!.write(`metrics ${encodedFont} ${values.lh} ${pairs}\n`);
        }
    }

    get alive(): boolean {
        return !this.closed;
    }

    dispose(): void {
        if (this.closed) return;
        try { this.child.stdin!.write('quit\n'); } catch { /* уже закрыт */ }
        setTimeout(() => { if (!this.closed) this.child.kill('SIGKILL'); }, 500);
    }
}
