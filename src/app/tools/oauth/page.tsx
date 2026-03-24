"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import { CONNECTOR_ICON_MAP } from "@/components/icons/connector-icons";
import { Shield, Check, X, Loader2, ExternalLink, AlertCircle, Key, Copy } from "lucide-react";

// Full OAuth provider configuration per connector
const OAUTH_PROVIDERS: Record<
  string,
  {
    name: string;
    color: string;
    providerUrl: string;
    authorizationUrl: string;
    tokenUrl: string;
    scopes: string[];
    scopeValues: string[];
    clientIdPlaceholder: string;
    documentation: string;
  }
> = {
  github: {
    name: "GitHub",
    color: "bg-gray-900 text-white",
    providerUrl: "github.com",
    authorizationUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: ["Read repositories", "Write issues & PRs", "Access commit history"],
    scopeValues: ["repo", "read:org", "write:discussion"],
    clientIdPlaceholder: "Ov23li...",
    documentation: "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps",
  },
  slack: {
    name: "Slack",
    color: "bg-[#4A154B] text-white",
    providerUrl: "slack.com",
    authorizationUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scopes: ["Send messages", "Read channels", "Search conversations"],
    scopeValues: ["chat:write", "channels:read", "search:read"],
    clientIdPlaceholder: "xoxb-...",
    documentation: "https://api.slack.com/authentication/oauth-v2",
  },
  outlook: {
    name: "Outlook",
    color: "bg-[#0078D4] text-white",
    providerUrl: "microsoft.com",
    authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["Read & send emails", "Manage calendar events", "Access contacts"],
    scopeValues: ["Mail.ReadWrite", "Calendars.ReadWrite", "Contacts.Read"],
    clientIdPlaceholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    documentation: "https://learn.microsoft.com/en-us/graph/auth-v2-user",
  },
  onedrive: {
    name: "OneDrive",
    color: "bg-[#0078D4] text-white",
    providerUrl: "microsoft.com",
    authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["Read & write files", "Create folders", "Share files"],
    scopeValues: ["Files.ReadWrite.All", "Sites.ReadWrite.All"],
    clientIdPlaceholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    documentation: "https://learn.microsoft.com/en-us/onedrive/developer",
  },
  gmail: {
    name: "Gmail",
    color: "bg-[#EA4335] text-white",
    providerUrl: "google.com",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["Read & send emails", "Manage labels", "Access threads"],
    scopeValues: ["https://www.googleapis.com/auth/gmail.modify"],
    clientIdPlaceholder: "xxxx.apps.googleusercontent.com",
    documentation: "https://developers.google.com/gmail/api/auth/about-auth",
  },
  "google-calendar": {
    name: "Google Calendar",
    color: "bg-[#4285F4] text-white",
    providerUrl: "google.com",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["Read & create events", "Manage calendars", "Check availability"],
    scopeValues: ["https://www.googleapis.com/auth/calendar"],
    clientIdPlaceholder: "xxxx.apps.googleusercontent.com",
    documentation: "https://developers.google.com/calendar/api/guides/auth",
  },
  "google-drive": {
    name: "Google Drive",
    color: "bg-[#4285F4] text-white",
    providerUrl: "google.com",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["Read & list files", "Search documents", "Access shared drives"],
    scopeValues: ["https://www.googleapis.com/auth/drive.readonly"],
    clientIdPlaceholder: "xxxx.apps.googleusercontent.com",
    documentation: "https://developers.google.com/drive/api/guides/about-auth",
  },
  notion: {
    name: "Notion",
    color: "bg-black text-white",
    providerUrl: "notion.so",
    authorizationUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    scopes: ["Read & create pages", "Query databases", "Update content"],
    scopeValues: [],
    clientIdPlaceholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    documentation: "https://developers.notion.com/docs/authorization",
  },
  hubspot: {
    name: "HubSpot",
    color: "bg-[#FF7A59] text-white",
    providerUrl: "hubspot.com",
    authorizationUrl: "https://app.hubspot.com/oauth/authorize",
    tokenUrl: "https://api.hubapi.com/oauth/v1/token",
    scopes: ["Manage contacts & deals", "Access CRM data", "Search records"],
    scopeValues: ["crm.objects.contacts.read", "crm.objects.deals.read"],
    clientIdPlaceholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    documentation: "https://developers.hubspot.com/docs/api/working-with-oauth",
  },
  salesforce: {
    name: "Salesforce",
    color: "bg-[#00A1E0] text-white",
    providerUrl: "salesforce.com",
    authorizationUrl: "https://login.salesforce.com/services/oauth2/authorize",
    tokenUrl: "https://login.salesforce.com/services/oauth2/token",
    scopes: ["Query & create records", "Access objects", "Run SOQL/SOSL"],
    scopeValues: ["api", "refresh_token"],
    clientIdPlaceholder: "3MVG9...",
    documentation: "https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_web_server_flow.htm",
  },
  figma: {
    name: "Figma",
    color: "bg-[#F24E1E] text-white",
    providerUrl: "figma.com",
    authorizationUrl: "https://www.figma.com/oauth",
    tokenUrl: "https://www.figma.com/api/oauth/token",
    scopes: ["Read design files", "Access components & styles", "Export assets"],
    scopeValues: ["file_read"],
    clientIdPlaceholder: "xxxxxx",
    documentation: "https://www.figma.com/developers/api#oauth2",
  },
  canva: {
    name: "Canva",
    color: "bg-[#00C4CC] text-white",
    providerUrl: "canva.com",
    authorizationUrl: "https://www.canva.com/api/oauth/authorize",
    tokenUrl: "https://www.canva.com/api/oauth/token",
    scopes: ["Create designs", "Access templates", "Export & share"],
    scopeValues: ["design:content:read", "design:content:write"],
    clientIdPlaceholder: "OC...",
    documentation: "https://www.canva.dev/docs/connect/authentication/",
  },
  paypal: {
    name: "PayPal",
    color: "bg-[#003087] text-white",
    providerUrl: "paypal.com",
    authorizationUrl: "https://www.paypal.com/signin/authorize",
    tokenUrl: "https://api-m.paypal.com/v1/oauth2/token",
    scopes: ["Process payments", "View transactions", "Manage orders"],
    scopeValues: ["openid", "email"],
    clientIdPlaceholder: "AV...",
    documentation: "https://developer.paypal.com/api/rest/authentication/",
  },
  asana: {
    name: "Asana",
    color: "bg-[#F06A6A] text-white",
    providerUrl: "asana.com",
    authorizationUrl: "https://app.asana.com/-/oauth_authorize",
    tokenUrl: "https://app.asana.com/-/oauth_token",
    scopes: ["Manage tasks & projects", "Add comments", "Track progress"],
    scopeValues: ["default"],
    clientIdPlaceholder: "xxxxxxxxxxxx",
    documentation: "https://developers.asana.com/docs/oauth",
  },
  jira: {
    name: "Jira",
    color: "bg-[#0052CC] text-white",
    providerUrl: "atlassian.com",
    authorizationUrl: "https://auth.atlassian.com/authorize",
    tokenUrl: "https://auth.atlassian.com/oauth/token",
    scopes: ["Create & update issues", "Search with JQL", "Manage sprints"],
    scopeValues: ["read:jira-work", "write:jira-work"],
    clientIdPlaceholder: "xxxxxx",
    documentation: "https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/",
  },
  confluence: {
    name: "Confluence",
    color: "bg-[#172B4D] text-white",
    providerUrl: "atlassian.com",
    authorizationUrl: "https://auth.atlassian.com/authorize",
    tokenUrl: "https://auth.atlassian.com/oauth/token",
    scopes: ["Read & create pages", "Search content", "Manage spaces"],
    scopeValues: ["read:confluence-content.all", "write:confluence-content"],
    clientIdPlaceholder: "xxxxxx",
    documentation: "https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/",
  },
};

type OAuthStep = "configure" | "authorizing" | "callback" | "success" | "denied" | "error";

function OAuthContent() {
  const searchParams = useSearchParams();
  const connectorId = searchParams.get("connector") || "";
  const connectorName = searchParams.get("name") || "Unknown Service";

  const [step, setStep] = useState<OAuthStep>("configure");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [copiedRedirect, setCopiedRedirect] = useState(false);
  const [redirectUri, setRedirectUri] = useState("");

  const provider = OAUTH_PROVIDERS[connectorId];
  const IconComponent = CONNECTOR_ICON_MAP[connectorId];
  const scopes = provider?.scopes || ["Read data", "Write data"];
  const providerUrl = provider?.providerUrl || connectorId + ".com";

  useEffect(() => {
    setRedirectUri(`${window.location.origin}/tools/oauth/callback`);
  }, []);

  // Check if returning from provider with authorization code
  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      setStep("error");
      setErrorMessage(error === "access_denied" ? "Access was denied by the provider." : `OAuth error: ${error}`);
      return;
    }

    if (code && state) {
      setStep("callback");
      handleTokenExchange(code, state);
    }
  }, [searchParams]);

  const handleTokenExchange = async (code: string, state: string) => {
    try {
      const res = await fetch("/api/tools/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, state, connectorId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Token exchange failed");
      }

      const tokenData = await res.json();

      // Notify parent window of successful authorization with real token data
      if (window.opener) {
        window.opener.postMessage(
          {
            type: "oauth_complete",
            connectorId,
            success: true,
            tokenData: {
              accessToken: tokenData.access_token,
              refreshToken: tokenData.refresh_token,
              expiresIn: tokenData.expires_in,
              scope: tokenData.scope,
              tokenType: tokenData.token_type,
            },
          },
          window.location.origin
        );
      }

      setStep("success");
      setTimeout(() => window.close(), 2000);
    } catch (err) {
      setStep("error");
      setErrorMessage(err instanceof Error ? err.message : "Token exchange failed");
    }
  };

  const handleAuthorize = () => {
    if (!provider) {
      setStep("error");
      setErrorMessage(`No OAuth configuration found for ${connectorName}`);
      return;
    }

    if (!clientId.trim()) {
      setErrorMessage("Client ID is required to start the OAuth flow.");
      return;
    }

    setErrorMessage("");
    setStep("authorizing");

    // Store OAuth config for the token exchange step
    try {
      const oauthState = `maestro_${connectorId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(
        `oauth_state_${connectorId}`,
        JSON.stringify({
          state: oauthState,
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          tokenUrl: provider.tokenUrl,
          redirectUri,
        })
      );

      // Build the real provider authorization URL
      const params = new URLSearchParams({
        client_id: clientId.trim(),
        redirect_uri: redirectUri,
        response_type: "code",
        state: oauthState,
      });

      if (provider.scopeValues.length > 0) {
        params.set("scope", provider.scopeValues.join(" "));
      }

      // Provider-specific params
      if (connectorId.startsWith("google") || connectorId === "gmail") {
        params.set("access_type", "offline");
        params.set("prompt", "consent");
      }
      if (connectorId === "jira" || connectorId === "confluence") {
        params.set("audience", "api.atlassian.com");
        params.set("prompt", "consent");
      }
      if (connectorId === "notion") {
        params.set("owner", "user");
      }

      const authUrl = `${provider.authorizationUrl}?${params.toString()}`;
      window.location.href = authUrl;
    } catch (err) {
      setStep("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to start OAuth flow");
    }
  };

  const handleDeny = () => {
    setStep("denied");
    if (window.opener) {
      window.opener.postMessage(
        { type: "oauth_complete", connectorId, success: false },
        window.location.origin
      );
    }
    setTimeout(() => window.close(), 1000);
  };

  const handleCopyRedirect = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopiedRedirect(true);
    setTimeout(() => setCopiedRedirect(false), 2000);
  };

  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 p-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Authorization Successful</h2>
          <p className="text-sm text-gray-500">
            {connectorName} has been connected successfully. This window will close automatically.
          </p>
        </div>
      </div>
    );
  }

  if (step === "denied") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 p-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <X className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Authorization Denied</h2>
          <p className="text-sm text-gray-500">No permissions were granted. This window will close.</p>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md text-center space-y-4 p-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Authorization Error</h2>
          <p className="text-sm text-gray-500">{errorMessage}</p>
          <button
            onClick={() => { setStep("configure"); setErrorMessage(""); }}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (step === "callback" || step === "authorizing") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 p-8">
          <Loader2 className="h-10 w-10 animate-spin text-gray-400 mx-auto" />
          <h2 className="text-lg font-semibold text-gray-900">
            {step === "authorizing" ? "Redirecting to provider..." : "Exchanging authorization code..."}
          </h2>
          <p className="text-sm text-gray-500">Please wait while we complete the connection.</p>
        </div>
      </div>
    );
  }

  // step === "configure" — main form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-5 ${provider?.color || "bg-gray-800 text-white"}`}>
          <div className="flex items-center gap-3">
            {IconComponent && (
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <IconComponent className="h-6 w-6" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-semibold">{connectorName}</h1>
              <p className="text-xs opacity-80">{providerUrl}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-1">
              Connect {connectorName} via OAuth 2.0
            </h2>
            <p className="text-xs text-gray-500">
              Enter your OAuth app credentials to start the authorization flow.
              {provider?.documentation && (
                <> <a href={provider.documentation} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">Setup guide <ExternalLink className="h-3 w-3" /></a></>
              )}
            </p>
          </div>

          {/* Redirect URI */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Redirect URI</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-gray-100 rounded-md px-3 py-2 text-gray-600 break-all border border-gray-200">
                {redirectUri}
              </code>
              <button
                onClick={handleCopyRedirect}
                className="shrink-0 p-2 rounded-md border border-gray-200 hover:bg-gray-50"
                title="Copy redirect URI"
              >
                {copiedRedirect ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 text-gray-400" />}
              </button>
            </div>
            <p className="text-[11px] text-gray-400">Add this URI to your OAuth app&apos;s allowed redirect URLs.</p>
          </div>

          {/* Client ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Client ID *</label>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder={provider?.clientIdPlaceholder || "Enter client ID"}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Client Secret */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Client Secret</label>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Enter client secret"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              />
            </div>
            <p className="text-[11px] text-gray-400">Required for the token exchange step.</p>
          </div>

          {/* Permissions */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">Permissions requested</p>
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
              {scopes.map((scope, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-blue-600" />
                  </div>
                  <span className="text-sm text-gray-700">{scope}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Error message */}
          {errorMessage && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">{errorMessage}</p>
            </div>
          )}

          {/* Security notice */}
          <div className="flex items-start gap-2.5 rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
            <Shield className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500 leading-relaxed">
              Your credentials are stored locally and used only for the OAuth flow.
              You can revoke access at any time from the Tools settings.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleDeny}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAuthorize}
              disabled={!clientId.trim()}
              className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                provider?.color?.replace("text-white", "") || "bg-gray-900"
              } hover:opacity-90`}
            >
              <ExternalLink className="h-4 w-4" />
              Authorize
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-[11px] text-gray-400 text-center">
            You will be redirected to {providerUrl} to authorize access.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function OAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <OAuthContent />
    </Suspense>
  );
}
