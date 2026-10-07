// VoxelCore bitmap fonts: numbered PNG pages, 16 x 16 glyph cells per page.
(function(root: any) {
    class BitmapFont {
        private pages = new Map<number, ImageData | null>();
        private loading = new Map<number, Promise<void>>();
        private glyphs = new Map<string, any>();
        private tinted = new Map<string, any>();
        constructor(private uri: string) {}
        async load(codepoints: number[]): Promise<void> {
            await Promise.all([...new Set([0,...codepoints.map(cp=>cp>>>8)])].map(page=> {
                if (this.loading.has(page)) return this.loading.get(page);
                if(page>1024){this.pages.set(page,null);return Promise.resolve();}
                const url = new URL(this.uri); url.pathname += `_${page}.png`;
                const promise = new Promise<void>(resolve => {
                    const img=new Image();
                    img.onload=()=> {
                        const c=document.createElement('canvas');c.width=img.width;c.height=img.height;
                        const ctx=c.getContext('2d')!;ctx.drawImage(img,0,0);
                        this.pages.set(page,ctx.getImageData(0,0,c.width,c.height));resolve();
                    };
                    img.onerror=()=>{this.pages.set(page,null);resolve();};
                    img.src=url.toString();
                });
                this.loading.set(page,promise);return promise;
            }));
            if(!this.pages.get(0))throw new Error('Не найдена PNG-страница 0 растрового шрифта');
        }
        lineHeight(size: number): number {return size+4;}
        glyph(size: number,cp: number): any {
            const key=`${size}|${cp}`;
            if(this.glyphs.has(key)) return this.glyphs.get(key);
            const page=this.pages.get(cp>>>8) || this.pages.get(0);
            const whitespace=[32,9,10,12,13].includes(cp);
            const g:any={left:0,top:size,width:size,height:size,advance:Math.floor(size/2),layoutAdvance:Math.floor(size/2)};
            if(page && !whitespace){
                const x=(cp%16)*size,y=(Math.floor(cp/16)%16)*size;
                const data=new Uint8ClampedArray(size*size*4);
                for(let row=0;row<size;row++) data.set(page.data.subarray(((y+row)*page.width+x)*4,((y+row)*page.width+x+size)*4),row*size*4);
                g.pixels=new ImageData(data,size,size);g.stride=size;
            }
            this.glyphs.set(key,g);return g;
        }
        image(size: number,cp: number,color: string): any {
            const key=`${size}|${cp}|${color}`;
            if(this.tinted.has(key)) return this.tinted.get(key);
            const g=this.glyph(size,cp);if(!g.pixels)return g;
            const c=document.createElement('canvas');c.width=g.width;c.height=g.height;
            const ctx=c.getContext('2d')!,pixels=ctx.createImageData(g.width,g.height);
            const values=color.match(/^rgba?\(([^)]+)\)$/)?.[1].split(',').map(Number);
            const hex=color.replace('#','');
            const rgb=values || [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
            for(let i=0;i<pixels.data.length;i+=4){
                for(let j=0;j<3;j++)pixels.data[i+j]=Math.round(g.pixels.data[i+j]*rgb[j]/255);
                pixels.data[i+3]=g.pixels.data[i+3];
            }
            ctx.putImageData(pixels,0,0);
            const result={...g,image:c,alpha:values ? (values[3]??1) : (hex.length>=8 ? parseInt(hex.slice(6,8),16)/255 : 1)};
            this.tinted.set(key,result);
            if(this.tinted.size>1024)this.tinted.delete(this.tinted.keys().next().value);
            return result;
        }
        dispose():void{this.pages.clear();this.loading.clear();this.glyphs.clear();this.tinted.clear();}
    }
    root.KompotBitmapFont=BitmapFont;
})(window);
