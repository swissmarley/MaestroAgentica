import { db } from "@/lib/db";

export async function getApiKey(): Promise<string | null> {
  // Check database first (user-configured via Settings page)
  try {
    const setting = await db.settings.findUnique({
      where: { key: "anthropic_api_key" },
    });
    if (setting?.value) return setting.value;
  } catch {
    // DB might not be ready
  }

  // Fall back to environment variable
  return process.env.ANTHROPIC_API_KEY || null;
}
