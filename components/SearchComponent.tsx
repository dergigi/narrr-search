'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useNostr } from '../app/contexts/NostrContext';
import { MagnifyingGlassIcon, StopIcon } from '@heroicons/react/24/outline';
import RelayStatus from './RelayStatus';

export default function SearchComponent() {
  const { searchNostr, stopSearch, isSearching, isLoggedIn, searchResults } = useNostr();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [countdown, setCountdown] = useState(21);

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

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      setError('Please enter a search term');
      return;
    }
    
    if (isLoggedIn) {
      setError(null);
      try {
        setHasSearched(true);
        await searchNostr(query);
        console.log('Search completed with results:', searchResults.length);
      } catch (err) {
        console.error('Search error:', err);
        setError('Failed to complete search. Please try again.');
      }
    } else {
      setError('Please log in to search');
    }
  };

  const handleStopSearch = () => {
    stopSearch();
  };

  return (
    <div className="w-full max-w-2xl mx-auto my-8">
      <form onSubmit={handleSearch} className="relative">
        <div className="cyber-border rounded-lg p-0.5 shadow-lg shadow-purple-900/20 transition-all duration-300 hover:shadow-purple-800/30">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (error) setError(null);
            }}
            placeholder="SEARCH//"
            className={`w-full p-4 pl-12 pr-16 rounded-lg bg-gray-900 text-gray-200 ${
              error ? 'border-red-500 focus:ring-red-500' : 'border-none focus:ring-purple-500/50'
            } focus:outline-none focus:ring-2 font-mono placeholder-gray-500`}
            disabled={isSearching}
          />
        </div>
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-500">
          <MagnifyingGlassIcon className="h-5 w-5" />
        </div>
        <button
          type="submit"
          disabled={isSearching || !query.trim()}
          className={`absolute right-3 top-1/2 transform -translate-y-1/2 px-3 py-1.5 rounded-md transition-all duration-300 ${
            isSearching || !query.trim()
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-900/50 cyber-glow'
          }`}
        >
          {isSearching ? 'SEARCHING' : 'SEARCH 🏴‍☠️'}
        </button>
      </form>
      
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
          
          <button 
            onClick={handleStopSearch}
            className="flex items-center bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-md transition-all duration-300 cyber-glow border border-red-500/50 shadow-lg hover:shadow-red-900/50"
          >
            <span className="font-mono text-sm">ABORT SEARCH 🏴‍☠️</span>
          </button>
        </div>
      )}
    </div>
  );
} 