/// <reference path="types.d.ts" />

/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /** Данные для отправки: бинарная строка, массив байтов или Bytearray. */
  type NetworkBytes = string | number[] | Bytearray;
  /** Адрес и порт отдельными значениями Lua; могут отсутствовать. */
  type SocketAddress = LuaMultiReturn<[address?: string, port?: number]>;
  /** Статус HTTP, строковое тело и строки заголовков ответа. */
  interface HttpResponse {
    /** Код HTTP-ответа; при транспортной ошибке обычно 0. */
    status: number;
    /** Тело ответа как строка Lua. */
    body: string;
    /** Заголовки ответа как строки. */
    headers: string[];
  }
  /** Метод, тело, параметры и обработчик HTTP-запроса. */
  interface HttpRequest {
    /** HTTP-метод, например GET или POST. */
    method: string;
    /** Готовое тело запроса: строка или Bytearray; объекты нужно сериализовать заранее. */
    body?: string | Bytearray;
    /**
     * Заголовки запроса в виде строк «Имя: значение».
     * Передавайте строки вида «Имя: значение», а не словарь.
     */
    headers?: string[];
    /** Таймаут запроса в миллисекундах. */
    timeout_ms?: number;
    /** Разрешает следовать HTTP-перенаправлениям. */
    follow_location?: boolean;
    /** Включает проверку TLS-сертификата сервера. */
    verify_ssl?: boolean;
    /**
     * Получает HTTP-ответ или сведения о транспортной ошибке.
     * Обработчик также получает транспортные ошибки, обычно с status=0.
     */
    on_response?: (this: void, response: HttpResponse) => void;
  }
  /** TCP-соединение с чтением и отправкой байтов. */
  interface Socket {
    /** Создаёт поток ввода и вывода поверх сокета; binaryMode выбирает бинарный режим. */
    as_stream(this:Socket,binaryMode?:boolean):IOStream;
    /** Отправляет байты через сокет; завершение вызова не подтверждает доставку. */
    send(this: Socket, data: NetworkBytes): void;
    /**
     * Читает до length байтов; пустой буфер означает отсутствие данных, undefined закрытое соединение без остатка.
     * @param useTable true возвращает обычный массив байтов, false или отсутствие аргумента возвращает Bytearray.
     */
    recv(this: Socket, length: number, useTable?: false): Bytearray | undefined;
    /**
     * Читает до length байтов; пустой буфер означает отсутствие данных, undefined закрытое соединение без остатка.
     * @param useTable true возвращает обычный массив байтов, false или отсутствие аргумента возвращает Bytearray.
     */
    recv(this: Socket, length: number, useTable: true): number[] | undefined;
    /**
     * Читает до length байтов; пустой буфер означает отсутствие данных, undefined закрытое соединение без остатка.
     * @param useTable true возвращает обычный массив байтов, false или отсутствие аргумента возвращает Bytearray.
     */
    recv(this: Socket, length: number, useTable: boolean): Bytearray | number[] | undefined;
    /**
     * Читает до length байтов без извлечения из буфера; undefined означает закрытое соединение без остатка.
     * @param useTable true возвращает обычный массив байтов, false или отсутствие аргумента возвращает Bytearray.
     */
    peek(this: Socket, length: number, useTable?: false): Bytearray | undefined;
    /**
     * Читает до length байтов без извлечения из буфера; undefined означает закрытое соединение без остатка.
     * @param useTable true возвращает обычный массив байтов, false или отсутствие аргумента возвращает Bytearray.
     */
    peek(this: Socket, length: number, useTable: true): number[] | undefined;
    /**
     * Читает до length байтов без извлечения из буфера; undefined означает закрытое соединение без остатка.
     * @param useTable true возвращает обычный массив байтов, false или отсутствие аргумента возвращает Bytearray.
     */
    peek(this: Socket, length: number, useTable: boolean): Bytearray | number[] | undefined;
    /**
     * Ждёт length байтов в корутине и извлекает их; собственного таймаута нет, при неполном буфере после EOF может ждать бесконечно.
     * Нужна корутина. Ожидает length байтов без таймаута; закрытый сокет с неполным остатком может ждать бесконечно.
     * @param useTable true возвращает обычный массив байтов, false или отсутствие аргумента возвращает Bytearray.
     */
    recv_async(this: Socket, length: number, useTable?: false): Bytearray | undefined;
    /**
     * Ждёт length байтов в корутине и извлекает их; собственного таймаута нет, при неполном буфере после EOF может ждать бесконечно.
     * @param useTable true возвращает обычный массив байтов, false или отсутствие аргумента возвращает Bytearray.
     */
    recv_async(this: Socket, length: number, useTable: true): number[] | undefined;
    /**
     * Ждёт length байтов в корутине и извлекает их; собственного таймаута нет, при неполном буфере после EOF может ждать бесконечно.
     * @param useTable true возвращает обычный массив байтов, false или отсутствие аргумента возвращает Bytearray.
     */
    recv_async(this: Socket, length: number, useTable: boolean): Bytearray | number[] | undefined;
    /**
     * Ждёт length байтов в корутине без извлечения; собственного таймаута нет, при неполном буфере после EOF может ждать бесконечно.
     * @param useTable true возвращает обычный массив байтов, false или отсутствие аргумента возвращает Bytearray.
     */
    peek_async(this: Socket, length: number, useTable?: false): Bytearray | undefined;
    /**
     * Ждёт length байтов в корутине без извлечения; собственного таймаута нет, при неполном буфере после EOF может ждать бесконечно.
     * @param useTable true возвращает обычный массив байтов, false или отсутствие аргумента возвращает Bytearray.
     */
    peek_async(this: Socket, length: number, useTable: true): number[] | undefined;
    /**
     * Ждёт length байтов в корутине без извлечения; собственного таймаута нет, при неполном буфере после EOF может ждать бесконечно.
     * @param useTable true возвращает обычный массив байтов, false или отсутствие аргумента возвращает Bytearray.
     */
    peek_async(this: Socket, length: number, useTable: boolean): Bytearray | number[] | undefined;
    /** Закрывает сокет и освобождает его ресурсы. */
    close(this: Socket): void;
    /** Возвращает число байтов, доступных для чтения. */
    available(this: Socket): number;
    /**
     * Проверяет, активно ли соединение или остались непрочитанные байты.
     * Закрытый TCP-сокет с непрочитанными байтами всё ещё считается активным.
     */
    is_alive(this: Socket): boolean;
    /** Проверяет, установлено ли TCP-соединение. */
    is_connected(this: Socket): boolean;
    /** Возвращает адрес и порт отдельными значениями Lua. */
    get_address(this: Socket): SocketAddress;
    /** Включает или выключает TCP_NODELAY для отправки без задержки алгоритма Нейгла. */
    set_nodelay(this: Socket, enabled?: boolean): void;
    /** Проверяет, включён ли TCP_NODELAY. */
    is_nodelay(this: Socket): boolean;
  }
  /** UDP-сокет для отправки данных выбранному получателю. */
  interface WriteableSocket {
    /** Отправляет байты через сокет; завершение вызова не подтверждает доставку. */
    send(this: WriteableSocket, data: NetworkBytes): void;
    /** Закрывает сокет и освобождает его ресурсы. */
    close(this: WriteableSocket): void;
    /** Проверяет, открыт ли сокет. */
    is_open(this: WriteableSocket): boolean;
    /** Возвращает адрес и порт отдельными значениями Lua. */
    get_address(this: WriteableSocket): SocketAddress;
  }
  /** Слушающий TCP-сокет. */
  interface ServerSocket {
    /** Закрывает сокет и освобождает его ресурсы. */
    close(this: ServerSocket): void;
    /** Проверяет, открыт ли сокет. */
    is_open(this: ServerSocket): boolean;
    /** Возвращает порт серверного сокета или undefined. */
    get_port(this: ServerSocket): number | undefined;
  }
  /** UDP-сокет для приёма и отправки датаграмм. */
  interface DatagramServerSocket {
    /** Закрывает сокет и освобождает его ресурсы. */
    close(this: DatagramServerSocket): void;
    /** Проверяет, открыт ли сокет. */
    is_open(this: DatagramServerSocket): boolean;
    /** Возвращает порт серверного сокета или undefined. */
    get_port(this: DatagramServerSocket): number | undefined;
    /** Отправляет UDP-датаграмму с байтами data на указанные address и port. */
    send(this: DatagramServerSocket, address: string, port: number, data: NetworkBytes): void;
  }
}
/** HTTP-запросы, TCP-соединения и UDP-датаграммы. */
declare namespace network {
  /**
   * Проверяет наличие сетевой подсистемы.
   * Проверка наличия подсистемы не гарантирует успех запроса или соединения.
   */
  function is_available(this: void): boolean;
  /** Возвращает общий объём отправленных байтов. */
  function get_total_upload(this: void): number;
  /** Возвращает общий объём полученных байтов. */
  function get_total_download(this: void): number;
  /**
   * Ищет свободный TCP-порт или возвращает undefined.
   * Порт не резервируется и может быть занят другим процессом.
   */
  function find_free_port(this: void): number | undefined;
  /**
   * Отправляет HTTP-запрос с указанными параметрами и обработчиком ответа.
   * ID запроса не возвращается; публичного API отмены нет.
   */
  function request(this: void, url: string, parameters: VC.HttpRequest): void;
  /**
   * Отправляет HTTP GET и передаёт строковое тело обработчику; предпочтителен request.
   * @deprecated В VC 0.32.1 успешным считается только статус 200. Передавайте обработчик ошибки; предпочтителен request.
   */
  function get(this: void, url: string, callback: (this: void, body: string) => void,
    errorCallback: (this: void, status: number, body: string) => void, headers?: string[]): void;
  /**
   * Отправляет HTTP GET для бинарного тела; в VC 0.32.1 используйте request.
   * @deprecated В VC 0.32.1 чтение отсутствующего response.code вызывает ошибку до обработчиков. Используйте request.
   */
  function get_binary(this: void, url: string, callback: (this: void, body: VC.Bytearray) => void,
    errorCallback: (this: void, status: number, body: string) => void, headers?: string[]): void;
  /**
   * Отправляет HTTP POST с готовым телом; в VC 0.32.1 используйте request.
   * @deprecated В VC 0.32.1 отсутствующий response.code и пропущенные headers вызывают ошибки. Тело-объект не сериализуется. Используйте request.
   */
  function post(this: void, url: string, body: string | VC.Bytearray, callback: (this: void, body: VC.Bytearray) => void,
    errorCallback: (this: void, status: number, body: string) => void, headers?: string[]): void;
  /**
   * Открывает TCP-сервер на port и передаёт новые соединения handler.
   * Задавайте явный свободный порт: при port=0 get_port некорректно сообщает назначенный порт.
   */
  function tcp_open(this: void, port: number, handler: (this: void, client: VC.Socket) => void): VC.ServerSocket;
  /**
   * Начинает TCP-подключение; callback вызывается после соединения, errorCallback сообщает об ошибке.
   * Возвращается сразу. Отправляйте данные после обработчика соединения. Ошибки DNS или настройки могут возникнуть синхронно.
   */
  function tcp_connect(this: void, address: string, port: number, callback: (this: void, socket: VC.Socket) => void,
    errorCallback?: (this: void, socket: VC.Socket, message: string) => void): VC.Socket;
  /** Открывает UDP-сервер; handler получает адрес, порт, байты и серверный сокет. */
  function udp_open(this: void, port: number,
    handler: (this: void, address: string, port: number, data: VC.Bytearray, server: VC.DatagramServerSocket) => void): VC.DatagramServerSocket;
  /**
   * Создаёт UDP-сокет для указанного адреса; handler получает входящие данные.
   * Обработчик получает только данные. Открытие UDP не подтверждает наличие удалённого сервера.
   */
  function udp_connect(this: void, address: string, port: number, handler: (this: void, data: VC.Bytearray) => void,
    openCallback?: (this: void, socket: VC.WriteableSocket) => void): VC.WriteableSocket;
}
