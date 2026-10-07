# Интерфейс Kompot на TypeScript

Открой эту папку в VSCode или WebStorm. Здесь обычный контент-пак
`kompot_ts` с внешней зависимостью Kompot. Исходники — `src/kompot_ts`:

- `screen.ts`: компонент, счётчик, форма, фильтрация списка, эффекты и очистка.
- `layout.ts`: монтирование при открытии XML-экрана и очистка при закрытии.
- `hud.ts`: клавиша H открывает/закрывает экран.

После `npm ci` в корне VCTS можно выполнить здесь `npm install`, затем
`npm run check`, `npm run build` или `npm run watch`.
Сборка создаёт `../../build/kompot/content/kompot_ts`; Kompot автоматически
не копируется в папку игры при обычной сборке своего пака.
Для игры установи также `../../integrations/kompot/pack` как пак `kompot`.
Путь установки своего пака задаётся `packOutDirs` в `vcts.config.json`.

Для превью установи собранный Kompot Lens 0.15.0 и открой `screen.ts`.
Над `K.preview` появится «Превью». Toolchain обнаруживается через
`node_modules/@vcts/toolchain` после `npm install`; можно также задать
настройку `kompot.vctsPath` на папку VCTS. Для несохранённых изменений
выбери `kompot.previewUpdateMode: live`.

В своём моде подключение такое:

```sh
vcts add /путь/к/vcts/integrations/kompot/pack
```

Команда подключает зависимость и её типы. Далее импортируй
`kompot:kompot` и `kompot:ui`, как в `screen.ts`. Внутри TypeScript
методы вызываются через точку; типы обеспечивают правильную передачу
Lua `self`. Функции компонентов и обработчиков имеют `this: void`.
