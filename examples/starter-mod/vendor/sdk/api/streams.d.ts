/// <reference path="types.d.ts" />
declare namespace VC {
  /** Engine stream wrapper. Mode changes discard buffers; close does not flush. Explicitly flush before close. */
  interface IOStream {
    is_binary_mode(this:IOStream):boolean;
    /** Engine tests presence, so false enables binary mode too; undefined disables it. */
    set_binary_mode(this:IOStream,value?:boolean):void;
    get_mode(this:IOStream):"default"|"buffered"|"yield";
    set_mode(this:IOStream,value:"default"|"buffered"|"yield"):void;
    get_flush_mode(this:IOStream):"all"|"buffer";
    set_flush_mode(this:IOStream,value:"all"|"buffer"):void;
    get_max_buffer_size(this:IOStream):number;
    set_max_buffer_size(this:IOStream,size:number):void;
    available(this:IOStream):number;
    available(this:IOStream,length:number):boolean;
    read_line(this:IOStream):string|undefined;
    write_line(this:IOStream,text:string):void;
    /** Result depends on binary mode. Text-mode count reads have engine edge-case bugs at EOF. */
    read(this:IOStream,length?:number,asTable?:boolean):Bytearray|number[]|string|(string|undefined)[]|undefined;
    read(this:IOStream,format:string):LuaMultiReturn<(number|boolean)[]>;
    read_fully(this:IOStream,asTable?:boolean):Bytearray|number[]|string|string[];
    write(this:IOStream,data:Bytearray|number[]|string[]):void;
    write(this:IOStream,textOrFormat:string,...values:(number|boolean)[]):void;
    seek(this:IOStream,mode:"b"|"c"|"e",offset:number):void;
    tell(this:IOStream):number;
    is_alive(this:IOStream):boolean;
    is_closed(this:IOStream):boolean;
    close(this:IOStream):void;
    flush(this:IOStream):void;
  }
}
declare namespace file {
  function open(this:void,path:string,mode:string):VC.IOStream;
  /** Native FIFO/pipe platform constraints apply; Unix engine implementation uses Linux flag constants. */
  function open_named_pipe(this:void,path:string,mode:string):VC.IOStream;
}
