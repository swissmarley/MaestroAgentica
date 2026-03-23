import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const settings = await db.settings.findMany();
    const result: Record<string, string> = {};
    for (const s of settings) {
      // Mask API key for security
      if (s.key === "anthropic_api_key" && s.value) {
        result[s.key] = s.value.slice(0, 7) + "..." + s.value.slice(-4);
      } else {
        result[s.key] = s.value;
      }
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("GET settings error:", err);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body as { key?: string; value?: string };

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    const allowedKeys = ["anthropic_api_key", "default_model", "theme", "activated_skills", "connected_tools", "tool_connections"];
    if (!allowedKeys.includes(key)) {
      return NextResponse.json({ error: "Invalid setting key" }, { status: 400 });
    }

    await db.settings.upsert({
      where: { key },
      create: { id: key, key, value: value || "" },
      update: { value: value || "" },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT settings error:", err);
    return NextResponse.json({ error: "Failed to save setting" }, { status: 500 });
  }
}
