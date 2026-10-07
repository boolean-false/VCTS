import { defineBlock, field, signal } from "@vc/core";
import { restore, transfer } from "@energy/api";
import type { BatteryActions, BatteryView } from "./battery-model";
import { batteryPanel } from "./battery-panel";

const CAPACITY = 100;
const TRANSFER_AMOUNT = 10;

export const battery = defineBlock({
  id: "workshop:battery",
  appearance: { texture: "base:stone" },
  state: { stored: field.int16(0) },

  // Новый объект на экземпляр загруженного блока, а не общий объект на тип блока.
  transient: () => ({
    charging: false,
    message: "Готов",
    changed: signal<BatteryView>(),
  }),

  onInteract(ctx, player) {
    const view = (): BatteryView => ({
      stored: ctx.state.stored,
      capacity: CAPACITY,
      status: ctx.transient.charging ? "charging" : "idle",
      message: ctx.transient.message,
    });

    const publish = () => ctx.transient.changed.emit(view());

    function apply(amount: number): void {
      // Повторная проверка актуального состояния непосредственно перед записью.
      const result = transfer(restore(ctx.state.stored, CAPACITY), amount);
      if (result.ok) {
        ctx.state.stored = result.next.stored;
        ctx.transient.message = "Готов";
      } else {
        ctx.transient.message = result.reason === "full"
          ? "Недостаточно места" : "Операция недоступна";
      }
      publish();
    }

    const actions: BatteryActions = {
      charge() {
        // Проверка в команде нужна независимо от состояния кнопки.
        if (ctx.transient.charging) return;
        const preview = transfer(restore(ctx.state.stored, CAPACITY), TRANSFER_AMOUNT);
        if (!preview.ok) return;
        ctx.transient.charging = true;
        ctx.transient.message = "Зарядка…";
        publish();

        // Асинхронная операция принадлежит блоку. Закрытие UI её не отменяет.
        // Выгрузка/удаление блока или выход из мира отменяет pending callback.
        ctx.lifetime.after(2, () => {
          ctx.transient.charging = false;
          apply(TRANSFER_AMOUNT);
        });
      },
      discharge() {
        if (ctx.transient.charging) return;
        apply(-TRANSFER_AMOUNT);
      },
    };

    batteryPanel.open(player, {
      read: view,
      changed: ctx.transient.changed,
      actions,
      owner: ctx.lifetime,
    });
    return true;
  },
});
