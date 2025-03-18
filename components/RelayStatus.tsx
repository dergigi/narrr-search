'use client';

import { useNostr } from '../app/contexts/NostrContext';

export default function RelayStatus() {
  const { relays, isLoggedIn, isUsingCustomRelays } = useNostr();

  // Format relay URL for display, ensuring we remove wss:// prefix and trailing slashes
  const formatRelayUrl = (url: string) => {
    // Remove wss:// prefix and trim any trailing slashes
    return url.replace(/^wss:\/\//i, '').replace(/\/+$/, '');
  };

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto mt-6 mb-6">
      <div className="mb-3">
        <h3 className="text-sm font-mono font-medium text-purple-400 flex items-center">
          <span className="mr-2">&gt;</span>
          {isUsingCustomRelays ? 'ACTIVE_RELAY_CONNECTIONS' : 'RELAY_CONNECTIONS'}
        </h3>
      </div>

      <div className="cyber-border rounded-lg p-4">
        <div className="flex flex-wrap gap-2">
          {relays.length > 0 ? (
            relays.map((relay) => (
              <div 
                key={relay.url}
                className={`py-1 px-3 rounded-md text-xs font-mono border flex items-center transition-all duration-300 ${
                  relay.connected 
                    ? 'border-green-500 text-green-400 shadow-sm shadow-green-900/20 bg-green-900/10' 
                    : relay.status === 'error'
                      ? 'border-red-500 text-red-400 shadow-sm shadow-red-900/20 bg-red-900/10'
                      : 'border-purple-500/30 text-purple-300 bg-gray-900/50'
                }`}
              >
                <span 
                  className={`w-2 h-2 rounded-full mr-1.5 ${
                    relay.connected 
                      ? 'bg-green-500 animate-pulse' 
                      : relay.status === 'error'
                        ? 'bg-red-500'
                        : 'bg-gray-500'
                  }`}
                />
                {formatRelayUrl(relay.url)}
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-300 font-mono">RELAY_CONNECTION_ERROR: NO_RELAYS_FOUND</div>
          )}
        </div>
      </div>
    </div>
  );
} 