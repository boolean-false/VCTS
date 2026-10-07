/// <reference path="types.d.ts" />

/** Sources: libnetwork.cpp, network/{Network,Curl,Sockets}.cpp, scripts/classes.lua.
 * Network permission in project.toml is required. Connections use IPv4.
 */
declare namespace VC {
  type NetworkBytes = string | number[] | Bytearray;
  type SocketAddress = LuaMultiReturn<[address?: string, port?: number]>;
  interface HttpResponse { status: number; body: string; headers: string[]; }
  interface HttpRequest {
    method: string;
    body?: string | Bytearray;
    /** Raw 'Name: value' lines, not a dictionary. */
    headers?: string[];
    timeout_ms?: number;
    follow_location?: boolean;
    verify_ssl?: boolean;
    /** Also receives transport failures (usually status=0), not only HTTP success. */
    on_response?: (this: void, response: HttpResponse) => void;
  }
  interface Socket {
    as_stream(this:Socket,binaryMode?:boolean):IOStream;
    send(this: Socket, data: NetworkBytes): void;
    recv(this: Socket, length: number, useTable?: false): Bytearray | undefined;
    recv(this: Socket, length: number, useTable: true): number[] | undefined;
    recv(this: Socket, length: number, useTable: boolean): Bytearray | number[] | undefined;
    peek(this: Socket, length: number, useTable?: false): Bytearray | undefined;
    peek(this: Socket, length: number, useTable: true): number[] | undefined;
    peek(this: Socket, length: number, useTable: boolean): Bytearray | number[] | undefined;
    /** Coroutine only. Waits for length bytes. Closed sockets with fewer unread bytes can wait forever. No timeout. */
    recv_async(this: Socket, length: number, useTable?: false): Bytearray | undefined;
    recv_async(this: Socket, length: number, useTable: true): number[] | undefined;
    recv_async(this: Socket, length: number, useTable: boolean): Bytearray | number[] | undefined;
    peek_async(this: Socket, length: number, useTable?: false): Bytearray | undefined;
    peek_async(this: Socket, length: number, useTable: true): number[] | undefined;
    peek_async(this: Socket, length: number, useTable: boolean): Bytearray | number[] | undefined;
    close(this: Socket): void;
    available(this: Socket): number;
    /** A closed TCP socket with unread bytes still counts as alive. */
    is_alive(this: Socket): boolean;
    is_connected(this: Socket): boolean;
    get_address(this: Socket): SocketAddress;
    set_nodelay(this: Socket, enabled?: boolean): void;
    is_nodelay(this: Socket): boolean;
  }
  interface WriteableSocket {
    send(this: WriteableSocket, data: NetworkBytes): void;
    close(this: WriteableSocket): void;
    is_open(this: WriteableSocket): boolean;
    get_address(this: WriteableSocket): SocketAddress;
  }
  interface ServerSocket {
    close(this: ServerSocket): void;
    is_open(this: ServerSocket): boolean;
    get_port(this: ServerSocket): number | undefined;
  }
  interface DatagramServerSocket {
    close(this: DatagramServerSocket): void;
    is_open(this: DatagramServerSocket): boolean;
    get_port(this: DatagramServerSocket): number | undefined;
    send(this: DatagramServerSocket, address: string, port: number, data: NetworkBytes): void;
  }
}
declare namespace network {
  /** Checks subsystem presence, not the success of a request/connection. */
  function is_available(this: void): boolean;
  function get_total_upload(this: void): number;
  function get_total_download(this: void): number;
  /** The returned port is not reserved; another process may claim it. */
  function find_free_port(this: void): number | undefined;
  /** Returns no request ID. No cancellation API in the public wrapper. */
  function request(this: void, url: string, parameters: VC.HttpRequest): void;
  /** @deprecated VC 0.32.1 treats only 200 as success. Supply an error callback. Prefer request. */
  function get(this: void, url: string, callback: (this: void, body: string) => void,
    errorCallback: (this: void, status: number, body: string) => void, headers?: string[]): void;
  /** @deprecated VC 0.32.1 reads missing response.code and errors before either callback. Use request. */
  function get_binary(this: void, url: string, callback: (this: void, body: VC.Bytearray) => void,
    errorCallback: (this: void, status: number, body: string) => void, headers?: string[]): void;
  /** @deprecated VC 0.32.1 reads missing response.code; omitted headers also throw. Object bodies are not serialized. Use request. */
  function post(this: void, url: string, body: string | VC.Bytearray, callback: (this: void, body: VC.Bytearray) => void,
    errorCallback: (this: void, status: number, body: string) => void, headers?: string[]): void;
  /** Choose an explicit free port: port=0 is not reflected correctly by get_port in this implementation. */
  function tcp_open(this: void, port: number, handler: (this: void, client: VC.Socket) => void): VC.ServerSocket;
  /** Returns immediately. Send after the connected callback. DNS/setup failures can throw synchronously. */
  function tcp_connect(this: void, address: string, port: number, callback: (this: void, socket: VC.Socket) => void,
    errorCallback?: (this: void, socket: VC.Socket, message: string) => void): VC.Socket;
  function udp_open(this: void, port: number,
    handler: (this: void, address: string, port: number, data: VC.Bytearray, server: VC.DatagramServerSocket) => void): VC.DatagramServerSocket;
  /** Callback gets only the data. UDP open does not confirm that a remote server exists. */
  function udp_connect(this: void, address: string, port: number, handler: (this: void, data: VC.Bytearray) => void,
    openCallback?: (this: void, socket: VC.WriteableSocket) => void): VC.WriteableSocket;
}
