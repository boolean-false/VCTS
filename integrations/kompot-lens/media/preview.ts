/* Webview превью Kompot: карточки превью файла, масштаб, переход к коду,
   интерактивный режим (ввод мышью -> кадры хоста). Рисует media/render.ts. */
(function () {
    'use strict';
    const vscode = (window as any).acquireVsCodeApi();
    const R = (window as any).KompotRender;
    const $ = (id: string) => document.getElementById(id)!;

    type Doc = any;
    const saved = vscode.getState() || {};
    const state = {
        zoom: saved.zoom || 1,
        fit: saved.fit !== false,
        docs: [] as Doc[],
        file: '',
        revision: 0,
        uris: {fonts: {} as Record<string, string>, images: {} as Record<string, string>},
        interactive: null as string | null,
        focus: null as string | null,
    };

    // --- ресурсы: FreeType, PNG-страницы шрифтов и картинки ------------------------------
    const rasterFonts = new Map<string, any>();
    const wasmUri = document.querySelector<HTMLScriptElement>('script[data-wasm]')!.dataset.wasm!;
    let wasmBytes: Promise<Uint8Array> | undefined;
    let rasterError = '';
    function loadRasterFont(uri: string): Promise<any> {
        wasmBytes ||= fetch(wasmUri).then(r => {if (!r.ok) throw new Error('FreeType WASM not loaded'); return r.arrayBuffer();}).then(b => new Uint8Array(b));
        return Promise.all([wasmBytes, fetch(uri).then(r => {if (!r.ok) throw new Error('TTF not loaded'); return r.arrayBuffer();})])
            .then(async ([wasmBinary, bytes]) => {
                const ft = await (window as any).KompotFreeTypeInit({wasmBinary});
                try {return new (window as any).KompotRasterFont(ft, new Uint8Array(bytes));}
                catch(e){ft.Cleanup();throw e;}
            });
    }
    const fontUris = new Map<string, string>();
    const fontLoads = new Map<string, Promise<void>>();
    const images = new Map<string, HTMLImageElement>();
    const imageLoads = new Map<string, Promise<void>>();
    const imageUris = new Map<string, string>();

    function loadFont(file: string, kind?: string, codepoints: number[] = []): Promise<void> {
        const uri = state.uris.fonts[file] || '';
        if (fontUris.get(file) !== uri) {
            fontUris.set(file, uri);
            fontLoads.delete(file);
            rasterFonts.get(file)?.dispose();
            rasterFonts.delete(file);
        }
        if(!uri) return Promise.reject(new Error('Не найден ресурс шрифта: ' + file));
        if (kind === 'bitmap') {
            if(!fontLoads.has(file)){
                const font=new (window as any).KompotBitmapFont(uri);
                rasterFonts.set(file,font);
                fontLoads.set(file,Promise.resolve());
            }
            return fontLoads.get(file)!.then(()=>rasterFonts.get(file)?.load(codepoints));
        }
        let p = fontLoads.get(file);
        if (p) return p;
        p = loadRasterFont(uri).then(font => {
            if (fontUris.get(file) === uri) rasterFonts.set(file,font);
            else font.dispose();
        });
        fontLoads.set(file, p);
        return p;
    }

    function loadImage(src: string): Promise<void> {
        const uri = state.uris.images[src] || '';
        if (imageUris.get(src) !== uri) {
            imageUris.set(src, uri);
            imageLoads.delete(src);
            images.delete(src);
        }
        if (!uri) return Promise.resolve();
        const cached = imageLoads.get(src);
        if (cached) return cached;
        const p: Promise<void> = new Promise(resolve => {
            const img = new Image();
            img.onload = () => { if (imageUris.get(src) === uri) images.set(src, img); resolve(); };
            img.onerror = () => { if (imageUris.get(src) === uri) imageLoads.delete(src); resolve(); };
            img.src = uri;
        });
        imageLoads.set(src, p);
        return p;
    }

    const res = {
        fontGlyph: (file: string, size: number, cp: number, color: string) => rasterFonts.get(file)?.image(size, cp, color),
        image: (src: string) => images.get(src) || null,
        createCanvas: (w: number, h: number) => {
            const c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            return c;
        },
    };

    function resourceError(error: any) {
        rasterError=String(error);
        const banner=$('banner');banner.hidden=false;
        banner.textContent='Не удалось загрузить шрифт превью: ' + rasterError;
        $('status').textContent='ошибка шрифта';
    }

    async function ensureResources(docs: Doc[]) {
        const loads: Promise<void>[] = [];
        for (const d of docs) {
            const r = R.resources(d);
            (d.font_requests || []).forEach((q: any) => loads.push(loadFont(q.file,q.kind,q.codepoints)));
            for (const p of R.primitives(d)) if(p.font_file) loads.push(loadFont(p.font_file,p.font_kind,
                Array.from(p.text || '').map((ch: string)=>ch.codePointAt(0))));
            r.images.forEach((s: string) => loads.push(loadImage(s)));
        }
        await Promise.all(loads);
    }

    // Измеряем в логических пикселях: масштаб карточки и DPR не меняют раскладку.
    function measureFonts(docs: Doc[], revision: number): boolean {
        const metrics: Record<string, Record<string, number>> = {};
        for (const doc of docs) for (const q of doc.font_requests || []) {
            const raster = rasterFonts.get(q.file);
            if (!raster) continue;
            const values = metrics[q.font] ||= {};
            values.lh = raster?.lineHeight?.(q.size) ?? R.engineLineHeight(q.size);
            // Движок размещает отдельные глифы с целочисленным шагом.
            for (const cp of q.codepoints) values[cp] = raster.glyph(q.size, cp).layoutAdvance;
        }
        if (!Object.keys(metrics).length) return false;
        vscode.postMessage({type: 'font-metrics', file: state.file, revision, metrics});
        return true;
    }

    // --- отрисовка карточек ------------------------------------------------
    // Масштаб карточки: общий, но в режиме «Вписать» не шире панели.
    function zoomOf(doc: Doc): number {
        if (!state.fit) return state.zoom;
        const avail = Math.max(120, document.body.clientWidth - 32);
        return Math.min(state.zoom, avail / doc.width);
    }

    function draw(canvas: HTMLCanvasElement, doc: Doc) {
        const dpr = window.devicePixelRatio || 1;
        const zoom = zoomOf(doc);
        const scale = zoom * dpr;
        canvas.width = Math.max(1, Math.round(doc.width * scale));
        canvas.height = Math.max(1, Math.round(doc.height * scale));
        canvas.style.width = `${doc.width * zoom}px`;
        canvas.style.height = `${doc.height * zoom}px`;
        canvas.dataset.zoom = String(zoom);
        const ctx = canvas.getContext('2d')!;
        R.render(ctx, doc, scale, res);
    }

    const CURSORS: Record<string, string> = {pointer: 'pointer', text: 'text', arrow: 'default', move: 'move', grab: 'grab'};

    function card(doc: Doc): HTMLElement {
        const el = document.createElement('article');
        el.className = 'card';
        el.dataset.name = doc.name;
        const live = state.interactive === doc.name;
        if (live) el.classList.add('live');
        if (state.focus === doc.name) el.classList.add('focus');

        const head = document.createElement('header');
        const title = document.createElement('button');
        title.className = 'title';
        title.textContent = doc.name;
        title.title = 'Перейти к объявлению';
        title.onclick = () => vscode.postMessage({type: 'reveal', source: doc.source, line: doc.line});
        const size = document.createElement('span');
        size.className = 'size';
        size.textContent = `${doc.width} × ${doc.height}`;
        const play = document.createElement('button');
        play.className = 'play';
        play.textContent = live ? '■ Стоп' : '▶ Интерактивно';
        play.title = live ? 'Выключить интерактивный режим' : 'Интерактивный режим: мышь, анимации, состояние';
        play.onclick = () => {
            state.interactive = live ? null : doc.name;
            vscode.postMessage({type: 'interactive', name: state.interactive});
            rebuild();
        };
        head.append(title, size);
        head.append(play);
        el.append(head);

        const frame = document.createElement('div');
        frame.className = 'frame';
        const canvas = document.createElement('canvas');
        canvas.dataset.name = doc.name;
        frame.append(canvas);
        el.append(frame);
        draw(canvas, doc);
        if (live) {
            canvas.tabIndex = 0;
            canvas.setAttribute('aria-label', `Интерактивное превью «${doc.name}»`);
            attachInput(canvas, doc.name);
        }

        if (doc.error) {
            const err = document.createElement('pre');
            err.className = 'error';
            err.textContent = doc.error;
            el.append(err);
        }
        return el;
    }

    const inputCleanups: (()=>void)[] = [];
    function rebuild(scrollToFocus = false) {
        for(const cleanup of inputCleanups.splice(0)) cleanup();
        const list = $('list');
        const scroller = document.scrollingElement || document.documentElement;
        const scrollTop = scroller.scrollTop;
        const navBottom = document.querySelector('nav')?.getBoundingClientRect().bottom || 0;
        const visibleCard = Array.from(list.querySelectorAll<HTMLElement>('article.card'))
            .find(el => el.getBoundingClientRect().bottom > navBottom);
        const anchor = visibleCard?.dataset.name;
        const anchorTop = visibleCard?.getBoundingClientRect().top;
        list.textContent = '';
        const groups = new Map<string, Doc[]>();
        for (const d of state.docs) {
            const g = d.group || '';
            if (!groups.has(g)) groups.set(g, []);
            groups.get(g)!.push(d);
        }
        for (const [g, docs] of groups) {
            const section = document.createElement('section');
            if (g) {
                const h = document.createElement('h2');
                h.textContent = g;
                section.append(h);
            }
            const grid = document.createElement('div');
            grid.className = 'grid';
            docs.forEach(d => grid.append(card(d)));
            section.append(grid);
            list.append(section);
        }
        $('empty').hidden = state.docs.length > 0;
        $('zoom-value').textContent = Math.round(state.zoom * 100) + '%';
        $('fit').setAttribute('aria-pressed', String(state.fit));
        if (scrollToFocus && state.focus) {
            const el = document.querySelector(`article[data-name="${CSS.escape(state.focus)}"]`);
            el?.scrollIntoView({block: 'nearest'});
        } else {
            scroller.scrollTop = scrollTop;
            if (anchor && anchorTop !== undefined) {
                const el = Array.from(list.querySelectorAll<HTMLElement>('article.card'))
                    .find(card => card.dataset.name === anchor);
                if (el) scroller.scrollTop += el.getBoundingClientRect().top - anchorTop;
            }
        }
    }

    // --- интерактивный режим -----------------------------------------------
    function attachInput(canvas: HTMLCanvasElement, name: string) {
        let down=false,rdown=false,lastX=-1,lastY=-1;
        const controller=new AbortController(), options={signal:controller.signal};
        const send=(e:MouseEvent,wheel=0)=>{
            const rect=canvas.getBoundingClientRect(),z=parseFloat(canvas.dataset.zoom || '1');
            lastX=(e.clientX-rect.left)/z;lastY=(e.clientY-rect.top)/z;
            vscode.postMessage({type:'input',name,x:lastX,y:lastY,down,rdown,wheel});
        };
        const cancel=()=>{
            if(!down && !rdown) return;
            down=rdown=false;
            vscode.postMessage({type:'input',name,x:lastX,y:lastY,down:false,rdown:false,wheel:0,cancel:true});
        };
        inputCleanups.push(()=>{cancel();controller.abort();});
        canvas.addEventListener('pointermove',e=>send(e),options);
        canvas.addEventListener('pointerdown',e=>{
            if(e.button!==0 && e.button!==2) return;
            canvas.focus();canvas.setPointerCapture(e.pointerId);
            if(e.button===0) down=true;else rdown=true;
            send(e);
        },options);
        canvas.addEventListener('pointerup',e=>{
            if(e.button===0) down=false;if(e.button===2) rdown=false;
            send(e);
            if(!down && !rdown && canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
        },options);
        canvas.addEventListener('pointercancel',cancel,options);
        canvas.addEventListener('lostpointercapture',cancel,options);
        window.addEventListener('blur',cancel,options);
        canvas.addEventListener('pointerleave',()=>{
            if(!down && !rdown) vscode.postMessage({type:'input',name,x:-1,y:-1,down:false,rdown:false,wheel:0});
        },options);
        canvas.addEventListener('wheel',e=>{e.preventDefault();send(e,e.deltaY<0?1:-1);},{...options,passive:false});
        canvas.addEventListener('contextmenu',e=>e.preventDefault(),options);
        canvas.addEventListener('keydown',e=>{
            if(e.ctrlKey || e.metaKey || e.altKey) return;
            const key=e.key===' '?'space':e.key.toLowerCase().replace(/^arrow/,'');
            if(!['tab','enter','space','escape','left','right','up','down'].includes(key)) return;
            e.preventDefault();vscode.postMessage({type:'key',name,key,shift:e.shiftKey});
            if(key==='escape'){cancel();canvas.blur();}
        },options);
    }

    function updateFrame(name: string, doc: Doc) {
        const i = state.docs.findIndex(d => d.name === name);
        if (i < 0) return;
        state.docs[i] = doc;
        const canvas = document.querySelector(`canvas[data-name="${CSS.escape(name)}"]`) as HTMLCanvasElement | null;
        if (!canvas) return;
        const revision = state.revision;
        ensureResources([doc]).then(() => {
            if (revision !== state.revision || state.docs[i] !== doc) return;
            if (measureFonts([doc], revision)) return;
            draw(canvas, doc);
            canvas.style.cursor = CURSORS[doc.cursor] || 'default';
            const pre = canvas.closest('article')!.querySelector('pre.error');
            if (doc.error && !pre) rebuild();
            else if (pre) pre.textContent = doc.error || '';
        }).catch(resourceError);
    }

    // --- снимок для тестов: каждое превью в PNG в масштабе 1 ----------------
    function snapshot(): Record<string, string> {
        const out: Record<string, string> = {};
        for (const d of state.docs) {
            const c = res.createCanvas(d.width, d.height);
            R.render(c.getContext('2d'), d, 1, res);
            out[d.name] = c.toDataURL('image/png');
        }
        return out;
    }

    // --- сообщения ----------------------------------------------------------
    window.addEventListener('message', async e => {
        const m = e.data;
        if (m.type === 'render') {
            const sameFile=state.file===m.file;
            const keepLastGood = !!m.error && state.file === m.file && state.docs.length > 0 && m.previews.length === 0;
            state.file = m.file;
            state.revision = m.revision;
            state.uris = m.uris;
            $('file').textContent = m.name || '';
            $('status').textContent = m.error ? (keepLastGood ? 'ошибка · последнее успешное превью' : 'ошибка')
                : `${m.previews.length} превью · ${m.elapsed} мс`;
            const banner = $('banner');
            banner.hidden = !m.error;
            banner.textContent = m.error || '';
            if (!keepLastGood) {
                try { await ensureResources(m.previews); }
                catch(e) {
                    if(m.revision !== state.revision) return;
                    if(!sameFile){state.docs=[];rebuild();}
                    resourceError(e);
                    vscode.postMessage({type:'rendered',count:state.docs.length,rasterFontCount:rasterFonts.size,rasterError});
                    return;
                }
                rasterError='';
                if (m.revision !== state.revision) return;
                if (measureFonts(m.previews, m.revision)) return;
                state.docs = m.previews;
            }
            if (state.interactive && !state.docs.some(d => d.name === state.interactive)) state.interactive = null;
            rebuild();
            vscode.postMessage({type: 'rendered', count: state.docs.length, rasterFontCount: rasterFonts.size, rasterError});
        } else if (m.type === 'frame') {
            if (m.uris) {
                Object.assign(state.uris.fonts, m.uris.fonts);
                Object.assign(state.uris.images, m.uris.images);
            }
            updateFrame(m.name, m.doc);
        } else if (m.type === 'focus') {
            state.focus = m.name;
            rebuild(true);
        } else if (m.type === 'message') {
            state.docs = [];
            rebuild();
            $('file').textContent = m.name || '';
            $('status').textContent = '';
            const banner = $('banner');
            banner.hidden = false;
            banner.textContent = m.text;
            if (m.action === 'choose-content') {
                const button = document.createElement('button');
                button.textContent = 'Выбрать каталог паков';
                button.addEventListener('click', () => vscode.postMessage({type: 'choose-content'}));
                banner.append(document.createElement('br'), button);
            }
        } else if (m.type === 'snapshot') {
            vscode.postMessage({type: 'snapshot', id: m.id, images: snapshot()});
        } else if (m.type === 'scroll') {
            const scroller = document.scrollingElement || document.documentElement;
            if (typeof m.top === 'number') scroller.scrollTop = m.top;
            vscode.postMessage({type: 'scroll', id: m.id, top: scroller.scrollTop,
                max: scroller.scrollHeight - scroller.clientHeight});
        } else if (m.type === 'interactive-started') {
            if (state.interactive !== m.name) {
                state.interactive = m.name;
                rebuild();
            }
        } else if (m.type === 'interactive-ended') {
            if (state.interactive === m.name) {
                state.interactive = null;
                rebuild();
            }
        }
    });

    function setZoom(z: number) {
        state.zoom = Math.max(0.25, Math.min(4, Math.round(z * 100) / 100));
        vscode.setState({...vscode.getState(), zoom: state.zoom});
        rebuild();
    }
    $('zoom-out').onclick = () => setZoom(state.zoom / 1.25);
    $('zoom-in').onclick = () => setZoom(state.zoom * 1.25);
    $('zoom-value').onclick = () => setZoom(1);
    $('refresh').onclick = () => vscode.postMessage({type: 'refresh'});
    $('fit').onclick = () => {
        state.fit = !state.fit;
        vscode.setState({...vscode.getState(), fit: state.fit});
        rebuild();
    };
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => { if (state.fit) rebuild(); }, 100);
    });
    window.addEventListener('wheel', e => {
        if (e.ctrlKey) {
            e.preventDefault();
            setZoom(state.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
        }
    }, {passive: false});

    vscode.postMessage({type: 'ready'});
})();
