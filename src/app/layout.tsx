import type { Metadata } from "next";
import "./globals.css";
import { SettingsProvider } from "@/contexts/settings-context";

export const metadata: Metadata = {
  title: "Mission Control",
  description: "AI Agent & Project Management Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased">
        <SettingsProvider>
          {children}
        </SettingsProvider>
      </body>
    </html>
  );
}
