import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "M.B.A // Mwango Brain Agent",
  description: "Sistema de Prospecção Inteligente v2.0.77",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='4' fill='%230a0a0f'/><text x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='%23dc2626' font-family='monospace' font-weight='bold' font-size='14'>MBA</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <body
        className={`${geistMono.variable} antialiased`}
        style={{ background: '#0a0a0f', color: '#e8e8ef' }}
      >
        {children}
      </body>
    </html>
  );
}