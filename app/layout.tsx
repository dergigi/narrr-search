import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NostrProvider } from "./contexts/NostrContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NARRR - Narcissistic Relay-Related Search",
  description: "A search tool for Nostr content across your connected relays",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <NostrProvider>
          {children}
          <footer className="w-full text-center py-6 text-purple-400 font-mono text-sm mt-8">
            Made with 🧡 and vibes by <a href="https://nosta.me/dergigi.com" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:text-purple-300 transition-colors duration-200">Gigi</a>
          </footer>
        </NostrProvider>
      </body>
    </html>
  );
}
