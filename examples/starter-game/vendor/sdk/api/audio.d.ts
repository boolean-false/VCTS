/// <reference path="types.d.ts" />
/** Speaker IDs use 0 for failed playback. Audio devices are unavailable in headless. */
declare namespace audio {
  function play_sound(this:void,name:string,x:number,y:number,z:number,volume:number,pitch:number,channel?:string,loop?:boolean):number;
  function play_stream(this:void,path:string,x:number,y:number,z:number,volume:number,pitch:number,channel?:string,loop?:boolean):number;
  function play_sound_2d(this:void,name:string,volume:number,pitch:number,channel?:string,loop?:boolean):number;
  function play_stream_2d(this:void,path:string,volume:number,pitch:number,channel?:string,loop?:boolean):number;
  function stop(this:void,id:number):void;
  function pause(this:void,id:number):void;
  function resume(this:void,id:number):void;
  function set_loop(this:void,id:number,value:boolean):void;
  function set_volume(this:void,id:number,value:number):void;
  function set_pitch(this:void,id:number,value:number):void;
  function set_time(this:void,id:number,seconds:number):void;
  function set_position(this:void,id:number,x:number,y:number,z:number):void;
  function set_velocity(this:void,id:number,x:number,y:number,z:number):void;
  function is_playing(this:void,id:number):boolean;
  function is_paused(this:void,id:number):boolean;
  function is_loop(this:void,id:number):boolean;
  function get_volume(this:void,id:number):number;
  function get_pitch(this:void,id:number):number;
  function get_time(this:void,id:number):number;
  function get_duration(this:void,id:number):number;
  function get_position(this:void,id:number):VC.MaybeXYZ;
  function get_velocity(this:void,id:number):VC.MaybeXYZ;
  function count_speakers(this:void):number;
  function count_streams(this:void):number;
}
declare namespace VC {
  interface PCMStream {
    feed(this:PCMStream,bytes:Bytearray):void;
    /** Graphical assets required. */
    share(this:PCMStream,alias:string):void;
    /** Graphical assets required. Consumes buffered PCM. */
    create_sound(this:PCMStream,alias:string):void;
  }
}
declare namespace audio { function PCMStream(this:void,sampleRate:number,channels:number,bitsPerSample:number):VC.PCMStream; }
