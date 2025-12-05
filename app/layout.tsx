// app/layout.tsx
import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google"; // REMOVED standard Next.js font imports
import "./globals.css";

// The fonts are now typically managed via Tailwind config or global CSS if using v4+.

export const metadata: Metadata = {
  title: "Big AI Chatbot (Production)",
  description: "A large scale Gemini chat application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Remove Geist variables if not configured in globals.css/tailwind.config */}
      <body className={`antialiased`}> 
        {children}
      </body>
    </html>
  );
}