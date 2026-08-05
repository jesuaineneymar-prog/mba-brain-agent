import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MBA Test",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-PT">
      <body style={{ margin:0, padding:0 }}>
        {children}
      </body>
    </html>
  );
}
