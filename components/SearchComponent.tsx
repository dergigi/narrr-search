'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useNostr } from '../app/contexts/NostrContext';
import { MagnifyingGlassIcon, StopIcon } from '@heroicons/react/24/outline';
import RelayStatus from './RelayStatus';
import { useSearchParams } from 'next/navigation';

export default function SearchComponent() {
  const { searchNostr, stopSearch, isSearching, isLoggedIn, searchResults, currentQuery, setCurrentQuery } = useNostr();
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [countdown, setCountdown] = useState(21);
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'web-of-trust' | 'recent' | 'oldest'>('web-of-trust');

  // Check if we have a search parameter that needs to be reflected in the UI
  useEffect(() => {
    const queryFromUrl = searchParams?.get('q');
    if (queryFromUrl) {
      setHasSearched(true);
    }
  }, [searchParams]);

  // Countdown timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (isSearching) {
      setCountdown(21);
      
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCountdown(21);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isSearching]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      await searchNostr(searchQuery, sortBy);
    } catch (error) {
      console.error('Search failed:', error);
      setError('Search failed. Please try again.');
    }
  };

  const handleStopSearch = () => {
    stopSearch();
  };

  return (
    <div className="w-full max-w-2xl mx-auto my-8">
      <div className="flex flex-col sm:flex-row gap-4 w-full">
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            placeholder="Search the Nostr network..."
            className="w-full px-4 py-2 bg-black border border-purple-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'web-of-trust' | 'recent' | 'oldest')}
            className="px-4 py-2 bg-black border border-purple-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="web-of-trust">Web of Trust</option>
            <option value="recent">Most Recent</option>
            <option value="oldest">Oldest First</option>
          </select>
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSearching ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                SEARCHING
              </div>
            ) : (
              'SEARCH'
            )}
          </button>
        </div>
      </div>
      
      {error && (
        <div className="mt-2 text-sm text-red-400 font-mono">
          &gt; ERROR: {error}
        </div>
      )}
      
      {!isLoggedIn && (
        <div className="mt-4 text-center text-sm text-purple-400 font-mono cyber-glitch-text">
          &gt; ACCESS REQUIRED: AUTHENTICATE VIA NOSTR PROTOCOL
        </div>
      )}
      
      {isLoggedIn && <RelayStatus />}
      
      {hasSearched && isSearching && (
        <div className="mt-6 flex flex-col items-center justify-center">
          <div className="cyber-spinner mb-3">
            <div className="cyber-spinner-polygon"></div>
            <div className="cyber-spinner-polygon"></div>
          </div>
          <span className="text-purple-400 font-mono text-sm mb-3">SEARCHING NETWORK...</span>
        </div>
      )}
    </div>
  );
} 