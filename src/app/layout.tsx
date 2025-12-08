import type { Metadata } from "next";
import { Geist, Geist_Mono, Bitcount_Prop_Double_Ink, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bitcount = Bitcount_Prop_Double_Ink({
  variable: "--font-bitcount",
  subsets: ["latin"],
  weight: "400", // Required for some fonts
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

import { AuthProvider } from "@/context/AuthContext";
import { GlobalErrorHandler } from "@/components/GlobalErrorHandler";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Mailer",
  description: "Send personalized email campaigns",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bitcount.variable} ${playfair.variable} antialiased`}
      >
        <script src="https://accounts.google.com/gsi/client" async defer></script>
        <GlobalErrorHandler />
        <AuthProvider>
            <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
            >
                {children}
            </ThemeProvider>
        </AuthProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
