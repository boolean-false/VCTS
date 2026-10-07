// Запускает интеграционные тесты в VS Code (отдельный профиль, окно
// откроется на время теста). Рабочая область - каталог content с паками.
//   KOMPOT_CONTENT=... KOMPOT_SNAPSHOTS=dir node out/scripts/run-extension-tests.js
import {spawnSync} from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

async function main() {
const root = path.resolve(__dirname, '../..');
const content = process.env.KOMPOT_CONTENT || path.resolve(root, '../game/content');
const workspace = process.env.KOMPOT_WORKSPACE || path.join(content, 'kompot');
const code = process.env.VSCODE_PATH || 'code';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kompot-lens-test-'));
const extensions = path.join(profile, 'extensions');
fs.mkdirSync(extensions);
const installed = path.join(os.homedir(), '.vscode', 'extensions');
const luaLS = process.env.KOMPOT_LUALS_EXTENSION || (fs.existsSync(installed)
    ? fs.readdirSync(installed).filter(name => name.startsWith('sumneko.lua-')).sort().at(-1) : undefined);
const luaLSSource = luaLS && (path.isAbsolute(luaLS) ? luaLS : path.join(installed, luaLS));
if (!luaLSSource || !fs.existsSync(luaLSSource)) {
    fs.rmSync(profile, {recursive: true, force: true});
    throw new Error('Install LuaLS (sumneko.lua) or set KOMPOT_LUALS_EXTENSION to its extension directory');
}
fs.symlinkSync(luaLSSource, path.join(extensions, path.basename(luaLSSource)), 'dir');
const report = path.join(profile, 'report.txt');
const result = spawnSync(code, [
    '--new-window',
    `--user-data-dir=${path.join(profile, 'user')}`,
    `--extensions-dir=${extensions}`,
    '--disable-workspace-trust',
    '--skip-welcome', '--skip-release-notes',
    `--extensionDevelopmentPath=${process.env.KOMPOT_EXTENSION_PATH || root}`,
    `--extensionTestsPath=${path.join(root, 'out', 'test', 'extension', ['font-parity','transforms','setup','corners','vcts'].includes(process.env.KOMPOT_TEST_ENTRY || '') ? process.env.KOMPOT_TEST_ENTRY + '.js' : 'index.js')}`,
    workspace,
], {stdio: 'inherit', env: {...process.env, KOMPOT_CONTENT: content, KOMPOT_REPORT: report}});
// The macOS CLI returns before extension tests finish; --wait can hang on folders.
const deadline=Date.now()+60000;
while(result.status===0 && !fs.existsSync(report) && Date.now()<deadline) await new Promise(resolve=>setTimeout(resolve,250));
if(fs.existsSync(report))await new Promise(resolve=>setTimeout(resolve,500));
const text = fs.existsSync(report) ? fs.readFileSync(report, 'utf8') : '';
if (text) console.log(text);
else console.error('VS Code не создал отчёт интеграционных проверок.');
const extensionProblems: string[] = [];
const inspectLogs = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) inspectLogs(file);
        else if (entry.name === 'renderer.log') {
            extensionProblems.push(...fs.readFileSync(file, 'utf8').split('\n').filter(line =>
                line.includes('[BooleanFalse.kompot-lens]') && /\[(error|warning)\]/.test(line)));
        }
    }
};
inspectLogs(path.join(profile, 'user', 'logs'));
if (extensionProblems.length) console.error(extensionProblems.join('\n'));
if (text && process.env.KOMPOT_REPORT) fs.writeFileSync(process.env.KOMPOT_REPORT, text);
if (process.env.KOMPOT_KEEP_PROFILE) console.log('Test profile:', profile);
else fs.rmSync(profile, {recursive: true, force: true});
process.exit(result.status !== 0 || !text || text.includes('FAIL ') || extensionProblems.length > 0 ? 1 : 0);

}
main().catch(error=>{console.error(error);process.exitCode=1;});
