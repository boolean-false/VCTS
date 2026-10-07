/** Контракт между устройством и UI. UI не импортирует реализацию блока. */
export interface BatteryView {
  readonly stored: number;
  readonly capacity: number;
  readonly status: "idle" | "charging";
  readonly message: string;
}

export interface BatteryActions {
  charge(this: void): void;
  discharge(this: void): void;
}
