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
        <div className="flex flex-col items-center justify-center p-8">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-600 mb-4"></div>
          <p className="text-gray-600">Searching across connected relays...</p>
        </div>
      </div>
    );
  }

  if (displayResults.length === 0 && initialized) {
    return (
      <div className="w-full max-w-2xl mx-auto my-8">
        <div className="text-center text-gray-500 p-8 bg-white rounded-lg shadow-md">
          <p className="mb-2">No results found.</p>
          <p className="text-sm">Try a different search term or check if your connected relays support NIP-50 search.</p>
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
      return 'Unknown author';
    }
  };

  const getTimeAgo = (event: NDKEvent) => {
    try {
      if (!event.created_at) return 'some time ago';
      return formatDistanceToNow(new Date(event.created_at * 1000), { addSuffix: true });
    } catch {
      return 'some time ago';
    }
  };
  
  const getResultType = (event: NDKEvent) => {
    if (user && event.pubkey === user.pubkey) {
      return 'Your note';
    } else if (userFollows.has(event.pubkey)) {
      return 'From someone you follow';
    }
    return 'Other note';
  };

  return (
    <div className="w-full max-w-2xl mx-auto my-8 space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Found {displayResults.length} result{displayResults.length === 1 ? '' : 's'}
        </h2>
        {isSearching && (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-purple-600 mr-2"></div>
            <span className="text-sm text-gray-500">Still searching...</span>
          </div>
        )}
      </div>
      
      {displayResults.map((event) => (
        <div key={event.id} className={`rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow ${
          user && event.pubkey === user.pubkey 
            ? 'bg-purple-50 border-l-4 border-purple-600' 
            : userFollows.has(event.pubkey)
              ? 'bg-blue-50 border-l-4 border-blue-400'
              : 'bg-white'
        }`}>
          <div className="flex justify-between mb-2">
            <div className="font-medium text-purple-700">{getAuthorName(event)}</div>
            <div className="text-sm text-gray-500">{getTimeAgo(event)}</div>
          </div>
          <div className="text-xs text-gray-500 mb-2">{getResultType(event)}</div>
          <div className="text-gray-800 whitespace-pre-wrap break-words">
            {event.content}
          </div>
          {event.tags?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {event.tags
                .filter((tag: string[]) => tag[0] === 't')
                .map((tag: string[], i: number) => (
                  <span 
                    key={i} 
                    className="inline-block bg-gray-100 rounded-full px-3 py-1 text-xs font-semibold text-gray-700"
                  >
                    #{tag[1]}
                  </span>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
} 