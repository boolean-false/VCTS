/* FreeType glyph bitmaps at the resource's pixel size, as in VoxelCore. */
(function(root: any) {
    class RasterFont {
        private glyphs = new Map<string, any>();
        private tinted = new Map<string, any>();
        private monospace: boolean;
        constructor(private ft: any, bytes: Uint8Array) {
            const face = ft.LoadFontFromBytes(bytes)[0];
            if (!face) throw new Error('TTF has no face');
            ft.SetFont(face.family_name, face.style_name);
            this.monospace = !!(face.face_flags & ft.FT_FACE_FLAG_FIXED_WIDTH);
        }
        glyph(size: number, cp: number): any {
            const key = `${size}|${cp}`;
            if (this.glyphs.has(key)) return this.glyphs.get(key);
            this.ft.SetPixelSize(0, size);
            // The engine stops loading vector pages at 1024 and uses page 0
            // without glyph offsets for codepoints outside that range.
            const outsidePages = (cp >>> 8) >= 1024;
            const loadedCp = outsidePages ? cp & 255 : cp;
            const slot = this.ft.LoadGlyphs([loadedCp], this.ft.FT_LOAD_RENDER).get(loadedCp);
            if (!slot) return null;
            const empty = !slot.bitmap.width;
            const whitespace = [32, 9, 10, 12, 13].includes(cp);
            const glyph = {left:outsidePages ? 0 : slot.bitmap_left, top:outsidePages ? size : slot.bitmap_top,
                // VoxelCore currently measures monospace labels with size/2,
                // but draws printable glyphs using their actual FreeType advances.
                advance:outsidePages || empty || whitespace ? Math.floor(size/2) : Math.floor(slot.advance.x/64),
                layoutAdvance:outsidePages || this.monospace ? Math.floor(size/2) : (empty || whitespace ? Math.floor(size/2) : Math.floor(slot.advance.x/64)),
                width:Math.min(size, slot.bitmap.width), height:Math.min(size, slot.bitmap.rows),
                pixels:slot.bitmap.imagedata, stride:slot.bitmap.width};
            this.glyphs.set(key, glyph);
            if (this.glyphs.size > 4096) this.glyphs.delete(this.glyphs.keys().next().value);
            return glyph;
        }
        image(size: number, cp: number, color: string): any {
            const key = `${size}|${cp}|${color}`;
            if (this.tinted.has(key)) return this.tinted.get(key);
            const g = this.glyph(size, cp);
            if (!g || !g.pixels || !g.width || !g.height || [32,9,10,12,13].includes(cp)) return g;
            const canvas = document.createElement('canvas');
            canvas.width=g.width; canvas.height=g.height;
            const ctx=canvas.getContext('2d')!;
            const image=ctx.createImageData(g.width,g.height);
            const channels=color.match(/^rgba?\(([^)]+)\)$/)?.[1].split(',').map(Number);
            const hex=color.replace('#','');
            const rgba=channels
                ? [channels[0],channels[1],channels[2],Math.round((channels[3] ?? 1)*255)]
                : [0,2,4,6].map((i,index) => index===3 && hex.length<8 ? 255 : parseInt(hex.slice(i,i+2),16));
            for(let y=0;y<g.height;y++) for(let x=0;x<g.width;x++) {
                const to=(y*g.width+x)*4, from=(y*g.stride+x)*4;
                image.data[to]=rgba[0]; image.data[to+1]=rgba[1]; image.data[to+2]=rgba[2];
                image.data[to+3]=g.pixels.data[from+3];
            }
            ctx.putImageData(image,0,0);
            const result={...g,image:canvas,alpha:channels ? (channels[3] ?? 1) : rgba[3]/255};
            this.tinted.set(key,result);
            if(this.tinted.size>1024) this.tinted.delete(this.tinted.keys().next().value);
            return result;
        }
        dispose(): void { this.ft.Cleanup(); this.glyphs.clear(); this.tinted.clear(); }
    }
    root.KompotRasterFont = RasterFont;
})(typeof window === 'object' ? window : globalThis);
