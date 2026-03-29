import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Lightweight test endpoints for API key validation per service
const TEST_ENDPOINTS: Record<string, { url: string; headers: (apiKey: string) => Record<string, string>; method?: string }> = {
  "brave-search": {
    url: "https://api.search.brave.com/res/v1/web/search?q=test&count=1",
    headers: (apiKey) => ({ Accept: "application/json", "X-Subscription-Token": apiKey }),
  },
  discord: {
    url: "https://discord.com/api/v10/users/@me",
    headers: (apiKey) => ({ Authorization: `Bot ${apiKey}` }),
  },
  telegram: {
    url: "", // dynamically set below
    headers: () => ({}),
  },
  airtable: {
    url: "https://api.airtable.com/v0/meta/whoami",
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
  },
  supabase: {
    url: "", // requires project URL, test with a health check
    headers: (apiKey) => ({ apikey: apiKey, Authorization: `Bearer ${apiKey}` }),
  },
  stripe: {
    url: "https://api.stripe.com/v1/balance",
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
  },
  cloudflare: {
    url: "https://api.cloudflare.com/client/v4/user/tokens/verify",
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }),
  },
  zapier: {
    url: "https://nla.zapier.com/api/v1/check/",
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
  },
  n8n: {
    url: "", // requires instance URL
    headers: (apiKey) => ({ "X-N8N-API-KEY": apiKey }),
  },
};

// POST /api/tools/test-connection — Test an API key against a service
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectorId, apiKey } = body as { connectorId?: string; apiKey?: string };

    if (!connectorId || !apiKey) {
      return NextResponse.json(
        { error: "connectorId and apiKey are required" },
        { status: 400 }
      );
    }

    const testConfig = TEST_ENDPOINTS[connectorId];

    if (!testConfig || !testConfig.url) {
      // For services without a known test endpoint, do a basic validation
      return NextResponse.json({
        success: true,
        message: `API key format accepted for ${connectorId}. Full validation will occur on first use.`,
        validated: false,
      });
    }

    // Special handling for Telegram
    let testUrl = testConfig.url;
    let testHeaders = testConfig.headers(apiKey);
    if (connectorId === "telegram") {
      testUrl = `https://api.telegram.org/bot${apiKey}/getMe`;
      testHeaders = {};
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(testUrl, {
        method: testConfig.method || "GET",
        headers: testHeaders,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        return NextResponse.json({
          success: true,
          message: "Connection successful! API key is valid.",
          validated: true,
          status: res.status,
        });
      }

      // Parse error details
      const errorBody = await res.text().catch(() => "");
      let errorMessage = `API returned status ${res.status}`;

      if (res.status === 401 || res.status === 403) {
        errorMessage = "Invalid API key or insufficient permissions.";
      } else if (res.status === 429) {
        errorMessage = "API key is valid but rate limited. Try again later.";
        // Rate limited means the key works
        return NextResponse.json({
          success: true,
          message: errorMessage,
          validated: true,
          status: res.status,
        });
      }

      return NextResponse.json({
        success: false,
        message: errorMessage,
        validated: true,
        status: res.status,
        details: errorBody.slice(0, 200),
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      const msg = fetchErr instanceof Error ? fetchErr.message : "Connection failed";
      if (msg.includes("abort")) {
        return NextResponse.json({
          success: false,
          message: "Connection timed out. Check your network or API key.",
          validated: false,
        });
      }
      return NextResponse.json({
        success: false,
        message: `Connection error: ${msg}`,
        validated: false,
      });
    }
  } catch (err) {
    console.error("Test connection error:", err);
    return NextResponse.json(
      { error: "Internal error testing connection" },
      { status: 500 }
    );
  }
}
