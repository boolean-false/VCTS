/** Проверяется tsc, не запускается. Каждая ожидаемая ошибка обязана существовать. */
import { restore, transfer } from "@energy/api";
import { defineBlock, field } from "@vc/core";
import type { BatteryActions, BatteryView } from "../packs/workshop/battery-model";

const result = transfer(restore(10, 100), -5);
if (result.ok) {
  const stored: number = result.next.stored;
  void stored;
}

// @ts-expect-error Нельзя читать результат успешной операции без проверки варианта.
result.next.stored;

// @ts-expect-error Ошибка типа на границе паков.
transfer(restore(10, 100), "10");

export function checkView(view: BatteryView, actions: BatteryActions): void {
  // @ts-expect-error Опечатка в поле модели UI.
  view.stroed;
  // @ts-expect-error Снимок UI только для чтения.
  view.stored = 100;
  // @ts-expect-error Команда не принимает произвольное количество энергии.
  actions.charge(1000);
}

defineBlock({
  id: "checks:block",
  appearance: { texture: "base:stone" },
  state: { stored: field.int16(0) },
  transient: () => ({}),
  onInteract(ctx) {
    // @ts-expect-error Тип сохраняемого поля выведен из схемы.
    ctx.state.stored = "full";
    // @ts-expect-error Несуществующее поле блока.
    ctx.state.capacity = 100;
    return true;
  },
});
