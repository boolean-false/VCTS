# Независимое дополнение к готовому RailCore

Этот проект использует только Lua-пак RailCore из `build/railcore/content/rail_core`
и его публичные `.d.ts`. Исходники RailCore не входят в TS-программу дополнения.
Сначала из корня VCTS подготовьте готовую зависимость, затем соберите и проверьте
дополнение:

```sh
npm run railcore:build
node tools/vcts.cjs build examples/external-api/vcts.config.json
node tools/vcts.cjs test examples/external-api/vcts.config.json
```

В `build/external-api/content` будет только `rail_client`. Для теста готовый
RailCore копируется во временный проект, после запуска этот проект удаляется.
Пример ничего не устанавливает в игровую папку. Свою готовую копию RailCore можно
подключить командой `vcts add <pack-folder> --config examples/external-api/vcts.config.json`.
Версия пака и версия опубликованного контракта фиксируются в конфиге.
