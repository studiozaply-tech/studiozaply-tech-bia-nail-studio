import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "BEATRIZ ABREU · Agendamento", template: "%s · BEATRIZ ABREU" },
  description: "Agende seu horário com Beatriz Abreu, do Bia Nail Studio, em poucos toques.",
};

export const viewport: Viewport = {
  themeColor: "#8E35A8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo antes da pintura para não piscar */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("tema")==="escuro")document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${playfair.variable}`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
