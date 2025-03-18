'use client';

import React, { createContext, useState, useContext, useEffect, ReactNode, Suspense, useRef } from 'react';
import NDK, { 
  NDKNip07Signer, 
  NDKUser, 
  NDKEvent, 
  NDKRelay,
  NDKSubscription,
  NDKFilter,
  NDKRelaySet,
  NDKRelayStatus,
  type NDKCacheAdapter
} from '@nostr-dev-kit/ndk';
import NDKCacheAdapterDexie from '@nostr-dev-kit/ndk-cache-dexie';
import { getRelayListForUser } from '@nostr-dev-kit/ndk';
import { useRouter, useSearchParams } from 'next/navigation';

// Storage keys
const STORAGE_KEY_LOGGED_IN = 'nostr-search:loggedIn';

// Default relay URLs as fallback
const DEFAULT_RELAY_URLS = process.env.NODE_ENV === 'development' 
  ? ['wss://relay.nostr.band']
  : [
      'wss://relay.nostr.band',
      'wss://relay.nostrcheck.me',
      'wss://relay.noswhere.com',
      'wss://bnc.netsec.vip',
      'wss://relay.snort.social',
      'wss://relay.damus.io',
      'wss://relay.primal.net',
    ];

// Outbox relay URLs for better content distribution
const OUTBOX_RELAY_URLS = process.env.NODE_ENV === 'development'
  ? ['wss://relay.nostr.band']
  : [
      'wss://purplepag.es',
      'wss://relay.primal.net',
    ];

// Interface for relay status
interface RelayStatus {
  url: string;
  connected: boolean;
  status: NDKRelayStatus;
}

// Interface for our Nostr context
interface NostrContextType {
  ndk: NDK | null;
  user: NDKUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => void;
  searchNostr: (query: string, sortBy: 'web-of-trust' | 'recent' | 'oldest', showOnlyMyStuff: boolean) => Promise<NDKEvent[]>;
  stopSearch: () => void;
  searchResults: NDKEvent[];
  isSearching: boolean;
  relays: RelayStatus[];
  rawRelayList: string | null;
  isUsingCustomRelays: boolean;
  userFollows: Set<string>;
  profileCache: Map<string, NDKUser>;
  getProfile: (pubkey: string) => Promise<NDKUser | null>;
  currentQuery: string;
  setCurrentQuery: (query: string) => void;
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
  stopSearch: () => {},
  searchResults: [],
  isSearching: false,
  relays: [],
  rawRelayList: null,
  isUsingCustomRelays: false,
  userFollows: new Set<string>(),
  profileCache: new Map<string, NDKUser>(),
  getProfile: async () => null,
  currentQuery: '',
  setCurrentQuery: () => {},
});

// Custom hook to use the Nostr context
export const useNostr = () => useContext(NostrContext);

// Add debug logging utility
const debug = (component: string, message: string, data?: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${component}] ${message}`, data || '');
  }
};

// Provider component that uses useSearchParams
function NostrProviderContent({ children }: { children: ReactNode }) {
  debug('NostrProvider', 'Initializing provider');
  
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [activeSubscription, setActiveSubscription] = useState<NDKSubscription | null>(null);
  const [profileCache, setProfileCache] = useState<Map<string, NDKUser>>(new Map());
  const [currentQuery, setCurrentQuery] = useState<string>('');
  
  debug('NostrProvider', 'Setting up searchAbortController');
  const searchAbortController = useRef<AbortController>(new AbortController());

  // Check for search query in URL on initialization
  useEffect(() => {
    const queryParam = searchParams?.get('q');
    debug('NostrProvider', 'URL query param:', queryParam);
    if (queryParam) {
      setCurrentQuery(queryParam);
    }
  }, [searchParams]);

  // Check if logged in and run search from URL parameter if needed
  useEffect(() => {
    const checkUrlSearchParam = async () => {
      const queryParam = searchParams?.get('q');
      debug('NostrProvider', 'Checking URL search param:', {
        queryParam,
        isLoggedIn,
        hasNdk: !!ndk,
        isLoading,
        isSearching
      });
      
      if (queryParam && isLoggedIn && ndk && !isLoading && !isSearching) {
        debug('NostrProvider', 'Executing search from URL param:', queryParam);
        await searchNostr(queryParam, 'web-of-trust', false);
      }
    };

    if (isLoggedIn && !isLoading) {
      checkUrlSearchParam();
    }
  }, [isLoggedIn, isLoading, ndk, searchParams]);

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
  const trackConnectedRelays = (url: string, connected: boolean, status: NDKRelayStatus) => {
    if (!url) return;

    // Normalize the URL by removing trailing slashes
    const normalizedUrl = url.replace(/\/+$/, '');

    setRelays(prev => {
      // Find if this relay is already in our list (checking normalized URLs)
      const existingIndex = prev.findIndex(r => r.url.replace(/\/+$/, '') === normalizedUrl);
      
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
        return [...prev, { url: normalizedUrl, connected, status }];
      }
    });
  };

  // Initialize NDK without default relays
  useEffect(() => {
    const init = async () => {
      debug('NostrProvider', 'Initializing NDK');
      try {
        // Create cache adapter if in browser
        let cacheAdapter: NDKCacheAdapter | undefined;
        if (typeof window !== 'undefined') {
          debug('NostrProvider', 'Creating cache adapter');
          cacheAdapter = new NDKCacheAdapterDexie({ dbName: "narrr" });
        }

        debug('NostrProvider', 'Creating NDK instance with config:', {
          explicitRelayUrls: DEFAULT_RELAY_URLS,
          outboxRelayUrls: OUTBOX_RELAY_URLS,
          hasCacheAdapter: !!cacheAdapter,
          isDevelopment: process.env.NODE_ENV === 'development'
        });

        // Create a new NDK instance with caching and outbox model
        const ndkInstance = new NDK({
          explicitRelayUrls: DEFAULT_RELAY_URLS,
          outboxRelayUrls: OUTBOX_RELAY_URLS,
          autoConnectUserRelays: true,
          autoFetchUserMutelist: true,
          enableOutboxModel: true,
          cacheAdapter: cacheAdapter,
          clientName: "Narrr web",
          clientNip89: "31990:fa984bd7dbb282f07e16e7ae87b26a2a7b9b90b7246a44771f0cf5ae58018f52:1731850618505"
        });
        
        debug('NostrProvider', 'Setting up relay connection listeners');
        // Set up relay connection listeners
        ndkInstance.pool.on('relay:connect', (relay: NDKRelay) => {
          debug('NostrProvider', 'Relay connected:', relay.url);
          trackConnectedRelays(relay.url, true, relay.status);
        });

        ndkInstance.pool.on('relay:disconnect', (relay: NDKRelay) => {
          debug('NostrProvider', 'Relay disconnected:', relay.url);
          trackConnectedRelays(relay.url, false, relay.status);
        });

        ndkInstance.pool.on('relay:connecting', (relay: NDKRelay) => {
          debug('NostrProvider', 'Relay connecting:', relay.url);
          trackConnectedRelays(relay.url, false, relay.status);
        });
        
        debug('NostrProvider', 'Connecting to NDK');
        await ndkInstance.connect();
        setNdk(ndkInstance);
        
        // Initialize with default relays, ensuring no duplicates
        const uniqueDefaultRelays = Array.from(new Set(DEFAULT_RELAY_URLS.map(url => url.replace(/\/+$/, ''))));
        debug('NostrProvider', 'Setting up default relays:', uniqueDefaultRelays);
        setRelays(uniqueDefaultRelays.map(url => ({
          url,
          connected: false,
          status: NDKRelayStatus.CONNECTING,
        })));
        setIsUsingCustomRelays(false);
        
        // Check if user was previously logged in
        const wasLoggedIn = checkSavedLoginState();
        debug('NostrProvider', 'Previous login state:', wasLoggedIn);
        
        // Check if user is already logged in or was logged in before
        if (hasNostrExtension() && (wasLoggedIn || hasNostrExtension())) {
          debug('NostrProvider', 'Attempting auto-login');
          const signer = new NDKNip07Signer();
          ndkInstance.signer = signer;
          try {
            const user = await signer.user();
            debug('NostrProvider', 'Auto-login successful:', user.pubkey);
            setUser(user);
            setIsLoggedIn(true);
            saveLoginState(true);
            
            // Fetch user's relays
            await fetchUserRelays(ndkInstance, user);
            
            // Fetch user's contact list on auto-login
            await fetchUserContactList(ndkInstance, user);
          } catch (e) {
            debug('NostrProvider', 'Auto-login failed:', e);
            console.error('Failed to get user:', e);
            // Clear saved login state if automatic login fails
            saveLoginState(false);
          }
        }
      } catch (error) {
        debug('NostrProvider', 'NDK initialization failed:', error);
        console.error('Failed to initialize NDK:', error);
      } finally {
        setIsLoading(false);
        debug('NostrProvider', 'Initialization complete');
      }
    };

    init();
  }, []);

  // Fetch and connect to user's relays
  const fetchUserRelays = async (ndkInstance: NDK, user: NDKUser) => {
    try {
      // In development mode, only use relay.nostr.band
      if (process.env.NODE_ENV === 'development') {
        debug('NostrProvider', 'Development mode: using only relay.nostr.band');
        const devRelay = {
          url: 'wss://relay.nostr.band',
          connected: false,
          status: NDKRelayStatus.CONNECTING
        };
        setRelays([devRelay]);
        setIsUsingCustomRelays(false);
        return;
      }

      // Get user's relay list
      const userRelayList = await getRelayListForUser(user.pubkey, ndkInstance);
      
      // Store the raw relay list for future reference if needed
      setRawRelayList(JSON.stringify(userRelayList, null, 2));
      
      if (userRelayList) {
        // Get relay URLs from the relay list
        // First try direct keys (most common structure)
        // Remove trailing slashes from relay URLs and ensure uniqueness
        const userRelayUrls = new Set<string>();
        Object.keys(userRelayList)
          .filter(url => url.startsWith('wss://'))
          .forEach(url => userRelayUrls.add(url.replace(/\/+$/, '')));
        
        // If no proper URLs found in keys, try to extract them from the values
        if (userRelayUrls.size === 0) {
          const relayListObj = userRelayList as unknown as Record<string, unknown>;
          
          // Try to find URL properties in the values
          Object.values(relayListObj).forEach(value => {
            if (value && typeof value === 'object') {
              const relayObj = value as Record<string, unknown>;
              if ('url' in relayObj && typeof relayObj.url === 'string' && relayObj.url.startsWith('wss://')) {
                // Remove trailing slashes before adding
                userRelayUrls.add((relayObj.url as string).replace(/\/+$/, ''));
              }
            }
          });
        }
        
        if (userRelayUrls.size > 0) {
          // Flag that we're using custom relays
          setIsUsingCustomRelays(true);
          
          // Replace the relay list completely with the user's preferred relays
          const newRelayList = Array.from(userRelayUrls).map(url => {
            // Keep connection status if we already have this relay
            const existingRelay = relays.find(r => r.url.replace(/\/+$/, '') === url);
            
            return existingRelay || {
              url,
              connected: false,
              status: NDKRelayStatus.CONNECTING
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

  // Logout function - reset to empty relays array
  const logout = () => {
    // Clean up subscriptions
    if (activeSubscription) {
      activeSubscription.stop();
      setActiveSubscription(null);
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
      status: NDKRelayStatus.CONNECTING,
    })));
  };

  // Sort function for search results based on the specified criteria
  const sortSearchResults = (results: NDKEvent[], sortBy: 'web-of-trust' | 'recent' | 'oldest' = 'web-of-trust'): NDKEvent[] => {
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
  const searchNostr = async (query: string, sortBy: 'web-of-trust' | 'recent' | 'oldest', showOnlyMyStuff: boolean) => {
    debug('NostrProvider', 'Starting search:', { query, sortBy, showOnlyMyStuff });
    
    if (!query.trim()) {
      debug('NostrProvider', 'Empty query, clearing results');
      setSearchResults([]);
      return [];
    }

    if (!ndk) {
      debug('NostrProvider', 'NDK not initialized');
      return [];
    }

    // Cancel any ongoing search before starting a new one
    debug('NostrProvider', 'Cancelling previous search');
    searchAbortController.current.abort();
    searchAbortController.current = new AbortController();

    // Set searching state to true
    setIsSearching(true);
    setSearchResults([]);
    
    try {
      const searchQuery = query.trim();
      setCurrentQuery(searchQuery);

      // Get the current user's pubkey if showOnlyMyStuff is true
      const currentUserPubkey = showOnlyMyStuff ? ndk?.activeUser?.pubkey : undefined;
      debug('NostrProvider', 'Search params:', { searchQuery, currentUserPubkey });

      // Log relay status
      debug('NostrProvider', 'Current relay status:', relays.map(r => ({
        url: r.url,
        connected: r.connected,
        status: r.status
      })));

      // Create a simpler filter first to test
      const filter: NDKFilter = {
        kinds: [1], // Just text notes for now
        search: searchQuery,
        limit: 100,
        ...(currentUserPubkey ? { authors: [currentUserPubkey] } : {}),
      };

      debug('NostrProvider', 'Fetching events with filter:', filter);
      
      // Get events from relays with timeout
      const events = await Promise.race([
        ndk.fetchEvents(filter),
        new Promise<Set<NDKEvent>>((_, reject) => 
          setTimeout(() => reject(new Error('Search timeout')), 10000)
        )
      ]);

      if (!events) {
        debug('NostrProvider', 'No events found');
        setSearchResults([]);
        return [];
      }

      // Convert events to array and sort them
      let sortedEvents = Array.from(events);
      debug('NostrProvider', `Found ${sortedEvents.length} events, sorting by ${sortBy}`);

      if (sortedEvents.length === 0) {
        debug('NostrProvider', 'No events found after conversion');
        setSearchResults([]);
        return [];
      }

      // Log some sample events for debugging
      debug('NostrProvider', 'Sample events:', sortedEvents.slice(0, 3).map(e => ({
        id: e.id,
        pubkey: e.pubkey,
        content: e.content.substring(0, 50) + '...',
        created_at: e.created_at
      })));

      if (sortBy === 'web-of-trust') {
        // Sort by web of trust (number of likes)
        sortedEvents.sort((a, b) => {
          const aLikes = a.tags.filter(tag => tag[0] === 'p' && tag[3] === 'like').length;
          const bLikes = b.tags.filter(tag => tag[0] === 'p' && tag[3] === 'like').length;
          return bLikes - aLikes;
        });
      } else if (sortBy === 'recent') {
        // Sort by most recent first
        sortedEvents.sort((a, b) => b.created_at! - a.created_at!);
      } else if (sortBy === 'oldest') {
        // Sort by oldest first
        sortedEvents.sort((a, b) => a.created_at! - b.created_at!);
      }

      debug('NostrProvider', 'Search complete, setting results');
      setSearchResults(sortedEvents);
      return sortedEvents;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          debug('NostrProvider', 'Search aborted');
        } else {
          debug('NostrProvider', 'Search error:', error);
          console.error('Error searching Nostr:', error);
        }
      }
      setSearchResults([]);
      return [];
    } finally {
      setIsSearching(false);
      debug('NostrProvider', 'Search finished');
    }
  };

  // Stop search function
  const stopSearch = () => {
    debug('NostrProvider', 'Stopping search');
    searchAbortController.current.abort();
    searchAbortController.current = new AbortController();
    setIsSearching(false);
  };

  // Fetch profile function with caching
  const getProfile = async (pubkey: string): Promise<NDKUser | null> => {
    if (!ndk) return null;
    
    try {
      // If it's the current user, return user directly
      if (user && user.pubkey === pubkey) {
        return user;
      }
      
      // Check if the profile is already cached
      if (profileCache.has(pubkey)) {
        console.log(`Using cached profile for ${pubkey}`);
        return profileCache.get(pubkey) || null;
      }
      
      console.log(`Fetching profile for ${pubkey}`);
      
      // Create a new NDKUser for this pubkey
      const ndkUser = new NDKUser({ pubkey });
      ndkUser.ndk = ndk;
      
      // Fetch the profile
      await ndkUser.fetchProfile();
      
      // Add it to the cache
      setProfileCache(prev => {
        const newCache = new Map(prev);
        newCache.set(pubkey, ndkUser);
        return newCache;
      });
      
      return ndkUser;
    } catch (error) {
      console.warn(`Failed to fetch profile for ${pubkey}:`, error);
      return null;
    }
  };

  // Fetch profiles for all authors in the search results
  const fetchProfilesForAuthors = async (events: NDKEvent[]) => {
    if (!ndk || events.length === 0) return;
    
    try {
      console.log('Fetching profiles for authors...');
      
      // Get unique author pubkeys
      const authorPubkeys = new Set<string>();
      events.forEach(event => {
        if (event.pubkey) {
          authorPubkeys.add(event.pubkey);
        }
      });
      
      // Filter out pubkeys we already have in the cache
      const pubkeysToFetch = Array.from(authorPubkeys).filter(
        pubkey => !profileCache.has(pubkey) && (!user || user.pubkey !== pubkey)
      );
      
      console.log(`Found ${authorPubkeys.size} unique authors, ${pubkeysToFetch.length} need to be fetched`);
      
      // Create NDKUser objects for each author
      const authors = pubkeysToFetch.map(pubkey => {
        const user = new NDKUser({ pubkey });
        user.ndk = ndk;
        return user;
      });
      
      // Fetch profiles in batches to avoid overloading
      const batchSize = 20;
      
      for (let i = 0; i < authors.length; i += batchSize) {
        console.log(`Fetching profiles for authors... batch ${i / batchSize + 1}`);
        const batch = authors.slice(i, i + batchSize);
        await Promise.all(batch.map(async user => {
          await getProfile(user.pubkey);
        }));
      }
    } catch (error) {
      console.error('Failed to fetch profiles for authors:', error);
    }
  };

  // Update relay status handling
  const updateRelayStatus = (relay: NDKRelay) => {
    setRelays(prev => {
      const newRelays = [...prev];
      const existingIndex = newRelays.findIndex(r => r.url === relay.url);
      
      if (existingIndex >= 0) {
        newRelays[existingIndex] = {
          url: relay.url,
          connected: relay.status === NDKRelayStatus.CONNECTED,
          status: relay.status
        };
      } else {
        newRelays.push({
          url: relay.url,
          connected: relay.status === NDKRelayStatus.CONNECTED,
          status: relay.status
        });
      }
      
      return newRelays;
    });
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
        stopSearch,
        searchResults,
        isSearching,
        relays,
        rawRelayList,
        isUsingCustomRelays,
        userFollows,
        profileCache,
        getProfile,
        currentQuery,
        setCurrentQuery,
      }}
    >
      {children}
    </NostrContext.Provider>
  );
}

export default NostrProviderContent;