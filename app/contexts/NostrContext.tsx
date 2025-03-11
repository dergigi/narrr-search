'use client';

import { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import NDK, { 
  NDKNip07Signer, 
  NDKUser, 
  NDKEvent, 
  NDKRelay
} from '@nostr-dev-kit/ndk';
import { getRelayListForUser } from '@nostr-dev-kit/ndk';

// Storage keys
const STORAGE_KEY_LOGGED_IN = 'nostr-search:loggedIn';

// Interface for relay status
interface RelayStatus {
  url: string;
  connected: boolean;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
}

// Interface for our Nostr context
interface NostrContextType {
  ndk: NDK | null;
  user: NDKUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => void;
  searchNostr: (query: string) => Promise<NDKEvent[]>;
  searchResults: NDKEvent[];
  isSearching: boolean;
  relays: RelayStatus[];
  rawRelayList: string | null;
  isUsingCustomRelays: boolean;
  userFollows: Set<string>;
}

// Create the context with a default value
const NostrContext = createContext<NostrContextType>({
  ndk: null,
  user: null,
  isLoggedIn: false,
  isLoading: true,
  login: async () => {},
  logout: () => {},
  searchNostr: async () => [],
  searchResults: [],
  isSearching: false,
  relays: [],
  rawRelayList: null,
  isUsingCustomRelays: false,
  userFollows: new Set<string>(),
});

// Custom hook to use the Nostr context
export const useNostr = () => useContext(NostrContext);

// Default relay URLs as fallback
const DEFAULT_RELAY_URLS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
];

// Provider component to wrap the app
export const NostrProvider = ({ children }: { children: ReactNode }) => {
  const [ndk, setNdk] = useState<NDK | null>(null);
  const [user, setUser] = useState<NDKUser | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<NDKEvent[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [relays, setRelays] = useState<RelayStatus[]>([]);
  const [rawRelayList, setRawRelayList] = useState<string | null>(null);
  const [isUsingCustomRelays, setIsUsingCustomRelays] = useState(false);
  const [userFollows, setUserFollows] = useState<Set<string>>(new Set());

  // Check if Nostr extension is available
  const hasNostrExtension = () => {
    return typeof window !== 'undefined' && 'nostr' in window;
  };

  // Check localStorage for saved login state
  const checkSavedLoginState = () => {
    if (typeof window === 'undefined') return false;
    
    try {
      const savedLoggedIn = localStorage.getItem(STORAGE_KEY_LOGGED_IN);
      return savedLoggedIn === 'true';
    } catch (e) {
      console.error('Error reading from localStorage:', e);
      return false;
    }
  };

  // Save login state to localStorage
  const saveLoginState = (isLoggedIn: boolean) => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEY_LOGGED_IN, isLoggedIn ? 'true' : 'false');
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  };

  // Track which relays are connected
  const trackConnectedRelays = (url: string, connected: boolean, status: RelayStatus['status']) => {
    if (!url) return;

    setRelays(prev => {
      // Find if this relay is already in our list
      const existingIndex = prev.findIndex(r => r.url === url);
      
      if (existingIndex >= 0) {
        // Update existing relay
        const updatedRelays = [...prev];
        updatedRelays[existingIndex] = {
          ...updatedRelays[existingIndex],
          connected,
          status
        };
        return updatedRelays;
      } else {
        // If we have custom relays enabled, only add if it's in our custom list
        if (isUsingCustomRelays) {
          return prev;
        }
        
        // Add new relay to list
        return [...prev, { url, connected, status }];
      }
    });
  };

  // Initialize NDK with default relays
  useEffect(() => {
    const init = async () => {
      try {
        // Create a new NDK instance with default relays for initial connection
        const ndkInstance = new NDK({
          explicitRelayUrls: DEFAULT_RELAY_URLS,
        });
        
        // Set up relay connection listeners
        ndkInstance.pool.on('relay:connect', (relay: NDKRelay) => {
          trackConnectedRelays(relay.url, true, 'connected');
        });

        ndkInstance.pool.on('relay:disconnect', (relay: NDKRelay) => {
          trackConnectedRelays(relay.url, false, 'disconnected');
        });

        ndkInstance.pool.on('relay:connecting', (relay: NDKRelay) => {
          trackConnectedRelays(relay.url, false, 'connecting');
        });
        
        await ndkInstance.connect();
        setNdk(ndkInstance);
        
        // Initialize with default relays
        setRelays(DEFAULT_RELAY_URLS.map(url => ({
          url,
          connected: false,
          status: 'connecting',
        })));
        setIsUsingCustomRelays(false);
        
        // Check if user was previously logged in
        const wasLoggedIn = checkSavedLoginState();
        
        // Check if user is already logged in or was logged in before
        if (hasNostrExtension() && (wasLoggedIn || hasNostrExtension())) {
          const signer = new NDKNip07Signer();
          ndkInstance.signer = signer;
          try {
            const user = await signer.user();
            setUser(user);
            setIsLoggedIn(true);
            saveLoginState(true);
            
            // Fetch user's relays
            await fetchUserRelays(ndkInstance, user);
            
            // Fetch user's contact list on auto-login
            await fetchUserContactList(ndkInstance, user);
          } catch (e) {
            console.error('Failed to get user:', e);
            // Clear saved login state if automatic login fails
            saveLoginState(false);
          }
        }
      } catch (error) {
        console.error('Failed to initialize NDK:', error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  // Fetch and connect to user's relays
  const fetchUserRelays = async (ndkInstance: NDK, user: NDKUser) => {
    try {
      // Get user's relay list
      const userRelayList = await getRelayListForUser(user.pubkey, ndkInstance);
      
      // Store the raw relay list for future reference if needed
      setRawRelayList(JSON.stringify(userRelayList, null, 2));
      
      if (userRelayList) {
        // Get relay URLs from the relay list
        // First try direct keys (most common structure)
        const userRelayUrls: string[] = Object.keys(userRelayList).filter(url => url.startsWith('wss://'));
        
        // If no proper URLs found in keys, try to extract them from the values
        if (userRelayUrls.length === 0) {
          const relayListObj = userRelayList as unknown as Record<string, unknown>;
          
          // Try to find URL properties in the values
          Object.values(relayListObj).forEach(value => {
            if (value && typeof value === 'object') {
              const relayObj = value as Record<string, unknown>;
              if ('url' in relayObj && typeof relayObj.url === 'string' && relayObj.url.startsWith('wss://')) {
                userRelayUrls.push(relayObj.url);
              }
            }
          });
        }
        
        if (userRelayUrls.length > 0) {
          // Flag that we're using custom relays
          setIsUsingCustomRelays(true);
          
          // Replace the relay list completely with the user's preferred relays
          const newRelayList = userRelayUrls.map(url => {
            // Keep connection status if we already have this relay
            const existingRelay = relays.find(r => r.url === url);
            return existingRelay || {
              url,
              connected: false,
              status: 'connecting' as const
            };
          });
          
          // Force a complete replacement of the relay list
          setRelays(newRelayList);
        } else {
          // No user relays found, using defaults
          setIsUsingCustomRelays(false);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user relays:', error);
      setIsUsingCustomRelays(false);
    }
  };

  // Fetch user's contact list to determine who they follow
  const fetchUserContactList = async (ndkInstance: NDK, user: NDKUser) => {
    try {
      // Create a filter to get the user's contacts (kind 3 event)
      const filter = { kinds: [3], authors: [user.pubkey] };
      
      // Fetch the user's contact list
      const contactListEvents = await ndkInstance.fetchEvents(filter);
      
      // Get the most recent contact list event
      const contactListEvent = Array.from(contactListEvents).sort((a, b) => {
        return b.created_at! - a.created_at!;
      })[0];
      
      if (contactListEvent) {
        // Extract the pubkeys of the followed users
        const followedPubkeys = new Set<string>();
        contactListEvent.tags.forEach(tag => {
          if (tag[0] === 'p' && tag[1]) {
            followedPubkeys.add(tag[1]);
          }
        });
        
        console.log(`Loaded ${followedPubkeys.size} followed users`);
        setUserFollows(followedPubkeys);
      } else {
        console.log('No contact list found');
        setUserFollows(new Set());
      }
    } catch (error) {
      console.error('Failed to fetch user contact list:', error);
      setUserFollows(new Set());
    }
  };

  // Login function using NIP-07
  const login = async () => {
    if (!ndk) return;
    
    try {
      setIsLoading(true);
      
      // Check if extension is available
      if (hasNostrExtension()) {
        const signer = new NDKNip07Signer();
        ndk.signer = signer;
        const user = await signer.user();
        setUser(user);
        setIsLoggedIn(true);
        
        // Save logged in state to localStorage
        saveLoginState(true);
        
        // Fetch user's relays
        await fetchUserRelays(ndk, user);
        
        // Fetch user's contact list
        await fetchUserContactList(ndk, user);
      } else {
        alert('No Nostr browser extension found. Please install one like nos2x, Alby, or Blockcore.');
      }
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed. Do you have a Nostr browser extension installed?');
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    if (ndk) {
      ndk.signer = undefined;
    }
    setUser(null);
    setIsLoggedIn(false);
    setSearchResults([]);
    setUserFollows(new Set());
    
    // Clear logged in state from localStorage
    saveLoginState(false);
    
    // Reset relays to default
    setRelays(DEFAULT_RELAY_URLS.map(url => ({
      url,
      connected: false,
      status: 'connecting',
    })));
  };

  // Sort function for search results based on the specified criteria
  const sortSearchResults = (results: NDKEvent[]): NDKEvent[] => {
    return [...results].sort((a, b) => {
      // User's own notes come first
      if (user && a.pubkey === user.pubkey && b.pubkey !== user.pubkey) {
        return -1;
      }
      if (user && a.pubkey !== user.pubkey && b.pubkey === user.pubkey) {
        return 1;
      }
      
      // Notes from followed users come next
      const aIsFollowed = userFollows.has(a.pubkey);
      const bIsFollowed = userFollows.has(b.pubkey);
      
      if (aIsFollowed && !bIsFollowed) {
        return -1;
      }
      if (!aIsFollowed && bIsFollowed) {
        return 1;
      }
      
      // Otherwise sort by creation time, newest first
      return (b.created_at || 0) - (a.created_at || 0);
    });
  };

  // Search function using NIP-50
  const searchNostr = async (query: string): Promise<NDKEvent[]> => {
    if (!ndk || !query.trim()) {
      return [];
    }

    setIsSearching(true);
    setSearchResults([]);
    
    try {
      console.log('Searching for:', query);
      
      // Set up the search
      const results: NDKEvent[] = [];
      
      // Create a filter for NIP-50 search - explicitly setting kind: 1 for notes
      const filter = { kinds: [1], search: query };
      
      // Log which relays we're using for the search (either user's preferred or default)
      if (ndk.pool?.relays) {
        const connectedRelays = Array.from(ndk.pool.relays.entries())
          .filter(([, relay]) => relay.status === 1) // 1 is connected status in NDK
          .map(([url]) => url);
        
        console.log('Using connected relays for search:', connectedRelays);
        console.log('Using custom relays:', isUsingCustomRelays);
      }
      
      // Subscribe to search events with all available relays
      const subscription = ndk.subscribe([filter], { 
        closeOnEose: true 
      });
      
      return new Promise<NDKEvent[]>((resolve) => {
        subscription.on('event', (event: NDKEvent) => {
          console.log('Received search result:', event.id);
          // Add this event to our results
          results.push(event);
          // Sort and update the search results state in real-time
          const sortedResults = sortSearchResults(results);
          setSearchResults(sortedResults);
        });
        
        subscription.on('eose', () => {
          console.log('Search complete, found:', results.length);
          setIsSearching(false);
          // Do one final sort before completing
          const sortedResults = sortSearchResults(results);
          resolve(sortedResults);
        });

        // Add timeout as a fallback
        setTimeout(() => {
          if (results.length === 0) {
            console.log('Search timed out with no results');
            setIsSearching(false);
            resolve([]);
          } else if (isSearching) {
            // We got some results but never got EOSE
            console.log('Search timeout reached with partial results:', results.length);
            setIsSearching(false);
            // Sort results before returning
            const sortedResults = sortSearchResults(results);
            resolve(sortedResults);
          }
        }, 10000);
      });
    } catch (error) {
      console.error('Search failed:', error);
      setIsSearching(false);
      return [];
    }
  };

  return (
    <NostrContext.Provider
      value={{
        ndk,
        user,
        isLoggedIn,
        isLoading,
        login,
        logout,
        searchNostr,
        searchResults,
        isSearching,
        relays,
        rawRelayList,
        isUsingCustomRelays,
        userFollows,
      }}
    >
      {children}
    </NostrContext.Provider>
  );
}; 