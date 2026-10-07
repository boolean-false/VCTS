import { definePanel } from "@vc/core";
import type { BatteryActions, BatteryView } from "./battery-model";

// Минимальный эскиз UI. Выбор TS-разметки вместо XML пока не закреплён.
export const batteryPanel = definePanel<BatteryView, BatteryActions>({
  title: "Накопитель",
  text: view => `${view.stored} / ${view.capacity}\n${view.message}`,
  buttons: [
    {
      label: "Зарядить на 10",
      enabled: view => view.status === "idle" && view.stored + 10 <= view.capacity,
      invoke: actions => actions.charge(),
    },
    {
      label: "Использовать 10",
      enabled: view => view.status === "idle" && view.stored >= 10,
      invoke: actions => actions.discharge(),
    },
  ],
});
