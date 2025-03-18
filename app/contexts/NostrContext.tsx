'use client';

import { createContext, useState, useContext, useEffect, ReactNode, Suspense, useRef } from 'react';
import NDK, { 
  NDKNip07Signer, 
  NDKUser, 
  NDKEvent, 
  NDKRelay,
  NDKSubscription
} from '@nostr-dev-kit/ndk';
import { getRelayListForUser } from '@nostr-dev-kit/ndk';
import { useRouter, useSearchParams } from 'next/navigation';

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

// Default relay URLs as fallback
const DEFAULT_RELAY_URLS = [
  'wss://relay.nostr.band',
  'wss://relay.nostrcheck.me',
  'wss://relay.noswhere.com',
  'wss://bnc.netsec.vip',
  'wss://relay.snort.social',
];

// Provider component that uses useSearchParams
function NostrProviderContent({ children }: { children: ReactNode }) {
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
  const searchAbortController = useRef<AbortController>(new AbortController());

  // Check for search query in URL on initialization
  useEffect(() => {
    const queryParam = searchParams?.get('q');
    if (queryParam) {
      setCurrentQuery(queryParam);
    }
  }, [searchParams]);

  // Check if logged in and run search from URL parameter if needed
  useEffect(() => {
    const checkUrlSearchParam = async () => {
      const queryParam = searchParams?.get('q');
      if (queryParam && isLoggedIn && ndk && !isLoading && !isSearching) {
        console.log('Found search query in URL, executing search:', queryParam);
        await searchNostr(queryParam);
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
  const trackConnectedRelays = (url: string, connected: boolean, status: RelayStatus['status']) => {
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
        
        // Initialize with default relays, ensuring no duplicates
        const uniqueDefaultRelays = Array.from(new Set(DEFAULT_RELAY_URLS.map(url => url.replace(/\/+$/, ''))));
        setRelays(uniqueDefaultRelays.map(url => ({
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
    console.log('searchNostr called with query:', query);
    console.log('NDK instance:', ndk ? 'available' : 'null');
    console.log('Is logged in:', isLoggedIn);
    
    if (!query.trim() || !ndk) {
      console.log('Search aborted: empty query or no NDK instance');
      setSearchResults([]);
      return [];
    }

    setIsSearching(true);
    setCurrentQuery(query);
    setSearchResults([]);

    // Abort any ongoing search
    if (searchAbortController.current) {
      console.log('Aborting previous search');
      searchAbortController.current.abort();
    }
    searchAbortController.current = new AbortController();

    try {
      console.log('Starting search for:', query);
      console.log('Using relays:', relays.map(r => r.url).join(', '));
      
      const results = await ndk.fetchEvents({
        kinds: [1],
        search: query,
        limit: 420
      });

      const resultsArray = Array.from(results);
      console.log(`Found ${resultsArray.length} results`);
      
      // Log first 10 results
      console.log('First 10 results:', resultsArray.slice(0, 10).map(event => ({
        id: event.id,
        pubkey: event.pubkey,
        content: event.content?.slice(0, 100) + '...',
        created_at: new Date(event.created_at! * 1000).toISOString()
      })));
      
      // Fetch profiles for all authors in the results
      await fetchProfilesForAuthors(resultsArray);
      
      // Sort the results
      const sortedResults = sortSearchResults(resultsArray);
      
      setSearchResults(sortedResults);
      return sortedResults;
    } catch (error) {
      if (error instanceof Error) {
        console.error('Search error:', error.name, error.message);
        if (error.name === 'AbortError') {
          console.log('Search aborted');
          return [];
        }
      }
      console.error('Error searching Nostr:', error);
      setSearchResults([]);
      return [];
    } finally {
      setIsSearching(false);
    }
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
        console.log(`Fetching profiles batch ${i / batchSize + 1}/${Math.ceil(authors.length / batchSize)}`);
        
        const batch = authors.slice(i, i + batchSize);
        const profilePromises = batch.map(async author => {
          try {
            await author.fetchProfile();
            // Add to cache
            setProfileCache(prev => {
              const newCache = new Map(prev);
              newCache.set(author.pubkey, author);
              return newCache;
            });
            return author;
          } catch (error) {
            console.warn(`Failed to fetch profile for ${author.pubkey}:`, error);
            return null;
          }
        });
        
        await Promise.all(profilePromises);
      }
      
      // Update event authors with fetched profiles
      for (const event of events) {
        if ((!event.author || !event.author.profile) && event.pubkey) {
          // Check if it's the current user
          if (user && event.pubkey === user.pubkey) {
            event.author = user;
          } else {
            // Look up in cache first
            const cachedUser = profileCache.get(event.pubkey);
            if (cachedUser) {
              event.author = cachedUser;
            } else {
              // Create a new user as fallback
              const ndkUser = new NDKUser({ pubkey: event.pubkey });
              ndkUser.ndk = ndk;
              event.author = ndkUser;
            }
          }
        }
      }
      
      console.log('Finished fetching author profiles');
      
      // Update the search results state to trigger a re-render
      const sortedResults = sortSearchResults([...events]);
      setSearchResults(sortedResults);
      
    } catch (error) {
      console.error('Error fetching author profiles:', error);
    }
  };

  // Function to stop the search
  const stopSearch = () => {
    if (activeSubscription || isSearching) {
      console.log('Stopping search...');
      if (activeSubscription) {
        activeSubscription.stop();
        setActiveSubscription(null);
      }
      // Always update the searching state
      setIsSearching(false);
      console.log('Search stopped');
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

// Main Provider component wrapped in Suspense
export const NostrProvider = ({ children }: { children: ReactNode }) => {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-black">
        <div className="cyber-spinner mb-4">
          <div className="cyber-spinner-polygon"></div>
          <div className="cyber-spinner-polygon"></div>
        </div>
        <p className="text-purple-400 font-mono">LOADING...</p>
      </div>
    }>
      <NostrProviderContent>{children}</NostrProviderContent>
    </Suspense>
  );
}; 