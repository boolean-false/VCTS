import * as energy from "@energy/api";
import type { Amount } from "@energy/api";
import available from "./nested/calculation";

const stored: Amount = 40;
export const remaining = available(stored);
export const valid = Number.isInteger(stored);
export const settings = energy.settings;
// Text resembling an import must remain untouched.
export const text = 'require("./nested/calculation")';
