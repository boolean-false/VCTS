# API и авторский слой VCTS 1.0

Прямой SDK — декларации существующего Lua API VC 0.32.1. Он не создаёт runtime-
объекты или обёртки: `block.get(...)` остаётся `block.get(...)` в Lua.
Авторский слой в `author/` компилируется в ваш пак отдельно. Его контракты и
практика работы описаны в [AUTHORING.md](AUTHORING.md).

## Профили

Подключайте одну точку входа в каждой отдельной TS-программе:

| Профиль | Доступ |
| --- | --- |
| `common.d.ts` | Файлы, кодеки, математика, crypto, CPU Canvas, Heightmap; без мира/сети/app |
| `generator.d.ts` | Общий API для отдельного состояния генератора |
| `headless.d.ts` | Мир, игроки, сущности, callbacks, сеть, камеры, пути, звук без GUI |
| `client.d.ts` | Паковый API с UI, input, assets и графикой активного HUD |
| `app.d.ts` | Управляющий `--script` в headless |
| `app-client.d.ts` | Управляющий `--script` графического клиента |

Включайте `lib:["ES2022"]`, `types:[]`, `strict:true`,
`noUncheckedIndexedAccess:true`, `exactOptionalPropertyTypes:true`.
Не подключайте `sdk/**/*.d.ts`: ambient-типы объединятся и границы профилей исчезнут.
Профиль не доказывает, что мир или renderer уже открыт; предусловия вызова сохраняются.

Обычный require-модуль исполняется в окружении пака. Декларация `app` не предоставляет
ему доступ к объекту управляющего скрипта; передавайте нужные функции явно из --script.
Генератор не получает world, player и network. Его модули исполняются в отдельном
Lua-состоянии; seed, dir, file передаются фабрике через GeneratorContext.

## ABI

Глобальные функции и callbacks имеют `this:void`. Методы userdata и Lua-объектов
имеют явный self. TypeScriptToLua поэтому выбирает правильные точку/двоеточие.
Не заменяйте декларации API на `any`: это отключит проверку способа вызова.

Несколько возвращаемых значений описаны `LuaMultiReturn`, например:

```ts
const [x,y,z]=player.get_pos(playerId);
if(x!==undefined && y!==undefined && z!==undefined) {
  const position:VC.Vec3=[x,y,z]; // одна Lua-таблица
}
```

`undefined` соответствует nil. Числовые IDs и координаты сохраняют индексы VC.
TS-массив индексируется с 0, а аргументы native API не меняются: inventory slots
и пиксели Canvas начинаются с 0, XML child lookup gui.getattr — с 1.
`Bytearray` — opaque FFI-значение, не Array; обычный массив можно запросить
`file.read_bytes(path,true)`. Нельзя считать native userdata обычным JS-объектом.

Парсеры возвращают unknown; Schema.decode проверяет его на границе. Числовые IDs
не защищают от удалённого объекта, неверного диапазона или потери точности LuaJIT
для больших целых. `player.set_entity` типизирован числовым UID: документированная
объектная форма не поддерживается текущим native get_entity.

## Фабрики

В `vcts.config.json` доступны `scripts`, `components`, `generators`, `layouts`.
Их factory должна быть экспортированной функцией с явным `this:void`.
Каждая возвращает таблицу функций, которую адаптер копирует в окружение VC.

- scripts: ScriptContext, контракты World/Block/Item/Content/HudCallbacks.
- components: ComponentContext с entity, args и saved; ComponentCallbacks.
- generators: GeneratorContext; четыре GeneratorCallbacks. TOML/biomes/structures — штатные ресурсы VC.
- layouts: LayoutContext с document и DOC_ENV; LayoutCallbacks и дополнительные XML-обработчики.

Кешируется модуль, а не состояние фабрики. Изменяемые данные экземпляра должны
находиться в её замыкании. Возвращайте сохранение компонента из on_save.
После начального копирования изменение поля TS-объекта не обновляет автоматически
окружение компонента; используйте функции и snapshots.

У on_world_open есть isNew, у обычного on_world_tick аргументов нет. У block tick
и player tick TPS передаётся. on_hud_open/on_hud_close получают player ID.
Callbacks init зарегистрированы, но места их вызова в исходниках не найдены:
для них не обещается подтверждённая доставка или конкретный payload.

## Генерация и Canvas

Heightmap создаётся вызовом `Heightmap(w,h)`, а операции меняют его на месте и
возвращают nil. Размеры положительные; map operands должны совпадать по размерам.
Свойства noiseSeed/normalNoise доступны для записи, но читаются как nil.
Несколько biome parameter maps возвращайте `$multi(...)`.
TOML heightmap-inputs использует **1-based** номера параметров.

VoxelFragment.create_fragment существует через `generation.create_fragment` в
world-профиле. Концы области включительны. place требует открытый мир/загруженные
чанки; load/save/crop доступны отдельно. Скрипты генератора имеют собственный require.

Canvas — CPU RGBA-буфер. Размеры положительные, координаты 0-based, packed color
соответствует little-endian RGBA. at вне границ возвращает nil. PNG encode/decode
и set_data проверены на настоящем движке. Для set_data передавайте ровно w*h*4
байтов; неверный размер является native предусловием и может быть небезопасен.
`create_texture` требует графический клиент. add/sub с цветовой таблицей в native
коде сломаны; декларации предлагают Canvas operand. GPU update и фактическая
отрисовка не проверены headless-тестом.

UI Document.new создаёт wrapper с доступом по ID, а не проверяет XML-схему.
`VC.UIDocument<{summary:VC.UIElement}>` задаёт контракт вашего документа;
существование ID и вид widget должен обеспечить XML. `name` зарезервирован документом.
Специфические свойства/методы отсутствуют у неподходящих widgets. GUI цвета Vec4
используют компоненты 0–255; gfx tints — обычно 0–1. Layout имеет on_open,
on_progress(done,total), on_close(inventory), on_destroy; per-frame on_update нет.
create_frame возвращает nil, несмотря на описание возврата в документации движка.

## Сеть и потоки

В проекте требуется `permissions=["network"]`. Основной HTTP API — request:

```ts
network.request("http://127.0.0.1:8080/state",{
  method:"POST",headers:["Content-Type: application/json"],
  body:json.tostring({ready:true}),timeout_ms:3000,
  on_response:response=>{ /* status, body:string, headers:string[] */ }
});
```

body — строка/Bytearray, не объект; headers — строки, не dictionary. ID запроса и
публичной native отмены нет. Транспортная ошибка приходит в on_response, обычно
status=0. timeout из документации игнорируется: native имя — timeout_ms.
on_error публичным диспетчером не обрабатывается. Task-обёртка авторского слоя
может прекратить доставку результата, но не остановить native запрос.

| Ограничение VC 0.32.1 | Следствие |
| --- | --- |
| network.get принимает только 200 | 204 идёт в errorCallback; он должен быть передан |
| get_binary/post читают отсутствующий response.code | Lua callback обработки завершается ошибкой |
| post без headers вызывает table.extend(nil) | синхронная ошибка; используйте request |
| recv_async/peek_async ждут фиксированный размер | после EOF с неполным буфером могут ждать бесконечно |
| TCP/UDP open(0) не сообщает назначенный ОС порт | задавайте явный порт |
| Random constructor игнорирует seed, Lua буфер общий | вызовите seed явно; не полагайтесь на независимость нескольких instances |
| NamedSkeleton.set_color передаёт аргументы в неверном порядке | отмечен deprecated; entity Skeleton имеет отдельный корректный wrapper |
| core.capture_output ошибается с native variadic ordering | передавайте функцию без аргументов, захватите значения замыканием |

recv/peek(...,true) возвращают number[], иначе Bytearray. Пустой буфер означает
отсутствие данных; nil — закрытый и опустошённый TCP socket. is_alive остаётся true
при закрытом соединении с непрочитанными байтами. Учитывайте is_connected и available.
send не подтверждает доставку. Адреса IPv4; UDP использует native буфер 16 KiB.
find_free_port проверяет TCP-порт и не резервирует его. Async socket methods требуют
корутину и не имеют собственного таймаута. TLS и внешние сети не проверялись.

IOStream описывает core:io_stream, file.open и Socket.as_stream. Mode changes
сбрасывают буферы; close не делает flush. set_binary_mode(false) включает binary
из-за native Lua-проверки наличия аргумента, а undefined выключает. Buffered/yield
режимы и text read на EOF имеют ограничения wrapper; они не прошли полную проверку.
Unix named pipe provider использует Linux-константы, поэтому его поведение на macOS
не обещается. Простое binary file read/write/flush/close проверено на VC.

## Что подтверждено

[Инвентаризация](api/COVERAGE.md) хранит позиции и хеши native/Lua исходников и
сигнатур. Объявлены все **637 найденных публичных функций**, 40 script callbacks,
16 component callbacks, по 4 generator/layout callbacks, 126 перечисленных методов
Lua-объектов, 24 сетевых метода и 40 методов userdata. Это счётчики конкретных
поверхностей, а не 100% всего движка. Не все перегрузки, предусловия, динамические
экспорты, стандартный LuaJIT и exports всех core modules проверены или объявлены.

```sh
npm run api:inventory
npm run api:check
npm test
```

Аудит читает VC_SOURCES и не меняет движок. Изменение native регистраций, Lua wrapper
или деклараций требует обновить и проверить отчёт. Обычные vcts build/test используют
поставляемые данные и не требуют checkout исходников.

Проверяются шесть независимых профилей и контракты авторского слоя, включая
ожидаемые ошибки типов. Headless-проверки исполняют собранный TypeScript на runtime
0.32.1 во временных мирах. Наличие функции проверяется отдельно от её поведения.
UI wrappers проверяются с настоящим gui_util.lua и подставным backend в LuaJIT;
реальный GUI, GPU и вывод звука не проверялись. Это открытые границы v1.

Сеть проверяется настоящими loopback HTTP/TCP/UDP-серверами и отдельным процессом
без network permission. Ожидаемые native timeout/refusal/Bad file descriptor
сообщения допускаются только на конкретном этапе и с ограничением количества;
неожиданные ошибки и ошибки Lua проваливают проверку. Ошибки HTTP shortcuts отдельно
воспроизводятся на настоящем classes.lua с подставным транспортом.

Свидетельства запуска и хеши бинарника/ресурсов находятся в build/logs. Общий
результат — v1-summary.json. Полный тест также проверяет оба свежих шаблона,
перезагрузку мира и прежнюю интеграцию состояния блока.
