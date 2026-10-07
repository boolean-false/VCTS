# Покрытие прямого API VC

Сгенерировано `npm run api:inventory` по локальным исходникам VC. Хеши исходников и позиции символов находятся в `inventory.json`.

Обнаружено публичных функций: **637**; объявлено: **637**. Это покрытие перечисленных функций, а не процент всего API движка.

Считаются функции хотя бы с одной декларацией. Это не гарантия покрытия всех перегрузок, предусловий и состояний. Контракты сверены с исходниками вручную; выбранные сценарии проверяются отдельным headless-тестом.

| Раздел | Декларации | Обнаружено |
| --- | ---: | ---: |
| app | 33 | 33 |
| assets | 5 | 5 |
| audio | 25 | 25 |
| audio.input | 4 | 4 |
| base64 | 4 | 4 |
| bjson | 2 | 2 |
| block | 39 | 39 |
| byteutil | 4 | 4 |
| cameras | 19 | 19 |
| compression | 2 | 2 |
| console | 10 | 10 |
| core | 3 | 3 |
| crypto | 35 | 35 |
| debug | 14 | 14 |
| entities | 18 | 18 |
| events | 5 | 5 |
| file | 34 | 34 |
| generation | 5 | 5 |
| gfx.blockwraps | 6 | 6 |
| gfx.particles | 5 | 5 |
| gfx.posteffects | 7 | 7 |
| gfx.skeletons | 1 | 1 |
| gfx.text3d | 15 | 15 |
| gfx.weather | 5 | 5 |
| gui | 22 | 22 |
| hud | 19 | 19 |
| input | 12 | 12 |
| inventory | 26 | 26 |
| item | 13 | 13 |
| json | 2 | 2 |
| mat4 | 13 | 13 |
| math | 9 | 9 |
| network | 12 | 12 |
| pack | 11 | 11 |
| pathfinding | 10 | 10 |
| player | 38 | 38 |
| quat | 6 | 6 |
| random | 4 | 4 |
| rules | 8 | 8 |
| session | 3 | 3 |
| string | 15 | 15 |
| table | 19 | 19 |
| time | 8 | 8 |
| toml | 2 | 2 |
| utf8 | 10 | 10 |
| vc | 7 | 7 |
| vec2 | 16 | 16 |
| vec3 | 15 | 15 |
| vec4 | 14 | 14 |
| world | 18 | 18 |
| xml | 3 | 3 |
| yaml | 2 | 2 |

## Объявленные функции с известными ограничениями

- `network.get`: VC 0.32.1 treats only 200 as success. Supply an error callback. Prefer request.
- `network.get_binary`: VC 0.32.1 reads missing response.code and errors before either callback. Use request.
- `network.post`: VC 0.32.1 reads missing response.code; omitted headers also throw. Object bodies are not serialized. Use request.
- `random.Random`: Constructor ignores the provided seed in VC 0.32.1; call .seed explicitly. Multiple instances share a prefetch buffer.

## Границы инвентаризации

- Lua table aliases/dynamic exports and userdata methods are not exhaustively discovered.
- Engine callbacks, constants, core modules and standard LuaJIT APIs require separate inventories.
- Registration context is not a guarantee a call is valid: content/world/client preconditions still apply.

## Другие поверхности API

Отдельно найдены 40 регистрации callbacks, 5 реализаций userdata и 15 Lua-модулей вне internal. Конструкторы и динамические экспорты модулей не покрываются этим счётчиком.

Методы Lua-объектов и потоков: **126/126**; callbacks компонентов: **16/16**. Они учитываются отдельно от глобальных функций. Сигнатура не означает проверку всех режимов исполнения.

Методы сетевых объектов: **24/24**. Socket.as_stream использует контракт IOStream; EOF/буферизация имеют ограничения движка. HTTP shortcuts с известными ошибками отмечены @deprecated; наличие декларации не исправляет их.

Callbacks скриптов: **40/40**; layout: **4/4**. init зарегистрирован, но места его вызова не найдены; его payload оставлен unknown.

Callbacks генератора: **4/4**; методы userdata: **40/40**. Свойства и конструкторы проверяются отдельно.

| Объект/контракт | Методы с декларациями |
| --- | ---: |
| VC.Entity | 11 |
| VC.Transform | 6 |
| VC.Rigidbody | 27 |
| VC.Skeleton | 13 |
| VC.ComponentCallbacks | 16 |
| VC.Socket | 13 |
| VC.WriteableSocket | 4 |
| VC.ServerSocket | 3 |
| VC.DatagramServerSocket | 4 |
| VC.Camera | 18 |
| VC.Text3D | 11 |
| VC.NamedSkeleton | 11 |
| VC.IOStream | 20 |
| VC.Random | 3 |
| VC.HashContext | 3 |
| VC.Logger | 3 |
| VC.Canvas | 15 |
| VC.PCMStream | 3 |
| VC.Heightmap | 20 |
| VC.VoxelFragment | 2 |
| VC.WorldCallbacks | 17 |
| VC.BlockCallbacks | 12 |
| VC.ItemCallbacks | 4 |
| VC.ContentCallbacks | 2 |
| VC.HudCallbacks | 5 |
| VC.LayoutCallbacks | 4 |
| VC.GeneratorCallbacks | 4 |

| Поверхность | Найдено |
| --- | --- |
| lua_type_canvas.cpp | at, set, line, blit, clear, rect, update, create_texture, unbind_texture, mul, add, sub, encode, get_data |
| lua_type_heightmap.cpp | dump, noise, cellnoise, pow, add, sub, mul, min, max, abs, floor, round, ceil, sin, cos, tan, resize, crop, at, mixin |
| lua_type_pcmstream.cpp | feed, share, create_sound |
| lua_type_random.cpp | Динамическая регистрация — нужна проверка |
| lua_type_voxelfragment.cpp | crop, place |

- `core:animation` — module found, exports untyped
- `core:bit_converter` — module found, exports untyped
- `core:bitwise/compiler` — module found, exports untyped
- `core:bitwise/executor` — module found, exports untyped
- `core:bitwise/parser` — module found, exports untyped
- `core:bitwise/tokenizer` — module found, exports untyped
- `core:bitwise/util` — module found, exports untyped
- `core:data_buffer` — module found, exports untyped
- `core:inventory_utils` — module found, exports untyped
- `core:io_stream` — module found, exports untyped
- `core:schedule` — module found, exports untyped
- `core:tests_util` — module found, exports untyped
- `core:toml` — module found, exports untyped
- `core:vector2` — module found, exports untyped
- `core:vector3` — module found, exports untyped

## Ещё без деклараций

