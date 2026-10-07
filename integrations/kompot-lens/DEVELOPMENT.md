# Разработка Kompot Lens

## Сборка

```sh
npm ci
npm test
npm run package
```

`npm run package` создаёт `dist/kompot-lens-<version>.vsix`. Для размещения панели справа требуется VS Code 1.106 или новее. Интеграционные проверки запускаются командой `npm run test:extension`; им нужны установленный VS Code, Lua и каталог `../game/content` с паками Kompot. Другой каталог можно передать через `KOMPOT_CONTENT`.

## Публикация в Visual Studio Marketplace

1. Войдите с Microsoft-аккаунтом на
   [страницу издателей Marketplace](https://marketplace.visualstudio.com/manage).
   Создайте издателя с ID `BooleanFalse` либо укажите ID своего издателя в
   `package.json` (`publisher`). Доступность этого ID нужно проверить на сайте.
2. Выполните `npm ci`, `npm test` и `npm run package`.
3. На странице издателя выберите **New extension → Visual Studio Code** и
   загрузите файл из `dist/`. Для последующих выпусков увеличьте `version`
   в `package.json` и `package-lock.json`, соберите VSIX и загрузите новую версию.

Упаковщик включает иконку, README, историю изменений и лицензии в ресурсы
Marketplace. Плагин сохраняет ID `BooleanFalse.kompot-lens`, пока не меняются
`publisher` и `name`.

Ручная загрузка готового VSIX удобна для первого выпуска. Для автоматической
публикации используйте официальный `@vscode/vsce`; актуальные варианты
авторизации и команды описаны в
[руководстве VS Code](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).
Microsoft рекомендует Microsoft Entra ID; глобальные Azure DevOps PAT
выводятся из использования 1 декабря 2026 года.


## Сверка шрифтов с игрой

`python3 scripts/check-font-parity.py --font /path/to/Other.ttf --tolerance 5`
создаёт временный сторонний пак и исполняет один Lua-модуль в игре и в webview
VS Code. Проверяются размеры 11–44 px, переносы, кириллица, комбинируемые
символы, пробелы, прозрачность, дробное размещение и PNG-страницы.
Дополнительные `--font` проверяют произвольные TTF/OTF.

Нужны Pillow, numpy, VS Code и GUI движка. Отчёт и PNG лежат в
`/tmp/kompot-font-parity/`; другой каталог задаётся через `--out`.
Ресурсы временного пака не включаются в расширение.

Раскладка сравнивается без допуска. `--tolerance` задаёт допустимую разницу
цветового канала; по умолчанию это 1/255. Полное побитовое совпадение
OpenGL и Canvas не гарантируется: на редких краях глифов в проверенной сборке
движка встречалась разница до 5/255. Исходные растры FreeType проверяются
отдельно от смешивания цвета.


## Проверка первого запуска

`KOMPOT_TEST_ENTRY=setup KOMPOT_WORKSPACE=/tmp/empty-content/my_pack npm run test:extension`
проверяет появление зависимости, установку и удаление пака, переключение каталога,
сохранение пользовательских настроек LuaLS и превью с пустым `PATH`.
Используйте отдельный пустой каталог: проверка создаёт в нём свой пак и настройки.
`KOMPOT_CONTENT` задаёт каталог с исходным Kompot для временной установки.

Lua 5.4 WASM и его загрузчик собираются в `out/runtime/` и входят в универсальный VSIX.
Запуск остаётся в отдельном процессе с ограничением времени; установка Lua и скачивание
интерпретатора на машине пользователя не требуются.

## Проверка скруглений

`KOMPOT_TEST_ENTRY=corners KOMPOT_SNAPSHOTS=/tmp/kompot-corners npm run test:extension`
создаёт временный пак и проверяет в webview независимые углы, общий `Shape`,
проценты, срезанные рамки, тени, вложенные маски и повёрнутый `clip`. Снимок `corners-webview.png` можно сравнить со сценой
`kompot/tests/visual/rounded_corners.lua` в игре. `npm test` также сверяет
покрытие асимметричных фонов, рамок и теней с Lua-растеризатором.
Сцена `kompot/tests/visual/shapes.lua` соответствует снимку `shapes-webview.png`.
