export type AdviceViewMode = "welcome" | "conversation";

export function getAdviceViewMode(itemCount: number, sending: boolean): AdviceViewMode {
  return itemCount === 0 && !sending ? "welcome" : "conversation";
}
