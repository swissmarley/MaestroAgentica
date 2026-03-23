import { NextResponse } from "next/server";
import { getApiKey } from "@/lib/get-api-key";
import Anthropic from "@anthropic-ai/sdk";

export async function POST() {
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "No API key configured. Save your key first." },
        { status: 400 }
      );
    }

    const client = new Anthropic({ apiKey });

    // Make a minimal API call to verify the key works
    const response = await client.messages.create({
      model: "claude-haiku-3-20250307",
      max_tokens: 10,
      messages: [{ role: "user", content: "Say hi" }],
    });

    if (response.content) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
