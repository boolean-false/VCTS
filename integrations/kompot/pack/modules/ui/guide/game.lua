return function(G)
    local scenes = {
        {
            "chest",
            "Сундук",
            "Inventory",
            "Перенос предметов между сундуком и рюкзаком. ЛКМ переносит, ПКМ быстро перекладывает.",
            { "UI.ItemSlot", "UI.InventoryGrid", "on_move", "accepts" },
        },
        {
            "pause",
            "Пауза",
            "Pause",
            "Короткое меню поверх мира: продолжить игру или изменить настройки.",
            { "UI.Button", "UI.Checkbox", "UI.Slider" },
        },
        {
            "workbench",
            "Верстак",
            "Machine",
            "Обработка древесины, прогресс и получение результата.",
            { "UI.MachinePanel", "UI.ItemSlot", "UI.ProgressBar" },
        },
        {
            "game_hud",
            "HUD",
            "Hud",
            "Хотбар, ресурсы и подсказки действий. Кнопки примера имитируют урон и восстановление.",
            { "UI.HUD", "UI.Hotbar", "UI.ResourceBar", "UI.ActionHint" },
        },
        {
            "game_settings",
            "Настройки",
            "Controls",
            "Поля, переключатели, ползунки, меню и диалог в игровом оформлении.",
            { "UI.TextField", "UI.Checkbox", "UI.Slider", "UI.Dialog" },
        },
        {
            "slot_states",
            "Состояния ячеек",
            "States",
            "Выбранные, заблокированные и пустые ячейки, количество и прочность предмета.",
            { "UI.ItemSlot", "UI.ResourceBar" },
        },
    }
    for _, row in ipairs(scenes) do
        G.add(
            "game",
            row[1],
            row[2],
            row[4],
            row[5],
            'local Examples = require "kompot:ui/examples"\nExamples.' .. row[3] .. "()",
            {
                section = "game",
                scene = true,
                note = "Пример работает с локальными данными и не изменяет инвентарь или настройки мира.",
            }
        )
    end
end
