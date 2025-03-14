'use client';

import { useNostr } from "../app/contexts/NostrContext";
import LoginButton from "./LoginButton";
import SearchComponent from "./SearchComponent";
import SearchResults from "./SearchResults";

export default function MainContent() {
  const { isLoggedIn } = useNostr();
  
  return (
    <div className="relative z-10 max-w-4xl mx-auto">
      {/* Glow effect overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent pointer-events-none blur-2xl opacity-30 -z-10"></div>
      
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600 font-mono cyber-glitch-text">NARRR</h1>
        <LoginButton />
      </div>
      
      {!isLoggedIn && (
        <div className="cyber-border rounded-xl shadow-lg shadow-purple-900/20 p-6 mb-8 text-gray-300">
          <p className="text-gray-300 mb-4">
            Welcome to NARRR (Narcissistic Relay-Related Search). Login with your Nostr browser extension to search
            content across your connected relays.
          </p>
          <div className="text-sm text-gray-400 font-mono">
            <p>
              &gt; This tool allows you to search notes and posts from your Nostr network.
              <br />
              &gt; The search is performed across all relays your account is connected to.
            </p>
          </div>
        </div>
      )}
      
      <SearchComponent />
      <SearchResults />
    </div>
  );
} 