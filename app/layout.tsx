import type { Metadata } from "next";
import { Orbitron, Space_Grotesk } from "next/font/google";
import "./globals.css";

const titleFont = Orbitron({
  subsets: ["latin"],
  variable: "--font-title",
  weight: ["500", "700"],
});

const bodyFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Robot Concierge",
  description: "iPad kiosk for Vapi voice assistant",
  icons: {
    icon: "/rocket-favicon.svg",
    shortcut: "/rocket-favicon.svg",
    apple: "/rocket-favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${titleFont.variable} ${bodyFont.variable} min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  );
}
