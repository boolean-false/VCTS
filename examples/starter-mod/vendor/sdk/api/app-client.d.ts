/// <reference path="app.d.ts" />
/** Graphical application scripts only. Source: libapp.cpp. */
declare namespace app {
  function focus(this: void): void;
  function set_title(this: void, title: string): void;
  function open_folder(this: void, path: string): void;
  function open_url(this: void, url: string): void;
}
