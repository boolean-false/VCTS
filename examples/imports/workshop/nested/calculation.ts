import { capacity } from "@energy/api";
export default function available(stored: number): number {
  return capacity - stored;
}
