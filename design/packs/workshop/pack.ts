import { definePack } from "@vc/core";
import { battery } from "./battery";

export default definePack({
  id: "workshop",
  dependencies: ["base", "energy", "vcts"],
  blocks: [battery],
});
