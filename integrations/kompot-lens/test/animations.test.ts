import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {runHost, Session, findLua} from '../src/host';

const content = process.env.KOMPOT_CONTENT || path.resolve(__dirname, '../../../game/content');
const skip = !findLua() || !fs.existsSync(path.join(content, 'kompot/modules/ui/guide/animations.lua'));
const moduleName = 'kompot:ui/previews';

test('the current gallery and all advanced animation previews export without errors', {skip}, async () => {
    const result = await runHost('render', content, [moduleName], [], [], {sandbox: false});
    assert.equal(result.ok, true, result.error);
    for (const doc of result.previews) assert.ok(!doc.error, `${doc.name}: ${doc.error}`);
    for (const title of [
        'Кривые движения', 'Настройка пружины', 'Параллельные переходы',
        'Последовательность из четырёх шагов', 'Каскадное появление',
        'Ключевые кадры и перемотка', 'Цикл туда и обратно', 'Волна и фазовые сдвиги',
        'Орбиты и вложенное движение', 'Прерывание и разворот перехода',
        'Многоэтапная загрузка', 'Перестановка с сохранением движения',
        'Перетаскивание с пружинным возвратом', 'Смена сцены в несколько фаз',
        'Цепочка по завершению переходов', 'Временная шкала: пауза и обратный ход',
    ]) {
        assert.ok(result.previews.some((doc: any) => doc.name === 'Kompot: ' + title), title);
    }
});

test('interactive host advances, finishes and restarts an animation sequence', {skip}, async () => {
    const session = new Session(content, [moduleName], 'Kompot: Последовательность из четырёх шагов', [], {sandbox: false});
    const queue: any[] = [];
    let receive: ((doc: any) => void) | undefined;
    session.onDocument = doc => {
        if (receive) { const resolve = receive; receive = undefined; resolve(doc); }
        else queue.push(doc);
    };
    const next = () => new Promise<any>((resolve, reject) => {
        if (queue.length) return resolve(queue.shift());
        const timer = setTimeout(() => reject(new Error('animation frame timeout')), 5000);
        receive = doc => { clearTimeout(timer); resolve(doc); };
    });
    const frame = async (dt: number, key = '') => {
        session.frame(dt, -1, -1, false, false, 0, key);
        const doc = await next();
        assert.ok(!doc.error, doc.error);
        return doc;
    };
    try {
        let doc = await next();
        assert.equal(doc.animating, true);
        const first = JSON.stringify(doc.prims);
        doc = await frame(0.2);
        assert.notEqual(JSON.stringify(doc.prims), first, 'animation must change the exported frame');
        for (let i = 0; i < 20; i++) doc = await frame(0.2);
        assert.ok(doc.prims.some((p: any) => p.text === 'Готово'));
        assert.equal(doc.animating, false, 'finished sequence must stop requesting frames');
        await frame(0, 'tab');
        doc = await frame(0, 'enter');
        assert.ok(doc.prims.some((p: any) => p.text === '1. Движение'));
        assert.equal(doc.animating, true, 'replay must restart the timeline');
    } finally {
        session.dispose();
    }
});
