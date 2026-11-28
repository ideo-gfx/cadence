import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

// Geist: a neutral interface typeface, chosen over Space Grotesk for an enterprise feel.
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

// Vercel sets VERCEL_ENV to "preview" on preview deployments, so the browser
// tab reads "Cadence Beta" there and plain "Cadence" in production.
const appName = process.env.VERCEL_ENV === "preview" ? "Cadence Beta" : "Cadence";

export const metadata: Metadata = {
  title: { default: appName, template: `%s · ${appName}` },
  description: "The rhythm of work. Daily updates, timesheets, leave and approvals in one calm workspace.",
  applicationName: appName,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#121214" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} antialiased`}>{children}</body>
    </html>
  );
}
