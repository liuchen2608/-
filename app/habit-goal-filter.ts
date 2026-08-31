export function filterGoalsByType<T extends { type: string }>(goals: T[], selectedType: string): T[] {
  if (selectedType === "日常习惯") return goals;
  return goals.filter((goal) => goal.type === selectedType);
}

