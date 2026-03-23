"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CONNECTOR_ICON_MAP } from "@/components/icons/connector-icons";
import { Shield, Check, X, Loader2, ExternalLink } from "lucide-react";

// Connector metadata for the authorization screen
const CONNECTOR_META: Record<string, { name: string; color: string; providerUrl: string; scopes: string[] }> = {
  github: {
    name: "GitHub",
    color: "bg-gray-900 text-white",
    providerUrl: "github.com",
    scopes: ["Read repositories", "Write issues & PRs", "Access commit history"],
  },
  slack: {
    name: "Slack",
    color: "bg-[#4A154B] text-white",
    providerUrl: "slack.com",
    scopes: ["Send messages", "Read channels", "Search conversations"],
  },
  outlook: {
    name: "Outlook",
    color: "bg-[#0078D4] text-white",
    providerUrl: "microsoft.com",
    scopes: ["Read & send emails", "Manage calendar events", "Access contacts"],
  },
  onedrive: {
    name: "OneDrive",
    color: "bg-[#0078D4] text-white",
    providerUrl: "microsoft.com",
    scopes: ["Read & write files", "Create folders", "Share files"],
  },
  gmail: {
    name: "Gmail",
    color: "bg-[#EA4335] text-white",
    providerUrl: "google.com",
    scopes: ["Read & send emails", "Manage labels", "Access threads"],
  },
  "google-calendar": {
    name: "Google Calendar",
    color: "bg-[#4285F4] text-white",
    providerUrl: "google.com",
    scopes: ["Read & create events", "Manage calendars", "Check availability"],
  },
  "google-drive": {
    name: "Google Drive",
    color: "bg-[#4285F4] text-white",
    providerUrl: "google.com",
    scopes: ["Read & list files", "Search documents", "Access shared drives"],
  },
  notion: {
    name: "Notion",
    color: "bg-black text-white",
    providerUrl: "notion.so",
    scopes: ["Read & create pages", "Query databases", "Update content"],
  },
  hubspot: {
    name: "HubSpot",
    color: "bg-[#FF7A59] text-white",
    providerUrl: "hubspot.com",
    scopes: ["Manage contacts & deals", "Access CRM data", "Search records"],
  },
  salesforce: {
    name: "Salesforce",
    color: "bg-[#00A1E0] text-white",
    providerUrl: "salesforce.com",
    scopes: ["Query & create records", "Access objects", "Run SOQL/SOSL"],
  },
  figma: {
    name: "Figma",
    color: "bg-[#F24E1E] text-white",
    providerUrl: "figma.com",
    scopes: ["Read design files", "Access components & styles", "Export assets"],
  },
  canva: {
    name: "Canva",
    color: "bg-[#00C4CC] text-white",
    providerUrl: "canva.com",
    scopes: ["Create designs", "Access templates", "Export & share"],
  },
  paypal: {
    name: "PayPal",
    color: "bg-[#003087] text-white",
    providerUrl: "paypal.com",
    scopes: ["Process payments", "View transactions", "Manage orders"],
  },
  asana: {
    name: "Asana",
    color: "bg-[#F06A6A] text-white",
    providerUrl: "asana.com",
    scopes: ["Manage tasks & projects", "Add comments", "Track progress"],
  },
  jira: {
    name: "Jira",
    color: "bg-[#0052CC] text-white",
    providerUrl: "atlassian.com",
    scopes: ["Create & update issues", "Search with JQL", "Manage sprints"],
  },
  confluence: {
    name: "Confluence",
    color: "bg-[#172B4D] text-white",
    providerUrl: "atlassian.com",
    scopes: ["Read & create pages", "Search content", "Manage spaces"],
  },
};

function OAuthContent() {
  const searchParams = useSearchParams();
  const connectorId = searchParams.get("connector") || "";
  const connectorName = searchParams.get("name") || "Unknown Service";

  const [authorizing, setAuthorizing] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [denied, setDenied] = useState(false);

  const meta = CONNECTOR_META[connectorId];
  const IconComponent = CONNECTOR_ICON_MAP[connectorId];
  const scopes = meta?.scopes || ["Read data", "Write data"];
  const providerUrl = meta?.providerUrl || connectorId + ".com";

  const handleAuthorize = () => {
    setAuthorizing(true);

    // Simulate OAuth handshake delay (token exchange)
    setTimeout(() => {
      setAuthorizing(false);
      setAuthorized(true);

      // Notify parent window of successful authorization
      if (window.opener) {
        window.opener.postMessage(
          { type: "oauth_complete", connectorId, success: true },
          window.location.origin
        );
      }

      // Auto-close after showing success
      setTimeout(() => window.close(), 1500);
    }, 2000);
  };

  const handleDeny = () => {
    setDenied(true);

    // Notify parent of denial
    if (window.opener) {
      window.opener.postMessage(
        { type: "oauth_complete", connectorId, success: false },
        window.location.origin
      );
    }

    setTimeout(() => window.close(), 1000);
  };

  if (authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 p-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Authorization Successful</h2>
          <p className="text-sm text-gray-500">
            {connectorName} has been connected. This window will close automatically.
          </p>
        </div>
      </div>
    );
  }

  if (denied) {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-5 ${meta?.color || "bg-gray-800 text-white"}`}>
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
              Maestro Agentica wants to access your account
            </h2>
            <p className="text-xs text-gray-500">
              This will allow Maestro Agentica to connect to {connectorName} on your behalf.
            </p>
          </div>

          {/* Permissions */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">Permissions requested</p>
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
              {scopes.map((scope, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-blue-600" />
                  </div>
                  <span className="text-sm text-gray-700">{scope}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Security notice */}
          <div className="flex items-start gap-2.5 rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
            <Shield className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500 leading-relaxed">
              Maestro Agentica will only access the permissions listed above.
              You can revoke access at any time from the Tools settings.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleDeny}
              disabled={authorizing}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Deny
            </button>
            <button
              onClick={handleAuthorize}
              disabled={authorizing}
              className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-70 flex items-center justify-center gap-2 ${
                meta?.color?.replace("text-white", "") || "bg-gray-900"
              } hover:opacity-90`}
            >
              {authorizing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4" />
                  Authorize
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-[11px] text-gray-400 text-center">
            By authorizing, you agree to share the listed permissions with Maestro Agentica.
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
