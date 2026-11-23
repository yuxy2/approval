import { Outfit, Inter } from "next/font/google";
import "./globals.css";
import SimulationPanel from "@/components/SimulationPanel";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata = {
  title: "Sistem Persetujuan Variasi | Elevate Equity",
  description: "Alur kerja persetujuan permohonan variasi internal Elevate Equity.",
};

export default function RootLayout({ children }) {
  const showSimulator = process.env.NEXT_PUBLIC_SHOW_SIMULATOR === 'true';
  
  return (
    <html lang="id" className={`${outfit.variable} ${inter.variable} h-full`}>
      <body className="font-sans bg-slate-50 text-slate-900 min-h-screen flex flex-col antialiased">
        {showSimulator && <SimulationPanel />}
        <main className="flex-1 flex flex-col">
          {children}
        </main>
        <footer className="py-6 border-t border-slate-200 bg-white text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Elevate Equity. Seluruh hak cipta dilindungi.</p>
          <p className="text-[10px] text-slate-600 mt-1">"Elevate Equity"</p>
        </footer>
      </body>
    </html>
  );
}
