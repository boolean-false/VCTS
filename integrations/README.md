# Kompot + VCTS

Рабочая интеграция Lua Kompot 1.2.2 и Kompot Lens 0.15.0 с TypeScript.

`kompot/pack` — копия Kompot из `tomac/kompot`. Lua-реализация сохранена,
добавлены публичные TypeScript-декларации `types/` и обработка `Error.stack`
в `modules/kompot/core/runtime.lua`. Она сохраняет стек исключений TS в
диагностике, когда Lua получает исключение в виде таблицы.
Лицензии и исходные уведомления находятся внутри пака.

`kompot-lens` — копия `tomac/kompot_plugin` (0.14.0) с поддержкой TS-превью:
поиск toolchain, временная сборка, несохранённые документы, CodeLens,
интерактивные сессии, карты исходников и очистка временных файлов.
Исходные папки tomac и исходники VoxelCore не изменялись.

## Подготовка и проверка

Из корня VCTS:

```sh
npm ci
npm run kompot:setup
npm run kompot:build
npm run kompot:test
npm run kompot:test:vscode
npm run kompot:plugin:package
```

Проверка VSCode открывает отдельное окно с временным профилем; нужны
установленные VSCode и LuaLS. Можно задать `VSCODE_PATH` и
`KOMPOT_LUALS_EXTENSION`. Отчёт: `build/logs/kompot-vscode.txt`.

VSIX создаётся в `integrations/kompot-lens/dist/`. Установка через
VSCode → Extensions → Install from VSIX. Нужен LuaLS, как и у исходного Lens.
WebStorm получает типы TS, но плагин превью здесь предназначен для VSCode.

Графическая проверка на установленном VoxelCore:

```sh
npm run kompot:test:native
```

Использует отдельный проект и пользовательский каталог в `build/`.
Результаты в `build/logs/`, снимок — `build/kompot-native-user/export/kompot-ts.png`.
Не устанавливает паки в пользовательский профиль игры.

## Границы

Типы генерируются из публичных LuaLS-аннотаций Kompot и UI. Генератор
уточняет State, формы, компоненты и эффекты, но не обещает описать
каждый динамический экспорт. Неизвестные значения имеют тип `unknown`.
Версия API фиксируется метаданными `types/vcts.json`.

Используется обычный TS с вызовами `K.Column`, `UI.Button` и других
компонентов. JSX/TSX не добавлялся. Переписывать ядро Kompot на TS для
написания интерфейсов на TS не требуется; Lua-пользователи продолжают
использовать прежние модули.

TS-превью требует доверенной рабочей области и `vcts.config.json`.
Новый файл нужно сначала сохранить. Live-режим поддерживает изменения
существующих TS-файлов без сохранения. Для native TS ошибок сохраняется
стек; ошибки сопоставляются строкам TS по source maps, с точностью до
первого отображения на сгенерированной строке Lua.
