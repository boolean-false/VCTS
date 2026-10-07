import { defineProject } from "@vc/core";

// Авторская конфигурация. Будущая сборка должна получить из неё project.toml
// и обычные content packs. Сейчас преобразования нет.
export default defineProject({
  id: "workshop_demo",
  title: "Мастерская",
  packs: [
    { id: "energy", source: "./packs/energy" },
    { id: "workshop", source: "./packs/workshop" },
  ],
  basePacks: ["base", "energy", "workshop"],
});
