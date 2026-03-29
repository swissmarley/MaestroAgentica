import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// Token exchange endpoint — exchanges an authorization code for an access token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, state, connectorId } = body as {
      code?: string;
      state?: string;
      connectorId?: string;
    };

    if (!code || !state || !connectorId) {
      return NextResponse.json(
        { error: "Missing required parameters: code, state, connectorId" },
        { status: 400 }
      );
    }

    // Retrieve the stored OAuth config for this connector from settings
    let oauthConfigs: Record<string, OAuthConfig> = {};
    try {
      const setting = await db.settings.findUnique({ where: { key: "oauth_configs" } });
      if (setting?.value) {
        oauthConfigs = JSON.parse(setting.value);
      }
    } catch {
      // No stored config
    }

    const config = oauthConfigs[connectorId];

    if (!config) {
      return NextResponse.json(
        { error: "OAuth configuration not found for this connector. Please configure OAuth credentials (client ID, client secret, token URL) before connecting." },
        { status: 400 }
      );
    }

    // Perform real token exchange with the provider
    const tokenRequestBody = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
    });

    if (config.clientSecret) {
      tokenRequestBody.set("client_secret", config.clientSecret);
    }

    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: tokenRequestBody.toString(),
    });

    if (!tokenRes.ok) {
      const errorBody = await tokenRes.text();
      console.error(`Token exchange failed for ${connectorId}:`, errorBody);
      return NextResponse.json(
        { error: "Token exchange failed with provider", details: errorBody },
        { status: 502 }
      );
    }

    const tokenData = await tokenRes.json();

    // Persist the token securely
    await storeToken(connectorId, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      token_type: tokenData.token_type || "Bearer",
      expires_in: tokenData.expires_in || 3600,
      scope: tokenData.scope || "",
      obtained_at: new Date().toISOString(),
      connector_id: connectorId,
    });

    return NextResponse.json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      token_type: tokenData.token_type || "Bearer",
      expires_in: tokenData.expires_in || 3600,
      scope: tokenData.scope || "",
    });
  } catch (err) {
    console.error("OAuth token exchange error:", err);
    return NextResponse.json(
      { error: "Internal error during token exchange" },
      { status: 500 }
    );
  }
}

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  redirectUri: string;
}

interface TokenData {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_in: number;
  scope: string;
  obtained_at: string;
  connector_id: string;
}

async function storeToken(connectorId: string, tokenData: TokenData) {
  try {
    // Read existing tokens
    let tokens: Record<string, TokenData> = {};
    const setting = await db.settings.findUnique({ where: { key: "oauth_tokens" } });
    if (setting?.value) {
      tokens = JSON.parse(setting.value);
    }

    // Store/update token for this connector
    tokens[connectorId] = tokenData;

    await db.settings.upsert({
      where: { key: "oauth_tokens" },
      create: { id: "oauth_tokens", key: "oauth_tokens", value: JSON.stringify(tokens) },
      update: { value: JSON.stringify(tokens) },
    });

    // Also update the tool_connections to reflect connected status
    let connections: Record<string, unknown> = {};
    const connSetting = await db.settings.findUnique({ where: { key: "tool_connections" } });
    if (connSetting?.value) {
      connections = JSON.parse(connSetting.value);
    }

    connections[connectorId] = {
      connected: true,
      authType: "oauth",
      hasToken: true,
      tokenType: tokenData.token_type,
      scope: tokenData.scope,
      connectedAt: tokenData.obtained_at,
    };

    await db.settings.upsert({
      where: { key: "tool_connections" },
      create: { id: "tool_connections", key: "tool_connections", value: JSON.stringify(connections) },
      update: { value: JSON.stringify(connections) },
    });
  } catch (err) {
    console.error("Failed to store OAuth token:", err);
  }
}
