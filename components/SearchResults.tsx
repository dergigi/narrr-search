'use client';

import { useNostr } from '../app/contexts/NostrContext';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect } from 'react';

export default function SearchResults() {
  const { searchResults, isSearching, isLoggedIn, user, userFollows } = useNostr();
  const [displayResults, setDisplayResults] = useState<NDKEvent[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Update display results whenever searchResults changes
  useEffect(() => {
    console.log('Search results updated:', searchResults.length);
    setDisplayResults(searchResults);
    
    if (searchResults.length > 0 && !initialized) {
      setInitialized(true);
    }
  }, [searchResults]);

  if (!isLoggedIn) {
    return null;
  }
  
  // Only show the loader if there are no results yet and we're still searching
  if (isSearching && displayResults.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto my-8">
        <div className="flex flex-col items-center justify-center p-8 cyber-border rounded-lg">
          <div className="cyber-spinner mb-4">
            <div className="cyber-spinner-polygon"></div>
            <div className="cyber-spinner-polygon"></div>
          </div>
          <p className="text-purple-400 font-mono">SEARCHING NOSTR NETWORK...</p>
        </div>
      </div>
    );
  }

  if (displayResults.length === 0 && initialized) {
    return (
      <div className="w-full max-w-2xl mx-auto my-8">
        <div className="text-center p-8 cyber-border rounded-lg">
          <p className="mb-3 text-purple-400 font-mono">SEARCH_COMPLETE: NO_RESULTS</p>
          <p className="text-sm text-gray-400">Try a different search term or check if your connected relays support NIP-50 search.</p>
        </div>
      </div>
    );
  }

  if (displayResults.length === 0) {
    return null; // Don't show anything if we haven't searched yet
  }

  const getAuthorName = (event: NDKEvent) => {
    try {
      const profile = event.author?.profile;
      if (profile?.displayName) return profile.displayName;
      if (profile?.name) return profile.name;
      return event.author?.npub?.slice(0, 8) + '...' + event.author?.npub?.slice(-4);
    } catch {
      return 'UNKNOWN_USER';
    }
  };

  const getTimeAgo = (event: NDKEvent) => {
    try {
      if (!event.created_at) return 'TIMESTAMP_UNKNOWN';
      return formatDistanceToNow(new Date(event.created_at * 1000), { addSuffix: true });
    } catch {
      return 'TIMESTAMP_ERROR';
    }
  };
  
  const getResultType = (event: NDKEvent) => {
    if (user && event.pubkey === user.pubkey) {
      return 'YOUR_NOTE';
    } else if (userFollows.has(event.pubkey)) {
      return 'FOLLOWED_USER';
    }
    return 'GLOBAL_NOTE';
  };

  return (
    <div className="w-full max-w-2xl mx-auto my-8 space-y-6">
      <div className="flex justify-between items-center mb-4 cyber-border py-2 px-4 rounded-md">
        <h2 className="text-lg font-mono text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600">
          RESULTS<span className="ml-2">[{displayResults.length}]</span>
        </h2>
        {isSearching && (
          <div className="flex items-center">
            <div className="w-3 h-3 bg-purple-500 rounded-full mr-2 animate-pulse"></div>
            <span className="text-xs text-purple-400 font-mono">SEARCHING...</span>
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        {displayResults.map((event, index) => (
          <div 
            key={event.id} 
            className={`cyber-border rounded-lg p-4 transition-all duration-300 hover:shadow-lg hover:shadow-purple-900/30 ${
              user && event.pubkey === user.pubkey 
                ? 'border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-900/20 to-gray-900/70' 
                : userFollows.has(event.pubkey)
                  ? 'border-l-4 border-l-blue-400 bg-gradient-to-r from-blue-900/20 to-gray-900/70'
                  : 'bg-gray-900/70'
            }`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex justify-between mb-2">
              <div className="font-medium text-purple-400 font-mono">{getAuthorName(event)}</div>
              <div className="text-xs text-gray-400 font-mono">{getTimeAgo(event)}</div>
            </div>
            <div className="text-xs text-purple-300 font-mono mb-3 flex items-center">
              <span className="inline-block w-2 h-2 bg-purple-500 mr-2"></span>
              {getResultType(event)}
            </div>
            <div className="text-gray-300 font-light whitespace-pre-wrap break-words bg-black/20 p-3 rounded">
              {event.content}
            </div>
            {event.tags?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {event.tags
                  .filter((tag: string[]) => tag[0] === 't')
                  .map((tag: string[], i: number) => (
                    <span 
                      key={i} 
                      className="inline-block bg-purple-900/30 border border-purple-500/30 rounded-md px-3 py-0.5 text-xs font-mono text-purple-300"
                    >
                      #{tag[1]}
                    </span>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 