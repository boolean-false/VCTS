import { definePack } from "@vc/core";

// Пак может предоставлять только библиотеку, без собственных блоков.
export default definePack({
  id: "energy",
  dependencies: ["vcts"],
  blocks: [],
});
