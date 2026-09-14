import type { Metadata } from "next";
import "./globals.css";
import "./enhancements.css";

export const metadata: Metadata = {
  title: "SmartCross 2.2",
  description: "Public simulation-only smart pedestrian-crossing prototype for Ampang Jaya.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-MY"><body>{children}</body></html>;
}
