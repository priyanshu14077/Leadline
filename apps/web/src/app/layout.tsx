import type { Metadata, Viewport } from "next";
import { Archivo, Azeret_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Archivo's width axis gives one family two voices: condensed label caps and a normal reading width.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });
// Mono only for measurement: clocks, ids, phone numbers.
const azeret = Azeret_Mono({ variable: "--font-azeret", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "LeadLine", template: "%s · LeadLine" },
  description: "Live lead board for cosmetic dental clinics: every enquiry on screen in under a second, and every minute until the call counted.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1d3a8f" },
    { media: "(prefers-color-scheme: dark)", color: "#121a2e" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${archivo.variable} ${azeret.variable} antialiased`}>
      <body className="min-h-dvh bg-background text-foreground">
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster position="bottom-left" />
      </body>
    </html>
  );
}
