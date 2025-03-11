'use client';

import { useState, FormEvent } from 'react';
import { useNostr } from '../app/contexts/NostrContext';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import RelayStatus from './RelayStatus';

export default function SearchComponent() {
  const { searchNostr, isSearching, isLoggedIn, searchResults } = useNostr();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

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

  return (
    <div className="w-full max-w-2xl mx-auto my-8">
      <form onSubmit={handleSearch} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Search for notes, articles, and posts..."
          className={`w-full p-4 pl-12 pr-16 rounded-lg border text-gray-800 ${
            error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-purple-500'
          } focus:outline-none focus:ring-2 focus:border-transparent`}
          disabled={isSearching}
        />
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
          <MagnifyingGlassIcon className="h-5 w-5" />
        </div>
        <button
          type="submit"
          disabled={isSearching || !query.trim()}
          className={`absolute right-3 top-1/2 transform -translate-y-1/2 px-3 py-1.5 rounded-md ${
            isSearching || !query.trim()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          } transition-colors`}
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </form>
      
      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
      
      {!isLoggedIn && (
        <div className="mt-4 text-center text-sm text-gray-500">
          Please login with your Nostr extension to search.
        </div>
      )}
      
      {isLoggedIn && <RelayStatus />}
      
      {hasSearched && isSearching && (
        <div className="mt-6 text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-600 mr-2"></div>
          <span className="text-gray-600">Searching across connected relays...</span>
        </div>
      )}
    </div>
  );
} 