'use client';

import { useNostr } from '../app/contexts/NostrContext';
import { NDKEvent, NDKUser } from '@nostr-dev-kit/ndk';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect, Suspense, useCallback } from 'react';
import { ShieldCheckIcon, ShieldExclamationIcon, UserCircleIcon, ShareIcon } from '@heroicons/react/24/solid';
import { useSearchParams } from 'next/navigation';

// Create a wrapper component that uses the search params
function SearchResultsContent() {
  const { searchResults, isSearching, isLoggedIn, user, userFollows, getProfile, profileCache, searchNostr, currentQuery } = useNostr();
  const [displayResults, setDisplayResults] = useState<NDKEvent[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [authorProfiles, setAuthorProfiles] = useState<Map<string, NDKUser | null>>(new Map());
  const [showShareMessage, setShowShareMessage] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'oldest'>('recent');
  const [useWebOfTrust, setUseWebOfTrust] = useState(true);
  const [showOnlyMyStuff, setShowOnlyMyStuff] = useState(false);
  const searchParams = useSearchParams();
  
  // Sort function for search results based on the specified criteria
  const sortSearchResults = (results: NDKEvent[], sortBy: 'recent' | 'oldest', useWebOfTrust: boolean): NDKEvent[] => {
    return [...results].sort((a, b) => {
      // First apply Web of Trust sorting if enabled
      if (useWebOfTrust) {
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
      }
      
      // Then apply time-based sorting
      if (sortBy === 'recent') {
        return (b.created_at || 0) - (a.created_at || 0);
      } else {
        return (a.created_at || 0) - (b.created_at || 0);
      }
    });
  };
  
  // Determine if we have an active search to show share button
  const hasActiveSearch = currentQuery.trim() !== '' && searchParams?.has('q');
  
  // Update display results whenever searchResults changes
  useEffect(() => {
    console.log('Search results updated:', searchResults.length);
    // Limit results to 420 notes and sort them
    const sortedResults = sortSearchResults(searchResults, sortBy, useWebOfTrust);
    setDisplayResults(sortedResults.slice(0, 420));
    
    if (searchResults.length > 0 && !initialized) {
      setInitialized(true);
    }
  }, [searchResults, sortBy, useWebOfTrust]);

  // Update display results when sortBy or useWebOfTrust changes
  useEffect(() => {
    if (displayResults.length > 0) {
      const sortedResults = sortSearchResults(displayResults, sortBy, useWebOfTrust);
      setDisplayResults(sortedResults);
    }
  }, [sortBy, useWebOfTrust]);

  // Handle share button click
  const handleShare = () => {
    // Copy the current URL to clipboard
    navigator.clipboard.writeText(window.location.href)
      .then(() => {
        setShowShareMessage(true);
        setTimeout(() => setShowShareMessage(false), 3000);
      })
      .catch(err => {
        console.error('Failed to copy URL:', err);
      });
  };

  // Preload profiles for all authors in the display results
  useEffect(() => {
    if (!displayResults.length) return;

    const loadProfiles = async () => {
      // Get unique pubkeys from the current display results
      const pubkeys = new Set<string>();
      displayResults.forEach(event => {
        if (event.pubkey) {
          pubkeys.add(event.pubkey);
        }
      });

      console.log(`Preloading ${pubkeys.size} author profiles for display`);
      
      // Create a new map for this batch of authors
      const newAuthorProfiles = new Map<string, NDKUser | null>();
      
      // For each pubkey, check the cache first, then load if needed
      const profilePromises = Array.from(pubkeys).map(async (pubkey) => {
        try {
          // First check if we already have this profile in our local component state
          if (authorProfiles.has(pubkey)) {
            newAuthorProfiles.set(pubkey, authorProfiles.get(pubkey)!);
            return;
          }
          
          // Otherwise load the profile using the context's getProfile function
          const profile = await getProfile(pubkey);
          newAuthorProfiles.set(pubkey, profile);
        } catch (error) {
          console.error(`Error loading profile for ${pubkey}:`, error);
          newAuthorProfiles.set(pubkey, null);
        }
      });
      
      await Promise.all(profilePromises);
      
      // Update our local cache of author profiles
      setAuthorProfiles(prev => {
        const merged = new Map(prev);
        newAuthorProfiles.forEach((value, key) => {
          merged.set(key, value);
        });
        return merged;
      });
    };
    
    loadProfiles();
  }, [displayResults, getProfile]);

  useEffect(() => {
    if (currentQuery && !isSearching) {
      searchNostr(currentQuery, sortBy, showOnlyMyStuff);
    }
  }, [currentQuery, sortBy, showOnlyMyStuff]);

  const handleSearch = async () => {
    if (currentQuery.trim()) {
      await searchNostr(currentQuery.trim(), sortBy, showOnlyMyStuff);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Handle hashtag click
  const handleHashtagClick = (hashtag: string) => {
    searchNostr(`#${hashtag}`, sortBy, showOnlyMyStuff);
  };

  // Handle hash click
  const handleHashClick = (hash: string) => {
    searchNostr(hash, sortBy, showOnlyMyStuff);
  };

  // Handle tag click
  const handleTagClick = (tag: string[]) => {
    searchNostr(`#${tag[1]}`, sortBy, showOnlyMyStuff);
  };

  // Handle search term click
  const handleSearchTermClick = (searchTerm: string) => {
    searchNostr(searchTerm, sortBy, showOnlyMyStuff);
  };

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
          <p className="text-purple-400 font-mono">SEARCHING NETWORK...</p>
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
      // If this note is from the current user, use their profile info directly
      if (user && event.pubkey === user.pubkey) {
        if (user.profile?.displayName) return user.profile.displayName;
        if (user.profile?.name) return user.profile.name;
        return 'YOUR_NOTE';
      }
      
      // Check our local component cache first
      const cachedProfile = authorProfiles.get(event.pubkey);
      if (cachedProfile?.profile) {
        if (cachedProfile.profile.displayName) return cachedProfile.profile.displayName;
        if (cachedProfile.profile.name) return cachedProfile.profile.name;
      }
      
      // Otherwise use the profile from the event author
      const profile = event.author?.profile;
      if (profile) {
        if (profile.displayName) return profile.displayName;
        if (profile.name) return profile.name;
      }
      
      // Check the global profile cache as a last resort
      const globalCachedProfile = profileCache.get(event.pubkey)?.profile;
      if (globalCachedProfile) {
        if (globalCachedProfile.displayName) return globalCachedProfile.displayName;
        if (globalCachedProfile.name) return globalCachedProfile.name;
      }
      
      // Fall back to npub if no profile or name is available
      return event.author?.npub ? 
        `${event.author.npub.slice(0, 8)}...${event.author.npub.slice(-4)}` :
        event.pubkey ? 
          `${event.pubkey.slice(0, 8)}...${event.pubkey.slice(-4)}` : 
          'UNKNOWN_USER';
    } catch (error) {
      console.error('Error getting author name:', error);
      return 'UNKNOWN_USER';
    }
  };

  const getProfilePicture = (event: NDKEvent) => {
    try {
      // If this note is from the current user, use their profile picture directly
      if (user && event.pubkey === user.pubkey && user.profile?.picture) {
        return user.profile.picture;
      }
      
      // Check our local component cache first
      const cachedProfile = authorProfiles.get(event.pubkey);
      if (cachedProfile?.profile?.picture) {
        return cachedProfile.profile.picture;
      }
      
      // Otherwise use the picture from the author's profile
      const profile = event.author?.profile;
      if (profile?.picture) {
        return profile.picture;
      }
      
      // Check the global profile cache as a last resort
      return profileCache.get(event.pubkey)?.profile?.picture || null;
    } catch (error) {
      console.error('Error getting profile picture:', error);
      return null;
    }
  };

  const isNip05Verified = (event: NDKEvent) => {
    try {
      // If this note is from the current user, check their profile directly
      if (user && event.pubkey === user.pubkey) {
        return !!user.profile?.nip05;
      }
      
      // Check our local component cache first
      const cachedProfile = authorProfiles.get(event.pubkey);
      if (cachedProfile?.profile) {
        return !!cachedProfile.profile.nip05;
      }
      
      const profile = event.author?.profile;
      if (profile) {
        return !!profile.nip05;
      }
      
      // Check the global profile cache as a last resort
      return !!profileCache.get(event.pubkey)?.profile?.nip05;
    } catch (error) {
      console.error('Error checking NIP-05 verification:', error);
      return false;
    }
  };

  const getNip05Name = (event: NDKEvent) => {
    try {
      // If this note is from the current user, get their nip05 directly
      if (user && event.pubkey === user.pubkey) {
        return user.profile?.nip05 || null;
      }
      
      // Check our local component cache first
      const cachedProfile = authorProfiles.get(event.pubkey);
      if (cachedProfile?.profile) {
        return cachedProfile.profile.nip05 || null;
      }
      
      const profile = event.author?.profile;
      if (profile) {
        return profile.nip05 || null;
      }
      
      // Check the global profile cache as a last resort
      return profileCache.get(event.pubkey)?.profile?.nip05 || null;
    } catch (error) {
      console.error('Error getting NIP-05 name:', error);
      return null;
    }
  };

  const getProfileUrl = (event: NDKEvent) => {
    try {
      // First check if user has a NIP-05 identifier
      const nip05 = getNip05Name(event);
      if (nip05 && typeof nip05 === 'string') {
        // Use the full NIP-05 identifier for nosta.me
        return `https://nosta.me/${nip05}`;
      }
      
      // Fall back to npub if available
      if (event.author?.npub) {
        return `https://nosta.me/${event.author.npub}`;
      }
      
      // Last resort: use hex pubkey
      if (event.pubkey) {
        return `https://nosta.me/${event.pubkey}`;
      }
      
      return null;
    } catch (error) {
      console.error('Error creating profile URL:', error);
      return null;
    }
  };

  const getTimeAgo = (event: NDKEvent) => {
    try {
      if (!event.created_at) return 'TIMESTAMP_UNKNOWN';
      return formatDistanceToNow(new Date(event.created_at * 1000), { addSuffix: true });
    } catch (error) {
      console.error('Error getting time ago:', error);
      return 'TIMESTAMP_ERROR';
    }
  };
  
  const getNoteUrl = (event: NDKEvent) => {
    try {
      // Ensure we have a valid ID
      if (!event.id) return null;
      // Return the njump.me URL with the note ID
      return `https://njump.me/${event.id}`;
    } catch (error) {
      console.error('Error creating note URL:', error);
      return null;
    }
  };
  
  const getNoteType = (event: NDKEvent) => {
    if (user && event.pubkey === user.pubkey) {
      return 'YOUR_NOTE 🏴‍☠️';
    } else if (userFollows.has(event.pubkey)) {
      return 'FOLLOWED_USER';
    }
    return 'RANDOM_PERSON';
  };

  const renderVerificationStatus = (event: NDKEvent) => {
    // Get the verification status
    const verified = isNip05Verified(event);
    
    // Get the NIP-05 name, which might be null
    const nip05Value = getNip05Name(event);
    
    // If we have a valid NIP-05 string, show it with appropriate styling
    if (nip05Value && typeof nip05Value === 'string') {
      if (verified) {
        // Verified case - show in green
        return (
          <div className="flex items-center" title={`Verified: ${nip05Value}`}>
            <ShieldCheckIcon className="w-4 h-4 text-green-400 mr-1" />
            <button
              onClick={() => {
                // Search for the user's npub or pubkey
                const searchTerm = event.author?.npub || event.pubkey;
                if (searchTerm) {
                  searchNostr(searchTerm, sortBy, showOnlyMyStuff);
                }
              }}
              className="text-xs text-green-400 truncate max-w-[150px] hover:text-green-300 hover:underline cursor-pointer transition-colors duration-200"
            >
              {nip05Value}
            </button>
          </div>
        );
      } else {
        // Unverified case - show in red
        return (
          <div className="flex items-center" title={`Unverified: ${nip05Value}`}>
            <ShieldExclamationIcon className="w-4 h-4 text-red-400 mr-1" />
            <button
              onClick={() => {
                // Search for the user's npub or pubkey
                const searchTerm = event.author?.npub || event.pubkey;
                if (searchTerm) {
                  searchNostr(searchTerm, sortBy, showOnlyMyStuff);
                }
              }}
              className="text-xs text-red-400 truncate max-w-[150px] hover:text-red-300 hover:underline cursor-pointer transition-colors duration-200"
            >
              {nip05Value}
            </button>
          </div>
        );
      }
    }
    
    // No NIP-05 identifier at all
    if (verified) {
      // Should be rare, but just in case - verified but no NIP-05 value
      return (
        <div className="flex items-center" title="NIP-05 Verified">
          <ShieldCheckIcon className="w-4 h-4 text-green-400 mr-1" />
          <span className="text-xs text-green-400 truncate max-w-[150px]">Verified</span>
        </div>
      );
    }
    
    // If no NIP-05, return null (no badge)
    return null;
  };

  // Function to detect and parse media URLs from content
  const parseMediaContent = (content: string) => {
    // URL regex pattern
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = content.match(urlRegex) || [];
    
    const mediaItems = {
      images: [] as string[],
      videos: [] as string[],
      youtubeEmbeds: [] as string[]
    };
    
    urls.forEach(url => {
      // Clean up the URL (remove trailing punctuation that might be part of text)
      const cleanUrl = url.replace(/[.,;:!?]$/, '');
      
      // Check for image URLs
      if (/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i.test(cleanUrl)) {
        mediaItems.images.push(cleanUrl);
      }
      // Check for video URLs
      else if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(cleanUrl)) {
        mediaItems.videos.push(cleanUrl);
      }
      // Check for YouTube URLs
      else if (/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/.test(cleanUrl) || 
               /youtu\.be\/([a-zA-Z0-9_-]+)/.test(cleanUrl)) {
        // Extract YouTube video ID
        const match = cleanUrl.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/) || 
                     cleanUrl.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          mediaItems.youtubeEmbeds.push(match[1]);
        }
      }
    });
    
    return mediaItems;
  };

  // Function to filter out media URLs from content
  const filterMediaContent = (content: string): string => {
    if (!content) return '';
    
    // Get media items
    const mediaItems = parseMediaContent(content);
    let filteredContent = content;
    
    // Collect all media URLs that need to be removed
    const urlsToRemove: string[] = [
      ...mediaItems.images,
      ...mediaItems.videos
    ];
    
    // Add YouTube URLs to the list of URLs to remove
    mediaItems.youtubeEmbeds.forEach(videoId => {
      // Check for both formats of YouTube URLs
      const youtubeUrl1 = `https://youtube.com/watch?v=${videoId}`;
      const youtubeUrl2 = `https://youtu.be/${videoId}`;
      
      urlsToRemove.push(youtubeUrl1);
      urlsToRemove.push(youtubeUrl2);
      
      // Also check for www. variants
      urlsToRemove.push(`https://www.youtube.com/watch?v=${videoId}`);
    });
    
    // Remove each URL from the content
    urlsToRemove.forEach(url => {
      // Escape special regex characters in the URL
      const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Create a regex that matches the URL possibly followed by punctuation
      const regex = new RegExp(`${escapedUrl}[.,;:!?]?\\s*`, 'g');
      filteredContent = filteredContent.replace(regex, '');
    });
    
    return filteredContent.trim();
  };

  // Function to render content with clickable links and hashtags
  const renderContent = (content: string) => {
    if (!content) return null;
    
    // First filter out media URLs that are already being rendered
    const filteredContent = filterMediaContent(content);
    
    // Process the content in multiple steps
    let processedContent = filteredContent;
    const elements: JSX.Element[] = [];
    let lastIndex = 0;
    
    // First process URLs
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    
    // Then process hashtags - match #word patterns
    const hashtagRegex = /#(\w+)/g;
    
    // Combined regex to match both URLs and hashtags
    const combinedRegex = new RegExp(`${urlRegex.source}|${hashtagRegex.source}`, 'g');
    
    // If no URLs or hashtags found, just return the filtered content
    if (!processedContent.match(combinedRegex)) {
      return <>{processedContent}</>;
    }
    
    // Process matches
    processedContent.replace(combinedRegex, (match, urlMatch, hashtagMatch, offset) => {
      // Add the text before the match
      if (offset > lastIndex) {
        elements.push(
          <span key={`text-${offset}`}>
            {processedContent.substring(lastIndex, offset)}
          </span>
        );
      }
      
      // Check if it's a URL
      if (match.startsWith('http')) {
        // Add the URL as a link
        elements.push(
          <a 
            key={`url-${offset}`}
            href={match}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 underline transition-colors duration-200"
          >
            {match}
          </a>
        );
      } 
      // Check if it's a hashtag
      else if (match.startsWith('#')) {
        // Extract the hashtag without the # symbol
        const hashtag = match.substring(1);
        
        // Add the hashtag as a clickable element - searchNostr now updates currentQuery internally
        elements.push(
          <button 
            key={`hashtag-${offset}`}
            onClick={() => handleHashtagClick(hashtag)}
            className="text-blue-400 hover:text-blue-300 hover:underline transition-colors duration-200 cursor-pointer font-semibold"
          >
            #{hashtag}
          </button>
        );
      }
      
      // Update the last index
      lastIndex = offset + match.length;
      
      return match; // This return value isn't used
    });
    
    // Add any remaining text after the last match
    if (lastIndex < processedContent.length) {
      elements.push(
        <span key={`text-end`}>
          {processedContent.substring(lastIndex)}
        </span>
      );
    }
    
    return <>{elements}</>;
  };

  // Function to render media content
  const renderMedia = (event: NDKEvent) => {
    if (!event.content) return null;
    
    const media = parseMediaContent(event.content);
    
    return (
      <>
        {/* Render images */}
        {media.images.length > 0 && (
          <div className="mt-3 space-y-2">
            {media.images.map((imgUrl, idx) => (
              <div key={`img-${idx}`} className="rounded-lg overflow-hidden bg-black/30 border border-purple-500/30">
                <a href={imgUrl} target="_blank" rel="noopener noreferrer">
                  <img 
                    src={imgUrl} 
                    alt="Embedded media" 
                    className="max-h-80 max-w-full object-contain mx-auto"
                    onError={(e) => {
                      // Hide image on error
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </a>
              </div>
            ))}
          </div>
        )}
        
        {/* Render videos */}
        {media.videos.length > 0 && (
          <div className="mt-3 space-y-2">
            {media.videos.map((videoUrl, idx) => (
              <div key={`video-${idx}`} className="rounded-lg overflow-hidden bg-black/30 border border-purple-500/30">
                <video 
                  src={videoUrl} 
                  controls 
                  className="max-h-80 max-w-full mx-auto"
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            ))}
          </div>
        )}
        
        {/* Render YouTube embeds */}
        {media.youtubeEmbeds.length > 0 && (
          <div className="mt-3 space-y-2">
            {media.youtubeEmbeds.map((videoId, idx) => (
              <div key={`yt-${idx}`} className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden bg-black/30 border border-purple-500/30">
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}`}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                ></iframe>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  // Function to detect SHA256 hashes in content
  const detectSha256Hashes = (content: string): string[] => {
    if (!content) return [];
    
    // SHA256 hashes are 64 characters long and consist of hexadecimal characters
    const sha256Regex = /\b([a-f0-9]{64})\b/gi;
    const matches = content.match(sha256Regex);
    
    return matches || [];
  };
  
  // Function to convert SHA256 hash to a hex color (first 6 chars)
  const hashToColor = (hash: string): string => {
    // Take the first 6 characters of the hash as a color
    return `#${hash.substring(0, 6)}`;
  };
  
  // Function to render color squares for SHA256 hashes
  const renderHashColors = (content: string) => {
    const hashes = detectSha256Hashes(content);
    
    if (hashes.length === 0) return null;
    
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {hashes.map((hash, index) => {
          const color = hashToColor(hash);
          return (
            <div
              key={`hash-${index}`}
              className="relative group"
            >
              <button
                onClick={() => handleHashClick(hash)}
                className="w-6 h-6 border rounded border-gray-600 shadow-sm cursor-pointer transition-transform hover:scale-110"
                style={{ backgroundColor: color }}
                aria-label={`Search for SHA256 hash: ${hash}`}
              />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-xs font-mono rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 border border-purple-500/30">
                <div>{color}</div>
                <div className="truncate max-w-56">{hash}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto my-8">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center p-4 cyber-border rounded-lg">
          <div className="text-purple-400 font-mono">
            {displayResults.length} {displayResults.length === 1 ? 'RESULT' : 'RESULTS'}
          </div>
          {hasActiveSearch && (
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
            >
              <ShareIcon className="h-4 w-4" />
              SHARE
            </button>
          )}
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="web-of-trust"
                checked={useWebOfTrust}
                onChange={(e) => setUseWebOfTrust(e.target.checked)}
                className="w-4 h-4 text-purple-600 bg-black border-purple-500 rounded focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-black"
              />
              <label htmlFor="web-of-trust" className="text-sm text-purple-400 font-mono">
                Web of Trust
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="show-only-my-stuff"
                checked={showOnlyMyStuff}
                onChange={(e) => setShowOnlyMyStuff(e.target.checked)}
                className="w-4 h-4 text-purple-600 bg-black border-purple-500 rounded focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-black"
              />
              <label htmlFor="show-only-my-stuff" className="text-sm text-purple-400 font-mono">
                Show only my stuff
              </label>
            </div>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'oldest')}
            className="px-4 py-2 bg-black border border-purple-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="recent">Most Recent</option>
            <option value="oldest">Oldest First</option>
          </select>
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
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center">
                  {/* Profile picture */}
                  <div className="mr-3">
                    {getProfilePicture(event) ? (
                      <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-purple-500/50 shadow-lg shadow-purple-900/30 bg-black">
                        {(() => {
                          const profileUrl = getProfileUrl(event);
                          return profileUrl ? (
                            <a href={profileUrl} target="_blank" rel="noopener noreferrer" title="View profile on nosta.me">
                              <img 
                                src={getProfilePicture(event) || ''} 
                                alt={getAuthorName(event)} 
                                className="w-full h-full object-cover hover:opacity-80 transition-opacity duration-200"
                                onError={(e) => {
                                  // If image fails to load, show fallback
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.classList.add('flex', 'items-center', 'justify-center', 'bg-purple-900/30');
                                    parent.innerHTML = `<span class="text-purple-300 text-sm font-mono">${getAuthorName(event).slice(0, 2).toUpperCase()}</span>`;
                                  }
                                }}
                              />
                            </a>
                          ) : (
                            <img 
                              src={getProfilePicture(event) || ''} 
                              alt={getAuthorName(event)} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // If image fails to load, show fallback
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.classList.add('flex', 'items-center', 'justify-center', 'bg-purple-900/30');
                                  parent.innerHTML = `<span class="text-purple-300 text-sm font-mono">${getAuthorName(event).slice(0, 2).toUpperCase()}</span>`;
                                }
                              }}
                            />
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg border-2 border-purple-500/50 shadow-lg shadow-purple-900/30 flex items-center justify-center bg-purple-900/30">
                        {(() => {
                          const profileUrl = getProfileUrl(event);
                          return profileUrl ? (
                            <a href={profileUrl} target="_blank" rel="noopener noreferrer" title="View profile on nosta.me">
                              <UserCircleIcon className="w-6 h-6 text-purple-300 hover:text-purple-400 transition-colors duration-200" />
                            </a>
                          ) : (
                            <UserCircleIcon className="w-6 h-6 text-purple-300" />
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="font-medium text-purple-400 font-mono flex items-center gap-1">
                      {(() => {
                        const profileUrl = getProfileUrl(event);
                        const authorName = getAuthorName(event);
                        return profileUrl ? (
                          <a 
                            href={profileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="max-w-[200px] truncate hover:text-purple-300 transition-colors duration-200"
                            title="View profile on nosta.me"
                          >
                            {authorName}
                          </a>
                        ) : (
                          <span className="max-w-[200px] truncate">{authorName}</span>
                        );
                      })()}
                      {renderVerificationStatus(event)}
                    </div>
                    <div className="text-xs text-purple-300 font-mono flex items-center">
                      <span className="inline-block w-2 h-2 bg-purple-500 mr-2"></span>
                      {getNoteType(event)}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-400 font-mono">
                  {(() => {
                    const noteUrl = getNoteUrl(event);
                    if (typeof noteUrl === 'string') {
                      return (
                        <a 
                          href={noteUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:text-purple-400 transition-colors duration-200"
                          title="View on njump.me"
                        >
                          {getTimeAgo(event)}
                        </a>
                      );
                    } else {
                      return getTimeAgo(event);
                    }
                  })()}
                </div>
              </div>
              
              {/* Warning for unverified users - don't show for YOUR_NOTE */}
              {!isNip05Verified(event) && !getNip05Name(event) && user?.pubkey !== event.pubkey && (
                <div className="mb-3 p-2 border border-red-500/30 bg-red-900/20 rounded flex items-center text-sm">
                  <ShieldExclamationIcon className="w-5 h-5 text-red-400 mr-2 flex-shrink-0" />
                  <span className="text-red-300 font-mono text-xs">WARNING: UNVERIFIED USER - POTENTIAL SCAMMER. VERIFY IDENTITY BEFORE TRUSTING CONTENT.</span>
                </div>
              )}
              
              <div className="text-gray-300 font-light whitespace-pre-wrap break-words bg-black/20 p-3 rounded">
                {renderContent(event.content)}
              </div>
              
              {/* Render inline media content */}
              {renderMedia(event)}
              
              {/* Render SHA256 hash color squares if present */}
              {renderHashColors(event.content)}
              
              {event.tags?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {event.tags
                    .filter((tag: string[]) => tag[0] === 't')
                    .map((tag: string[], i: number) => (
                      <button 
                        key={i} 
                        onClick={() => handleTagClick(tag)}
                        className="inline-block bg-purple-900/30 border border-purple-500/30 rounded-md px-3 py-0.5 text-xs font-mono text-purple-300 cursor-pointer hover:bg-purple-800/40 hover:border-purple-400/40 transition-colors duration-200"
                      >
                        #{tag[1]}
                      </button>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Main component with Suspense boundary
export default function SearchResults() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-2xl mx-auto my-8">
        <div className="flex flex-col items-center justify-center p-4 cyber-border rounded-lg">
          <div className="cyber-spinner mb-2">
            <div className="cyber-spinner-polygon"></div>
            <div className="cyber-spinner-polygon"></div>
          </div>
          <p className="text-purple-400 font-mono text-sm">LOADING...</p>
        </div>
      </div>
    }>
      <SearchResultsContent />
    </Suspense>
  );
} 