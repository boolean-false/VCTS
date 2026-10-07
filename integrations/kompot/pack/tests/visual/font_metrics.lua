-- Снимает метрики шрифтов Kompot с движка (ширина каждого символа и высота
-- строки) -> export:font_metrics.lua. Результат кладётся в
-- modules/kompot/core/font_metrics.lua и используется измерителем без движка
-- (превью в редакторе, тесты).
app.config_packs({ "base", "kompot" })
app.new_world("kompot_metrics", "1", "core:default")

local FONTS = {}
for _, s in ipairs({ 11, 12, 13, 14, 16, 20, 24, 32, 44 }) do
    FONTS[#FONTS + 1] = "kompot_" .. s
    FONTS[#FONTS + 1] = "kompot_sb_" .. s
end
for _, s in ipairs({ 11, 12, 13, 14, 16, 20, 24, 32, 44 }) do
    FONTS[#FONTS + 1] = "kompot_mono_" .. s
end

local CPS = {}
for cp = 32, 126 do
    CPS[#CPS + 1] = cp
end
for cp = 0x400, 0x45F do
    CPS[#CPS + 1] = cp
end
for _, cp in ipairs({
    0xA0,
    0xAB,
    0xBB,
    0xB0,
    0xB1,
    0xB7,
    0xD7,
    0x2013,
    0x2014,
    0x2022,
    0x2026,
    0x2116,
    0x2190,
    0x2191,
    0x2192,
    0x2193,
    0x20AC,
    0x20BD,
    0x2713,
}) do
    CPS[#CPS + 1] = cp
end

local function utf8char(cp)
    if cp < 0x80 then
        return string.char(cp)
    end
    if cp < 0x800 then
        return string.char(0xC0 + math.floor(cp / 64), 0x80 + cp % 64)
    end
    return string.char(
        0xE0 + math.floor(cp / 4096),
        0x80 + math.floor(cp / 64) % 64,
        0x80 + cp % 64
    )
end

local root = gui.root.root
for i, f in ipairs(FONTS) do
    root:add(
        string.format(
            "<label id='fm_%d' font='%s' autoresize='true' color='#00000000' pos='10,%d'>Ag</label>",
            i,
            f,
            i * 2
        )
    )
end
app.sleep(0.5)

local out = {
    "-- Сгенерировано tests/visual/font_metrics.lua по движку. Не редактировать.",
    "-- [шрифт] = {lh = высота строки, [кодовая точка] = ширина}",
    "return {",
}
local worst = 0
for i, f in ipairs(FONTS) do
    local el = gui.root["fm_" .. i]
    el.text = "Ag"
    local lh = el.size[2]
    local parts = { string.format("lh=%d", lh) }
    local adv = {}
    for _, cp in ipairs(CPS) do
        el.text = "|" .. utf8char(cp) .. "|"
        local w2 = el.size[1]
        el.text = "||"
        adv[cp] = w2 - el.size[1]
        parts[#parts + 1] = string.format("[%d]=%d", cp, adv[cp])
    end
    out[#out + 1] = string.format("  [%q]={%s},", f, table.concat(parts, ","))
    -- проверка аддитивности на фразах
    for _, s in ipairs({
        "Hello, мир!",
        "Kompot UI 0.1.0",
        "Съешь же ещё этих мягких французских булок",
    }) do
        el.text = s
        local real = el.size[1]
        local sum = 0
        for ch in s:gmatch("[%z\1-\127\194-\244][\128-\191]*") do
            local b1, b2, b3 = ch:byte(1, 3)
            local c = #ch == 1 and b1
                or (
                    #ch == 2 and (b1 - 0xC0) * 64 + (b2 - 0x80)
                    or (b1 - 0xE0) * 4096 + (b2 - 0x80) * 64 + (b3 - 0x80)
                )
            sum = sum + (adv[c] or 0)
        end
        worst = math.max(worst, math.abs(real - sum))
        if real ~= sum then
            print(string.format("%s %q real=%d sum=%d", f, s, real, sum))
        end
    end
end
out[#out + 1] = "}"
file.write("export:font_metrics.lua", table.concat(out, "\n") .. "\n")
print("fonts: " .. #FONTS .. ", codepoints: " .. #CPS .. ", worst additivity error: " .. worst)
app.close_world(false)
app.delete_world("kompot_metrics")
