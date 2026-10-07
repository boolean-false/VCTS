-- Точка входа Kompot. Примеры использования есть в README.md.

local R = require "kompot:kompot/core/runtime"
local Mod = require "kompot:kompot/core/modifier"
local color = require "kompot:kompot/core/color"
local anim = require "kompot:kompot/core/anim"
local Input = require "kompot:kompot/core/input"
local App = require "kompot:kompot/core/app"
local text = require "kompot:kompot/core/text"
local F = require "kompot:kompot/ui/foundation"
local Th = require "kompot:kompot/theme"
local preview = require "kompot:kompot/preview"

local K = {
    VERSION = "1.2.2",
}

-- Модификаторы
K.Modifier = Mod
K.M = Mod
local Shape = require "kompot:kompot/core/shape"
K.Shape = {
    rectangle = Shape.rectangle, circle = Shape.circle,
    rounded = Shape.rounded, cut = Shape.cut,
    px = Shape.px, percent = Shape.percent,
}
-- Радиусы углов: число или {top_left, top_right, bottom_right, bottom_left}.
K.rounded_corners = require("kompot:kompot/core/corners").of
local Paint = require "kompot:kompot/core/paint"
K.nine_patch, K.raster = Paint.nine_patch, Paint.raster

-- Состояние и композиция
K.state = R.state
K.form = R.form
K.new_state = R.new_state
K.remember = R.remember
K.effect = R.effect
K.on_dispose = R.on_dispose
K.on_frame = R.on_frame
K.key = R.key
K.component = R.component
K.provide = R.provide
K.local_of = R.local_of
K.untracked = R.untracked
K.is_state = R.is_state
K.poll = R.poll
K.copy = require "kompot:kompot/core/copy"

-- Анимации
K.animate = anim.animate
K.tween = anim.tween
K.spring = anim.spring
K.snap = anim.snap
K.clock = anim.clock
K.after = anim.after
K.runtime = R.runtime
K.EASING = anim.EASING

function K.interaction()
    return R._remember("interaction", Input.interaction)
end

K.new_interaction = Input.interaction

K.color = color
K.rgb = color.rgb
K.hex = color.hex
K.fonts = require "kompot:kompot/fonts"
require "kompot:font_families"
K.BASE_THEME = Th.BASE
K.theme = Th.theme
K.Theme = Th.Theme
K.ContentColor = Th.ContentColor
K.TextStyle = Th.TextStyle
K.style = Th.style
K.extend_theme = Th.extend
K.LocalTheme = Th.LocalTheme
K.LocalContentColor = Th.LocalContentColor
K.LocalTextStyle = Th.LocalTextStyle
-- Компоненты ДС текущей темы: local UI = K.ui()
K.ui = Th.ui

-- Базовые элементы
for name, fn in pairs(F) do
    K[name] = fn
end
---@cast K +KompotApi

K.App = App
K.text = text

K.preview = preview.register
K.previews = preview.list

function K.mount(opts)
    local backend = require "kompot:kompot/backend/voxelcore"
    return backend.mount(opts)
end

return K
