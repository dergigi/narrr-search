'use client';

import { useNostr } from '../app/contexts/NostrContext';

export default function RelayStatus() {
  const { relays, isLoggedIn, isUsingCustomRelays } = useNostr();

  // Format relay URL for display, ensuring we remove wss:// prefix
  const formatRelayUrl = (url: string) => {
    return url.replace(/^wss:\/\//i, '');
  };

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto mt-2 mb-6">
      <div className="mb-2">
        <h3 className="text-sm font-medium text-gray-500">
          {isUsingCustomRelays ? 'Your Preferred Relays:' : 'Default Relays:'}
        </h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {relays.length > 0 ? (
          relays.map((relay) => (
            <div 
              key={relay.url}
              className={`py-1 px-3 rounded-full text-xs font-medium flex items-center ${
                relay.connected 
                  ? 'bg-green-100 text-green-800' 
                  : relay.status === 'error'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
              }`}
            >
              <span 
                className={`w-2 h-2 rounded-full mr-1.5 ${
                  relay.connected 
                    ? 'bg-green-500' 
                    : relay.status === 'error'
                      ? 'bg-red-500'
                      : 'bg-gray-500'
                }`}
              />
              {formatRelayUrl(relay.url)}
            </div>
          ))
        ) : (
          <div className="text-sm text-gray-500">No relays connected</div>
        )}
      </div>
    </div>
  );
} 