'use client';

import { ReactNode } from 'react';
import NostrProvider from "./contexts/NostrContext";

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <NostrProvider>
      {children}
      <footer className="w-full text-center py-6 text-purple-400 font-mono text-sm mt-8">
        Made with 🧡 and vibes by <a href="https://nosta.me/dergigi.com" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:text-purple-300 transition-colors duration-200">Gigi</a> during <a href="https://nosta.me/sovereignengineering.io" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:text-purple-300 transition-colors duration-200">SEC-04</a> 🏴‍☠️
      </footer>
    </NostrProvider>
  );
} 