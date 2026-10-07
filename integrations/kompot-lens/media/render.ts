/* Отрисовка документа превью Kompot (kompot-preview/1) на Canvas 2D.
   Формат описан в kompot/docs/PREVIEW.md. Без зависимостей: работает в webview и
   в тестах Node (с поддельным контекстом). */
(function (root: any, factory: () => any) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.KompotRender = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // VoxelCore Font/Label: lineHeight=size, yoffset=size/2; пробелы и
    // пустые растры используют glyphInterval=size/2 (а не ширину из TTF).
    function engineLineHeight(size: number): number {
        return Math.floor(size) + Math.floor(size / 2);
    }

    function engineAdvance(ctx: any, size: number, ch: string): number {
        if (' \t\n\f\r'.includes(ch)) return Math.floor(size / 2);
        const m = ctx.measureText(ch);
        if (m.actualBoundingBoxLeft === 0 && m.actualBoundingBoxRight === 0 &&
            m.actualBoundingBoxAscent === 0 && m.actualBoundingBoxDescent === 0) return Math.floor(size / 2);
        return Math.round(m.width);
    }

    function rgba(hex: string, alphaMul = 1): string {
        const h = (hex || '#000000FF').replace('#', '');
        const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
        const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
        return `rgba(${r},${g},${b},${+(a * alphaMul).toFixed(4)})`;
    }

    function alphaOf(hex: string): number {
        const h = (hex || '').replace('#', '');
        return h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    }

    function cornerValues(radius: any, w: number, h: number): number[] {
        w=Math.max(0,w);h=Math.max(0,h);
        if (typeof radius !== 'object' || radius === null) return Array(4).fill(Math.max(0,Math.min(radius || 0,w/2,h/2)));
        const r=['top_left','top_right','bottom_right','bottom_left'].map(k => {
            const v=radius[k] || 0;return v===Infinity ? Math.min(w,h)/2 : Math.max(0,v);
        });
        let scale=1;
        for (const [length,sum] of [[w,r[0]+r[1]],[w,r[3]+r[2]],[h,r[0]+r[3]],[h,r[1]+r[2]]]) {
            if(sum>0) scale=Math.min(scale,length/sum);
        }
        return r.map(v=>v*scale);
    }
    function cornerDistance(x:number,y:number,w:number,h:number,r:number[],kind="rounded"):number {
        const [a,b,c,d]=r;
        let distance=Math.min(x,y,w-x,h-y);
        if(kind==='cut') return Math.min(distance,(x+y-a)/Math.SQRT2,(w-x+y-b)/Math.SQRT2,
            (w-x+h-y-c)/Math.SQRT2,(x+h-y-d)/Math.SQRT2);
        if(a>0 && x<a && y<a) distance=Math.min(distance,a-Math.hypot(x-a,y-a));
        if(b>0 && x>w-b && y<b) distance=Math.min(distance,b-Math.hypot(x-w+b,y-b));
        if(c>0 && x>w-c && y>h-c) distance=Math.min(distance,c-Math.hypot(x-w+c,y-h+c));
        if(d>0 && x<d && y>h-d) distance=Math.min(distance,d-Math.hypot(x-d,y-h+d));
        return distance;
    }
    function roundRect(ctx: any, x: number, y: number, w: number, h: number, radius: any, inset=0) {
        const [a,b,c,d]=cornerValues(radius,w+2*inset,h+2*inset).map(v=>Math.max(0,v-inset*(radius?.kind==='cut' ? 2-Math.SQRT2 : 1)));
        ctx.beginPath();
        if (Math.max(a,b,c,d) <= 0.01) {
            ctx.rect(x, y, w, h);
            return;
        }
        if(radius?.kind==='cut') {
            ctx.moveTo(x+a,y);ctx.lineTo(x+w-b,y);ctx.lineTo(x+w,y+b);
            ctx.lineTo(x+w,y+h-c);ctx.lineTo(x+w-c,y+h);ctx.lineTo(x+d,y+h);
            ctx.lineTo(x,y+h-d);ctx.lineTo(x,y+a);ctx.closePath();return;
        }
        ctx.moveTo(x + a, y);
        ctx.lineTo(x+w-b,y);
        if(b) ctx.arcTo(x+w,y,x+w,y+b,b);
        ctx.lineTo(x+w,y+h-c);
        if(c) ctx.arcTo(x+w,y+h,x+w-c,y+h,c);
        ctx.lineTo(x+d,y+h);
        if(d) ctx.arcTo(x,y+h,x,y+h-d,d);
        ctx.lineTo(x,y+a);
        if(a) ctx.arcTo(x,y,x+a,y,a);
        ctx.closePath();
    }

    function drawText(ctx: any, res: any, p: any, text: string, x: number, y: number, h: number, color: string) {
        const family = res.fontFamily ? res.fontFamily(p.font_file, p.font) : 'sans-serif';
        const font = `${p.font_size || 14}px ${family}`;
        ctx.font = font;
        ctx.fillStyle = color;
        ctx.textBaseline = 'alphabetic';
        const size = p.font_size || 14;
        const baseline = Math.floor(y + (h - (p.font_kind === 'bitmap' ? size + 4 : engineLineHeight(size))) / 2) + size;
        const chars = Array.from(text);
        if (res.fontGlyph) {
            const glyphs = chars.map(ch => res.fontGlyph(p.font_file, size, ch.codePointAt(0), color));
            if (glyphs.every(Boolean)) {
                ctx.imageSmoothingEnabled = false;
                let pen = x;
                const placed = glyphs.map((glyph: any,i: number) => {
                    const entry = {glyph,x:Math.floor(pen)+glyph.left,page:chars[i].codePointAt(0)!>>>8};
                    // Layout and drawing can use different advances in native labels.
                    pen += glyph.advance;
                    return entry;
                });
                // Native fonts draw their codepages in ascending order. This also
                // preserves overlap order for colored bitmap font pages.
                placed.sort((a:any,b:any)=>a.page-b.page);
                for (const {glyph,x:gx} of placed) if(glyph.image) {
                    ctx.save();
                    ctx.globalAlpha *= glyph.alpha ?? 1;
                    ctx.drawImage(glyph.image,gx,baseline-glyph.top);
                    ctx.restore();
                }
                return;
            }
        }
        const adv = p.advances;
        if (p.font_metrics !== 'approximate' && adv && adv.length === chars.length) {
            // Измеренные ширины символов; приблизительные одинаковые шаги игнорируем.
            let pen = x;
            for (let i = 0; i < chars.length; i++) {
                ctx.fillText(chars[i], Math.round(pen), baseline);
                pen += adv[i];
            }
        } else {
            ctx.fillText(text, x, baseline);
        }
    }

    // Картинка с умножением на цвет (иконки белые - получают цвет).
    const tintCache = new Map<string, any>();
    function tinted(res: any, src: string, color: string, w: number, h: number, region?: number[]) {
        const img = res.image ? res.image(src) : null;
        if (!img) return null;
        const uv = region || [0, 0, 1, 1];
        if (!res.createCanvas) return img;
        const key = `${img.src || src}|${color}|${w}|${h}|${uv.join(',')}`;
        let c = tintCache.get(key);
        if (c) return c;
        c = res.createCanvas(w, h);
        const g = c.getContext('2d');
        const iw = img.naturalWidth || img.width || w, ih = img.naturalHeight || img.height || h;
        const flipX = uv[2] < uv[0], flipY = uv[3] < uv[1];
        const sx = Math.min(uv[0], uv[2]) * iw, sy = (1 - Math.max(uv[1], uv[3])) * ih;
        const sw = Math.abs(uv[2] - uv[0]) * iw, sh = Math.abs(uv[3] - uv[1]) * ih;
        const draw = () => {
            g.save();
            if (flipX || flipY) {
                g.translate(flipX ? w : 0, flipY ? h : 0);
                g.scale(flipX ? -1 : 1, flipY ? -1 : 1);
            }
            g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
            g.restore();
        };
        g.imageSmoothingEnabled = src.startsWith('kompot_ui_icons:') ? false : w < sw;
        draw();
        const white = /^#FFFFFF/i.test(color);
        if (!white) {
            g.globalCompositeOperation = 'multiply';
            g.fillStyle = rgba(color.slice(0, 7) + 'FF');
            g.fillRect(0, 0, w, h);
            g.globalCompositeOperation = 'destination-in';
            draw();
        }
        tintCache.set(key, c);
        if (tintCache.size > 400) tintCache.delete(tintCache.keys().next().value);
        return c;
    }

    // Пиксели холста (base64 RGBA) -> холст-картинка.
    const pixelCache = new Map<string, any>();
    function pixels(res: any, p: any) {
        if (!res.createCanvas) return null;
        if (p.commands) return canvasFromData(res,Math.max(1,Math.floor(p.w)),Math.max(1,Math.floor(p.h)),commandPixels(res,Math.max(1,Math.floor(p.w)),Math.max(1,Math.floor(p.h)),p.commands));
        if (!p.pixels) return null;
        const w = Math.max(1, Math.floor(p.w)), h = Math.max(1, Math.floor(p.h));
        const key = `${p.key}|${w},${h}|${p.pixels}`;
        let c = pixelCache.get(key);
        if (c) return c;
        const bin = atob(p.pixels);
        const data = new Uint8ClampedArray(w * h * 4);
        for (let i = 0; i < data.length && i < bin.length; i++) data[i] = bin.charCodeAt(i);
        c = res.createCanvas(w, h);
        const g = c.getContext('2d');
        const img = g.createImageData(w, h);
        img.data.set(data);
        g.putImageData(img, 0, 0);
        pixelCache.set(key, c);
        if (pixelCache.size > 200) pixelCache.delete(pixelCache.keys().next().value);
        return c;
    }

    // Nine-patch uses the same source-pixel sampling as Kompot's reference renderer.
    const patchCache = new Map<string, any>();
    function ninePatch(res: any, p: any) {
        if (!res.createCanvas) return null;
        const source = p.src ? res.image?.(p.src) : null;
        if (!source && !p.source_pixels && !p.source_commands) return null;
        const [sw, sh] = p.source_size || [];
        const [left, top, right, bottom] = p.border || [];
        const w = Math.max(0, Math.floor(p.w)), h = Math.max(0, Math.floor(p.h));
        if (!sw || !sh || !w || !h || [left, top, right, bottom].some(v => v === undefined)) return null;
        const color = (p.color || '#FFFFFFFF').replace('#', '');
        const identity = p.source_pixels || JSON.stringify(p.source_commands) || source?.src || p.src;
        const key = `${identity}|${sw},${sh}|${left},${top},${right},${bottom}|${p.scale || 1}|${p.center}|${p.edges}|${w},${h}|${color}`;
        const cached = patchCache.get(key);
        if (cached) return cached;

        let sourceData: Uint8ClampedArray;
        if (p.source_commands) {
            sourceData = commandPixels(res,sw,sh,p.source_commands);
        } else if (p.source_pixels) {
            const bin = atob(p.source_pixels);
            sourceData = new Uint8ClampedArray(sw * sh * 4);
            for (let i = 0; i < sourceData.length && i < bin.length; i++) sourceData[i] = bin.charCodeAt(i);
        } else {
            const canvas = res.createCanvas(sw, sh);
            const g = canvas.getContext('2d');
            g.imageSmoothingEnabled = false;
            g.drawImage(source, 0, 0, sw, sh);
            sourceData = g.getImageData(0, 0, sw, sh).data;
        }

        const result = res.createCanvas(w, h);
        const g = result.getContext('2d');
        const image = g.createImageData(w, h);
        const target = image.data;
        const tint = [0, 2, 4, 6].map(i => parseInt(color.slice(i, i + 2), 16));
        const scale = p.scale || 1;
        const fx = Math.min(1, w / Math.max(1, (left + right) * scale));
        const fy = Math.min(1, h / Math.max(1, (top + bottom) * scale));
        const dx = [0, Math.floor(left * scale * fx), w - Math.floor(right * scale * fx), w];
        const dy = [0, Math.floor(top * scale * fy), h - Math.floor(bottom * scale * fy), h];
        const sx = [0, left, sw - right, sw], sy = [0, top, sh - bottom, sh];
        for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
            const mode = row === 1 && col === 1 ? p.center || 'stretch' : p.edges || 'stretch';
            const dw = dx[col + 1] - dx[col], dh = dy[row + 1] - dy[row];
            const cw = sx[col + 1] - sx[col], ch = sy[row + 1] - sy[row];
            if (mode === 'none' || Math.min(dw, dh, cw, ch) <= 0) continue;
            for (let iy = 0; iy < dh; iy++) {
                const srcY = sy[row] + Math.floor(row === 1 && mode === 'tile'
                    ? (iy + 0.5) / scale : (iy + 0.5) * ch / dh) % ch;
                for (let ix = 0; ix < dw; ix++) {
                    const srcX = sx[col] + Math.floor(col === 1 && mode === 'tile'
                        ? (ix + 0.5) / scale : (ix + 0.5) * cw / dw) % cw;
                    const from = (srcY * sw + srcX) * 4;
                    const to = ((dy[row] + iy) * w + dx[col] + ix) * 4;
                    for (let channel = 0; channel < 4; channel++)
                        target[to + channel] = Math.floor(sourceData[from + channel] * tint[channel] / 255);
                }
            }
        }
        g.putImageData(image, 0, 0);
        patchCache.set(key, result);
        if (patchCache.size > 128) patchCache.delete(patchCache.keys().next().value);
        return result;
    }

    function point(m: number[], x: number, y: number): number[] {
        return [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
    }
    function inverse(m: number[]): number[] | null {
        const d=m[0]*m[3]-m[1]*m[2];
        if(Math.abs(d)<1e-12) return null;
        return [m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];
    }
    function bounds(m: number[], w: number, h: number): number[] {
        const p=[point(m,0,0),point(m,w,0),point(m,0,h),point(m,w,h)];
        return [Math.floor(Math.min(...p.map(p=>p[0]))),Math.floor(Math.min(...p.map(p=>p[1]))),
            Math.ceil(Math.max(...p.map(p=>p[0]))),Math.ceil(Math.max(...p.map(p=>p[1])))];
    }
    function composite(target: Uint8ClampedArray, dw: number, dh: number, source: Uint8ClampedArray,
        sw: number, sh: number, w: number, h: number, matrix: number[], options: any={}) {
        const inv=inverse(matrix); if(!inv) return;
        const [x0,y0,x1,y1]=bounds(matrix,w,h), uv=options.region || [0,0,1,1];
        const tint=(options.color || [1,1,1,1]).map((v:number)=>Math.min(1,Math.max(0,v))), alpha=(options.alpha ?? 1)*(tint[3] ?? 1);
        for(let y=Math.max(0,y0);y<Math.min(dh,y1);y++) for(let x=Math.max(0,x0);x<Math.min(dw,x1);x++) {
            const [sx,sy]=point(inv,x+0.5,y+0.5);
            if(sx<0 || sy<0 || sx>=w || sy>=h) continue;
            const u=uv[0]+sx/w*(uv[2]-uv[0]), v=uv[3]+sy/h*(uv[1]-uv[3]);
            const tx=Math.min(sw-1,Math.max(0,Math.floor(u*sw+1e-9))), ty=Math.min(sh-1,Math.max(0,Math.floor((1-v)*sh+1e-9)));
            const si=(ty*sw+tx)*4, di=(y*dw+x)*4;
            const sa=source[si+3]/255*alpha; if(sa<=0) continue;
            const weight=target[di+3]/255*(1-sa), oa=sa+weight;
            for(let i=0;i<3;i++) target[di+i]=Math.floor((source[si+i]*tint[i]*sa+target[di+i]*weight)/oa+0.5);
            target[di+3]=Math.floor(oa*255+0.5);
        }
    }
    function imageMatrix(o: any,w: number,h: number): number[] {
        const pivot=o.pivot || [0.5,0.5], px=(pivot.x ?? pivot[0])*w, py=(pivot.y ?? pivot[1])*h;
        const scale=o.scale ?? 1, sx=typeof scale==='number'?scale:scale.x ?? scale[0], sy=typeof scale==='number'?scale:scale.y ?? scale[1];
        const rad=(o.angle || 0)*Math.PI/180,a=Math.cos(rad)*sx,b=Math.sin(rad)*sx,c=-Math.sin(rad)*sy,d=Math.cos(rad)*sy;
        return [a,b,c,d,px-a*px-c*py+(o.x || 0),py-b*px-d*py+(o.y || 0)];
    }
    function canvasFromData(res: any,w: number,h: number,data: Uint8ClampedArray) {
        const c=res.createCanvas(w,h), g=c.getContext('2d'), img=g.createImageData(w,h);
        img.data.set(data);g.putImageData(img,0,0);return c;
    }
    function sourceData(res: any,s: any): {data: Uint8ClampedArray; width: number; height: number} | null {
        if(s.commands) return {data:commandPixels(res,s.width,s.height,s.commands),width:s.width,height:s.height};
        if(s.pixels) {
            const bin=atob(s.pixels), data=new Uint8ClampedArray(s.width*s.height*4);
            for(let i=0;i<data.length;i++) data[i]=bin.charCodeAt(i);
            return {data,width:s.width,height:s.height};
        }
        const image=res.image?.(s.src); if(!image) return null;
        const w=image.naturalWidth || image.width,h=image.naturalHeight || image.height;
        const c=res.createCanvas(w,h),g=c.getContext('2d');g.drawImage(image,0,0);
        return {data:g.getImageData(0,0,w,h).data,width:w,height:h};
    }
    function commandPixels(res: any,w: number,h: number,commands: any[]): Uint8ClampedArray {
        const target=new Uint8ClampedArray(w*h*4);
        const put=(x:number,y:number,rgba:number[])=>{
            x=Math.trunc(x);y=Math.trunc(y);if(x<0 || y<0 || x>=w || y>=h) return;
            for(let i=0;i<4;i++) target[(y*w+x)*4+i]=Math.floor(rgba[i]) & 255;
        };
        for(const q of commands) {
            if(q.op==='image') {
                const source=sourceData(res,q.source || {src:q.src});if(!source) continue;
                const o=q.options || {},iw=o.width || source.width,ih=o.height || source.height;
                composite(target,w,h,source.data,source.width,source.height,iw,ih,imageMatrix(o,iw,ih),o);
                continue;
            }
            const args=q.args || [],start=q.op==='set'?2:q.op==='clear'?0:4;
            const a=args.slice(start);
            const rgba=a.length<=1 ? [(a[0] || 0)&255,((a[0] || 0)>>>8)&255,((a[0] || 0)>>>16)&255,((a[0] || 0)>>>24)&255]
                : [a[0],a[1],a[2],a[3] ?? 255];
            if(q.op==='clear') {for(let y=0;y<h;y++) for(let x=0;x<w;x++) put(x,y,rgba);}
            else if(q.op==='set') put(args[0],args[1],rgba);
            else if(q.op==='rect') {
                const [x,y,rw,rh]=args.map(Math.trunc), clamp=(n:number,hi:number)=>Math.min(hi,Math.max(0,n));
                for(let yy=clamp(y,h-1);yy<=clamp(y+rh,h-1);yy++) for(let xx=clamp(x,w-1);xx<=clamp(x+rw,w-1);xx++) put(xx,yy,rgba);
            } else if(q.op==='line') {
                let [x,y,x2,y2]=args.map(Math.trunc);const dx=Math.abs(x2-x),dy=-Math.abs(y2-y),sx=x<x2?1:-1,sy=y<y2?1:-1;let err=dx+dy;
                while(true) {put(x,y,rgba);if(x===x2 && y===y2) break;const e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}
            }
        }
        return target;
    }
    // Native rounded rectangles use an integer radius and a coverage mask,
    // sampled without browser path antialiasing.
    function nativeShape(res:any,p:any) {
        const w=Math.max(0,Math.floor(p.w)),h=Math.max(0,Math.floor(p.h));if(!w || !h) return null;
        const shape=p.shape ?? p.radius,kind=shape?.kind || 'rounded';
        const blur=p.kind==='shadow' ? Math.max(0,Math.floor((p.blur || 0)+0.5)) : 0;
        const iw=Math.max(0,w-2*blur),ih=Math.max(0,h-2*blur);
        const r=cornerValues(shape,iw,ih).map(v=>typeof shape === 'object' ? v : Math.min(Math.floor(v+0.5),Math.floor(iw/2),Math.floor(ih/2)));
        const bw=Math.max(0,Math.floor((p.width ?? 1)+0.5));
        const inner=r.map(v=>Math.max(0,v-bw*(kind==='cut' ? 2-Math.SQRT2 : 1)));
        const hex=(p.color || '#FFFFFFFF').slice(1),c=[0,2,4,6].map(i=>parseInt(hex.slice(i,i+2) || 'FF',16));
        const data=new Uint8ClampedArray(w*h*4);
        const coverage=(d:number)=>Math.min(1,Math.max(0,d+0.5));
        let alpha=new Float64Array(w*h);
        for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
            const px=x+0.5-blur,py=y+0.5-blur;
            let a=coverage(cornerDistance(px,py,iw,ih,r,kind));
            if(p.kind==='border') {
                const inside=iw>2*bw && ih>2*bw ? coverage(cornerDistance(px-bw,py-bw,iw-2*bw,ih-2*bw,inner,kind)) : 0;
                a=Math.max(0,a-inside);
            }
            alpha[y*w+x]=a;
        }
        if(blur>0) {
            const kernel:number[]=[];let sum=0;
            for(let i=-blur;i<=blur;i++) {const v=Math.exp(-i*i/(2*(blur/2)**2));kernel.push(v);sum+=v;}
            for(let i=0;i<kernel.length;i++) kernel[i]/=sum;
            for(const horizontal of [true,false]) {
                const next=new Float64Array(w*h);
                for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
                    let a=0;
                    for(let i=-blur;i<=blur;i++) {
                        const xx=x+(horizontal?i:0),yy=y+(horizontal?0:i);
                        if(xx>=0 && xx<w && yy>=0 && yy<h) a+=alpha[yy*w+xx]*kernel[i+blur];
                    }
                    next[y*w+x]=a;
                }
                alpha=next;
            }
        }
        for(let i=0;i<w*h;i++) {
            for(let k=0;k<3;k++) data[i*4+k]=c[k];
            data[i*4+3]=Math.round(Math.round(alpha[i]*255)*c[3]/255);
        }
        return canvasFromData(res,w,h,data);
    }
    function transformedLayer(res: any,p: any) {
        if(!p.mask_shape && !p.mask_radius && p.prims.length===1 && p.prims[0].kind==='image') {
            const image=p.prims[0],source=sourceData(res,{src:image.src});
            if(source) {
                const m=p.transform.slice();m[4]+=m[0]*image.x+m[2]*image.y;m[5]+=m[1]*image.x+m[3]*image.y;
                const [x0,y0,x1,y1]=bounds(m,image.w,image.h),w=Math.max(1,x1-x0),h=Math.max(1,y1-y0);
                if(w>2048 || h>2048) throw new Error('transformed layer output exceeds 2048 pixels');
                m[4]-=x0;m[5]-=y0;
                const hex=(image.color || '#FFFFFFFF').replace('#','');
                const color=[0,2,4,6].map(i=>parseInt(hex.slice(i,i+2) || 'FF',16)/255);
                const data=new Uint8ClampedArray(w*h*4);
                composite(data,w,h,source.data,source.width,source.height,image.w,image.h,m,{color,region:image.region});
                return {image:canvasFromData(res,w,h,data),x:x0,y:y0,w,h};
            }
        }
        const [bx,by,bw,bh]=p.source_bounds;
        if(bw>2048 || bh>2048) throw new Error('transformed layer source exceeds 2048 pixels');
        const source=res.createCanvas(bw,bh);
        const prims=p.prims.map((q:any)=>q.clip ? q : {...q,x:q.x-bx,y:q.y-by});
        render(source.getContext('2d'),{width:bw,height:bh,background:'#00000000',prims},1,{...res,nativeShapes:true});
        const m=p.transform.slice();m[4]+=m[0]*bx+m[2]*by;m[5]+=m[1]*bx+m[3]*by;
        const [x0,y0,x1,y1]=bounds(m,bw,bh),w=Math.max(1,x1-x0),h=Math.max(1,y1-y0);
        if(w>2048 || h>2048) throw new Error('transformed layer output exceeds 2048 pixels');
        m[4]-=x0;m[5]-=y0;
        const target=new Uint8ClampedArray(w*h*4);
        composite(target,w,h,source.getContext('2d').getImageData(0,0,bw,bh).data,bw,bh,bw,bh,m);
        if(p.mask_shape || p.mask_radius) {
            const shape=p.mask_shape || p.mask_radius;
            const r=cornerValues(shape,p.w,p.h);
            for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
                const a=Math.max(0,Math.min(1,cornerDistance(x+x0+0.5,y+y0+0.5,p.w,p.h,r,shape.kind)+0.5));
                const i=(y*w+x)*4+3;target[i]=Math.round(target[i]*a);
            }
        }
        return {image:canvasFromData(res,w,h,target),x:x0,y:y0,w,h};
    }
    function primitives(doc: any): any[] {
        const out:any[]=[];
        function visit(list:any[]) {for(const p of list || []) {out.push(p);if(p.prims) visit(p.prims);}}
        visit(doc.prims);return out;
    }
    function imageSources(doc: any): string[] {
        const images=new Set<string>();
        const commands=(list:any[])=>{for(const q of list || []) {if(q.src) images.add(q.src);commands(q.source?.commands);}};
        for(const p of primitives(doc)) {if(p.src) images.add(p.src);commands(p.commands);commands(p.source_commands);}
        return [...images];
    }

    /** Рисует документ в контекст ctx с масштабом scale. res: fontFamily(file, font), image(src), createCanvas(w, h). */
    function render(ctx: any, doc: any, scale: number, res: any) {
        const W = doc.width, H = doc.height;
        ctx.save();
        ctx.scale(scale, scale);
        ctx.fillStyle = rgba(doc.background || '#000000FF');
        ctx.fillRect(0, 0, W, H);
        const clips: Record<string, {ox: number; oy: number; rect: number[]}> = {'': {ox: 0, oy: 0, rect: [0, 0, W, H]}};
        for (const p of doc.prims || []) {
            const parent = clips[p.clip] || clips[''];
            const x = parent.ox + p.x, y = parent.oy + p.y;
            if (p.kind === 'clip') {
                const r = parent.rect;
                clips[p.key] = {ox: x, oy: y, rect: [Math.max(r[0], x), Math.max(r[1], y), Math.min(r[2], x + p.w), Math.min(r[3], y + p.h)]};
                continue;
            }
            if (p.kind !== 'layer' && (p.w <= 0 || p.h <= 0)) continue;
            const r = parent.rect;
            if (r[2] <= r[0] || r[3] <= r[1]) continue;
            ctx.save();
            ctx.beginPath();
            ctx.rect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
            ctx.clip();
            if((res.nativeShapes || ((p.shape || typeof p.radius==='object') && res.createCanvas)) && (p.kind==='rect' || p.kind==='border' || (p.shape && p.kind==='shadow'))) {
                const shape=nativeShape(res,p);
                if(shape) {ctx.imageSmoothingEnabled=false;ctx.drawImage(shape,Math.floor(x),Math.floor(y));}
                ctx.restore();continue;
            }
            switch (p.kind) {
                case 'layer': {
                    if (!res.createCanvas) break;
                    const q=transformedLayer(res,p);
                    ctx.imageSmoothingEnabled=false;
                    ctx.drawImage(q.image,x+q.x,y+q.y,q.w,q.h);
                    break;
                }
                case 'rect':
                    ctx.fillStyle = rgba(p.color);
                    roundRect(ctx, x, y, p.w, p.h, p.shape ?? p.radius);
                    ctx.fill();
                    break;
                case 'border': {
                    const bw = p.width ?? 1;
                    if(bw<=0) break;
                    ctx.strokeStyle = rgba(p.color);
                    ctx.lineWidth = bw;
                    roundRect(ctx, x + bw / 2, y + bw / 2, p.w - bw, p.h - bw, p.shape ?? p.radius, bw / 2);
                    ctx.stroke();
                    break;
                }
                case 'shadow': {
                    const b = p.blur || 0;
                    ctx.filter = `blur(${(b / 2) * scale}px)`;
                    ctx.fillStyle = rgba(p.color);
                    roundRect(ctx, x + b, y + b, p.w - 2 * b, p.h - 2 * b, p.shape ?? p.radius);
                    ctx.fill();
                    ctx.filter = 'none';
                    break;
                }
                case 'text':
                    drawText(ctx, res, p, p.text, x, y, p.h, rgba(p.color));
                    break;
                case 'field': {
                    let text = p.text || '';
                    let color = rgba(p.color);
                    let advances = p.advances;
                    if (!text && p.hint) {
                        text = p.hint;
                        color = rgba(p.color, 0.5);
                        advances = undefined;
                    }
                    if (text) {
                        const multiline = p.lines > 1;
                        const rows = multiline ? text.split('\n') : [text.split('\n')[0]];
                        const pad = p.pad ?? 8;
                        const lh = multiline ? p.line_height || (p.font_size || 14) * 1.3 : p.h;
                        const gutter = p.line_numbers ? (String(rows.length).length + 2) * (p.font_size || 14) * 0.6 : 0;
                        ctx.beginPath();
                        ctx.rect(x, y, p.w, p.h);
                        ctx.clip();
                        rows.forEach((row: string, i: number) => {
                            const top = y + (multiline ? pad + i * lh : 0);
                            if (top >= y + p.h) return;
                            const line = {...p, advances: multiline ? undefined : advances};
                            if (gutter) drawText(ctx, res, {...p, advances: undefined}, String(i + 1), x + pad, top, lh, rgba(p.color, 0.5));
                            drawText(ctx, res, line, row, x + pad + gutter, top, lh, color);
                        });
                    }
                    break;
                }
                case 'image': {
                    const img = tinted(res, p.src, p.color || '#FFFFFFFF', Math.max(1, Math.round(p.w * scale)), Math.max(1, Math.round(p.h * scale)), p.region);
                    if (img) {
                        ctx.globalAlpha = alphaOf(p.color || '#FFFFFFFF');
                        ctx.drawImage(img, x, y, p.w, p.h);
                        ctx.globalAlpha = 1;
                    } else {
                        ctx.fillStyle = '#FF00FF';
                        ctx.fillRect(x, y, p.w, p.h);
                        ctx.strokeStyle = '#000000';
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        ctx.lineTo(x + p.w, y + p.h);
                        ctx.moveTo(x + p.w, y);
                        ctx.lineTo(x, y + p.h);
                        ctx.stroke();
                    }
                    break;
                }
                case 'canvas': {
                    const c = pixels(res, p);
                    if (c) {
                        ctx.imageSmoothingEnabled = false;
                        ctx.globalAlpha = alphaOf(p.color || '#FFFFFFFF');
                        ctx.drawImage(c, x, y, p.w, p.h);
                        ctx.globalAlpha = 1;
                        ctx.imageSmoothingEnabled = true;
                    }
                    break;
                }
                case 'nine_patch': {
                    const patch = ninePatch(res, p);
                    if (patch) {
                        ctx.imageSmoothingEnabled = false;
                        ctx.drawImage(patch, x, y, p.w, p.h);
                        ctx.imageSmoothingEnabled = true;
                    } else {
                        ctx.fillStyle = '#FF00FF';
                        ctx.fillRect(x, y, p.w, p.h);
                    }
                    break;
                }
            }
            ctx.restore();
        }
        ctx.restore();
    }

    /** Все шрифты и картинки документа (что загрузить до отрисовки). */
    function resources(doc: any): {fonts: string[]; images: string[]} {
        const fonts = new Set<string>(), images = new Set<string>();
        for (const p of primitives(doc)) {
            if (p.font_file) fonts.add(p.font_file);
            if ((p.kind === 'image' || p.kind === 'nine_patch') && p.src) images.add(p.src);
        }
        for(const src of imageSources(doc)) images.add(src);
        return {fonts: [...fonts], images: [...images]};
    }

    return {render, resources, primitives, imageSources, composite, commandPixels, rgba, engineLineHeight, engineAdvance, cornerValues, cornerDistance, nativeShape};
});
