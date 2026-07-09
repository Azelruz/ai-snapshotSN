import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "AI SNAP – The Ultimate AI Photobooth Platform",
  description:
    "Transform your events with world-class AI imaging. Instantly generate stunning, premium avatars for your guests.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={inter.className}>
      <body style={{ margin: 0, padding: 0, background: "#fafafa", color: "#0a0a0a" }}>
        {children}
      </body>
    </html>
  );
}
