"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";

function CallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setErrorMessage(error === "access_denied" ? "Access was denied." : `Error: ${error}`);
      notifyParent(false);
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setErrorMessage("Missing authorization code or state parameter.");
      notifyParent(false);
      return;
    }

    // Extract connector ID from state (format: maestro_{connectorId}_{timestamp}_{random})
    const stateParts = state.split("_");
    const connectorId = stateParts.length >= 3 ? stateParts[1] : "";

    if (!connectorId) {
      setStatus("error");
      setErrorMessage("Invalid OAuth state parameter.");
      notifyParent(false);
      return;
    }

    exchangeToken(code, state, connectorId);
  }, [searchParams]);

  const exchangeToken = async (code: string, state: string, connectorId: string) => {
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

      // Notify parent (opener) window
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

      setStatus("success");
      setTimeout(() => window.close(), 2000);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Token exchange failed");
      notifyParent(false);
    }
  };

  const notifyParent = (success: boolean) => {
    if (window.opener) {
      window.opener.postMessage(
        { type: "oauth_complete", connectorId: "", success },
        window.location.origin
      );
    }
    setTimeout(() => window.close(), 3000);
  };

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 p-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Connected Successfully</h2>
          <p className="text-sm text-gray-500">This window will close automatically.</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 p-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Connection Failed</h2>
          <p className="text-sm text-gray-500">{errorMessage}</p>
          <p className="text-xs text-gray-400">This window will close automatically.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4 p-8">
        <Loader2 className="h-10 w-10 animate-spin text-gray-400 mx-auto" />
        <h2 className="text-lg font-semibold text-gray-900">Completing authorization...</h2>
        <p className="text-sm text-gray-500">Exchanging authorization code for access token.</p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
