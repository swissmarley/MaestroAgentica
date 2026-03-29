"use client";

import { useEffect } from "react";

export default function OAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Hide the sidebar and make content full-width for the OAuth popup
  useEffect(() => {
    document.body.classList.add("oauth-popup");
    return () => {
      document.body.classList.remove("oauth-popup");
    };
  }, []);

  return <>{children}</>;
}
