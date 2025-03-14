'use client';

import { useState, useEffect } from "react";
import { useNostr } from "../app/contexts/NostrContext";
import LoginButton from "./LoginButton";
import SearchComponent from "./SearchComponent";
import SearchResults from "./SearchResults";
import { ShareIcon } from "@heroicons/react/24/outline";
import { useSearchParams } from "next/navigation";

export default function MainContent() {
  const { isLoggedIn, currentQuery, isSearching } = useNostr();
  const [showShareMessage, setShowShareMessage] = useState(false);
  const searchParams = useSearchParams();
  
  // Determine if we have an active search from URL or user action
  const hasActiveSearch = currentQuery.trim() !== '' && searchParams?.has('q');
  
  // Handle share button click
  const handleShare = () => {
    // Copy the current URL to clipboard
    navigator.clipboard.writeText(window.location.href)
      .then(() => {
        setShowShareMessage(true);
        setTimeout(() => setShowShareMessage(false), 3000);
      })
      .catch(err => {
        console.error('Failed to copy URL:', err);
      });
  };
  
  return (
    <div className="relative z-10 max-w-4xl mx-auto">
      {/* Glow effect overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent pointer-events-none blur-2xl opacity-30 -z-10"></div>
      
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600 font-mono cyber-glitch-text flex items-center">
          <span className="mr-2">🏴‍☠️</span>NARRR<span className="ml-2">🏴‍☠️</span>
        </h1>
        <div className="flex items-center space-x-3">
          {hasActiveSearch && (
            <button 
              onClick={handleShare}
              className="flex items-center text-purple-400 hover:text-purple-300 transition-colors duration-200 cyber-box-sm p-2 rounded"
              title="Share this search"
            >
              <ShareIcon className="h-5 w-5 mr-1" />
              <span className="hidden sm:inline text-sm">Share</span>
            </button>
          )}
          <LoginButton />
        </div>
      </div>
      
      {showShareMessage && (
        <div className="fixed top-5 right-5 bg-purple-900/80 text-white px-4 py-2 rounded-md shadow-lg border border-purple-500/50 z-50 font-mono text-sm animation-fade-in">
          Search URL copied to clipboard!
        </div>
      )}
      
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