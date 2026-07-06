import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Outpay",
  description: "Non-custodial USDC checkout on Base for modern merchants.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className="h-full antialiased"
      style={{ colorScheme: "light" }}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
