import type { Metadata } from "next";
// @ts-ignore
import "./globals.css";

export const metadata: Metadata = {
  title: "Populavote — Vote with PromptPay",
  description: "10 baht = 1 point. Pay, scan, vote.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="grain min-h-screen">
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
