import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/layout/sidebar";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Maestro Agentica - Agent Management Platform",
  description: "Build, test, deploy, and manage AI agents with confidence",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} font-sans antialiased`}>
        <TooltipProvider delayDuration={200}>
          <div className="flex h-screen overflow-hidden bg-background">
            {/* Ambient background blobs for dark mode depth */}
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
              <div className="absolute -top-1/4 -left-1/4 h-[600px] w-[600px] rounded-full bg-[hsl(var(--gradient-start)/0.03)] blur-[120px] animate-blob-morph" />
              <div className="absolute -bottom-1/4 -right-1/4 h-[500px] w-[500px] rounded-full bg-[hsl(var(--gradient-end)/0.04)] blur-[100px] animate-blob-morph" style={{ animationDelay: "-4s" }} />
            </div>
            <Sidebar />
            <main className="relative z-10 flex-1 overflow-auto">
              {children}
            </main>
          </div>
        </TooltipProvider>
      </body>
    </html>
  );
}
