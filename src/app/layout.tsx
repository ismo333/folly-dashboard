import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Folly — What’s On",
  description: "A shared theatre scouting and review notebook for Folly Productions."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
