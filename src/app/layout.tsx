import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/context/auth-context";
import { ToastProvider } from "@/components/ToastProvider";
import { ThemeColorProvider } from "@/context/theme-context";
import { TrainingProvider } from "@/context/training-context";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AutoForgeML",
  description: "AI-Powered AutoML Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(outfit.className, "min-h-screen bg-background font-sans antialiased overflow-x-hidden")}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <ThemeColorProvider>
            <AuthProvider>
              <TrainingProvider>
                <ToastProvider>
                  {children}
                </ToastProvider>
              </TrainingProvider>
            </AuthProvider>
          </ThemeColorProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
