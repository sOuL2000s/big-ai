// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from '@/components/providers/AuthProvider';


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
    <html lang="en" suppressHydrationWarning>
      <body className={`antialiased`}> 
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}