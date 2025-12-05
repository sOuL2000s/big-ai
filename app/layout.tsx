// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from '@/components/providers/AuthProvider';
import { ThemeProvider } from '@/components/providers/ThemeContext'; // NEW IMPORT


export const metadata: Metadata = {
  title: "Big AI Chatbot (Production)",
  description: "A large scale Gemini chat application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Theme is applied via CSS variables and the ThemeProvider context
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`antialiased`}> 
        <AuthProvider>
          <ThemeProvider> {/* Wrap children with ThemeProvider */}
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}