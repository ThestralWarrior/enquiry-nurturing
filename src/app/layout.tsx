import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadPilot — Speed-to-Lead AI for Delhi NCR Real Estate",
  description:
    "Every property enquiry answered in seconds, qualified by a local AI, and handed to your team as a hot, ready-to-call lead. Runs privately on your own machine.",
  applicationName: "LeadPilot",
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
