/// <reference path="audio.d.ts" />
declare namespace audio.input {
  /** Opens VC's permission dialog. Callback runs only after granting. */
  function request_open(this:void,callback:(this:void,token:string)=>void):void;
  function fetch(this:void,token:string,size?:number):VC.Bytearray|undefined;
  /** Engine 0.32.1 resets per fetch frame and keeps the last sample amplitude, not a true peak. */
  function get_max_amplitude(this:void):number;
  function get_input_info(this:void):{device_specifier:string;channels:number;sample_rate:number;bits_per_sample:number}|undefined;
}
