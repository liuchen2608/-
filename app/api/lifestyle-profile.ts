export function mergeLifestylePreferences(
  profileJson: string,
  preferences: Record<string, string>,
) {
  let profile: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(profileJson || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      profile = parsed as Record<string, unknown>;
    }
  } catch {
    profile = {};
  }

  return JSON.stringify({
    ...profile,
    lifestylePreferences: preferences,
  });
}
